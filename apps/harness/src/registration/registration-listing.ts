import { decodeStrict, ProjectListResultSchema } from "@slopstop/protocol";
import { Effect, Result } from "effect";

type Closed = Readonly<{ status: string }>;

/** What the Project listing adapter owns: the registration owner, observer and registry. */
export type RegistrationListingPorts = Readonly<{
  owner: Readonly<{ listProjects(): Promise<unknown>; close(): Promise<Closed> }>;
  observer: Readonly<{ close(): Promise<Closed> }>;
  registry: Readonly<{ stop(): Promise<void> }>;
}>;

/** A registration part whose cleanup at stop was not confirmed. */
type CleanupPart = "registry" | "observer" | "listing";

/** Stop could not confirm every part's cleanup; each unconfirmed part is named. */
class RegistrationCleanupUnconfirmed extends Error {
  override readonly name = "RegistrationCleanupUnconfirmed";
  constructor(
    readonly parts: readonly CleanupPart[],
    options?: ErrorOptions,
  ) {
    super(`Project registration cleanup is unconfirmed: ${parts.join(", ")}.`, options);
  }
}

/**
 * Closes the owner and the observer, then stops the registry they share, collecting every
 * unconfirmed part as a value; a failed registry stop is the cause.
 */
function unconfirmedParts(registration: RegistrationListingPorts) {
  return Effect.gen(function* () {
    const listing = yield* Effect.promise(() => registration.owner.close());
    const observer = yield* Effect.promise(() => registration.observer.close());
    const registry = yield* Effect.result(
      Effect.tryPromise({ try: () => registration.registry.stop(), catch: (cause) => cause }),
    );
    const parts: CleanupPart[] = [];
    if (Result.isFailure(registry)) parts.push("registry");
    if (observer.status !== "closed") parts.push("observer");
    if (listing.status !== "closed") parts.push("listing");
    return { parts, cause: Result.isFailure(registry) ? registry.failure : undefined };
  });
}

// Listing and registration share the registry: it stops after the owner and the observer.
export function createRegistrationListing(registration: RegistrationListingPorts) {
  return {
    list: async () =>
      decodeStrict(ProjectListResultSchema, await registration.owner.listProjects()),
    /** Temporary Promise facade: throws once, naming every unconfirmed part. */
    stop: async () => {
      const { parts, cause } = await Effect.runPromise(unconfirmedParts(registration));
      if (parts.length === 0) return;
      throw new RegistrationCleanupUnconfirmed(parts, cause === undefined ? undefined : { cause });
    },
  };
}
