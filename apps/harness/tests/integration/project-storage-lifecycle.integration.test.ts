import { MessageChannel, type MessagePort } from "node:worker_threads";
import {
  CanonicalDatabaseLineageIdSchema,
  createProjectCloseCommand,
  createProjectCreateCommand,
  createProjectOpenCommand,
  type ProjectId,
  type ProjectStorageCreateRequest,
  ProjectStorageOpenRequestSchema,
  parseHarnessMessage,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "@slopstop/protocol";
import { afterEach, expect, it, vi } from "vitest";
import {
  createProjectStorageApplication,
  createUnavailableWorkspaceApplication,
  startHarnessRuntime,
} from "../../src/index.js";
import { ProjectStorageUnavailableError } from "../../src/storage/project-storage-errors.js";
import { createNodeProjectStorageDependencies } from "../../src/storage/project-storage-node-adapters.js";
import {
  type ProjectStorageOpenEvidence,
  presentProjectDatabaseProbe,
} from "../../src/storage/project-storage-opening.js";
import {
  createProjectStorageOwner,
  type ProjectStorageStoreDependencies,
} from "../../src/storage/project-storage-store.js";
import {
  checkedInMigrationRoot,
  createRequest,
  createStorageRuntimeForRoot,
  createTemporaryApplicationRoot,
  expectedCreatedResult,
  fixedCreationIds,
  transportFor,
} from "./project-storage-create-fixture.js";

const projectA = ProjectStorageOpenRequestSchema.parse({
  projectId: "00000000-0000-4000-8000-000000000071",
}).projectId;
const projectB = ProjectStorageOpenRequestSchema.parse({
  projectId: "00000000-0000-4000-8000-000000000072",
}).projectId;
const identity = {
  storageId: StorageIdSchema.parse("00000000-0000-4000-8000-000000000073"),
  generationId: StorageGenerationIdSchema.parse("00000000-0000-4000-8000-000000000074"),
  canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema.parse(
    "00000000-0000-4000-8000-000000000075",
  ),
  runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema.parse(
    "00000000-0000-4000-8000-000000000076",
  ),
};
const healthyProbe = presentProjectDatabaseProbe({
  identityMatches: true,
  format: "current",
  migration: "current",
});

type OpeningEntry = readonly [
  ProjectId,
  ProjectStorageOpenEvidence | Promise<ProjectStorageOpenEvidence>,
];

const createBoundaries = [
  "declareStaging",
  "createCanonical",
  "createRuntime",
  "baseline",
  "manifest",
  "verifyStaged",
  "rename",
  "verifyActive",
  "activate",
] as const;
type CreateBoundary = (typeof createBoundaries)[number];
const createEventOrder = [
  "declareStaging",
  "projectDirectory",
  "createCanonical",
  "createRuntime",
  "baseline",
  "manifest",
  "verifyStaged",
  "rename",
  "verifyActive",
  "activate",
] as const;
type CreateEvent = (typeof createEventOrder)[number];

type ActiveRuntime = Readonly<{
  stop(): Promise<void>;
  closePorts(): void;
}>;

const activeRuntimes = new Set<ActiveRuntime>();
const openingStartedResolvers = new WeakMap<Promise<ProjectStorageOpenEvidence>, () => void>();

afterEach(async () => {
  const runtimes = [...activeRuntimes];
  activeRuntimes.clear();
  await Promise.allSettled(runtimes.map(({ stop }) => stop()));
  for (const runtime of runtimes) runtime.closePorts();
});

function unusedCanonicalApplication() {
  return {
    activate: async () => {
      throw new Error("Canonical activation is unused by this fixture.");
    },
    execute: async () => {
      throw new Error("Canonical command is unused by this fixture.");
    },
    stop: async () => undefined,
  };
}

function nextMessage(port: MessagePort, causationId: string): Promise<unknown> {
  return new Promise((resolve) => {
    const listener = (message: unknown) => {
      const parsed = parseHarnessMessage(message);
      if (!parsed.ok || parsed.value.causationId !== causationId) return;
      port.off("message", listener);
      resolve(parsed.value);
    };
    port.on("message", listener);
  });
}

function healthyOpeningEvidence(release: () => Promise<void>): ProjectStorageOpenEvidence {
  return {
    status: "selected-current",
    identity,
    canonical: healthyProbe,
    runtime: healthyProbe,
    release,
  };
}

function safeModeOpeningEvidence(release: () => Promise<void>): ProjectStorageOpenEvidence {
  return {
    status: "selected-current",
    identity,
    canonical: { status: "missing" },
    runtime: healthyProbe,
    release,
  };
}

function deferredOpeningEvidence() {
  let resolveEvidence: ((evidence: ProjectStorageOpenEvidence) => void) | undefined;
  let rejectEvidence: ((error: unknown) => void) | undefined;
  let resolveStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    resolveStarted = resolve;
  });
  const promise = new Promise<ProjectStorageOpenEvidence>((resolve, reject) => {
    resolveEvidence = resolve;
    rejectEvidence = reject;
  });
  if (resolveStarted === undefined) throw new Error("Opening start resolver was not initialized.");
  if (resolveEvidence === undefined) throw new Error("Opening resolver was not initialized.");
  if (rejectEvidence === undefined) throw new Error("Opening rejection was not initialized.");
  openingStartedResolvers.set(promise, resolveStarted);
  return { promise, started, resolve: resolveEvidence, reject: rejectEvidence };
}

type ShutdownSettlement =
  | Readonly<{ status: "resolved" }>
  | Readonly<{ status: "rejected"; error: unknown }>;

function settleShutdown(shutdown: Promise<void>): Promise<ShutdownSettlement> {
  return shutdown.then(
    () => ({ status: "resolved" }),
    (error: unknown) => ({ status: "rejected", error }),
  );
}

function expectShutdownFailure(
  settlement: ShutdownSettlement,
  expectedErrors: readonly unknown[],
): void {
  expect(settlement.status).toBe("rejected");
  if (settlement.status !== "rejected") {
    throw new Error("Expected Project Storage shutdown to reject.");
  }
  expect(settlement.error).toBeInstanceOf(AggregateError);
  if (!(settlement.error instanceof AggregateError)) {
    throw new Error("Expected Project Storage shutdown to fail with AggregateError.");
  }
  expect(settlement.error.message).toBe("Project Storage shutdown failed.");
  expect(settlement.error.errors).toEqual(expectedErrors);
}

function observeResolvingStop(stop: () => Promise<void>) {
  let settled = false;
  const stopPromise = stop();
  const repeatedStop = stop();
  const observedStop = stopPromise.then(() => {
    settled = true;
  });
  return {
    stopPromise,
    repeatedStop,
    observedStop,
    isSettled: () => settled,
  };
}

async function expectPostStopOperationsUnavailable(
  fixture: ReturnType<typeof createCreateBoundaryTransportFixture>,
): Promise<void> {
  const projectLockCount = fixture.projectLockCount();
  const outcomes = await Promise.all([
    fixture.application.create(createRequest),
    fixture.application.open({ projectId: createRequest.projectId }),
    fixture.application.close({ projectId: createRequest.projectId }),
  ]);
  expect(outcomes.map(({ status }) => status)).toEqual([
    "unavailable",
    "unavailable",
    "unavailable",
  ]);
  expect(fixture.projectLockCount()).toBe(projectLockCount);
}

function createBoundaryGate(boundary: CreateBoundary) {
  let markStarted: (() => void) | undefined;
  let releaseBoundary: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const released = new Promise<void>((resolve) => {
    releaseBoundary = resolve;
  });
  if (markStarted === undefined || releaseBoundary === undefined) {
    throw new Error("Create boundary gate was not initialized.");
  }
  const markBoundaryStarted = markStarted;
  const releaseHeldBoundary = releaseBoundary;
  const events: CreateEvent[] = [];
  let held = false;
  let wasReleased = false;

  return {
    events,
    started,
    async after<Result>(label: CreateEvent, operation: () => Promise<Result>): Promise<Result> {
      const result = await operation();
      events.push(label);
      if (label === boundary) {
        if (held) throw new Error(`Create boundary ${boundary} was entered more than once.`);
        held = true;
        markBoundaryStarted();
        await released;
      }
      return result;
    },
    release() {
      if (wasReleased) return;
      wasReleased = true;
      releaseHeldBoundary();
    },
  };
}

function createCreateBoundaryTransportFixture(
  applicationStorageRoot: string,
  boundary: CreateBoundary,
  registryStopError?: unknown,
) {
  const gate = createBoundaryGate(boundary);
  const baseDependencies = createNodeProjectStorageDependencies({
    applicationStorageRoot,
    migrationResourcesRoot: checkedInMigrationRoot,
    applicationVersion: "0.0.0",
    ids: {
      storageId: () => fixedCreationIds.storageId,
      locationId: () => fixedCreationIds.locationId,
      generationId: () => fixedCreationIds.generationId,
      canonicalLineageId: () => fixedCreationIds.canonicalDatabaseLineageId,
      runtimeLineageId: () => fixedCreationIds.runtimeDatabaseLineageId,
    },
    clock: { now: () => "2026-09-03T18:00:00.000Z" },
  });
  let baselineCompletions = 0;
  let verificationCount = 0;
  let projectLockCount = 0;
  const shutdownEvents: string[] = [];
  const afterBaselineObservation = async <Result>(
    operation: () => Promise<Result>,
  ): Promise<Result> => {
    const result = await operation();
    baselineCompletions += 1;
    return baselineCompletions === 4 ? gate.after("baseline", async () => result) : result;
  };
  const registryStop = vi.fn(async () => {
    shutdownEvents.push("registry-stop");
    await baseDependencies.registry.stop();
    if (registryStopError !== undefined) throw registryStopError;
  });
  const dependencies = {
    ...baseDependencies,
    hashes: {
      ...baseDependencies.hashes,
      sha256File: (filePath: string) =>
        afterBaselineObservation(() => baseDependencies.hashes.sha256File(filePath)),
    },
    registry: {
      ...baseDependencies.registry,
      declareStaging: (creation, paths) =>
        gate.after("declareStaging", () =>
          baseDependencies.registry.declareStaging(creation, paths),
        ),
      activate: (creation, paths) =>
        gate.after("activate", () => baseDependencies.registry.activate(creation, paths)),
      stop: registryStop,
    },
    files: {
      ...baseDependencies.files,
      createDirectoryExclusive: (directoryPath: string) =>
        gate.after("projectDirectory", () =>
          baseDependencies.files.createDirectoryExclusive(directoryPath),
        ),
      writeFileExclusive: (filePath: string, contents: string) =>
        gate.after("manifest", () => baseDependencies.files.writeFileExclusive(filePath, contents)),
      size: (filePath: string) =>
        afterBaselineObservation(() => baseDependencies.files.size(filePath)),
      renameAtomic: (source: string, destination: string) =>
        gate.after("rename", () => baseDependencies.files.renameAtomic(source, destination)),
    },
    databases: {
      ...baseDependencies.databases,
      createCanonical: (databasePath, creation) =>
        gate.after("createCanonical", () =>
          baseDependencies.databases.createCanonical(databasePath, creation),
        ),
      createRuntime: (databasePath, creation) =>
        gate.after("createRuntime", () =>
          baseDependencies.databases.createRuntime(databasePath, creation),
        ),
      verifySealed: async (paths, creation) => {
        await baseDependencies.databases.verifySealed(paths, creation);
        verificationCount += 1;
        const label = verificationCount === 1 ? "verifyStaged" : "verifyActive";
        await gate.after(label, async () => undefined);
      },
    },
    locks: {
      ...baseDependencies.locks,
      forCreate: <Result>(operation: () => Promise<Result>) =>
        baseDependencies.locks.forCreate(async () => {
          try {
            return await operation();
          } finally {
            shutdownEvents.push("create-operation-finished");
          }
        }),
      afterCreateDrain: (operation: () => Promise<void>) =>
        baseDependencies.locks.afterCreateDrain(async () => {
          shutdownEvents.push("after-create-drain-entered");
          await operation();
        }),
      forProject: <Result>(projectId: ProjectId, operation: () => Promise<Result>) => {
        projectLockCount += 1;
        return baseDependencies.locks.forProject(projectId, operation);
      },
    },
  } satisfies ProjectStorageStoreDependencies;
  const application = createProjectStorageApplication(createProjectStorageOwner(dependencies));
  const { port1, port2 } = new MessageChannel();
  let generatedId = 600;
  let commandId = 700;
  const stop = startHarnessRuntime({
    transport: transportFor(port1),
    canonicalProjectApplication: unusedCanonicalApplication(),
    workspaceApplication: createUnavailableWorkspaceApplication(),
    projectStorageApplication: application,
    harnessVersion: "0.0.0",
    createId: () => `00000000-0000-4000-8000-${String(generatedId++).padStart(12, "0")}`,
    now: () => "2026-09-03T18:00:01.000Z",
  });
  const runtime = {
    stop,
    closePorts: () => {
      port1.close();
      port2.close();
    },
  };
  activeRuntimes.add(runtime);

  return {
    application,
    events: gate.events,
    projectLockCount: () => projectLockCount,
    registryStop,
    shutdownEvents,
    started: gate.started,
    release: gate.release,
    create(request: ProjectStorageCreateRequest): Promise<unknown> {
      const metadata = {
        messageId: `00000000-0000-4000-8000-${String(commandId++).padStart(12, "0")}`,
        sentAt: "2026-09-03T18:00:00.000Z",
      };
      const response = nextMessage(port2, metadata.messageId);
      port2.postMessage(createProjectCreateCommand(metadata, request));
      return response;
    },
    stop,
  };
}

function createStorageTransportFixture(
  options: Readonly<{
    openings: readonly OpeningEntry[];
    registryStopError?: unknown;
  }>,
) {
  const openings = [...options.openings];
  let nextProjectOperation:
    | Readonly<{ markStarted(): void; waitUntilReleased: Promise<void> }>
    | undefined;
  const registryStop = vi.fn(async () => {
    if (options.registryStopError !== undefined) throw options.registryStopError;
  });
  const baseDependencies = createNodeProjectStorageDependencies({
    applicationStorageRoot: "project-storage-lifecycle-unused",
    migrationResourcesRoot: checkedInMigrationRoot,
    applicationVersion: "0.0.0",
  });
  const forProject: ProjectStorageStoreDependencies["locks"]["forProject"] = (
    projectId,
    operation,
  ) =>
    baseDependencies.locks.forProject(projectId, async () => {
      const deferredOperation = nextProjectOperation;
      if (deferredOperation !== undefined) {
        nextProjectOperation = undefined;
        deferredOperation.markStarted();
        await deferredOperation.waitUntilReleased;
      }
      return operation();
    });
  const dependencies = {
    ...baseDependencies,
    registry: { ...baseDependencies.registry, stop: registryStop },
    opening: {
      inspect: async (projectId: ProjectId) => {
        const entry = openings.shift();
        if (entry === undefined) throw new Error("No Project Storage opening was queued.");
        const [expectedProjectId, evidence] = entry;
        expect(projectId).toBe(expectedProjectId);
        if (evidence instanceof Promise) openingStartedResolvers.get(evidence)?.();
        return await evidence;
      },
    },
    locks: { ...baseDependencies.locks, forProject },
  } satisfies ProjectStorageStoreDependencies;
  const { port1, port2 } = new MessageChannel();
  let generatedId = 200;
  let commandId = 300;
  const stop = startHarnessRuntime({
    transport: transportFor(port1),
    canonicalProjectApplication: unusedCanonicalApplication(),
    workspaceApplication: createUnavailableWorkspaceApplication(),
    projectStorageApplication: createProjectStorageApplication(
      createProjectStorageOwner(dependencies),
    ),
    harnessVersion: "0.0.0",
    createId: () => `00000000-0000-4000-8000-${String(generatedId++).padStart(12, "0")}`,
    now: () => "2026-09-03T18:00:00.000Z",
  });
  const runtime = {
    stop,
    closePorts: () => {
      port1.close();
      port2.close();
    },
  };
  activeRuntimes.add(runtime);
  const nextCommandMetadata = () => ({
    messageId: `00000000-0000-4000-8000-${String(commandId++).padStart(12, "0")}`,
    sentAt: "2026-09-03T18:00:00.000Z",
  });

  return {
    registryStop,
    open(projectId: ProjectId): Promise<unknown> {
      const metadata = nextCommandMetadata();
      const response = nextMessage(port2, metadata.messageId);
      port2.postMessage(createProjectOpenCommand(metadata, { projectId }));
      return response;
    },
    close(projectId: ProjectId): Promise<unknown> {
      const metadata = nextCommandMetadata();
      const response = nextMessage(port2, metadata.messageId);
      port2.postMessage(createProjectCloseCommand(metadata, { projectId }));
      return response;
    },
    deferNextProjectOperation() {
      if (nextProjectOperation !== undefined) {
        throw new Error("A Project Storage operation is already deferred.");
      }
      let resolveStarted: (() => void) | undefined;
      let resolveReleased: (() => void) | undefined;
      const started = new Promise<void>((resolve) => {
        resolveStarted = resolve;
      });
      const waitUntilReleased = new Promise<void>((resolve) => {
        resolveReleased = resolve;
      });
      if (resolveStarted === undefined || resolveReleased === undefined) {
        throw new Error("Deferred Project Storage operation was not initialized.");
      }
      const releaseDeferredOperation = resolveReleased;
      nextProjectOperation = { markStarted: resolveStarted, waitUntilReleased };
      let released = false;
      return {
        started,
        release: () => {
          if (released) return;
          released = true;
          releaseDeferredOperation();
        },
      };
    },
    stop,
  };
}

it("reopens one Project without closing another and releases every session once", async () => {
  const releaseA1 = vi.fn(async () => undefined);
  const releaseA2 = vi.fn(async () => undefined);
  const releaseB = vi.fn(async () => undefined);
  const fixture = createStorageTransportFixture({
    openings: [
      [projectA, healthyOpeningEvidence(releaseA1)],
      [projectB, safeModeOpeningEvidence(releaseB)],
      [projectA, healthyOpeningEvidence(releaseA2)],
    ],
  });

  await expect(fixture.open(projectA)).resolves.toMatchObject({
    event: "project.open.result",
    payload: { status: "opened" },
  });
  await expect(fixture.open(projectB)).resolves.toMatchObject({
    event: "project.open.result",
    payload: { status: "safe-mode" },
  });
  await fixture.open(projectA);
  expect(releaseA1).toHaveBeenCalledOnce();
  expect(releaseA2).not.toHaveBeenCalled();
  expect(releaseB).not.toHaveBeenCalled();

  await fixture.close(projectA);
  await fixture.close(projectA);
  expect(releaseA2).toHaveBeenCalledOnce();
  expect(releaseB).not.toHaveBeenCalled();
  const firstStop = fixture.stop();
  const repeatedStop = fixture.stop();
  expect(repeatedStop).toBe(firstStop);
  await firstStop;
  expect(releaseB).toHaveBeenCalledOnce();
  expect(fixture.registryStop).toHaveBeenCalledOnce();
});

it("retains Project Storage sessions until close succeeds", async () => {
  const failure = new Error("first close failed");
  const release = vi.fn(async () => undefined).mockRejectedValueOnce(failure);
  const fixture = createStorageTransportFixture({
    openings: [[projectA, healthyOpeningEvidence(release)]],
  });
  await fixture.open(projectA);
  await expect(fixture.close(projectA)).resolves.toMatchObject({
    event: "project.close.result",
    payload: {
      status: "broken",
      request: { projectId: projectA },
      diagnostic: {
        code: "PROJECT_STORAGE_OWNER_FAILED",
        message: "Project Storage owner failed.",
      },
    },
  });
  await fixture.stop();
  expect(release).toHaveBeenCalledTimes(2);
  expect(fixture.registryStop).toHaveBeenCalledOnce();
});

it("releases retained sessions by admission after opens complete in reverse", async () => {
  const pendingA = deferredOpeningEvidence();
  const pendingB = deferredOpeningEvidence();
  const releaseOrder: string[] = [];
  const releaseA = vi.fn(async () => {
    releaseOrder.push("A");
  });
  const releaseB = vi.fn(async () => {
    releaseOrder.push("B");
  });
  const fixture = createStorageTransportFixture({
    openings: [
      [projectA, pendingA.promise],
      [projectB, pendingB.promise],
    ],
  });

  const openingA = fixture.open(projectA);
  await pendingA.started;
  const openingB = fixture.open(projectB);
  await pendingB.started;
  pendingB.resolve(healthyOpeningEvidence(releaseB));
  try {
    await expect(openingB).resolves.toMatchObject({
      event: "project.open.result",
      payload: { status: "opened", request: { projectId: projectB } },
    });
  } finally {
    pendingA.resolve(healthyOpeningEvidence(releaseA));
  }
  await expect(openingA).resolves.toMatchObject({
    event: "project.open.result",
    payload: { status: "opened", request: { projectId: projectA } },
  });

  await fixture.stop();
  expect(releaseOrder).toEqual(["A", "B"]);
  expect(releaseA).toHaveBeenCalledOnce();
  expect(releaseB).toHaveBeenCalledOnce();
  expect(fixture.registryStop).toHaveBeenCalledOnce();
});

it("reports every session and registry failure through one shared stop promise", async () => {
  const sessionFailure = new Error("session release failed");
  const registryFailure = new Error("registry close failed");
  const releaseA = vi.fn(async () => {
    throw sessionFailure;
  });
  const releaseB = vi.fn(async () => undefined);
  const fixture = createStorageTransportFixture({
    openings: [
      [projectA, healthyOpeningEvidence(releaseA)],
      [projectB, healthyOpeningEvidence(releaseB)],
    ],
    registryStopError: registryFailure,
  });
  await fixture.open(projectA);
  await fixture.open(projectB);

  const firstStop = fixture.stop();
  const repeatedStop = fixture.stop();
  expect(repeatedStop).toBe(firstStop);
  let failure: unknown;
  try {
    await firstStop;
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(AggregateError);
  if (!(failure instanceof AggregateError)) {
    throw new Error("Expected Project Storage shutdown to fail with AggregateError.");
  }
  expect(failure.message).toBe("Project Storage shutdown failed.");
  expect(failure.errors).toEqual([sessionFailure, registryFailure]);
  expect(releaseA).toHaveBeenCalledOnce();
  expect(releaseB).toHaveBeenCalledOnce();
  expect(fixture.registryStop).toHaveBeenCalledOnce();
});

it("drains an already-admitted deferred close before registry shutdown", async () => {
  const releaseSession = vi.fn(async () => undefined);
  const fixture = createStorageTransportFixture({
    openings: [[projectA, healthyOpeningEvidence(releaseSession)]],
  });
  await fixture.open(projectA);
  const pendingClose = fixture.deferNextProjectOperation();
  const closeResponse = fixture.close(projectA);
  await pendingClose.started;

  let closeSettlements = 0;
  const observedClose = closeResponse.then((result) => {
    closeSettlements += 1;
    return result;
  });
  const stop = observeResolvingStop(fixture.stop);
  await Promise.resolve();

  try {
    expect(stop.repeatedStop).toBe(stop.stopPromise);
    expect(closeSettlements).toBe(0);
    expect(stop.isSettled()).toBe(false);
    expect(releaseSession).not.toHaveBeenCalled();
    expect(fixture.registryStop).not.toHaveBeenCalled();
  } finally {
    pendingClose.release();
  }
  await expect(observedClose).resolves.toMatchObject({
    event: "project.close.result",
    payload: {
      status: "unavailable",
      request: { projectId: projectA },
      diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE" },
    },
  });
  expect(closeSettlements).toBe(1);
  await stop.observedStop;

  expect(releaseSession).toHaveBeenCalledOnce();
  expect(fixture.registryStop).toHaveBeenCalledOnce();
  expect(stop.isSettled()).toBe(true);
});

it("reports a failed release from an admitted close through shutdown", async () => {
  const releaseFailure = new Error("admitted close release failed");
  let markReleaseStarted: (() => void) | undefined;
  let completeRelease: (() => void) | undefined;
  const releaseStarted = new Promise<void>((resolve) => {
    markReleaseStarted = resolve;
  });
  const releaseGate = new Promise<void>((resolve) => {
    completeRelease = resolve;
  });
  if (markReleaseStarted === undefined || completeRelease === undefined) {
    throw new Error("Deferred Project Storage release was not initialized.");
  }
  const markDeferredReleaseStarted = markReleaseStarted;
  const finishDeferredRelease = completeRelease;
  const releaseSession = vi.fn(async () => {
    markDeferredReleaseStarted();
    await releaseGate;
    throw releaseFailure;
  });
  const fixture = createStorageTransportFixture({
    openings: [[projectA, healthyOpeningEvidence(releaseSession)]],
  });
  await fixture.open(projectA);
  const closeResponse = fixture.close(projectA);
  await releaseStarted;

  const stopPromise = fixture.stop();
  const stopResult = settleShutdown(stopPromise);
  finishDeferredRelease();

  await expect(closeResponse).resolves.toMatchObject({
    event: "project.close.result",
    payload: {
      status: "broken",
      request: { projectId: projectA },
      diagnostic: { code: "PROJECT_STORAGE_OWNER_FAILED" },
    },
  });
  expectShutdownFailure(await stopResult, [releaseFailure]);
  expect(releaseSession).toHaveBeenCalledTimes(2);
  expect(fixture.registryStop).toHaveBeenCalledOnce();
});

it("releases a late opening candidate when stop wins the race", async () => {
  const pending = deferredOpeningEvidence();
  const release = vi.fn(async () => undefined);
  const fixture = createStorageTransportFixture({
    openings: [[projectA, pending.promise]],
  });
  const response = fixture.open(projectA);
  await pending.started;

  const stopPromise = fixture.stop();
  pending.resolve(healthyOpeningEvidence(release));

  await expect(response).resolves.toMatchObject({
    event: "project.open.result",
    payload: {
      status: "unavailable",
      request: { projectId: projectA },
      diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE" },
    },
  });
  await stopPromise;
  expect(release).toHaveBeenCalledOnce();
  expect(fixture.registryStop).toHaveBeenCalledOnce();
});

it("drains a pending open and aggregates its late release failure before registry stop", async () => {
  const lateReleaseFailure = new Error("late opening release failed");
  const release = vi.fn(async () => {
    throw lateReleaseFailure;
  });
  const pending = deferredOpeningEvidence();
  const fixture = createStorageTransportFixture({
    openings: [[projectA, pending.promise]],
  });
  const response = fixture.open(projectA);
  await pending.started;

  const stopPromise = fixture.stop();
  let stopSettled = false;
  const observedStop = stopPromise.then(
    () => {
      stopSettled = true;
      return { status: "resolved" as const };
    },
    (error: unknown) => {
      stopSettled = true;
      return { status: "rejected" as const, error };
    },
  );
  await Promise.resolve();
  try {
    expect(stopSettled).toBe(false);
    expect(fixture.registryStop).not.toHaveBeenCalled();
  } finally {
    pending.resolve(healthyOpeningEvidence(release));
  }
  await expect(response).resolves.toMatchObject({
    event: "project.open.result",
    payload: {
      status: "broken",
      request: { projectId: projectA },
      diagnostic: {
        code: "PROJECT_STORAGE_OWNER_FAILED",
        message: "Project Storage opening release failed.",
      },
    },
  });
  expectShutdownFailure(await observedStop, [lateReleaseFailure]);
  expect(release).toHaveBeenCalledOnce();
  expect(fixture.registryStop).toHaveBeenCalledOnce();
});

it("aggregates a real unavailable failure from an opening pending at stop", async () => {
  const unavailableFailure = new ProjectStorageUnavailableError("Project database access failed.");
  const pending = deferredOpeningEvidence();
  const fixture = createStorageTransportFixture({
    openings: [[projectA, pending.promise]],
  });
  const response = fixture.open(projectA);
  await pending.started;

  const stopResult = fixture.stop().then(
    () => ({ status: "resolved" as const }),
    (error: unknown) => ({ status: "rejected" as const, error }),
  );
  pending.reject(unavailableFailure);

  await expect(response).resolves.toMatchObject({
    event: "project.open.result",
    payload: {
      status: "unavailable",
      request: { projectId: projectA },
      diagnostic: {
        code: "PROJECT_STORAGE_UNAVAILABLE",
        message: "Project database access failed.",
      },
    },
  });
  expectShutdownFailure(await stopResult, [unavailableFailure]);
  expect(fixture.registryStop).toHaveBeenCalledOnce();
});

it.each(createBoundaries)(
  "stops create after $boundary without crossing the next durable boundary",
  async (boundary) => {
    const root = await createTemporaryApplicationRoot();
    const fixture = createCreateBoundaryTransportFixture(root, boundary);
    const createResponse = fixture.create(createRequest);
    await fixture.started;

    const stop = observeResolvingStop(fixture.stop);
    await Promise.resolve();

    try {
      expect(stop.repeatedStop).toBe(stop.stopPromise);
      expect(stop.isSettled()).toBe(false);
      expect(fixture.registryStop).not.toHaveBeenCalled();
      await expectPostStopOperationsUnavailable(fixture);
    } finally {
      fixture.release();
    }

    await expect(createResponse).resolves.toMatchObject({
      event: "project.create.result",
      payload: {
        status: "unavailable",
        request: createRequest,
        diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE" },
      },
    });
    await stop.observedStop;
    expect(fixture.registryStop).toHaveBeenCalledOnce();
    expect(fixture.events).toEqual(
      createEventOrder.slice(0, createEventOrder.indexOf(boundary) + 1),
    );
    expect(fixture.shutdownEvents).toEqual([
      "create-operation-finished",
      "after-create-drain-entered",
      "registry-stop",
    ]);

    const retry = await createStorageRuntimeForRoot(root);
    try {
      const retryResult = await retry.create(createRequest);
      if (boundary === "activate") {
        expect(retryResult).toMatchObject({
          event: "project.create.result",
          payload: expectedCreatedResult,
        });
      } else {
        expect(retryResult).toMatchObject({
          event: "project.create.result",
          payload: {
            status: "blocked",
            request: createRequest,
            reason: "prior-state-witness",
            diagnostic: { code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS" },
          },
        });
      }
    } finally {
      await retry.stop();
    }
  },
);

it("rejects the retained stop promise when registry shutdown fails after create drain", async () => {
  const root = await createTemporaryApplicationRoot();
  const registryFailure = new Error("registry shutdown failed");
  const fixture = createCreateBoundaryTransportFixture(root, "declareStaging", registryFailure);
  const createResponse = fixture.create(createRequest);
  await fixture.started;

  const stopPromise = fixture.stop();
  const repeatedStop = fixture.stop();
  const stopResult = stopPromise.then(
    () => ({ status: "resolved" as const }),
    (error: unknown) => ({ status: "rejected" as const, error }),
  );
  await Promise.resolve();
  try {
    expect(repeatedStop).toBe(stopPromise);
    expect(fixture.registryStop).not.toHaveBeenCalled();
  } finally {
    fixture.release();
  }

  await expect(createResponse).resolves.toMatchObject({
    event: "project.create.result",
    payload: {
      status: "unavailable",
      request: createRequest,
      diagnostic: { code: "PROJECT_STORAGE_UNAVAILABLE" },
    },
  });
  expectShutdownFailure(await stopResult, [registryFailure]);
  expect(fixture.registryStop).toHaveBeenCalledOnce();
  expect(fixture.shutdownEvents).toEqual([
    "create-operation-finished",
    "after-create-drain-entered",
    "registry-stop",
  ]);
});
