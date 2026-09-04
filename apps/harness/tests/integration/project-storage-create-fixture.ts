import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { MessageChannel, type MessagePort } from "node:worker_threads";
import {
  CanonicalDatabaseLineageIdSchema,
  createProjectCloseCommand,
  createProjectCreateCommand,
  createProjectOpenCommand,
  type ProjectStorageCloseRequest,
  type ProjectStorageCreateRequest,
  ProjectStorageCreateRequestSchema,
  type ProjectStorageOpenRequest,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "@slopstop/protocol";
import { afterEach } from "vitest";
import {
  createProjectStorageApplication,
  createUnavailableWorkspaceApplication,
  type HarnessTransport,
  type ProjectStorageApplication,
  startHarnessRuntime,
} from "../../src/index.js";
import {
  createNodeProjectStorageDependencies,
  type NodeProjectStorageOptions,
} from "../../src/storage/project-storage-node-adapters.js";
import {
  type CreationCheckpoint,
  createProjectStorageOwner,
} from "../../src/storage/project-storage-store.js";

export const checkedInMigrationRoot = path.resolve(import.meta.dirname, "../../drizzle");
export const projectStorageIntegrationTimeout = 15_000;
const temporaryRoots: string[] = [];
export const createRequest = ProjectStorageCreateRequestSchema.parse({
  projectId: "00000000-0000-4000-8000-000000000010",
  createRequestId: "00000000-0000-4000-8000-000000000011",
});
export const fixedCreationIds = {
  storageId: StorageIdSchema.parse("00000000-0000-4000-8000-000000000012"),
  locationId: "00000000-0000-4000-8000-000000000013",
  generationId: StorageGenerationIdSchema.parse("00000000-0000-4000-8000-000000000014"),
  canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema.parse(
    "00000000-0000-4000-8000-000000000015",
  ),
  runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema.parse(
    "00000000-0000-4000-8000-000000000016",
  ),
} as const;
export const expectedCreatedResult = {
  status: "created" as const,
  request: createRequest,
  mode: "read-write" as const,
  identity: {
    storageId: fixedCreationIds.storageId,
    generationId: fixedCreationIds.generationId,
    canonicalDatabaseLineageId: fixedCreationIds.canonicalDatabaseLineageId,
    runtimeDatabaseLineageId: fixedCreationIds.runtimeDatabaseLineageId,
  },
};

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 50,
      }),
    ),
  );
});

export async function createTemporaryApplicationRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-project-storage-"));
  temporaryRoots.push(root);
  return root;
}

export function transportFor(port: MessagePort): HarnessTransport {
  return {
    send: (message) => port.postMessage(message),
    subscribe(listener) {
      port.on("message", listener);
      return () => port.off("message", listener);
    },
  };
}

function nextMessage(port: MessagePort): Promise<unknown> {
  return new Promise((resolve) => port.once("message", resolve));
}

type StorageRuntimeOptions = Readonly<{
  failAt?: CreationCheckpoint;
  onCheckpoint?: (checkpoint: CreationCheckpoint) => Promise<void> | void;
  migrationResourcesRoot?: string;
  onIdentityAllocation?: () => void;
  clockNow?: () => string;
  initializeApplicationClient?: NodeProjectStorageOptions["initializeApplicationClient"];
  openProjectDatabaseClient?: NodeProjectStorageOptions["openProjectDatabaseClient"];
}>;

function allocated<Value>(value: Value, onIdentityAllocation: (() => void) | undefined): Value {
  onIdentityAllocation?.();
  return value;
}

async function projectStorageApplicationForRoot(
  root: string,
  options: StorageRuntimeOptions = {},
): Promise<ProjectStorageApplication> {
  const dependencies = createNodeProjectStorageDependencies({
    applicationStorageRoot: root,
    migrationResourcesRoot: options.migrationResourcesRoot ?? checkedInMigrationRoot,
    applicationVersion: "0.0.0",
    ...(options.initializeApplicationClient === undefined
      ? {}
      : { initializeApplicationClient: options.initializeApplicationClient }),
    ids: {
      storageId: () => allocated(fixedCreationIds.storageId, options.onIdentityAllocation),
      locationId: () => allocated(fixedCreationIds.locationId, options.onIdentityAllocation),
      generationId: () => allocated(fixedCreationIds.generationId, options.onIdentityAllocation),
      canonicalLineageId: () =>
        allocated(fixedCreationIds.canonicalDatabaseLineageId, options.onIdentityAllocation),
      runtimeLineageId: () =>
        allocated(fixedCreationIds.runtimeDatabaseLineageId, options.onIdentityAllocation),
    },
    clock: { now: options.clockNow ?? (() => "2026-08-31T12:00:00.000Z") },
    failures: {
      checkpoint: async (checkpoint) => {
        await options.onCheckpoint?.(checkpoint);
        if (checkpoint === options.failAt) throw new Error(`Injected failure at ${checkpoint}.`);
      },
    },
    ...(options.openProjectDatabaseClient === undefined
      ? {}
      : { openProjectDatabaseClient: options.openProjectDatabaseClient }),
  });
  return createProjectStorageApplication(createProjectStorageOwner(dependencies));
}

export async function createStorageRuntimeForRoot(
  root: string,
  options: StorageRuntimeOptions = {},
) {
  const { port1, port2 } = new MessageChannel();
  let generatedId = 100;
  const stopRuntime = startHarnessRuntime({
    transport: transportFor(port1),
    workspaceApplication: createUnavailableWorkspaceApplication(),
    projectStorageApplication: await projectStorageApplicationForRoot(root, options),
    harnessVersion: "0.0.0",
    createId: () => `00000000-0000-4000-8000-${String(generatedId++).padStart(12, "0")}`,
    now: () => "2026-08-31T12:00:01.000Z",
  });
  const send = (message: unknown): Promise<unknown> => {
    const response = nextMessage(port2);
    port2.postMessage(message);
    return response;
  };
  return {
    open: (request: ProjectStorageOpenRequest) =>
      send(
        createProjectOpenCommand(
          {
            messageId: "00000000-0000-4000-8000-000000000098",
            sentAt: "2026-08-31T12:00:00.000Z",
          },
          request,
        ),
      ),
    create: (request: ProjectStorageCreateRequest) =>
      send(
        createProjectCreateCommand(
          {
            messageId: "00000000-0000-4000-8000-000000000099",
            sentAt: "2026-08-31T12:00:00.000Z",
          },
          request,
        ),
      ),
    close: (request: ProjectStorageCloseRequest) =>
      send(
        createProjectCloseCommand(
          {
            messageId: "00000000-0000-4000-8000-000000000097",
            sentAt: "2026-08-31T12:00:00.000Z",
          },
          request,
        ),
      ),
    async stop(): Promise<void> {
      await stopRuntime();
      port1.close();
      port2.close();
    },
  };
}

export async function readRows(databasePath: string, sql: string) {
  const database = new DatabaseSync(databasePath);
  try {
    return database
      .prepare(sql)
      .all()
      .map((row) => Object.values(row));
  } finally {
    database.close();
  }
}

export async function sha256File(filePath: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await lstat(targetPath);
    return true;
  } catch (error) {
    if (typeof error !== "object") throw error;
    if (error === null) throw error;
    if (Reflect.get(error, "code") === "ENOENT") return false;
    throw error;
  }
}
