import type { ProjectId } from "@slopstop/protocol";
import { Context, Effect, Layer, Semaphore } from "effect";
import { type PermitLock, withPermit } from "./permit-lock.js";
import type { ProjectStorageStoreDependencies } from "./project-storage-store.js";

type ProjectPermitEntry = { semaphore: PermitLock; users: number };

type ProjectPermits = Map<ProjectId, ProjectPermitEntry>;

/** A Project's permit, counted as used by one caller until `release` runs. */
type RetainedProjectPermit = Readonly<{ permit: PermitLock; release: Effect.Effect<void> }>;

/** Gets or creates the Project's permit entry and counts one more user, in one synchronous step. */
function retainProjectPermit(permits: ProjectPermits, projectId: ProjectId): ProjectPermitEntry {
  let entry = permits.get(projectId);
  if (entry === undefined) {
    entry = { semaphore: Semaphore.makeUnsafe(1), users: 0 };
    permits.set(projectId, entry);
  }
  entry.users += 1;
  return entry;
}

/** Counts one user less and forgets the entry once it is unused and still the current one. */
function releaseProjectPermit(
  permits: ProjectPermits,
  projectId: ProjectId,
  entry: ProjectPermitEntry,
): void {
  entry.users -= 1;
  if (entry.users === 0 && permits.get(projectId) === entry) {
    permits.delete(projectId);
  }
}

/** The create permit and the per-Project permits of one Project Storage adapter. */
export class ProjectStorageLocks extends Context.Service<ProjectStorageLocks>()(
  "harness/ProjectStorageLocks",
  {
    make: Effect.gen(function* () {
      const createPermit = yield* Semaphore.make(1);
      const projectPermits: ProjectPermits = new Map();
      const retainProject = (projectId: ProjectId) =>
        Effect.sync((): RetainedProjectPermit => {
          const entry = retainProjectPermit(projectPermits, projectId);
          return {
            permit: entry.semaphore,
            release: Effect.sync(() => releaseProjectPermit(projectPermits, projectId, entry)),
          };
        });
      return {
        // The raw permits serve the temporary Promise facade below (#123).
        createPermit,
        retainProject,
        forCreate: <A, E>(effect: Effect.Effect<A, E>) => createPermit.withPermits(1)(effect),
        // Queues behind every create already waiting for or holding the create permit.
        afterCreateDrain: <E>(effect: Effect.Effect<void, E>) =>
          createPermit.withPermits(1)(effect),
        forProject: <A, E>(projectId: ProjectId, effect: Effect.Effect<A, E>) =>
          Effect.acquireUseRelease(
            retainProject(projectId),
            (retained) => retained.permit.withPermits(1)(effect),
            (retained) => retained.release,
          ),
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}

/**
 * Temporary Promise facade over one service value for the store's Promise callers; delete it
 * once those callers are Effects (#123).
 *
 * It runs each operation through {@link withPermit}: the permit is taken through Effect and
 * released with `runSync`, which hands it to the next waiter before any later caller can take
 * it. Released inside a `runPromise` fiber, effect's Semaphore wakes waiters on a later task,
 * so a caller arriving in between would overtake them.
 */
export function createProjectStorageLocksFacade(): ProjectStorageStoreDependencies["locks"] {
  const locks = Effect.runSync(ProjectStorageLocks.make);
  return {
    forCreate: (operation) => withPermit(locks.createPermit, operation),
    afterCreateDrain: (operation) => withPermit(locks.createPermit, operation),
    forProject: (projectId, operation) => {
      const retained = Effect.runSync(locks.retainProject(projectId));
      return withPermit(retained.permit, operation).finally(() => Effect.runSync(retained.release));
    },
  };
}
