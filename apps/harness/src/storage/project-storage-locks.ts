import type { ProjectId } from "@slopstop/protocol";
import { Context, Effect, Layer } from "effect";
import { createPermitLock, type PermitLock, withPermit, withPermitEffect } from "./permit-lock.js";
import type { ProjectStorageStoreDependencies } from "./project-storage-store.js";

type ProjectPermitEntry = { permit: PermitLock; users: number };

type ProjectPermits = Map<ProjectId, ProjectPermitEntry>;

/** A Project's permit, counted as used by one caller until `release` runs. */
type RetainedProjectPermit = Readonly<{ permit: PermitLock; release: () => void }>;

/** Gets or creates the Project's permit entry and counts one more user, in one synchronous step. */
function retainProjectPermit(permits: ProjectPermits, projectId: ProjectId): ProjectPermitEntry {
  let entry = permits.get(projectId);
  if (entry === undefined) {
    entry = { permit: createPermitLock(), users: 0 };
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

/** The locks behind one service value or one Promise facade. */
function createLockSet() {
  const createPermit = createPermitLock();
  const projectPermits: ProjectPermits = new Map();
  // Each retain is released exactly once by its caller.
  const retainProject = (projectId: ProjectId): RetainedProjectPermit => {
    const entry = retainProjectPermit(projectPermits, projectId);
    return {
      permit: entry.permit,
      release: () => releaseProjectPermit(projectPermits, projectId, entry),
    };
  };
  return { createPermit, retainProject };
}

/** The create permit and the per-Project permits of one Project Storage adapter. */
export class ProjectStorageLocks extends Context.Service<ProjectStorageLocks>()(
  "harness/ProjectStorageLocks",
  {
    make: Effect.sync(() => {
      const { createPermit, retainProject } = createLockSet();
      return {
        forCreate: <A, E>(effect: Effect.Effect<A, E>) => withPermitEffect(createPermit)(effect),
        // Queues behind every create already waiting for or holding the create permit.
        afterCreateDrain: <E>(effect: Effect.Effect<void, E>) =>
          withPermitEffect(createPermit)(effect),
        forProject: <A, E>(projectId: ProjectId, effect: Effect.Effect<A, E>) =>
          Effect.acquireUseRelease(
            Effect.sync(() => retainProject(projectId)),
            (retained) => withPermitEffect(retained.permit)(effect),
            (retained) => Effect.sync(retained.release),
          ),
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}

/**
 * Temporary Promise facade over one lock set for the store's Promise callers; delete it
 * once those callers are Effects (#123).
 */
export function createProjectStorageLocksFacade(): ProjectStorageStoreDependencies["locks"] {
  const { createPermit, retainProject } = createLockSet();
  return {
    forCreate: (operation) => withPermit(createPermit, operation),
    afterCreateDrain: (operation) => withPermit(createPermit, operation),
    forProject: (projectId, operation) => {
      const retained = retainProject(projectId);
      return withPermit(retained.permit, operation).finally(retained.release);
    },
  };
}
