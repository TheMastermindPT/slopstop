import { setImmediate as nextTurn } from "node:timers/promises";
import {
  type CanonicalProjectCommandRequest,
  CanonicalProjectCommandRequestSchema,
  ProjectActivationIdSchema,
  ProjectIdSchema,
  ProjectStorageOpenResultSchema,
  WriterGenerationSchema,
} from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import {
  activateSwitchSource,
  expectNoSwitchAcquisition,
  newAEpoch,
  observeSwitchPromise,
  requireSwitch,
  switchActive,
  switchAlreadyActive,
  switchBrokenTarget,
  switchCommandFailure,
  switchCommands,
  switchFixture,
  switchProjects,
  switchReleaseFailure,
  switchRequests,
  switchSourceFailure,
  switchTarget,
  switchTimes,
} from "../tests/integration/project-storage-create-fixture.js";
import * as coordinators from "./active-project-coordinator.js";
import type { ProjectStorageActivationOutcome } from "./project-storage-application.js";
import {
  type CanonicalCommandRepositoryActivationResult,
  CanonicalCommandRepositoryError,
  WriterCapabilityTokenSchema,
  type WriterFenceCheck,
} from "./storage/canonical-command-repository.js";
import {
  type CanonicalWriterLeaseAcquisition,
  CanonicalWriterLeaseError,
} from "./storage/canonical-writer-lease.js";

const projectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000010");
const activationId = ProjectActivationIdSchema.parse("00000000-0000-4000-8000-000000000011");
const request = { projectId };
const command = CanonicalProjectCommandRequestSchema.parse({
  projectId,
  activationId,
  command: {
    commandId: "00000000-0000-4000-8000-000000000012",
    type: "conformance.noop",
    version: 1,
    payload: { private: "secret command payload" },
  },
});
const writable = {
  status: "active",
  request,
  access: "read-write",
  activationId,
  writerGeneration: 1,
};
const readonlyResult = {
  status: "active",
  request,
  access: "read-only",
  activationId,
  writerGeneration: null,
  diagnostic: {
    code: "WRITER_UNAVAILABLE",
    message: "Another SlopStop process holds Project write authority.",
    retryable: true,
  },
};
const unavailableMessage = "Canonical Project coordination is unavailable.";
const commandFailures = {
  inactive: ["PROJECT_INACTIVE", "No Project is active for Typed commands.", false],
  "project-mismatch": ["PROJECT_NOT_ACTIVE", "The command Project is not active.", false],
  "stale-activation": ["PROJECT_ACTIVATION_STALE", "The command activation is stale.", false],
  "read-only": ["WRITER_UNAVAILABLE", "The active Project has no write authority.", true],
  "stale-writer": ["WRITER_FENCE_STALE", "The active Writer fence is stale.", false],
  broken: ["WRITER_FENCE_CHECK_FAILED", "The active Writer fence could not be verified.", false],
  "settlement-unavailable": [
    "COMMAND_SETTLEMENT_UNAVAILABLE",
    "Typed-command settlement is not available in this release slice.",
    false,
  ],
  "coordinator-unavailable": ["PROJECT_COORDINATOR_UNAVAILABLE", unavailableMessage, false],
} as const;

function failure(status: keyof typeof commandFailures, input = command) {
  const [code, message, retryable] = commandFailures[status];
  return {
    status,
    projectId: input.projectId,
    activationId: input.activationId,
    commandId: input.command.commandId,
    diagnostic: { code, message, retryable },
  };
}
const alreadyActive = {
  status: "rejected",
  request,
  diagnostic: {
    code: "PROJECT_ALREADY_ACTIVE",
    message: "A Project activation already owns this harness session.",
    retryable: false,
  },
};

function openedResult() {
  const result = ProjectStorageOpenResultSchema.parse({
    status: "opened",
    request,
    mode: "read-write",
    identity: {
      storageId: "00000000-0000-4000-8000-000000000013",
      generationId: "00000000-0000-4000-8000-000000000014",
      canonicalDatabaseLineageId: "00000000-0000-4000-8000-000000000015",
      runtimeDatabaseLineageId: "00000000-0000-4000-8000-000000000016",
    },
    canonicalHealth: { status: "healthy" },
    runtimeHealth: { status: "healthy" },
  });
  if (result.status !== "opened") throw new Error("Invalid storage fixture.");
  return result;
}

function fixture() {
  const calls: string[] = [];
  const faults = new Map<string, unknown>();
  const touch = (stage: string) => {
    calls.push(stage);
    if (faults.has(stage)) {
      const error = faults.get(stage);
      faults.delete(stage);
      throw error;
    }
  };
  const result = openedResult();
  const session = {
    mode: "read-write" as const,
    result,
    canonicalDatabasePath: "active/slopstop.db",
    writerLeasePath: "project/.slopstop-writer.lock",
    close: vi.fn(async () => touch("storage")),
  };
  const repository = {
    projectId,
    writerGeneration: WriterGenerationSchema.parse(1),
    verifyFence: vi.fn(async (): Promise<WriterFenceCheck> => ({ status: "current" })),
    releaseFence: vi.fn(async (): Promise<WriterFenceCheck> => {
      touch("fence");
      return { status: "current" };
    }),
    close: vi.fn(async () => touch("repository")),
  };
  const lease = { release: vi.fn(async () => touch("lease")) };
  const dependencies = {
    storage: {
      acquireActivation: vi.fn(
        async (): Promise<ProjectStorageActivationOutcome> => ({ status: "ready", session }),
      ),
    },
    leases: {
      acquire: vi.fn(
        async (): Promise<CanonicalWriterLeaseAcquisition> => ({ status: "acquired", lease }),
      ),
    },
    repositories: {
      activate: vi.fn(
        async (): Promise<CanonicalCommandRepositoryActivationResult> => ({
          status: "activated",
          repository,
          writerGeneration: repository.writerGeneration,
        }),
      ),
    },
    createActivationId: vi.fn(() => activationId),
    createWriterToken: vi.fn(() => WriterCapabilityTokenSchema.parse("a".repeat(64))),
    now: () => "2026-09-04T12:00:00.000Z",
  };
  const create = coordinators.createActiveProjectCoordinator;
  expect(create).toBeTypeOf("function");
  if (typeof create !== "function") throw new Error("Coordinator factory is missing.");
  return {
    owner: create(dependencies),
    dependencies,
    session,
    repository,
    lease,
    calls,
    faults,
    touch,
  };
}

function noAcquisition(f: ReturnType<typeof fixture>): void {
  expect(f.dependencies.createActivationId).not.toHaveBeenCalled();
  expect(f.dependencies.createWriterToken).not.toHaveBeenCalled();
  expect(f.dependencies.leases.acquire).not.toHaveBeenCalled();
  expect(f.dependencies.repositories.activate).not.toHaveBeenCalled();
}

it("owns one activation for the complete harness session", async () => {
  const f = fixture();
  expect(await f.owner.execute(command)).toEqual(failure("inactive"));
  expect(await f.owner.activate(request)).toEqual(writable);
  expect(await f.owner.activate(request)).toEqual(alreadyActive);
  f.faults.set("storage", new Error("close failed"));
  await expect(f.owner.stop()).rejects.toThrow("Canonical Project activation release failed.");
  expect(await f.owner.activate(request)).toEqual(alreadyActive);
  expect(f.dependencies.storage.acquireActivation).toHaveBeenCalledOnce();
  expect(f.dependencies.leases.acquire).toHaveBeenCalledOnce();
  expect(f.dependencies.repositories.activate).toHaveBeenCalledOnce();
  expect(f.dependencies.createActivationId).toHaveBeenCalledOnce();
  expect(f.dependencies.createWriterToken).toHaveBeenCalledOnce();
  await f.owner.stop();
  expect(await f.owner.activate(request)).toEqual({
    status: "unavailable",
    request,
    diagnostic: {
      code: "PROJECT_COORDINATOR_UNAVAILABLE",
      message: unavailableMessage,
      retryable: false,
    },
  });
  expect(await f.owner.execute(command)).toEqual(failure("coordinator-unavailable"));
});

it("maps non-writable Project Storage activation branches without acquiring a Writer", async () => {
  for (const status of ["unavailable", "broken", "not-registered", "safe-mode"] as const) {
    const f = fixture();
    if (status === "safe-mode") {
      const result = ProjectStorageOpenResultSchema.parse({
        ...f.session.result,
        status,
        mode: status,
        canonicalHealth: {
          status: "missing",
          diagnostic: { code: "DATABASE_MISSING", message: "missing" },
        },
      });
      if (result.status !== "safe-mode") throw new Error("Safe fixture invalid.");
      f.dependencies.storage.acquireActivation.mockResolvedValue({
        status: "ready",
        session: { mode: "safe-mode", result, close: f.session.close },
      });
      expect(await f.owner.activate(request)).toEqual({
        status,
        request,
        identity: result.identity,
        canonicalHealth: result.canonicalHealth,
        runtimeHealth: result.runtimeHealth,
      });
      expect(f.session.close).toHaveBeenCalledOnce();
    } else await nonReadyStorage(f, status);
    noAcquisition(f);
    expect(await f.owner.execute(command)).toEqual(failure("inactive"));
    await f.owner.stop();
  }
});

async function nonReadyStorage(
  f: ReturnType<typeof fixture>,
  status: "unavailable" | "broken" | "not-registered",
): Promise<void> {
  if (status === "not-registered") {
    f.dependencies.storage.acquireActivation.mockResolvedValue({
      status,
      result: { status, request },
    });
    expect(await f.owner.activate(request)).toEqual({ status, request });
  } else {
    f.dependencies.storage.acquireActivation.mockResolvedValue({
      status,
      message: "C:\\private\\project",
    });
    const expected = {
      unavailable: {
        code: "PROJECT_STORAGE_UNAVAILABLE",
        message: "Project Storage is unavailable.",
        retryable: true,
      },
      broken: {
        code: "PROJECT_STORAGE_BROKEN",
        message: "Project Storage activation failed.",
        retryable: false,
      },
    };
    expect(await f.owner.activate(request)).toEqual({
      status,
      request,
      diagnostic: expected[status],
    });
  }
  expect(f.session.close).not.toHaveBeenCalled();
}

it("retains a read-only activation on native contention without creating a repository", async () => {
  const f = fixture();
  f.dependencies.leases.acquire.mockResolvedValue({ status: "contended" });
  expect(await f.owner.activate(request)).toEqual(readonlyResult);
  expect(await f.owner.execute(command)).toEqual(failure("read-only"));
  expect(f.dependencies.repositories.activate).not.toHaveBeenCalled();
  expect(f.dependencies.createWriterToken).not.toHaveBeenCalled();
  expect(f.dependencies.createActivationId).toHaveBeenCalledOnce();
  await f.owner.stop();
  expect(f.calls).toEqual(["storage"]);
});

function deferred<Value>() {
  let resolve: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

it("admits Typed commands in Project, activation, access, then fence order", async () => {
  const f = fixture();
  expect(await f.owner.execute(command)).toEqual(failure("inactive"));
  const pending = deferred<ProjectStorageActivationOutcome>();
  const entered = deferred<void>();
  f.dependencies.storage.acquireActivation.mockImplementationOnce(() => {
    entered.resolve();
    return pending.promise;
  });
  const activation = f.owner.activate(request);
  await entered.promise;
  expect(await f.owner.execute(command)).toEqual(failure("coordinator-unavailable"));
  pending.resolve({ status: "ready", session: f.session });
  await activation;
  const stale = {
    ...command,
    activationId: ProjectActivationIdSchema.parse("00000000-0000-4000-8000-000000000021"),
  };
  const wrong: CanonicalProjectCommandRequest = {
    ...stale,
    projectId: ProjectIdSchema.parse("00000000-0000-4000-8000-000000000020"),
  };
  expect(await f.owner.execute(wrong)).toEqual(failure("project-mismatch", wrong));
  expect(await f.owner.execute(stale)).toEqual(failure("stale-activation", stale));
  expect(f.repository.verifyFence).not.toHaveBeenCalled();
  expect(await f.owner.execute(command)).toEqual(failure("settlement-unavailable"));
  f.repository.verifyFence.mockResolvedValueOnce({ status: "stale" });
  expect(await f.owner.execute(command)).toEqual(failure("stale-writer"));
  f.repository.verifyFence.mockRejectedValueOnce(new Error("secret command payload"));
  expect(await f.owner.execute(command)).toEqual(failure("broken"));
  const closing = deferred<void>();
  const closeEntered = deferred<void>();
  f.session.close.mockImplementationOnce(async () => {
    closeEntered.resolve();
    await closing.promise;
    throw new Error("close failed");
  });
  const stopping = f.owner.stop();
  const failureObserved = expect(stopping).rejects.toThrow(
    "Canonical Project activation release failed.",
  );
  await closeEntered.promise;
  expect(await f.owner.execute(command)).toEqual(failure("coordinator-unavailable"));
  closing.resolve();
  await failureObserved;
  expect(await f.owner.execute(command)).toEqual(failure("coordinator-unavailable"));
  await f.owner.stop();
  expect(await f.owner.execute(command)).toEqual(failure("coordinator-unavailable"));
});

it("retains failed release ownership and resumes cleanup on stop retry", async () => {
  for (const stage of ["fence", "repository", "lease", "storage"] as const) {
    const f = fixture();
    await f.owner.activate(request);
    f.faults.set(stage, new Error("release failed"));
    await expect(f.owner.stop()).rejects.toThrow("Canonical Project activation release failed.");
    expect(await f.owner.activate(request)).toEqual(alreadyActive);
    await f.owner.stop();
    const order = ["fence", "repository", "lease", "storage"];
    expect(f.calls).toEqual([
      ...order.slice(0, order.indexOf(stage) + 1),
      ...order.slice(order.indexOf(stage)),
    ]);
  }
  const clean = fixture();
  await clean.owner.activate(request);
  await clean.owner.stop();
  expect(clean.calls).toEqual(["fence", "repository", "lease", "storage"]);
  const stale = fixture();
  await stale.owner.activate(request);
  stale.repository.releaseFence.mockResolvedValue({ status: "stale" });
  await expect(stale.owner.stop()).rejects.toThrow();
  expect(stale.repository.close).not.toHaveBeenCalled();
  await unacquiredCleanup();
});

async function unacquiredCleanup(): Promise<void> {
  const f = fixture();
  const close = vi.fn(async () => {
    f.touch("lease-file-cleanup");
  });
  f.dependencies.leases.acquire.mockResolvedValue({
    status: "broken",
    error: new CanonicalWriterLeaseError("WRITER_LEASE_CLOSE_FAILED"),
    cleanup: { close },
  });
  expect(await f.owner.activate(request)).toEqual({
    status: "broken",
    request,
    diagnostic: {
      code: "WRITER_LEASE_CLOSE_FAILED",
      message: "Project activation resources could not be released.",
      retryable: false,
    },
  });
  expect(close).not.toHaveBeenCalled();
  expect(f.repository.close).not.toHaveBeenCalled();
  expect(f.session.close).not.toHaveBeenCalled();
  expect(await f.owner.activate(request)).toEqual(alreadyActive);
  await f.owner.stop();
  expect(f.calls).toEqual(["lease-file-cleanup", "storage"]);
}

it("retains a repository client when failed activation cleanup cannot close it", async () => {
  for (const closeFails of [false, true]) {
    const f = fixture();
    const close = vi.fn(async () => {
      f.touch("repository-cleanup");
    });
    if (closeFails) f.faults.set("repository-cleanup", new Error("close failure"));
    f.dependencies.repositories.activate.mockImplementationOnce(async () => {
      try {
        await close();
      } catch {
        return {
          status: "broken",
          error: new CanonicalCommandRepositoryError("WRITER_REPOSITORY_CLOSE_FAILED"),
          cleanup: { close },
        };
      }
      return {
        status: "broken",
        error: new CanonicalCommandRepositoryError("WRITER_FENCE_ACTIVATION_FAILED"),
      };
    });
    const result = await f.owner.activate(request);
    expect(close).toHaveBeenCalledTimes(1);
    if (closeFails) {
      expect(result).toEqual({
        status: "broken",
        request,
        diagnostic: {
          code: "WRITER_REPOSITORY_CLOSE_FAILED",
          message: "Project activation resources could not be released.",
          retryable: false,
        },
      });
      expect(f.lease.release).not.toHaveBeenCalled();
      expect(f.session.close).not.toHaveBeenCalled();
      expect(await f.owner.activate(request)).toEqual(alreadyActive);
      f.calls.length = 0;
      await f.owner.stop();
      expect(f.calls).toEqual(["repository-cleanup", "lease", "storage"]);
      expect(close).toHaveBeenCalledTimes(2);
    } else {
      expect(result).toEqual({
        status: "broken",
        request,
        diagnostic: {
          code: "WRITER_FENCE_ACTIVATION_FAILED",
          message: "Writer fence could not be activated.",
          retryable: false,
        },
      });
      expect(f.calls).toEqual(["repository-cleanup", "lease", "storage"]);
    }
  }
});

const ineligibleSources = [
  "inactive",
  "stopped",
  "wrong-project",
  "wrong-epoch",
  "failed-acquisition",
] as const;
async function arrangeIneligibleSource(
  f: ReturnType<typeof switchFixture>,
  state: (typeof ineligibleSources)[number],
) {
  let expected: "inactive" | "coordinator-unavailable" | "project-mismatch" | "stale-activation" =
    "inactive";
  if (state === "stopped") {
    await f.owner.stop();
    expected = "coordinator-unavailable";
  }
  if (state === "wrong-project") {
    expect(await f.owner.activate(switchRequests.AB.to)).toEqual(switchActive("B"));
    expected = "project-mismatch";
  }
  if (state === "wrong-epoch") {
    f.dependencies.createActivationId.mockReturnValueOnce(newAEpoch);
    expect(await f.owner.activate(switchRequests.AA.to)).toEqual({
      ...switchActive("A"),
      activationId: newAEpoch,
    });
    expected = "stale-activation";
  }
  if (state === "failed-acquisition") {
    f.faults.set("A.repository.close", [new Error("private failed acquisition close")]);
    f.projects.A.activate.mockImplementationOnce(async () => {
      try {
        await f.projects.A.repository.close();
      } catch {
        return {
          status: "broken",
          error: new CanonicalCommandRepositoryError("WRITER_REPOSITORY_CLOSE_FAILED"),
          cleanup: { close: f.projects.A.repository.close },
        };
      }
      throw new Error("Expected acquisition cleanup failure.");
    });
    expect(await f.owner.activate(switchRequests.AA.to)).toEqual({
      ...switchBrokenTarget("WRITER_REPOSITORY_CLOSE_FAILED"),
      request: switchRequests.AA.to,
    });
    expect(f.projects.A.repository.close).toHaveBeenCalledTimes(1);
    expected = "coordinator-unavailable";
  }
  return expected;
}

it.each(ineligibleSources)(
  "rejects ineligible switch sources before touching dependencies",
  async (state) => {
    const f = switchFixture();
    const switchProject = requireSwitch(f.owner);
    const expected = await arrangeIneligibleSource(f, state);
    f.reset();
    expect(await switchProject(switchRequests.AB)).toEqual(switchSourceFailure(expected));
    expect(f.all).toEqual([]);
    const altered = {
      ...switchRequests.AB,
      from: { ...switchProjects.A, activationId: newAEpoch },
    };
    if (state === "wrong-project" || state === "failed-acquisition") {
      expect(await switchProject(altered)).toEqual(switchSourceFailure(expected, altered));
      expect(f.all).toEqual([]);
    }
    if (state === "wrong-project")
      expect(await f.owner.execute(switchCommands.B)).toEqual(
        switchCommandFailure("settlement-unavailable", switchCommands.B),
      );
    if (state === "wrong-epoch")
      expect(await f.owner.execute(switchCommands.ANew)).toEqual(
        switchCommandFailure("settlement-unavailable", switchCommands.ANew),
      );
    if (state === "failed-acquisition")
      expect(await f.owner.execute(switchCommands.A)).toEqual(
        switchCommandFailure("coordinator-unavailable"),
      );
    await f.owner.stop();
  },
);

it.each(["switch", "activate", "stop", "initial"] as const)(
  "closes command admission in the same turn as lifecycle enqueue",
  async (operation) => {
    const f = switchFixture();
    if (operation !== "initial") await activateSwitchSource(f);
    const startSwitch = () => requireSwitch(f.owner)(switchRequests.AB);
    const actions = {
      switch: startSwitch,
      activate: () => f.owner.activate(switchRequests.AB.to),
      stop: () => f.owner.stop(),
      initial: () => f.owner.activate(switchRequests.AA.to),
    };
    const lifecycle = actions[operation]();
    const command = f.owner.execute(switchCommands.A);
    expect(await command).toEqual(switchCommandFailure("coordinator-unavailable"));
    expect(f.projects.A.repository.verifyFence).toHaveBeenCalledTimes(0);
    const result = await lifecycle;
    if (operation === "switch") {
      expect(result).toEqual(switchTarget());
      expect(await f.owner.execute(switchCommands.B)).toEqual(
        switchCommandFailure("settlement-unavailable", switchCommands.B),
      );
      expect(await f.owner.execute(switchCommands.A)).toEqual(
        switchCommandFailure("project-mismatch"),
      );
    }
    if (operation === "activate") {
      expect(result).toEqual(switchAlreadyActive("B"));
      expect(await f.owner.execute(switchCommands.A)).toEqual(
        switchCommandFailure("settlement-unavailable"),
      );
    }
    if (operation === "initial") expect(result).toEqual(switchActive("A"));
    await f.owner.stop();
  },
);

it.each(["A.fence", "B.storage.acquire"])(
  "closes command admission in the same turn as lifecycle enqueue",
  async (stage) => {
    const f = switchFixture();
    const switchProject = requireSwitch(f.owner);
    await activateSwitchSource(f);
    const hold = f.hold(stage);
    const switching = observeSwitchPromise(switchProject(switchRequests.AB));
    await nextTurn();
    expect(f.all).toContain(stage);
    expect(switching.isSettled()).toBe(false);
    for (const input of [switchCommands.A, switchCommands.B]) {
      expect(await f.owner.execute(input)).toEqual(
        switchCommandFailure("coordinator-unavailable", input),
      );
    }
    expect(f.projects.A.repository.verifyFence).toHaveBeenCalledTimes(0);
    expect(f.projects.B.repository.verifyFence).toHaveBeenCalledTimes(0);
    expect(f.projects.A.storage).toHaveBeenCalledTimes(1);
    hold.resolve();
    expect(await switching.promise).toEqual(switchTarget());
    expect(await f.owner.execute(switchCommands.B)).toEqual(
      switchCommandFailure("settlement-unavailable", switchCommands.B),
    );
    expect(await f.owner.execute(switchCommands.A)).toEqual(
      switchCommandFailure("project-mismatch"),
    );
    await f.owner.stop();
  },
);

it.each(["switch", "stop"] as const)(
  "requires exact retained source authority for an explicit switch retry",
  async (retry) => {
    const f = switchFixture();
    const switchProject = requireSwitch(f.owner);
    await activateSwitchSource(f);
    f.faults.set("A.repository.close", [new Error("private close")]);
    const failed = await switchProject(switchRequests.AB);
    expect(failed).toEqual(switchReleaseFailure("WRITER_REPOSITORY_CLOSE_FAILED"));
    f.reset();
    const wrong = { ...switchRequests.AB, from: switchProjects.C };
    const stale = { ...switchRequests.AB, from: { ...switchProjects.A, activationId: newAEpoch } };
    expect(await switchProject(wrong)).toEqual(switchSourceFailure("project-mismatch", wrong));
    expect(await switchProject(stale)).toEqual(switchSourceFailure("stale-activation", stale));
    expect(f.all).toEqual([]);
    expect(f.projects.A.repository.close).toHaveBeenCalledTimes(1);
    f.clock.mockReset().mockReturnValue(switchTimes.T5);
    f.times(switchTimes.T3, switchTimes.T5);
    if (retry === "switch") {
      expect(await switchProject(switchRequests.AC)).toEqual(
        switchTarget(switchActive("C"), switchRequests.AC),
      );
      expect(f.projects.C.storage).toHaveBeenCalledTimes(1);
    } else {
      await f.owner.stop();
      expectNoSwitchAcquisition(f, "C");
    }
    await nextTurn();
    expect(f.projects.A.repository.close).toHaveBeenCalledTimes(2);
    expectNoSwitchAcquisition(f);
    expect(failed).toEqual(switchReleaseFailure("WRITER_REPOSITORY_CLOSE_FAILED"));
    await f.owner.stop();
  },
);

import {
  expectFailedSwitchOwnership,
  injectSwitchCleanupClock,
  injectSwitchException,
  sourceReleaseOrder,
  switchCleanupFailures,
  switchExceptionCases,
  switchPrivateFailure,
  targetAcquireOrder,
} from "../tests/integration/project-storage-create-fixture.js";
import { createCanonicalProjectApplication } from "./canonical-project-application.js";

it.each(switchExceptionCases)(
  "contains unexpected target exceptions without restoring the source: $stage",
  async (row) => {
    for (const seam of ["coordinator", "application"]) {
      const f = switchFixture();
      await activateSwitchSource(f);
      const error = new Error(switchPrivateFailure);
      injectSwitchException(f, row.stage, error);
      const app = createCanonicalProjectApplication(f.owner);
      const operation = seam === "coordinator" ? f.owner : app;
      await expect(operation.switchProject(switchRequests.AB)).rejects.toBe(error);
      expect(f.log).toEqual([...sourceReleaseOrder, ...row.attempted, ...row.cleanup]);
      const settled = [...f.all];
      await nextTurn();
      expect(f.all).toEqual(settled);
      for (const input of [switchCommands.A, switchCommands.B])
        expect(await operation.execute(input)).toEqual(switchCommandFailure("inactive", input));
      expect(f.projects.A.storage).toHaveBeenCalledTimes(1);
      expect(f.projects.B.repository.close).toHaveBeenCalledTimes(0);
      expect(f.projects.B.repository.releaseFence).toHaveBeenCalledTimes(0);
      await operation.stop();
      expect(f.log).toEqual([...sourceReleaseOrder, ...row.attempted, ...row.cleanup]);
    }
  },
);

it.each(switchCleanupFailures)(
  "contains unexpected target exceptions without restoring the source: cleanup $stage",
  async (row) => {
    for (const seam of ["coordinator", "application"]) {
      const f = switchFixture();
      await activateSwitchSource(f);
      injectSwitchException(f, "repository.activate", new Error(switchPrivateFailure));
      f.faults.set(row.stage, [new Error("private cleanup failure")]);
      const operation =
        seam === "coordinator" ? f.owner : createCanonicalProjectApplication(f.owner);
      expect(await operation.switchProject(switchRequests.AB)).toEqual(
        switchTarget(switchBrokenTarget(row.code)),
      );
      const initial = [...sourceReleaseOrder, ...targetAcquireOrder, ...row.completed, row.stage];
      expect(f.log).toEqual(initial);
      await expectFailedSwitchOwnership(f);
      await operation.stop();
      expect(f.log).toEqual([...initial, ...row.remaining]);
      expect(f.projects.B.storage).toHaveBeenCalledTimes(1);
    }
  },
);

it("contains unexpected target exceptions without restoring the source: cleanup clock identity", async () => {
  for (const seam of ["coordinator", "application"]) {
    const f = switchFixture();
    await activateSwitchSource(f);
    injectSwitchException(f, "repository.activate", new Error(switchPrivateFailure));
    const clockError = new Error("private cleanup clock");
    injectSwitchCleanupClock(f, clockError);
    const operation = seam === "coordinator" ? f.owner : createCanonicalProjectApplication(f.owner);
    await expect(operation.switchProject(switchRequests.AB)).rejects.toBe(clockError);
    expect(f.clock).toHaveBeenCalledTimes(3);
    expect(f.log).toEqual([...sourceReleaseOrder, ...targetAcquireOrder]);
    await expectFailedSwitchOwnership(f);
    expect(f.clock).toHaveBeenCalledTimes(3);
    await operation.stop();
    expect(f.clock).toHaveBeenCalledTimes(4);
    expect(f.log).toEqual([
      ...sourceReleaseOrder,
      ...targetAcquireOrder,
      "B.lease.unlock",
      "B.lease.close",
      "B.storage.close",
    ]);
  }
});
