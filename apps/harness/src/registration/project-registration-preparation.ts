import { randomUUID } from "node:crypto";
import { decodeStrict, isRegistryBrokenCode } from "@slopstop/protocol";
import { Duration, Effect, Result } from "effect";
import { untypedRejection } from "../effect-rejection.js";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { withWriteTransaction } from "../storage/project-storage-transaction.js";
import { sameExecutableIdentity } from "./executable-identity.js";
import type { IdentityQueryChildPort } from "./identity-query-child.js";
import { REGISTRATION_CLEANUP_BUDGET_MS } from "./observer-limits.js";
import { samePhysicalIdentity } from "./physical-identity.js";
import type { listRegisteredProjects } from "./project-listing.js";
import {
  type ConfirmationRequest,
  ConfirmationValidationRequestSchema,
  incomplete,
  type RegistrationBootstrap,
  readConfirmation,
  reserveConfirmation,
} from "./registration-confirmation-store.js";
import {
  insertProposal,
  type PrepareProjectRegistration,
  PrepareProjectRegistrationSchema,
  preparationFingerprint,
  preparedResult,
  type RegistrationProposalRecord,
  RegistrationProposalRecordSchema,
  readProposal,
} from "./registration-proposal-store.js";
import {
  type RegistrationDatabaseOptions,
  registrationClock,
  withRegistrationDatabase,
} from "./registry-database.js";
import { registryFailure } from "./registry-failure.js";
import { createRepositoryIdentityQueryOwner } from "./repository-identity-query-owner.js";
import type { IdentityQueryAdmissionPort, RepositoryTrustOwner } from "./repository-trust.js";

type Listing = (signal: AbortSignal) => ReturnType<typeof listRegisteredProjects>;

type Dependencies = Readonly<{
  registry: RepositoryTrustOwner;
  options: RegistrationDatabaseOptions;
  controlDirectory: string;
  child: IdentityQueryChildPort | undefined;
  bootstrap?: RegistrationBootstrap;
  listing?: Listing;
}>;

const pendingCleanup = {
  status: "pending-recovery",
  code: "OBSERVER_CLEANUP_UNCONFIRMED",
} as const;

async function observeProposal(
  dependencies: Dependencies,
  request: PrepareProjectRegistration,
  signal: AbortSignal,
) {
  let authority: Parameters<IdentityQueryAdmissionPort["admit"]>[0] | undefined;
  const registry: RepositoryTrustOwner = {
    ...dependencies.registry,
    admitRepositoryIdentityQueries: (input, port) =>
      dependencies.registry.admitRepositoryIdentityQueries(input, {
        admit: async (admitted) => {
          authority = admitted;
          await port.admit(admitted);
        },
      }),
  };
  const observer = createRepositoryIdentityQueryOwner(
    registry,
    dependencies.options,
    dependencies.controlDirectory,
    dependencies.child,
  );
  const inspect = async () => {
    const observation = await observer.inspectPhysicalIdentity(request.admission, signal);
    if (observation.status !== "physically-observed") return observation;
    const record = decodeStrict(RegistrationProposalRecordSchema, {
      request,
      authority,
      observation,
      proposalId: randomUUID(),
      preparedAt: registrationClock(dependencies.options).now(),
    });
    return { status: "captured" as const, record };
  };
  const result = await inspect().catch(registryFailure);
  const cleanup = await observer.close().catch(() => pendingCleanup);
  if (result.status === "pending-recovery" && result.code === "OBSERVER_CLEANUP_UNCONFIRMED") {
    return result;
  }
  return cleanup.status === "pending-recovery" ? cleanup : result;
}

function write<T>(
  options: RegistrationDatabaseOptions,
  operation: (transaction: LocalLibsqlTransaction) => Promise<T>,
) {
  return withRegistrationDatabase(
    options,
    (client) => withWriteTransaction(client, operation),
    "existing-only",
  );
}

async function prepare(dependencies: Dependencies, input: unknown, signal: AbortSignal) {
  try {
    const request = decodeStrict(PrepareProjectRegistrationSchema, input);
    const existing = await write(dependencies.options, (transaction) =>
      readProposal(transaction, request),
    );
    if (existing !== undefined) return preparedResult(existing);
    if (signal.aborted) return { status: "cancelled" } as const;
    const observed = await observeProposal(dependencies, request, signal);
    if (observed.status !== "captured") return observed;
    return await write(dependencies.options, async (transaction) => {
      const raced = await readProposal(transaction, request);
      if (raced !== undefined) return preparedResult(raced);
      if (signal.aborted) return { status: "cancelled" } as const;
      return insertProposal(transaction, observed.record);
    });
  } catch (error) {
    return registryFailure(error);
  }
}

/** Whether the confirmation names the saved proposal, by its id and its fingerprint. */
function isSavedProposal(
  saved: RegistrationProposalRecord | undefined,
  request: ConfirmationRequest,
): saved is RegistrationProposalRecord {
  return !(
    saved === undefined ||
    saved.proposalId !== request.proposalId ||
    preparationFingerprint(saved) !== request.proposalFingerprint
  );
}

/**
 * The refusal when a fresh observation no longer matches the saved proposal, or `undefined`.
 * The executable is compared first, then each physical directory.
 */
function identityRefusal(saved: RegistrationProposalRecord, observed: RegistrationProposalRecord) {
  if (
    !sameExecutableIdentity(
      saved.authority.executable.executableIdentity,
      observed.authority.executable.executableIdentity,
    )
  ) {
    return { status: "unavailable", code: "GIT_CONFIRMATION_REQUIRED" } as const;
  }
  if (
    !(["worktree", "gitDirectory", "commonDirectory"] as const).every((directory) => {
      return samePhysicalIdentity(
        saved.observation.physical[directory],
        observed.observation.physical[directory],
      );
    })
  )
    return { status: "rejected", code: "REPOSITORY_IDENTITY_CHANGED" } as const;
  return undefined;
}

// Internal pre-reservation validation. This result is neither a durable registration
// receipt nor a reusable creation grant. Confirmation publication still needs its owner.
async function inspectConfirmation(
  dependencies: Dependencies,
  input: unknown,
  signal: AbortSignal,
) {
  try {
    const request = decodeStrict(ConfirmationValidationRequestSchema, input);
    const saved = await write(dependencies.options, (transaction) =>
      readProposal(transaction, request.preparation),
    );
    if (!isSavedProposal(saved, request)) {
      return { status: "rejected", code: "REGISTRATION_IDEMPOTENCY_CONFLICT" } as const;
    }
    if (signal.aborted) return { status: "cancelled" } as const;
    const observed = await observeProposal(dependencies, saved.request, signal);
    if (observed.status !== "captured") return observed;
    const refusal = identityRefusal(saved, observed.record);
    if (refusal !== undefined) return refusal;
    return {
      status: "confirmation-observed" as const,
      request,
      saved,
      phaseId: observed.record.observation.phaseId,
    };
  } catch (error) {
    return registryFailure(error);
  }
}

async function validateConfirmation(
  dependencies: Dependencies,
  input: unknown,
  signal: AbortSignal,
) {
  const observed = await inspectConfirmation(dependencies, input, signal);
  if (observed.status !== "confirmation-observed") return observed;
  return {
    status: "confirmation-validated" as const,
    requestId: observed.request.requestId,
    proposalId: observed.saved.proposalId,
    proposalFingerprint: observed.request.proposalFingerprint,
  };
}

type Reserved = Extract<Awaited<ReturnType<typeof reserveConfirmation>>, { status: "reserved" }>;

/** The bootstrap a reservation runs: only a newly created one, and only before an abort. */
function bootstrapFor(dependencies: Dependencies, reserved: Reserved, signal: AbortSignal) {
  const runs = reserved.created && dependencies.bootstrap !== undefined && !signal.aborted;
  return runs ? dependencies.bootstrap : undefined;
}

/** Runs the reservation's bootstrap, or answers the stored confirmation. */
async function completeConfirmation(
  dependencies: Dependencies,
  request: ConfirmationRequest,
  reserved: Reserved,
  signal: AbortSignal,
) {
  const bootstrap = bootstrapFor(dependencies, reserved, signal);
  if (bootstrap !== undefined) {
    const creation: Promise<Awaited<ReturnType<RegistrationBootstrap>>> = bootstrap(
      reserved.reservation,
      reserved.request,
      signal,
    );
    return await creation;
  }
  return (
    (await write(dependencies.options, (transaction) => readConfirmation(transaction, request))) ??
    incomplete(request)
  );
}

async function confirm(dependencies: Dependencies, input: unknown, signal: AbortSignal) {
  try {
    const request = decodeStrict(ConfirmationValidationRequestSchema, input);
    const previous = await write(dependencies.options, (transaction) =>
      readConfirmation(transaction, request),
    );
    if (previous !== undefined) return previous;
    if (signal.aborted) return { status: "cancelled" } as const;
    const observed = await inspectConfirmation(dependencies, request, signal);
    if (observed.status !== "confirmation-observed") return observed;
    const reserved = await write(dependencies.options, (transaction) =>
      reserveConfirmation(transaction, observed, registrationClock(dependencies.options), signal),
    );
    if (reserved.status !== "reserved") return reserved;
    return await completeConfirmation(dependencies, request, reserved, signal);
  } catch (error) {
    return registryFailure(error);
  }
}

function bootstrapFailed(result: Awaited<ReturnType<RegistrationBootstrap>>): boolean {
  return result.status === "broken";
}

type OperationResult =
  | Awaited<ReturnType<typeof listProjects>>
  | Awaited<ReturnType<typeof prepare>>
  | Awaited<ReturnType<typeof confirm>>
  | Awaited<ReturnType<typeof validateConfirmation>>;

const pendingCreation = { status: "pending-recovery", code: "REGISTRATION_INCOMPLETE" } as const;
const pendingListing = { status: "broken", code: "INTERNAL_FAILURE" } as const;
type PendingClose = typeof pendingCleanup | typeof pendingCreation | typeof pendingListing;

/**
 * Whether a listing's own cleanup did not complete. Only the registry-data codes are answers
 * whose cleanup completed; every other broken code is unconfirmed (G19, #102).
 */
function listingCleanupFailed(result: Awaited<ReturnType<Listing>>): boolean {
  return result.status === "broken" && !isRegistryBrokenCode(result.code);
}

async function listProjects(dependencies: Dependencies, _input: unknown, signal: AbortSignal) {
  if (dependencies.listing === undefined) return pendingListing;
  return dependencies.listing(signal);
}

function cleanupUnconfirmed(result: Result.Result<OperationResult, unknown>): boolean {
  if (Result.isFailure(result)) return true;
  return (
    result.success.status === "pending-recovery" &&
    result.success.code === "OBSERVER_CLEANUP_UNCONFIRMED"
  );
}

// Waits for aborted work within the cleanup budget; work still running at the budget is
// reported through timeoutResult, never as closed.
function drainPreparations(
  work: Iterable<Promise<OperationResult>>,
  timeoutResult: () => PendingClose,
): Promise<PendingClose | Readonly<{ status: "closed" }>> {
  const settled = Effect.map(
    Effect.forEach(
      [...work],
      (pending) =>
        Effect.result(Effect.tryPromise({ try: () => pending, catch: untypedRejection })),
      { concurrency: "unbounded" },
    ),
    (results): PendingClose | Readonly<{ status: "closed" }> =>
      results.some(cleanupUnconfirmed) ? pendingCleanup : { status: "closed" },
  );
  return Effect.runPromise(
    Effect.timeoutOrElse(settled, {
      duration: Duration.millis(REGISTRATION_CLEANUP_BUDGET_MS),
      orElse: () => Effect.sync(timeoutResult),
    }),
  );
}

// Optional creation stays owned until its work and resource cleanup settle.
export function createProjectRegistrationPreparation(
  registry: RepositoryTrustOwner,
  options: RegistrationDatabaseOptions,
  controlDirectory: string,
  child?: IdentityQueryChildPort,
  bootstrap?: RegistrationBootstrap,
  listing?: Listing,
) {
  let closed = false;
  let unconfirmed: PendingClose | undefined;
  const bootstraps = { running: 0, pending: pendingCreation };
  const listings = { running: 0, pending: pendingListing };
  // Counts the running work and records its unconfirmed answer when its own failure test says so.
  const tracked =
    <Args extends unknown[], Answer>(
      counter: { running: number; pending: PendingClose },
      work: (...args: Args) => Promise<Answer>,
      failed: (result: Answer) => boolean,
    ) =>
    async (...args: Args): Promise<Answer> => {
      counter.running += 1;
      try {
        const result = await work(...args);
        if (failed(result)) unconfirmed ??= counter.pending;
        return result;
      } finally {
        counter.running -= 1;
      }
    };
  const trackedListing: Listing | undefined =
    listing === undefined ? undefined : tracked(listings, listing, listingCleanupFailed);
  const trackedBootstrap: RegistrationBootstrap | undefined =
    bootstrap === undefined ? undefined : tracked(bootstraps, bootstrap, bootstrapFailed);
  let closing: ReturnType<typeof drainPreparations> | undefined;
  const active = new Map<AbortController, Promise<OperationResult>>();
  const run = async (
    operation: typeof prepare | typeof validateConfirmation | typeof confirm | typeof listProjects,
    request: unknown,
  ) => {
    if (closed) return { status: "cancelled" } as const;
    const controller = new AbortController();
    const work = operation(
      {
        registry,
        options,
        controlDirectory,
        child,
        ...(trackedBootstrap === undefined ? {} : { bootstrap: trackedBootstrap }),
        ...(trackedListing === undefined ? {} : { listing: trackedListing }),
      },
      request,
      controller.signal,
    );
    active.set(controller, work);
    try {
      const result = await work;
      if (result.status === "pending-recovery" && result.code === "OBSERVER_CLEANUP_UNCONFIRMED")
        unconfirmed ??= pendingCleanup;
      // Publication is fenced after commit acknowledgement too. A committed proposal
      // remains historical replay authority; cancellation never erases durable history.
      if (
        (result.status === "prepared" ||
          result.status === "confirmation-validated" ||
          result.status === "registered" ||
          result.status === "listed") &&
        controller.signal.aborted
      )
        return { status: "cancelled" } as const;
      return result;
    } finally {
      active.delete(controller);
    }
  };
  return {
    listProjects: () => run(listProjects, undefined),
    confirm: (request: unknown) => run(confirm, request),
    prepare: (request: unknown) => run(prepare, request),
    validateConfirmation: (request: unknown) => run(validateConfirmation, request),
    close: () => {
      if (closing !== undefined) return closing;
      closed = true;
      for (const controller of active.keys()) controller.abort();
      closing = drainPreparations(active.values(), () =>
        bootstraps.running > 0
          ? pendingCreation
          : listings.running > 0
            ? pendingListing
            : pendingCleanup,
      ).then((result) => {
        return unconfirmed ?? result;
      });
      return closing;
    },
  };
}
