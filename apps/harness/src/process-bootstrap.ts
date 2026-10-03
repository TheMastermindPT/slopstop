import { createHash, randomBytes, randomUUID } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  decodeStrict,
  HarnessBootstrapSchema,
  ProjectActivationIdSchema,
} from "@slopstop/protocol";
import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { createActiveProjectCoordinator } from "./active-project-coordinator.js";
import { createCanonicalCommandRegistry } from "./canonical-command-registry.js";
import {
  type CanonicalProjectApplication,
  createCanonicalProjectApplication,
} from "./canonical-project-application.js";
import {
  type HarnessTransport,
  type StopHarnessRuntime,
  startHarnessRuntime,
} from "./harness-runtime.js";
import {
  createProjectStorageApplication,
  type ProjectStorageOwner,
} from "./project-storage-application.js";
import type { RegistrationRegistry } from "./registration/registration-registry.js";
import {
  type ApplicationDatabaseAuthority,
  createApplicationDatabaseAuthority,
} from "./storage/application-database-authority.js";
import {
  createCanonicalCommandRepositoryFactory,
  WriterCapabilityTokenSchema,
} from "./storage/canonical-command-repository.js";
import { createNodeCanonicalWriterLeaseFactory } from "./storage/canonical-writer-lease.js";
import { createWorkerLocalLibsqlClient } from "./storage/local-libsql-worker-client.js";
import { createNodeProjectStorageDependencies } from "./storage/project-storage-node-adapters.js";
import { createProjectStorageOwner } from "./storage/project-storage-store.js";
import { createUnavailableWorkspaceApplication } from "./workspace-application.js";

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function parentOf(root: string): string {
  const parent = path.dirname(root);
  if (parent === root) throw new Error("Harness bootstrap root has no existing ancestor.");
  return parent;
}

function physicalRoot(root: string): string {
  const missingSegments: string[] = [];
  let cursor = root;
  for (;;) {
    try {
      const entry = lstatSync(cursor);
      if (entry.isSymbolicLink()) {
        throw new Error("Harness bootstrap root must not be a symbolic link.");
      }
      return path.join(realpathSync.native(cursor), ...missingSegments.reverse());
    } catch (error: unknown) {
      if (!isMissingPathError(error)) throw error;
      missingSegments.push(path.basename(cursor));
      cursor = parentOf(cursor);
    }
  }
}

function trustedRoot(value: string): string {
  const root = path.resolve(fileURLToPath(value));
  if (!path.isAbsolute(root)) {
    throw new Error("Harness bootstrap root must resolve absolutely.");
  }
  return physicalRoot(root);
}

function rootsOverlap(first: string, second: string): boolean {
  const relative = path.relative(first, second);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

export function startHarnessProcessRuntime(
  input: Readonly<{
    bootstrap: unknown;
    transport: HarnessTransport;
  }>,
): StopHarnessRuntime {
  const bootstrap = decodeStrict(HarnessBootstrapSchema, input.bootstrap);
  const applicationStorageRoot = trustedRoot(bootstrap.applicationStorageRootUrl);
  const migrationResourcesRoot = trustedRoot(bootstrap.migrationResourcesRootUrl);
  if (
    rootsOverlap(applicationStorageRoot, migrationResourcesRoot) ||
    rootsOverlap(migrationResourcesRoot, applicationStorageRoot)
  ) {
    throw new Error("Harness bootstrap roots must not overlap.");
  }
  // One runtime per harness process builds the owners once, sharing one application
  // database authority. Their shutdown order stays explicit in the harness runtime.
  const runtime = ManagedRuntime.make(
    harnessServicesLayer({ applicationStorageRoot, migrationResourcesRoot }),
  );
  try {
    const services = runtime.runSync(
      Effect.gen(function* () {
        return {
          applicationDatabase: yield* ApplicationDatabase,
          projectStorage: yield* ProjectStorage,
          registration: yield* ProjectRegistration,
          canonicalProjects: yield* CanonicalProjects,
        };
      }),
    );
    const { registration } = services;
    const stopHarness = startHarnessRuntime({
      projectListing: {
        list: async () =>
          decodeStrict(ProjectListResultSchema, await registration.owner.listProjects()),
        stop: async () => {
          const result = await registration.owner.close();
          await registration.registry.stop();
          if (result.status !== "closed")
            throw new Error("Project listing cleanup is unconfirmed.");
        },
      },
      applicationDatabase: services.applicationDatabase,
      transport: input.transport,
      canonicalProjectApplication: services.canonicalProjects,
      workspaceApplication: createUnavailableWorkspaceApplication(),
      projectStorageApplication: createProjectStorageApplication(services.projectStorage),
      harnessVersion: "0.0.0",
      createId: randomUUID,
      now: currentTime,
    });
    let disposal: Promise<void> | undefined;
    return () => {
      const stopped = stopHarness();
      disposal ??= stopped.finally(() => runtime.dispose());
      return disposal;
    };
  } catch (error) {
    void runtime.dispose();
    throw error;
  }
}

const currentTime = () => new Date().toISOString();

type HarnessRootPaths = Readonly<{
  applicationStorageRoot: string;
  migrationResourcesRoot: string;
}>;

class HarnessRoots extends Context.Service<HarnessRoots, HarnessRootPaths>()(
  "slopstop/harness/HarnessRoots",
) {}
class ApplicationDatabase extends Context.Service<
  ApplicationDatabase,
  ApplicationDatabaseAuthority
>()("slopstop/harness/ApplicationDatabase") {}
class ProjectStorage extends Context.Service<ProjectStorage, ProjectStorageOwner>()(
  "slopstop/harness/ProjectStorage",
) {}
class ProjectRegistration extends Context.Service<
  ProjectRegistration,
  Readonly<{
    registry: RegistrationRegistry;
    owner: ReturnType<typeof createProjectRegistrationOwner>;
  }>
>()("slopstop/harness/ProjectRegistration") {}
class CanonicalProjects extends Context.Service<CanonicalProjects, CanonicalProjectApplication>()(
  "slopstop/harness/CanonicalProjects",
) {}

const applicationDatabaseLayer = Layer.effect(
  ApplicationDatabase,
  Effect.gen(function* () {
    return createApplicationDatabaseAuthority(yield* HarnessRoots);
  }),
);

const projectStorageLayer = Layer.effect(
  ProjectStorage,
  Effect.gen(function* () {
    const roots = yield* HarnessRoots;
    return createProjectStorageOwner(
      createNodeProjectStorageDependencies({
        ...roots,
        applicationVersion: "0.0.0",
        applicationDatabase: yield* ApplicationDatabase,
      }),
    );
  }),
);

const projectRegistrationLayer = Layer.effect(
  ProjectRegistration,
  Effect.gen(function* () {
    const roots = yield* HarnessRoots;
    const options = {
      ...roots,
      applicationVersion: "0.0.0",
      applicationDatabase: yield* ApplicationDatabase,
    };
    const registry = createRegistrationRegistry(options);
    return {
      registry,
      owner: createProjectRegistrationOwner(registry, options, roots.applicationStorageRoot),
    };
  }),
);

const canonicalProjectsLayer = Layer.effect(
  CanonicalProjects,
  Effect.gen(function* () {
    const roots = yield* HarnessRoots;
    const applicationDatabase = yield* ApplicationDatabase;
    const registryOptions = { ...roots, applicationDatabase };
    const coordinator = createActiveProjectCoordinator({
      validateTarget: createRegisteredProjectTargetValidation(registryOptions),
      validateSession: createRegisteredProjectSessionValidation(registryOptions),
      storage: yield* ProjectStorage,
      leases: createNodeCanonicalWriterLeaseFactory(),
      repositories: createCanonicalCommandRepositoryFactory({
        registry: createCanonicalCommandRegistry([]),
        createReceiptId: randomUUID,
        createEventId: randomUUID,
        now: currentTime,
        openClient: (databasePath) => createWorkerLocalLibsqlClient(databasePath, "generation"),
        sha256Text: async (text) => createHash("sha256").update(text).digest("hex"),
        createHandoffId: randomUUID,
        createRecoveryRecordId: randomUUID,
      }),
      createActivationId: () => decodeStrict(ProjectActivationIdSchema, randomUUID()),
      createWriterToken: () =>
        decodeStrict(WriterCapabilityTokenSchema, randomBytes(32).toString("hex")),
      now: currentTime,
    });
    return createCanonicalProjectApplication(coordinator);
  }),
);

function harnessServicesLayer(roots: HarnessRootPaths) {
  return canonicalProjectsLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(projectStorageLayer, projectRegistrationLayer)),
    Layer.provideMerge(applicationDatabaseLayer),
    Layer.provideMerge(Layer.succeed(HarnessRoots, roots)),
  );
}

import { ProjectListResultSchema } from "@slopstop/protocol";
import { createProjectRegistrationOwner } from "./registration/project-registration-owner.js";
import {
  createRegisteredProjectSessionValidation,
  createRegisteredProjectTargetValidation,
} from "./registration/registered-project-selection.js";
import { createRegistrationRegistry } from "./registration/registration-registry.js";
