import { createHash, randomBytes, randomUUID } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  decodeStrict,
  HarnessBootstrapSchema,
  ProjectActivationIdSchema,
} from "@slopstop/protocol";
import { createActiveProjectCoordinator } from "./active-project-coordinator.js";
import { createCanonicalCommandRegistry } from "./canonical-command-registry.js";
import { createCanonicalProjectApplication } from "./canonical-project-application.js";
import {
  type HarnessTransport,
  type StopHarnessRuntime,
  startHarnessRuntime,
} from "./harness-runtime.js";
import { createProjectStorageApplication } from "./project-storage-application.js";
import { createApplicationDatabaseAuthority } from "./storage/application-database-authority.js";
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
  // One application database authority for every owner this harness composes.
  const applicationDatabase = createApplicationDatabaseAuthority({
    applicationStorageRoot,
    migrationResourcesRoot,
  });
  // It stops only after both consumers that can still admit work have stopped; a withheld
  // Storage stop keeps it alive with any uncertain transaction.
  let activeApplicationDatabaseConsumers = 2;
  const releaseApplicationDatabaseConsumer = async (): Promise<void> => {
    activeApplicationDatabaseConsumers -= 1;
    if (activeApplicationDatabaseConsumers === 0) await applicationDatabase.stop();
  };
  const projectStorageOwner = createProjectStorageOwner(
    createNodeProjectStorageDependencies({
      applicationStorageRoot,
      migrationResourcesRoot,
      applicationVersion: "0.0.0",
      applicationDatabase,
    }),
  );
  const projectStorageApplication = createProjectStorageApplication(projectStorageOwner);

  const now = () => new Date().toISOString();
  const coordinator = createActiveProjectCoordinator({
    validateTarget: createRegisteredProjectTargetValidation({
      applicationStorageRoot,
      migrationResourcesRoot,
      applicationDatabase,
    }),
    validateSession: createRegisteredProjectSessionValidation({
      applicationStorageRoot,
      migrationResourcesRoot,
      applicationDatabase,
    }),
    storage: projectStorageOwner,
    leases: createNodeCanonicalWriterLeaseFactory(),
    repositories: createCanonicalCommandRepositoryFactory({
      registry: createCanonicalCommandRegistry([]),
      createReceiptId: randomUUID,
      createEventId: randomUUID,
      now,
      openClient: (databasePath) => createWorkerLocalLibsqlClient(databasePath, "generation"),
      sha256Text: async (text) => createHash("sha256").update(text).digest("hex"),
      createHandoffId: randomUUID,
      createRecoveryRecordId: randomUUID,
    }),
    createActivationId: () => decodeStrict(ProjectActivationIdSchema, randomUUID()),
    createWriterToken: () =>
      decodeStrict(WriterCapabilityTokenSchema, randomBytes(32).toString("hex")),
    now,
  });
  const registrationOptions = {
    applicationStorageRoot,
    migrationResourcesRoot,
    applicationVersion: "0.0.0",
    applicationDatabase,
  };
  const registrationRegistry = createRegistrationRegistry(registrationOptions);
  const registration = createProjectRegistrationOwner(
    registrationRegistry,
    registrationOptions,
    applicationStorageRoot,
  );
  return startHarnessRuntime({
    projectListing: {
      list: async () => decodeStrict(ProjectListResultSchema, await registration.listProjects()),
      stop: async () => {
        try {
          const result = await registration.close();
          await registrationRegistry.stop();
          if (result.status !== "closed")
            throw new Error("Project listing cleanup is unconfirmed.");
        } finally {
          await releaseApplicationDatabaseConsumer();
        }
      },
    },
    transport: input.transport,
    canonicalProjectApplication: createCanonicalProjectApplication(coordinator),
    workspaceApplication: createUnavailableWorkspaceApplication(),
    projectStorageApplication: {
      ...projectStorageApplication,
      stop: async () => {
        await projectStorageApplication.stop();
        await releaseApplicationDatabaseConsumer();
      },
    },
    harnessVersion: "0.0.0",
    createId: randomUUID,
    now,
  });
}

import { ProjectListResultSchema } from "@slopstop/protocol";
import { createProjectRegistrationOwner } from "./registration/project-registration-owner.js";
import {
  createRegisteredProjectSessionValidation,
  createRegisteredProjectTargetValidation,
} from "./registration/registered-project-selection.js";
import { createRegistrationRegistry } from "./registration/registration-registry.js";
