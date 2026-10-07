import { setImmediate as nextTurn } from "node:timers/promises";
import {
  decodeStrict,
  ProjectStorageOpenResultSchema,
  projectUpgradeDiagnostics,
} from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import {
  activationId,
  command,
  failure,
  fixture,
  request,
  unavailableMessage,
} from "../tests/integration/active-project-coordinator-fixture.js";
import {
  closesCoordinatorAdmission,
  rejectsIneligibleSwitchSource,
} from "../tests/integration/command-admission-cases.js";
import {
  activateSwitchSource,
  expectNoSwitchAcquisition,
  newAEpoch,
  requireSwitch,
  switchActive,
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
import { CanonicalCommandRepositoryError } from "./storage/canonical-command-repository.js";
import { CanonicalWriterLeaseError } from "./storage/canonical-writer-lease.js";

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
const alreadyActive = {
  status: "rejected",
  request,
  diagnostic: {
    code: "PROJECT_ALREADY_ACTIVE",
    message: "A Project activation already owns this harness session.",
    retryable: false,
  },
};

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
      const result = decodeStrict(ProjectStorageOpenResultSchema, {
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

it.each(["inactive", "stopped", "failed-acquisition"] as const)(
  "rejects ineligible switch sources before touching dependencies",
  rejectsIneligibleSwitchSource,
);

it.each(["stop", "initial"] as const)(
  "closes command admission in the same turn as lifecycle enqueue",
  closesCoordinatorAdmission,
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

it("refuses an upgrade while a Project is held or after stop", async () => {
  const upgradeRequest = { projectId: request.projectId };
  const f = fixture();
  expect(await f.owner.activate(request)).toEqual(writable);
  f.faults.set("storage", new Error("close failed"));
  await expect(f.owner.stop()).rejects.toThrow("Canonical Project activation release failed.");
  expect(await f.owner.upgrade(upgradeRequest)).toEqual({
    status: "rejected",
    request: upgradeRequest,
    diagnostic: projectUpgradeDiagnostics.alreadyActive,
  });
  await f.owner.stop();
  expect(await f.owner.upgrade(upgradeRequest)).toEqual({
    status: "unavailable",
    request: upgradeRequest,
    diagnostic: projectUpgradeDiagnostics.coordinatorStopped,
  });
  expect(f.dependencies.storage.upgrade).not.toHaveBeenCalled();
});

it("reports whether it holds a Project, including one whose release failed", async () => {
  const f = fixture();
  expect(f.owner.holdsProject?.()).toBe(false);
  expect(await f.owner.activate(request)).toEqual(writable);
  expect(f.owner.holdsProject?.()).toBe(true);
  f.faults.set("storage", new Error("close failed"));
  await expect(f.owner.stop()).rejects.toThrow("Canonical Project activation release failed.");
  expect(f.owner.holdsProject?.()).toBe(true);
  await f.owner.stop();
  expect(f.owner.holdsProject?.()).toBe(false);
});

it("reports a Project held while it is still activating or releasing", async () => {
  const f = fixture();
  const observed: Array<boolean | undefined> = [];
  const { session } = f;
  f.dependencies.storage.acquireActivation.mockImplementationOnce(async () => {
    observed.push(f.owner.holdsProject?.());
    return { status: "ready", session };
  });
  session.close.mockImplementationOnce(async () => {
    observed.push(f.owner.holdsProject?.());
  });
  expect(await f.owner.activate(request)).toEqual(writable);
  await f.owner.stop();
  expect(observed).toEqual([true, true]);
  expect(f.owner.holdsProject?.()).toBe(false);
});
