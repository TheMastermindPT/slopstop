import { randomUUID } from "node:crypto";
import { decodeStrict } from "@slopstop/protocol";
import { Duration, Effect, Result } from "effect";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { withWriteTransaction } from "../storage/project-storage-transaction.js";
import { sameExecutableIdentity } from "./executable-identity.js";
import type { IdentityQueryChildPort } from "./identity-query-child.js";
import { REGISTRATION_CLEANUP_BUDGET_MS } from "./observer-limits.js";
import { samePhysicalIdentity } from "./physical-identity.js";
import type { listRegisteredProjects } from "./project-listing.js";
import {
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
  RegistrationProposalRecordSchema,
  readProposal,
} from "./registration-proposal-store.js";
import { type RegistrationDatabaseOptions, withRegistrationDatabase } from "./registry-database.js";
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
      preparedAt: new Date().toISOString(),
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

async function prepare(dependencies: Dependencies, input: unknown, signal: AbortSignal) {
  try {
    const request = decodeStrict(PrepareProjectRegistrationSchema, input);
    const write = <T>(operation: (transaction: LocalLibsqlTransaction) => Promise<T>) =>
      withRegistrationDatabase(
        dependencies.options,
        (client) => withWriteTransaction(client, operation),
        "existing-only",
      );
    const existing = await write((transaction) => readProposal(transaction, request));
    if (existing !== undefined) return preparedResult(existing);
    if (signal.aborted) return { status: "cancelled" } as const;
    const observed = await observeProposal(dependencies, request, signal);
    if (observed.status !== "captured") return observed;
    return await write(async (transaction) => {
      const raced = await readProposal(transaction, request);
      if (raced !== undefined) return preparedResult(raced);
      if (signal.aborted) return { status: "cancelled" } as const;
      return insertProposal(transaction, observed.record);
    });
  } catch (error) {
    return registryFailure(error);
  }
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
    const saved = await withRegistrationDatabase(
      dependencies.options,
      (client) =>
        withWriteTransaction(client, (transaction) =>
          readProposal(transaction, request.preparation),
        ),
      "existing-only",
    );
    if (
      saved === undefined ||
      saved.proposalId !== request.proposalId ||
      preparationFingerprint(saved) !== request.proposalFingerprint
    ) {
      return { status: "rejected", code: "REGISTRATION_IDEMPOTENCY_CONFLICT" } as const;
    }
    if (signal.aborted) return { status: "cancelled" } as const;
    const observed = await observeProposal(dependencies, saved.request, signal);
    if (observed.status !== "captured") return observed;
    if (
      !sameExecutableIdentity(
        saved.authority.executable.executableIdentity,
        observed.record.authority.executable.executableIdentity,
      )
    ) {
      return { status: "unavailable", code: "GIT_CONFIRMATION_REQUIRED" } as const;
    }
    if (
      !(["worktree", "gitDirectory", "commonDirectory"] as const).every((directory) => {
        return samePhysicalIdentity(
          saved.observation.physical[directory],
          observed.record.observation.physical[directory],
        );
      })
    )
      return { status: "rejected", code: "REPOSITORY_IDENTITY_CHANGED" } as const;
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

async function confirm(dependencies: Dependencies, input: unknown, signal: AbortSignal) {
  try {
    const request = decodeStrict(ConfirmationValidationRequestSchema, input);
    const write = <T>(operation: (transaction: LocalLibsqlTransaction) => Promise<T>) =>
      withRegistrationDatabase(
        dependencies.options,
        (client) => withWriteTransaction(client, operation),
        "existing-only",
      );
    const previous = await write((transaction) => readConfirmation(transaction, request));
    if (previous !== undefined) return previous;
    if (signal.aborted) return { status: "cancelled" } as const;
    const observed = await inspectConfirmation(dependencies, request, signal);
    if (observed.status !== "confirmation-observed") return observed;
    const reserved = await write((transaction) =>
      reserveConfirmation(transaction, observed, signal),
    );
    if (reserved.status !== "reserved") return reserved;
    if (reserved.created && dependencies.bootstrap !== undefined && !signal.aborted) {
      const creation: Promise<Awaited<ReturnType<RegistrationBootstrap>>> = dependencies.bootstrap(
        reserved.reservation,
        reserved.request,
        signal,
      );
      return await creation;
    }
    return (
      (await write((transaction) => readConfirmation(transaction, request))) ?? incomplete(request)
    );
  } catch (error) {
    return registryFailure(error);
  }
}

type OperationResult =
  | Awaited<ReturnType<typeof listProjects>>
  | Awaited<ReturnType<typeof prepare>>
  | Awaited<ReturnType<typeof confirm>>
  | Awaited<ReturnType<typeof validateConfirmation>>;

const pendingCreation = { status: "pending-recovery", code: "REGISTRATION_INCOMPLETE" } as const;
const pendingListing = { status: "broken", code: "INTERNAL_FAILURE" } as const;
type PendingClose = typeof pendingCleanup | typeof pendingCreation | typeof pendingListing;

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
        Effect.result(Effect.tryPromise({ try: () => pending, catch: (error) => error })),
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
  let activeBootstraps = 0;
  let activeListings = 0;
  const trackedListing: Listing | undefined =
    listing === undefined
      ? undefined
      : async (signal) => {
          activeListings += 1;
          try {
            const work: Promise<Awaited<ReturnType<Listing>>> = listing(signal);
            const result = await work;
            if (result.status === "broken") unconfirmed ??= pendingListing;
            return result;
          } finally {
            activeListings -= 1;
          }
        };
  const trackedBootstrap: RegistrationBootstrap | undefined =
    bootstrap === undefined
      ? undefined
      : async (...args) => {
          activeBootstraps += 1;
          try {
            const work: Promise<Awaited<ReturnType<RegistrationBootstrap>>> = bootstrap(...args);
            const result = await work;
            if (result.status === "broken") unconfirmed ??= pendingCreation;
            return result;
          } finally {
            activeBootstraps -= 1;
          }
        };
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
        activeBootstraps > 0
          ? pendingCreation
          : activeListings > 0
            ? pendingListing
            : pendingCleanup,
      ).then((result) => {
        if (result.status === "pending-recovery") unconfirmed ??= result;
        return unconfirmed ?? result;
      });
      return closing;
    },
  };
}
