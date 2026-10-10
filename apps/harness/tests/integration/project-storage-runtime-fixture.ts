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
  decodeStrict,
  type ProjectStorageCloseRequest,
  type ProjectStorageCreateRequest,
  ProjectStorageCreateRequestIdSchema,
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
import { createProjectStorageOwner } from "../../src/storage/project-storage-store.js";
import { unusedCanonicalApplication } from "./canonical-runtime-application-fixture.js";

export const checkedInMigrationRoot = path.resolve(import.meta.dirname, "../../drizzle");
export const projectStorageIntegrationTimeout = 15_000;
/** A process logger for runtimes whose log lines no test reads. */
export const silentHarnessLogger = { info: () => undefined, warn: () => undefined } as const;
const temporaryRoots: string[] = [];
export const createRequest = decodeStrict(ProjectStorageCreateRequestSchema, {
  projectId: "00000000-0000-4000-8000-000000000010",
  createRequestId: "00000000-0000-4000-8000-000000000011",
});
export const fixedCreationIds = {
  storageId: decodeStrict(StorageIdSchema, "00000000-0000-4000-8000-000000000012"),
  locationId: "00000000-0000-4000-8000-000000000013",
  generationId: decodeStrict(StorageGenerationIdSchema, "00000000-0000-4000-8000-000000000014"),
  canonicalDatabaseLineageId: decodeStrict(
    CanonicalDatabaseLineageIdSchema,
    "00000000-0000-4000-8000-000000000015",
  ),
  runtimeDatabaseLineageId: decodeStrict(
    RuntimeDatabaseLineageIdSchema,
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

type StorageCheckpoint = Parameters<
  NonNullable<NodeProjectStorageOptions["failures"]>["checkpoint"]
>[0];
type StorageRuntimeOptions = Readonly<{
  failAt?: StorageCheckpoint;
  onCheckpoint?: (checkpoint: StorageCheckpoint) => Promise<void> | void;
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
      upgradeId: () => {
        throw new Error("Unexpected upgrade allocation.");
      },
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
    canonicalProjectApplication: unusedCanonicalApplication(async () => {
      throw new Error("Unexpected canonical Project switch in this fixture.");
    }),
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

export function switchDeferred<Value>() {
  let resolve: (value: Value) => void = () => {
    throw new Error("Deferred not initialized.");
  };
  let reject: (error: Error) => void = () => {
    throw new Error("Deferred not initialized.");
  };
  const promise = new Promise<Value>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
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

export const upgradeIds = {
  sourceGenerationId: fixedCreationIds.generationId,
  targetGenerationId: decodeStrict(
    StorageGenerationIdSchema,
    "00000000-0000-4000-8000-000000000024",
  ),
  upgradeId: decodeStrict(
    ProjectStorageCreateRequestIdSchema,
    "00000000-0000-4000-8000-0000000000a1",
  ),
} as const;
export const upgradeTimes = {
  created: "2026-08-31T12:00:00.000Z",
  started: "2026-10-05T10:00:00.000Z",
  activated: "2026-10-05T10:00:01.000Z",
} as const;

/** The ids of the second upgrade attempt (after an abandoned first one). */
export const retryUpgradeIds = {
  targetGenerationId: decodeStrict(
    StorageGenerationIdSchema,
    "00000000-0000-4000-8000-000000000034",
  ),
  upgradeId: decodeStrict(
    ProjectStorageCreateRequestIdSchema,
    "00000000-0000-4000-8000-0000000000a2",
  ),
} as const;

const attemptIds = { 1: upgradeIds, 2: retryUpgradeIds } as const;

/** The ids of a fourth upgrade, interrupted on a chain of three. */
export const fourthUpgradeIds = {
  targetGenerationId: decodeStrict(
    StorageGenerationIdSchema,
    "00000000-0000-4000-8000-000000000054",
  ),
  upgradeId: decodeStrict(
    ProjectStorageCreateRequestIdSchema,
    "00000000-0000-4000-8000-0000000000a4",
  ),
} as const;

/** The ids of a third upgrade (interrupted on a chain of two, or the third link). */
export const thirdUpgradeIds = {
  targetGenerationId: decodeStrict(
    StorageGenerationIdSchema,
    "00000000-0000-4000-8000-000000000044",
  ),
  upgradeId: decodeStrict(
    ProjectStorageCreateRequestIdSchema,
    "00000000-0000-4000-8000-0000000000a3",
  ),
} as const;

/** The instants of a later, chained upgrade (strictly after `upgradeTimes`). */
export const chainedUpgradeTimes = {
  started: "2026-10-09T10:00:00.000Z",
  activated: "2026-10-09T10:00:01.000Z",
} as const;

/** The instants of a third chained upgrade (strictly after `chainedUpgradeTimes`). */
export const thirdUpgradeTimes = {
  started: "2026-10-10T10:00:00.000Z",
  activated: "2026-10-10T10:00:01.000Z",
} as const;

type UpgradeInstants = Readonly<{ started: string; activated: string }>;

type UpgradeDiagnostics = NonNullable<NodeProjectStorageOptions["upgradeDiagnostics"]>;
type UpgradeDiagnosticEvent =
  | Readonly<{ kind: "abandoned"; event: Parameters<UpgradeDiagnostics["abandoned"]>[0] }>
  | Readonly<{ kind: "discardFailed"; event: Parameters<UpgradeDiagnostics["discardFailed"]>[0] }>;

export type UpgradeOwnerOptions = Readonly<{
  /** The attempt the first `upgrade` call makes (default 1); each call advances it. */
  attempt?: 1 | 2;
  /** Applies to attempt 1 only (a one-time failure). */
  failAt?: StorageCheckpoint;
  /** Applies to attempt 1 only. */
  onCheckpoint?: (checkpoint: StorageCheckpoint) => Promise<void> | void;
  /** Also receives every upgrade diagnostic the fixture records. */
  upgradeDiagnostics?: UpgradeDiagnostics;
  /** Attempt 1's target generation instead of `upgradeIds.targetGenerationId`. */
  targetGenerationId?: typeof upgradeIds.targetGenerationId;
  /** Attempt 1's upgrade id instead of `upgradeIds.upgradeId`. */
  upgradeId?: typeof upgradeIds.upgradeId;
  /** The instants every upgrade call reads (default `upgradeTimes`). */
  times?: UpgradeInstants;
  /** Another Storage's creation ids (default `fixedCreationIds`): a second Project in the root. */
  identity?: StorageCreationIds;
}>;

/** The ids a Storage's creation allocates. */
type StorageCreationIds = Readonly<{
  storageId: typeof fixedCreationIds.storageId;
  locationId: string;
  generationId: typeof fixedCreationIds.generationId;
  canonicalDatabaseLineageId: typeof fixedCreationIds.canonicalDatabaseLineageId;
  runtimeDatabaseLineageId: typeof fixedCreationIds.runtimeDatabaseLineageId;
}>;

/**
 * The raw Storage owner with fixed ids (the creation generation outside an upgrade, the
 * attempt's target generation and upgrade id inside one), a clock that answers the creation
 * time except while `upgrade` runs, where it answers exactly the two upgrade instants and
 * refuses any further read, and recorded upgrade diagnostics.
 */
export function createUpgradeStorageOwner(root: string, options: UpgradeOwnerOptions = {}) {
  let upgradeClock: string[] | undefined;
  let nextAttempt: 1 | 2 = options.attempt ?? 1;
  let running: 1 | 2 | undefined;
  const diagnostics: UpgradeDiagnosticEvent[] = [];
  const identity = options.identity ?? fixedCreationIds;
  const ids = {
    ...attemptIds,
    1: {
      ...upgradeIds,
      targetGenerationId: options.targetGenerationId ?? upgradeIds.targetGenerationId,
      upgradeId: options.upgradeId ?? upgradeIds.upgradeId,
    },
  };
  const current = () => ids[running ?? nextAttempt];
  const now = (): string => {
    if (upgradeClock === undefined) return upgradeTimes.created;
    const next = upgradeClock.shift();
    if (next === undefined) throw new Error("Unexpected Storage clock read during the upgrade.");
    return next;
  };
  const dependencies = createNodeProjectStorageDependencies({
    applicationStorageRoot: root,
    migrationResourcesRoot: checkedInMigrationRoot,
    applicationVersion: "0.0.0",
    ids: {
      storageId: () => identity.storageId,
      locationId: () => identity.locationId,
      generationId: () =>
        upgradeClock === undefined ? identity.generationId : current().targetGenerationId,
      canonicalLineageId: () => identity.canonicalDatabaseLineageId,
      runtimeLineageId: () => identity.runtimeDatabaseLineageId,
      upgradeId: () => current().upgradeId,
    },
    clock: { now },
    failures: {
      checkpoint: async (checkpoint) => {
        if (running !== 1) return;
        await options.onCheckpoint?.(checkpoint);
        if (checkpoint === options.failAt) throw new Error(`Injected failure at ${checkpoint}.`);
      },
    },
    upgradeDiagnostics: {
      abandoned: (event) => {
        diagnostics.push({ kind: "abandoned", event });
        options.upgradeDiagnostics?.abandoned(event);
      },
      discardFailed: (event) => {
        diagnostics.push({ kind: "discardFailed", event });
        options.upgradeDiagnostics?.discardFailed(event);
      },
    },
  });
  const owner = createProjectStorageOwner(dependencies);
  return {
    owner,
    diagnostics,
    upgrade: async (request: Parameters<typeof owner.upgrade>[0]) => {
      running = nextAttempt;
      nextAttempt = 2;
      const times = options.times ?? upgradeTimes;
      upgradeClock = [times.started, times.activated];
      try {
        return await owner.upgrade(request);
      } finally {
        upgradeClock = undefined;
        running = undefined;
      }
    },
  };
}
