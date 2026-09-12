import { setImmediate as nextTurn } from "node:timers/promises";
import { MessageChannel } from "node:worker_threads";
import {
  type CanonicalProjectCommandRequest,
  CanonicalProjectCommandRequestSchema,
  type CanonicalProjectSwitchRequest,
  type CanonicalProjectSwitchResult,
  createProjectActivateCommand,
  createProjectCommand,
  createProjectOpenCommand,
  createProjectSwitchCommand,
  ProjectActivationIdSchema,
  ProjectIdSchema,
  type ProjectStorageOpenResult,
  ProjectStorageOpenResultSchema,
  parseHarnessMessage,
  WriterGenerationSchema,
} from "@slopstop/protocol";
import { expect, vi } from "vitest";
import {
  type ActiveProjectCoordinator,
  createActiveProjectCoordinator,
} from "../../src/active-project-coordinator.js";
import { createCanonicalProjectApplication } from "../../src/canonical-project-application.js";
import {
  createProjectStorageApplication,
  createUnavailableProjectStorageApplication,
  createUnavailableWorkspaceApplication,
  type HarnessTransport,
  startHarnessRuntime,
} from "../../src/index.js";
import type { ProjectStorageActivationOutcome } from "../../src/project-storage-application.js";
import {
  type CanonicalCommandRepositoryActivationResult,
  type CanonicalCommandRepositoryFactory,
  WriterCapabilityTokenSchema,
  type WriterFenceCheck,
} from "../../src/storage/canonical-command-repository.js";
import { createCanonicalWriterLeaseFactory } from "../../src/storage/canonical-writer-lease.js";
import { createNodeProjectStorageDependencies } from "../../src/storage/project-storage-node-adapters.js";
import {
  type ProjectStorageOpenEvidence,
  presentProjectDatabaseProbe,
} from "../../src/storage/project-storage-opening.js";
import { createProjectStorageOwner } from "../../src/storage/project-storage-store.js";
import { createMigratedSettlement } from "./conformance-counter-command.js";
import { checkedInMigrationRoot, switchDeferred } from "./project-storage-runtime-fixture.js";

export {
  checkedInMigrationRoot,
  createRequest,
  createStorageRuntimeForRoot,
  createTemporaryApplicationRoot,
  expectedCreatedResult,
  fixedCreationIds,
  pathExists,
  projectStorageIntegrationTimeout,
  readRows,
  sha256File,
  switchDeferred,
  transportFor,
} from "./project-storage-runtime-fixture.js";

// Fixed S4 contract values; expected results never come from the coordinator.
export const switchProjects = {
  A: {
    projectId: ProjectIdSchema.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
    activationId: ProjectActivationIdSchema.parse("eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
  },
  B: {
    projectId: ProjectIdSchema.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"),
    activationId: ProjectActivationIdSchema.parse("ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"),
  },
  C: {
    projectId: ProjectIdSchema.parse("cccccccc-cccc-4ccc-8ccc-ccccccccccc3"),
    activationId: ProjectActivationIdSchema.parse("eccccccc-cccc-4ccc-8ccc-ccccccccccc3"),
  },
};
export type SwitchProjectName = keyof typeof switchProjects;
export const newAEpoch = ProjectActivationIdSchema.parse("eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2");
export const switchTimes = {
  T0: "2026-09-05T12:00:00.000Z",
  T1: "2026-09-05T12:00:01.000Z",
  T2: "2026-09-05T12:00:02.000Z",
  T3: "2026-09-05T12:00:03.000Z",
  T4: "2026-09-05T12:00:04.000Z",
  T5: "2026-09-05T12:00:05.000Z",
};
export const switchRequests = {
  AB: { from: switchProjects.A, to: { projectId: switchProjects.B.projectId } },
  AC: { from: switchProjects.A, to: { projectId: switchProjects.C.projectId } },
  AA: { from: switchProjects.A, to: { projectId: switchProjects.A.projectId } },
} satisfies Record<string, CanonicalProjectSwitchRequest>;
function switchCommand(
  name: SwitchProjectName,
  suffix: string,
  epoch = switchProjects[name].activationId,
) {
  return CanonicalProjectCommandRequestSchema.parse({
    projectId: switchProjects[name].projectId,
    activationId: epoch,
    command: {
      commandId: `44444444-4444-4444-8444-44444444440${suffix}`,
      type: "conformance.counter.set",
      version: 1,
      payload: { value: 7 },
    },
  });
}
export const switchCommands = {
  A: switchCommand("A", "1"),
  B: switchCommand("B", "2"),
  ANew: switchCommand("A", "3", newAEpoch),
  ASecond: switchCommand("A", "4"),
};
function expectedCommandDiagnostic<Code extends string, Retryable extends boolean>(
  code: Code,
  message: string,
  retryable: Retryable,
) {
  return { code, message, retryable };
}
const switchCommandDiagnostics = {
  "coordinator-unavailable": expectedCommandDiagnostic(
    "PROJECT_COORDINATOR_UNAVAILABLE",
    "Canonical Project coordination is unavailable.",
    false,
  ),
  inactive: expectedCommandDiagnostic(
    "PROJECT_INACTIVE",
    "No Project is active for Typed commands.",
    false,
  ),
  "project-mismatch": expectedCommandDiagnostic(
    "PROJECT_NOT_ACTIVE",
    "The command Project is not active.",
    false,
  ),
  "stale-activation": expectedCommandDiagnostic(
    "PROJECT_ACTIVATION_STALE",
    "The command activation is stale.",
    false,
  ),
  "read-only": expectedCommandDiagnostic(
    "WRITER_UNAVAILABLE",
    "The active Project has no write authority.",
    true,
  ),
  "stale-writer": expectedCommandDiagnostic(
    "WRITER_FENCE_STALE",
    "The active Writer fence is stale.",
    false,
  ),
  broken: expectedCommandDiagnostic(
    "WRITER_FENCE_CHECK_FAILED",
    "The active Writer fence could not be verified.",
    false,
  ),
  "settlement-unavailable": expectedCommandDiagnostic(
    "COMMAND_SETTLEMENT_UNAVAILABLE",
    "Typed-command settlement is not available in this release slice.",
    false,
  ),
} as const;
export function switchCommandFailure(
  status: keyof typeof switchCommandDiagnostics,
  input = switchCommands.A,
) {
  return {
    status,
    projectId: input.projectId,
    activationId: input.activationId,
    commandId: input.command.commandId,
    diagnostic: switchCommandDiagnostics[status],
  };
}
const switchSourceDiagnostics = {
  inactive: {
    code: "PROJECT_INACTIVE",
    message: "No Project is active for switching.",
    retryable: false,
  },
  "coordinator-unavailable": switchCommandDiagnostics["coordinator-unavailable"],
  "project-mismatch": {
    code: "PROJECT_NOT_ACTIVE",
    message: "The switch source Project is not active.",
    retryable: false,
  },
  "stale-activation": {
    code: "PROJECT_ACTIVATION_STALE",
    message: "The switch source activation is stale.",
    retryable: false,
  },
} as const;
export function switchSourceFailure(
  status: keyof typeof switchSourceDiagnostics,
  request = switchRequests.AB,
) {
  return { status, request, diagnostic: switchSourceDiagnostics[status] };
}
export function switchActive(
  name: SwitchProjectName,
  generation = 1,
  access: "read-write" | "read-only" = "read-write",
) {
  const activationId =
    name === "A" && generation === 2 ? newAEpoch : switchProjects[name].activationId;
  const base = {
    status: "active",
    request: { projectId: switchProjects[name].projectId },
    access,
    activationId,
  };
  return access === "read-write"
    ? { ...base, writerGeneration: generation }
    : {
        ...base,
        writerGeneration: null,
        diagnostic: {
          code: "WRITER_UNAVAILABLE",
          message: "Another SlopStop process holds Project write authority.",
          retryable: true,
        },
      };
}
export function switchTarget(target: unknown = switchActive("B"), request = switchRequests.AB) {
  return { status: "target-result", request, target };
}
export function switchReleaseFailure(code: string, request = switchRequests.AB) {
  return {
    status: "release-failed",
    request,
    diagnostic: {
      code,
      message: "Project activation resources could not be released.",
      retryable: code !== "WRITER_FENCE_STALE",
    },
  };
}
export function switchBrokenTarget(
  code: string,
  message = "Project activation resources could not be released.",
) {
  return {
    status: "broken",
    request: switchRequests.AB.to,
    diagnostic: { code, message, retryable: false },
  };
}
export function switchAlreadyActive(name: SwitchProjectName) {
  return {
    status: "rejected",
    request: { projectId: switchProjects[name].projectId },
    diagnostic: {
      code: "PROJECT_ALREADY_ACTIVE",
      message: "A Project activation already owns this harness session.",
      retryable: false,
    },
  };
}
export function observeSwitchPromise<Value>(promise: Promise<Value>) {
  let settled = false;
  void promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  return { promise, isSettled: () => settled };
}
export function requireSwitch(owner: ActiveProjectCoordinator) {
  const method: unknown = Reflect.get(owner, "switchProject");
  expect(method, "public switchProject capability").toBeTypeOf("function");
  if (typeof method !== "function") throw new Error("Public switchProject capability missing.");
  return (request: CanonicalProjectSwitchRequest): Promise<CanonicalProjectSwitchResult> =>
    method.call(owner, request);
}
function switchObservations() {
  const log: string[] = [];
  const all: string[] = [];
  const faults = new Map<string, Error[]>();
  const holds = new Map<string, ReturnType<typeof switchDeferred<void>>>();
  const entered = new Map<string, ReturnType<typeof switchDeferred<void>>>();
  const touch = (key: string, label = key) => {
    all.push(key);
    log.push(label);
    const error = faults.get(key)?.shift();
    if (error !== undefined) throw error;
  };
  return {
    log,
    all,
    faults,
    touch,
    run: async (key: string, label = key) => {
      touch(key, label);
      entered.get(key)?.resolve();
      await holds.get(key)?.promise;
    },
    hold: (key: string) => {
      const gate = switchDeferred<void>();
      const entry = switchDeferred<void>();
      holds.set(key, gate);
      entered.set(key, entry);
      return {
        entered: entry.promise,
        resolve: () => {
          holds.delete(key);
          gate.resolve();
        },
      };
    },
    reset: () => {
      log.length = 0;
      all.length = 0;
    },
  };
}
function switchStorageResult(name: SwitchProjectName) {
  const result = ProjectStorageOpenResultSchema.parse({
    status: "opened",
    mode: "read-write",
    request: { projectId: switchProjects[name].projectId },
    identity: {
      storageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1",
      generationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc2",
      canonicalDatabaseLineageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc3",
      runtimeDatabaseLineageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc4",
    },
    canonicalHealth: { status: "healthy" },
    runtimeHealth: { status: "healthy" },
  });
  if (result.status !== "opened") throw new Error("Invalid S4 Storage fixture.");
  return result;
}
function switchRepositoryPorts(
  name: SwitchProjectName,
  observations: ReturnType<typeof switchObservations>,
  realCommands: boolean,
) {
  const real = createMigratedSettlement(switchProjects[name].projectId);
  const run = (stage: string) => observations.run(`${name}.${stage}`);
  const repository = {
    projectId: switchProjects[name].projectId,
    writerGeneration: WriterGenerationSchema.parse(1),
    settle: vi.fn((text: string) => {
      if (!realCommands) throw new Error("Unexpected lifecycle-only settlement.");
      return real.settle(text);
    }),
    verifyFence: vi.fn(async (): Promise<WriterFenceCheck> => {
      throw new Error("Unexpected direct verification in settlement composition.");
    }),
    releaseFence: vi.fn(async (time: string): Promise<WriterFenceCheck> => {
      await observations.run(`${name}.fence`, `${name}.fence@${time}`);
      return realCommands ? real.releaseFence(time) : { status: "current" };
    }),
    close: vi.fn(async () => {
      await run("repository.close");
      await real.close();
    }),
  };
  let generation = 0;
  return {
    real,
    repository,
    activate: vi.fn(
      async (
        input: Parameters<CanonicalCommandRepositoryFactory["activate"]>[0],
      ): Promise<CanonicalCommandRepositoryActivationResult> => {
        await observations.run(
          `${name}.repository.activate`,
          `${name}.repository.activate@${input.activatedAt}`,
        );
        const result = realCommands
          ? await real.activate(input)
          : {
              status: "activated" as const,
              writerGeneration: WriterGenerationSchema.parse(++generation),
              repository,
            };
        if (result.status !== "activated") return result;
        return {
          status: "activated",
          repository,
          writerGeneration: result.writerGeneration,
        };
      },
    ),
  };
}
function switchProjectPorts(
  name: SwitchProjectName,
  observations: ReturnType<typeof switchObservations>,
  realCommands: boolean,
) {
  const ports = switchRepositoryPorts(name, observations, realCommands);
  const run = (stage: string) => observations.run(`${name}.${stage}`);
  const session = {
    mode: "read-write" as const,
    result: switchStorageResult(name),
    canonicalDatabasePath: `${name}/slopstop.db`,
    writerLeasePath: `${name}/writer.lock`,
    close: vi.fn(async () => {
      await run("storage.close");
      await ports.real.closeStorage();
    }),
  };
  const descriptor = { fd: { A: 11, B: 12, C: 13 }[name], close: vi.fn(() => run("lease.close")) };
  const native = {
    platform: "win32" as const,
    openLeaseFile: vi.fn(async () => descriptor),
    tryLock: vi.fn(() => true),
    unlock: vi.fn(() => observations.touch(`${name}.lease.unlock`)),
  };
  const leases = createCanonicalWriterLeaseFactory(native);
  return {
    ...ports,
    session,
    native,
    descriptor,
    storage: vi.fn(async (): Promise<ProjectStorageActivationOutcome> => {
      await run("storage.acquire");
      return { status: "ready", session };
    }),
    lease: vi.fn(async () => {
      observations.touch(`${name}.lease.acquire`);
      return leases.acquire(session.writerLeasePath);
    }),
  };
}
export function switchFixture(realCommands = false) {
  const observations = switchObservations();
  const projects = {
    A: switchProjectPorts("A", observations, realCommands),
    B: switchProjectPorts("B", observations, realCommands),
    C: switchProjectPorts("C", observations, realCommands),
  };
  let selected: SwitchProjectName = "A";
  const allocated = { A: 0, B: 0, C: 0 };
  const clock = vi.fn(() => switchTimes.T5);
  clock.mockReturnValueOnce(switchTimes.T0);
  const dependencies = {
    storage: {
      acquireActivation: vi.fn(
        async (request: { projectId: CanonicalProjectCommandRequest["projectId"] }) => {
          const name = (Object.keys(switchProjects) as SwitchProjectName[]).find(
            (key) => switchProjects[key].projectId === request.projectId,
          );
          if (name === undefined) throw new Error("Unknown S4 Project.");
          selected = name;
          return projects[name].storage();
        },
      ),
    },
    leases: { acquire: vi.fn(() => projects[selected].lease()) },
    repositories: {
      activate: vi.fn((input: Parameters<CanonicalCommandRepositoryFactory["activate"]>[0]) =>
        projects[selected].activate(input),
      ),
    },
    createActivationId: vi.fn(() => {
      observations.touch(`${selected}.activation-id`);
      allocated[selected]++;
      return selected === "A" && allocated.A > 1
        ? newAEpoch
        : switchProjects[selected].activationId;
    }),
    createWriterToken: vi.fn(() => {
      observations.touch(`${selected}.token`);
      return WriterCapabilityTokenSchema.parse("a".repeat(64));
    }),
    now: vi.fn(() => {
      observations.all.push("clock");
      return clock();
    }),
  };
  return {
    ...observations,
    projects,
    dependencies,
    clock,
    owner: createActiveProjectCoordinator(dependencies),
    times: (...values: string[]) => {
      for (const time of values) clock.mockReturnValueOnce(time);
    },
  };
}
export type SwitchFixture = ReturnType<typeof switchFixture>;
export function expectNoSwitchAcquisition(f: SwitchFixture, name: SwitchProjectName = "B") {
  expect(f.projects[name].storage).toHaveBeenCalledTimes(0);
  expect(f.projects[name].lease).toHaveBeenCalledTimes(0);
  expect(f.projects[name].activate).toHaveBeenCalledTimes(0);
  expect(f.all.filter((key) => key === `${name}.activation-id` || key === `${name}.token`)).toEqual(
    [],
  );
}
export async function activateSwitchSource(
  f: SwitchFixture,
  access: "read-write" | "read-only" = "read-write",
) {
  if (access === "read-only") f.projects.A.native.tryLock.mockReturnValue(false);
  expect(await f.owner.activate({ projectId: switchProjects.A.projectId })).toEqual(
    switchActive("A", 1, access),
  );
  f.reset();
  f.clock.mockReset().mockReturnValue(switchTimes.T5);
  f.times(switchTimes.T1, switchTimes.T2);
}
export const sourceReleaseOrder = [
  `A.fence@${switchTimes.T1}`,
  "A.repository.close",
  "A.lease.unlock",
  "A.lease.close",
  "A.storage.close",
];
export const targetAcquireOrder = [
  "B.storage.acquire",
  "B.activation-id",
  "B.lease.acquire",
  "B.token",
  `B.repository.activate@${switchTimes.T2}`,
];
export function safeSwitchStorage(f: SwitchFixture) {
  const result = ProjectStorageOpenResultSchema.parse({
    ...f.projects.B.session.result,
    status: "safe-mode",
    mode: "safe-mode",
    canonicalHealth: {
      status: "migration-required",
      diagnostic: {
        code: "DATABASE_MIGRATION_REQUIRED",
        message: "Database migration is required.",
      },
    },
  });
  if (result.status !== "safe-mode") throw new Error("Invalid S4 safe-mode fixture.");
  f.projects.B.storage.mockImplementation(async () => {
    await f.run("B.storage.acquire");
    return {
      status: "ready",
      session: { mode: "safe-mode", result, close: f.projects.B.session.close },
    };
  });
  return {
    status: "safe-mode",
    request: result.request,
    identity: result.identity,
    canonicalHealth: result.canonicalHealth,
    runtimeHealth: result.runtimeHealth,
  };
}

export const switchPrivateFailure = "C:\\private\\project\\slopstop.db secret-token secret-digest";
export const switchInternalFailure = {
  code: "HARNESS_INTERNAL_FAILURE",
  message: "Harness failed while handling a message.",
  retryable: false,
};
export function switchMetadata(suffix: number) {
  return {
    messageId: `11111111-1111-4111-8111-111111111${suffix}`,
    sentAt: switchTimes.T0,
  };
}
export const switchMessages = {
  activate: createProjectActivateCommand(switchMetadata(401), {
    projectId: switchProjects.A.projectId,
  }),
  switch: createProjectSwitchCommand(switchMetadata(402), switchRequests.AB),
  A: createProjectCommand(switchMetadata(403), switchCommands.A),
  B: createProjectCommand(switchMetadata(404), switchCommands.B),
  openC: createProjectOpenCommand(switchMetadata(405), { projectId: switchProjects.C.projectId }),
};
export function switchEvent(sequence: number, causation: number, event: string, payload: unknown) {
  return {
    protocolVersion: 4,
    messageType: "event",
    messageId: `99999999-9999-4999-8999-${String(999999999400 + sequence)}`,
    sentAt: switchTimes.T4,
    sequence,
    causationId: switchMetadata(causation).messageId,
    event,
    payload,
  };
}
export function switchRuntimeOptions(
  owner: ActiveProjectCoordinator,
  transport: HarnessTransport,
  storage = createUnavailableProjectStorageApplication(),
) {
  let sequence = 400;
  return {
    transport,
    canonicalProjectApplication: createCanonicalProjectApplication(owner),
    projectStorageApplication: storage,
    workspaceApplication: createUnavailableWorkspaceApplication(),
    harnessVersion: "0.0.0",
    now: () => switchTimes.T4,
    createId: () => `99999999-9999-4999-8999-999999999${++sequence}`,
  };
}

export function switchChannel(
  owner: ActiveProjectCoordinator,
  storage = createUnavailableProjectStorageApplication(),
) {
  const { port1, port2 } = new MessageChannel();
  const sent: unknown[] = [];
  const received: unknown[] = [];
  const deliveries = new Map<unknown, ReturnType<typeof switchDeferred<void>>>();
  const arrivals = new Map<number, ReturnType<typeof switchDeferred<void>>>();
  port2.on("message", (message: unknown) => {
    received.push(message);
    arrivals.get(received.length)?.resolve();
  });
  const transport: HarnessTransport = {
    send(message) {
      sent.push(message);
      port1.postMessage(message);
    },
    subscribe(listener) {
      const observe = (message: unknown) => {
        listener(message);
        if (typeof message === "object" && message !== null)
          deliveries.get(Reflect.get(message, "messageId"))?.resolve();
      };
      port1.on("message", observe);
      return () => port1.off("message", observe);
    },
  };
  const stop = startHarnessRuntime(switchRuntimeOptions(owner, transport, storage));
  return {
    sent,
    received,
    async post(message: { messageId: string }) {
      const delivery = switchDeferred<void>();
      deliveries.set(message.messageId, delivery);
      port2.postMessage(message);
      await delivery.promise;
      await nextTurn();
    },
    async expectEvents(expected: unknown[]) {
      if (received.length < expected.length) {
        const arrival = switchDeferred<void>();
        arrivals.set(expected.length, arrival);
        await arrival.promise;
      }
      expect(sent).toEqual(expected);
      expect(received).toEqual(expected);
      for (const envelope of received)
        expect(parseHarnessMessage(envelope)).toEqual({ ok: true, value: envelope });
    },
    async stop() {
      try {
        await stop();
      } finally {
        port1.close();
        port2.close();
      }
    },
  };
}

export const switchExceptionCases = [
  { stage: "storage.acquire", attempted: ["B.storage.acquire"], cleanup: [] },
  {
    stage: "activation-id",
    attempted: ["B.storage.acquire", "B.activation-id"],
    cleanup: ["B.storage.close"],
  },
  {
    stage: "lease.acquire",
    attempted: ["B.storage.acquire", "B.activation-id", "B.lease.acquire"],
    cleanup: ["B.storage.close"],
  },
  {
    stage: "token",
    attempted: ["B.storage.acquire", "B.activation-id", "B.lease.acquire", "B.token"],
    cleanup: ["B.lease.unlock", "B.lease.close", "B.storage.close"],
  },
  {
    stage: "repository.activate",
    attempted: targetAcquireOrder,
    cleanup: ["B.lease.unlock", "B.lease.close", "B.storage.close"],
  },
  {
    stage: "activation-time",
    attempted: ["B.storage.acquire", "B.activation-id", "B.lease.acquire", "B.token"],
    cleanup: ["B.lease.unlock", "B.lease.close", "B.storage.close"],
  },
] as const;
export function injectSwitchException(f: SwitchFixture, stage: string, error: Error) {
  if (stage === "activation-time") {
    f.clock
      .mockReset()
      .mockReturnValue(switchTimes.T3)
      .mockReturnValueOnce(switchTimes.T1)
      .mockImplementationOnce(() => {
        throw error;
      });
  } else f.faults.set(`B.${stage}`, [error]);
}

export const switchCleanupFailures = [
  {
    stage: "B.lease.unlock",
    code: "WRITER_LEASE_UNLOCK_FAILED",
    completed: [],
    remaining: ["B.lease.unlock", "B.lease.close", "B.storage.close"],
  },
  {
    stage: "B.lease.close",
    code: "WRITER_LEASE_CLOSE_FAILED",
    completed: ["B.lease.unlock"],
    remaining: ["B.lease.close", "B.storage.close"],
  },
  {
    stage: "B.storage.close",
    code: "PROJECT_STORAGE_RELEASE_FAILED",
    completed: ["B.lease.unlock", "B.lease.close"],
    remaining: ["B.storage.close"],
  },
] as const;
export function injectSwitchCleanupClock(f: SwitchFixture, error: Error) {
  // Source release, target activation, then exactly one failed cleanup clock read.
  f.clock
    .mockReset()
    .mockReturnValue(switchTimes.T3)
    .mockReturnValueOnce(switchTimes.T1)
    .mockReturnValueOnce(switchTimes.T2)
    .mockImplementationOnce(() => {
      throw error;
    });
}
export async function expectFailedSwitchOwnership(f: SwitchFixture) {
  const before = [...f.all];
  for (const input of [switchCommands.A, switchCommands.B])
    expect(await f.owner.execute(input)).toEqual(
      switchCommandFailure("coordinator-unavailable", input),
    );
  for (const request of [
    switchRequests.AB,
    { from: switchProjects.B, to: { projectId: switchProjects.C.projectId } },
  ])
    expect(await f.owner.switchProject(request)).toEqual(
      switchSourceFailure("coordinator-unavailable", request),
    );
  expect(await f.owner.activate({ projectId: switchProjects.C.projectId })).toEqual(
    switchAlreadyActive("C"),
  );
  await nextTurn();
  expect(f.all).toEqual(before);
  expectNoSwitchAcquisition(f, "C");
  expect(f.projects.A.storage).toHaveBeenCalledTimes(1);
}
export async function activateSwitchChannel(
  f: SwitchFixture,
  channel: ReturnType<typeof switchChannel>,
) {
  await channel.post(switchMessages.activate);
  await channel.expectEvents([switchEvent(1, 401, "project.activate.result", switchActive("A"))]);
  f.reset();
  f.clock.mockReset().mockReturnValue(switchTimes.T5);
  f.times(switchTimes.T1, switchTimes.T2);
}

export function ordinarySwitchStorage(f: SwitchFixture) {
  const ordinary = {
    A: vi.fn(async () => f.touch("ordinary.A.close")),
    B: vi.fn(async () => f.touch("ordinary.B.close")),
  };
  const openings = { A: 0, B: 0 };
  const base = createNodeProjectStorageDependencies({
    applicationStorageRoot: "switch-storage-unused",
    migrationResourcesRoot: checkedInMigrationRoot,
    applicationVersion: "0.0.0",
  });
  const registryStop = vi.fn(async () => f.touch("registry.stop"));
  const owner = createProjectStorageOwner({
    ...base,
    registry: { ...base.registry, stop: registryStop },
    opening: {
      async inspect(projectId): Promise<ProjectStorageOpenEvidence> {
        const name = projectId === switchProjects.A.projectId ? "A" : "B";
        expect(projectId).toBe(switchProjects[name].projectId);
        const release = openings[name]++ === 0 ? ordinary[name] : f.projects[name].session.close;
        const probe = presentProjectDatabaseProbe({
          identityMatches: true,
          format: "current",
          migration: "current",
        });
        return {
          status: "selected-current",
          identity: f.projects[name].session.result.identity,
          canonical: probe,
          runtime: probe,
          release,
        };
      },
    },
  });
  for (const name of ["A", "B"] as const)
    f.projects[name].storage.mockImplementation(async () => {
      await f.run(`${name}.storage.acquire`);
      return owner.acquireActivation({ projectId: switchProjects[name].projectId });
    });
  return { application: createProjectStorageApplication(owner), ordinary, registryStop };
}

export const switchApplicationTargets = [
  { name: "B_RW", target: switchActive("B") },
  { name: "B_RO", target: switchActive("B", 1, "read-only") },
  {
    name: "B_SAFE",
    target: {
      status: "safe-mode",
      request: switchRequests.AB.to,
      identity: {
        storageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1",
        generationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc2",
        canonicalDatabaseLineageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc3",
        runtimeDatabaseLineageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc4",
      },
      canonicalHealth: {
        status: "migration-required",
        diagnostic: {
          code: "DATABASE_MIGRATION_REQUIRED",
          message: "Database migration is required.",
        },
      },
      runtimeHealth: { status: "healthy" },
    },
  },
  { name: "not-registered", target: { status: "not-registered", request: switchRequests.AB.to } },
  ...[
    ["unavailable", "PROJECT_STORAGE_UNAVAILABLE", "Project Storage is unavailable.", true],
    ["broken", "PROJECT_STORAGE_BROKEN", "Project Storage activation failed.", false],
    ["broken", "WRITER_LEASE_OPEN_FAILED", "Writer lease file could not be opened.", false],
    ["broken", "WRITER_LEASE_LOCK_FAILED", "Writer lease could not be acquired.", false],
    ["broken", "WRITER_FENCE_ACTIVATION_FAILED", "Writer fence could not be activated.", false],
    [
      "unavailable",
      "PROJECT_COORDINATOR_UNAVAILABLE",
      "Canonical Project coordination is unavailable.",
      false,
    ],
    [
      "rejected",
      "PROJECT_ALREADY_ACTIVE",
      "A Project activation already owns this harness session.",
      false,
    ],
  ].map(([status, code, message, retryable]) => ({
    name: code,
    target: { status, request: switchRequests.AB.to, diagnostic: { code, message, retryable } },
  })),
];
export const switchApplicationFailures = [
  ...(["inactive", "project-mismatch", "stale-activation", "coordinator-unavailable"] as const).map(
    (status) => switchSourceFailure(status),
  ),
  ...[
    "WRITER_FENCE_RELEASE_FAILED",
    "WRITER_FENCE_STALE",
    "WRITER_REPOSITORY_CLOSE_FAILED",
    "WRITER_LEASE_UNLOCK_FAILED",
    "WRITER_LEASE_CLOSE_FAILED",
    "PROJECT_STORAGE_RELEASE_FAILED",
    "WRITER_LEASE_OPEN_FAILED",
    "WRITER_LEASE_LOCK_FAILED",
  ].map((code) => switchReleaseFailure(code)),
].map((value) => ({ name: `${value.status}/${value.diagnostic.code}`, value }));
export const switchApplicationResults = [
  ...switchApplicationTargets.map(({ name, target }) => ({ name, value: switchTarget(target) })),
  ...switchApplicationFailures,
];
export function switchResultBoundaries(value: CanonicalProjectSwitchResult): object[] {
  const boundaries: object[] = [value, value.request, value.request.from, value.request.to];
  if (value.status !== "target-result") return [...boundaries, value.diagnostic];
  const target = value.target;
  boundaries.push(target, target.request);
  if ("diagnostic" in target) boundaries.push(target.diagnostic);
  if (target.status === "safe-mode") {
    boundaries.push(target.identity, target.canonicalHealth, target.runtimeHealth);
    if (target.canonicalHealth.status !== "healthy")
      boundaries.push(target.canonicalHealth.diagnostic);
  }
  return boundaries;
}

export const switchRuntimeLifecycles = [
  {
    kind: "switch",
    message: switchMessages.switch,
    event: switchEvent(2, 402, "project.switch.result", switchTarget()),
  },
  {
    kind: "activate",
    message: createProjectActivateCommand(switchMetadata(402), {
      projectId: switchProjects.B.projectId,
    }),
    event: switchEvent(2, 402, "project.activate.result", switchAlreadyActive("B")),
  },
  {
    kind: "initial activate",
    message: createProjectActivateCommand(switchMetadata(402), {
      projectId: switchProjects.A.projectId,
    }),
    event: switchEvent(2, 402, "project.activate.result", switchActive("A")),
  },
  { kind: "stop", message: undefined, event: undefined },
];

export async function expectInvalidSwitchRuntime(
  result: CanonicalProjectSwitchResult,
  transport: HarnessTransport & { emit(message: unknown): void; sent: unknown[] },
) {
  const f = switchFixture();
  const pending = switchDeferred<ProjectStorageOpenResult>();
  const storage = {
    ...createUnavailableProjectStorageApplication(),
    open: vi.fn(() => pending.promise),
    stop: vi.fn(async () => undefined),
  };
  const owner = { ...f.owner, switchProject: async () => result };
  const stop = startHarnessRuntime(switchRuntimeOptions(owner, transport, storage));
  try {
    transport.emit(switchMessages.openC);
    transport.emit(switchMessages.switch);
    await nextTurn();
    const expected = [switchEvent(1, 402, "request.failure", switchInternalFailure)];
    expect(transport.sent).toEqual(expected);
    await nextTurn();
    expect(transport.sent).toEqual(expected);
    expect(storage.stop).toHaveBeenCalledTimes(0);
    expect(storage.open).toHaveBeenCalledExactlyOnceWith({ projectId: switchProjects.C.projectId });
    const missing = {
      status: "not-registered",
      request: { projectId: switchProjects.C.projectId },
    } as const;
    pending.resolve(missing);
    await nextTurn();
    expected.push(switchEvent(2, 405, "project.open.result", missing));
    transport.emit(createProjectSwitchCommand(switchMetadata(406), switchRequests.AB));
    await nextTurn();
    expected.push(switchEvent(3, 406, "request.failure", switchInternalFailure));
    transport.emit(switchMessages.A);
    await nextTurn();
    expected.push(switchEvent(4, 403, "project.command.result", switchCommandFailure("inactive")));
    expect(transport.sent).toEqual(expected);
    expect(storage.stop).toHaveBeenCalledTimes(0);
  } finally {
    pending.resolve({
      status: "not-registered",
      request: { projectId: switchProjects.C.projectId },
    });
    await stop();
  }
}
