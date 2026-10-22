import { decodeStrict, ProjectListResultSchema } from "@slopstop/protocol";
import { Data, Effect, Result } from "effect";
import { untypedRejection } from "../effect-rejection.js";
import { REGISTRATION_SHUTDOWN_CLEANUP_BUDGET_MS } from "./observer-limits.js";

type Closed = Readonly<{ status: string }>;

/** What the Project listing adapter owns: the registration owner, observer and registry. */
export type RegistrationListingPorts = Readonly<{
  owner: Readonly<{ listProjects(): Promise<unknown>; close(): Promise<Closed> }>;
  observer: Readonly<{ closeEffect: Effect.Effect<Closed> }>;
  registry: Readonly<{ stop(): Promise<void> }>;
}>;

/** The registration parts whose cleanup at stop can be unconfirmed, in reporting order. */
export const REGISTRATION_CLEANUP_PARTS = ["registry", "observer", "listing"] as const;

/** A registration part whose cleanup at stop was not confirmed. */
export type CleanupPart = (typeof REGISTRATION_CLEANUP_PARTS)[number];

/** The tag of the failure naming the unconfirmed cleanup parts. */
export const REGISTRATION_CLEANUP_TAG = "RegistrationCleanupUnconfirmed";

/** Stop could not confirm every part's cleanup; each unconfirmed part is named. */
class RegistrationCleanupUnconfirmed extends Data.TaggedError(REGISTRATION_CLEANUP_TAG)<{
  readonly message: string;
  readonly parts: readonly CleanupPart[];
  readonly cause?: unknown;
}> {}

/** The failure naming `parts`; it carries a cause only when there is one. */
function cleanupUnconfirmed(parts: readonly CleanupPart[], cause: unknown) {
  const message = `Project registration cleanup is unconfirmed: ${parts.join(", ")}.`;
  return new RegistrationCleanupUnconfirmed(
    cause === undefined ? { message, parts } : { message, parts, cause },
  );
}

/** What the cleanup chain has seen so far; an answer not yet seen counts as unconfirmed. */
type CleanupProgress = { listing?: Closed; observer?: Closed };

function unconfirmedParts(progress: CleanupProgress, registryUnconfirmed: boolean) {
  const parts: CleanupPart[] = [];
  if (registryUnconfirmed) parts.push("registry");
  if (progress.observer?.status !== "closed") parts.push("observer");
  if (progress.listing?.status !== "closed") parts.push("listing");
  return parts;
}

/**
 * Closes the owner and the observer, then stops the registry they share, all within one
 * shutdown budget. Out of budget, the part in progress is abandoned, no later part starts,
 * and every part not confirmed by then is named; a failed registry stop is the cause.
 */
function stopWithinBudget(registration: RegistrationListingPorts) {
  return Effect.suspend(() => {
    const progress: CleanupProgress = {};
    const chain = Effect.gen(function* () {
      progress.listing = yield* Effect.promise(() => registration.owner.close());
      progress.observer = yield* registration.observer.closeEffect;
      const registry = yield* Effect.result(
        Effect.tryPromise({ try: () => registration.registry.stop(), catch: untypedRejection }),
      );
      return Result.isFailure(registry)
        ? { parts: unconfirmedParts(progress, true), cause: registry.failure.cause }
        : { parts: unconfirmedParts(progress, false), cause: undefined };
    });
    return chain.pipe(
      Effect.timeoutOrElse({
        duration: REGISTRATION_SHUTDOWN_CLEANUP_BUDGET_MS,
        orElse: () => Effect.succeed({ parts: unconfirmedParts(progress, true), cause: undefined }),
      }),
      Effect.flatMap(({ parts, cause }) =>
        parts.length === 0 ? Effect.void : Effect.fail(cleanupUnconfirmed(parts, cause)),
      ),
    );
  });
}

// Listing and registration share the registry: it stops after the owner and the observer.
export function createRegistrationListing(registration: RegistrationListingPorts) {
  return {
    list: async () =>
      decodeStrict(ProjectListResultSchema, await registration.owner.listProjects()),
    stop: stopWithinBudget(registration),
  };
}
