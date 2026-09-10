import { setImmediate as nextTurn } from "node:timers/promises";
import { expect, it } from "vitest";
import {
  CanonicalCommandRepositoryError,
  type WriterFenceCheck,
} from "../../src/storage/canonical-command-repository.js";
import { CanonicalWriterLeaseError } from "../../src/storage/canonical-writer-lease.js";
import { createOpeningRelease } from "../../src/storage/project-storage-opening.js";
import {
  activateSwitchSource,
  expectNoSwitchAcquisition,
  newAEpoch,
  observeSwitchPromise,
  requireSwitch,
  type SwitchFixture,
  safeSwitchStorage,
  sourceReleaseOrder,
  switchActive,
  switchAlreadyActive,
  switchBrokenTarget,
  switchCommandFailure,
  switchCommands,
  switchDeferred,
  switchFixture,
  switchProjects,
  switchReleaseFailure,
  switchRequests,
  switchSourceFailure,
  switchTarget,
  switchTimes,
  targetAcquireOrder,
} from "./project-storage-create-fixture.js";

it.each(["current", "stale", "rejected"] as const)(
  "waits for all admitted fence checks before switching ownership",
  async (outcome) => {
    const f = switchFixture();
    const switchProject = requireSwitch(f.owner);
    await activateSwitchSource(f);
    const first = switchDeferred<WriterFenceCheck>();
    const second = switchDeferred<WriterFenceCheck>();
    f.projects.A.repository.verifyFence
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const command1 = observeSwitchPromise(f.owner.execute(switchCommands.A));
    const command2 = observeSwitchPromise(f.owner.execute(switchCommands.ASecond));
    const switching = observeSwitchPromise(switchProject(switchRequests.AB));
    expect(await f.owner.execute(switchCommands.A)).toEqual(
      switchCommandFailure("coordinator-unavailable"),
    );
    expect(f.projects.A.repository.verifyFence).toHaveBeenCalledTimes(2);
    expect(command1.isSettled()).toBe(false);
    expect(command2.isSettled()).toBe(false);
    expect(f.log).toEqual([]);
    const status =
      outcome === "rejected"
        ? "broken"
        : outcome === "stale"
          ? "stale-writer"
          : "settlement-unavailable";
    if (outcome === "rejected") first.reject(new Error("private rejected fence"));
    else first.resolve({ status: outcome });
    expect(await command1.promise).toEqual(switchCommandFailure(status));
    await nextTurn();
    expect(command2.isSettled()).toBe(false);
    expect(switching.isSettled()).toBe(false);
    expect(f.log).toEqual([]);
    if (outcome === "rejected") second.reject(new Error("private rejected fence"));
    else second.resolve({ status: outcome });
    expect(await command2.promise).toEqual(switchCommandFailure(status, switchCommands.ASecond));
    expect(await switching.promise).toEqual(switchTarget());
    expect(f.log).toEqual([...sourceReleaseOrder, ...targetAcquireOrder]);
    await f.owner.stop();
  },
);

it("waits for all admitted fence checks before switching ownership", async () => {
  const f = switchFixture();
  const switchProject = requireSwitch(f.owner);
  await activateSwitchSource(f);
  const held = switchDeferred<WriterFenceCheck>();
  f.projects.A.repository.verifyFence
    .mockImplementationOnce(() => held.promise)
    .mockImplementationOnce(() => {
      // This throws in the repository call itself, not after awaiting a promise.
      throw new Error("private broken fence");
    });
  const first = observeSwitchPromise(f.owner.execute(switchCommands.A));
  const thrown = f.owner.execute(switchCommands.ASecond);
  const switching = observeSwitchPromise(switchProject(switchRequests.AB));
  expect(await thrown).toEqual(switchCommandFailure("broken", switchCommands.ASecond));
  expect(await f.owner.execute(switchCommands.A)).toEqual(
    switchCommandFailure("coordinator-unavailable"),
  );
  await nextTurn();
  expect(first.isSettled()).toBe(false);
  expect(switching.isSettled()).toBe(false);
  expect(f.projects.A.repository.verifyFence).toHaveBeenCalledTimes(2);
  expect(f.log).toEqual([]);
  held.resolve({ status: "current" });
  expect(await first.promise).toEqual(switchCommandFailure("settlement-unavailable"));
  expect(await switching.promise).toEqual(switchTarget());
  expect(f.log).toEqual([...sourceReleaseOrder, ...targetAcquireOrder]);
  await f.owner.stop();
});

it.each(["A.fence", "A.repository.close", "A.lease.close", "A.storage.close"])(
  "releases A completely before acquiring B",
  async (stage) => {
    const f = switchFixture();
    const switchProject = requireSwitch(f.owner);
    await activateSwitchSource(f);
    const hold = f.hold(stage);
    const switching = observeSwitchPromise(switchProject(switchRequests.AB));
    await nextTurn();
    expect(f.all).toContain(stage);
    expect(switching.isSettled()).toBe(false);
    expectNoSwitchAcquisition(f);
    hold.resolve();
    expect(await switching.promise).toEqual(switchTarget());
    expect(f.log).toEqual([...sourceReleaseOrder, ...targetAcquireOrder]);
    expect(f.projects.A.native.unlock).toHaveBeenCalledExactlyOnceWith(11, 0, 1);
    expect(f.projects.A.descriptor.close).toHaveBeenCalledTimes(1);
    expect(f.projects.A.repository.releaseFence).toHaveBeenCalledExactlyOnceWith(switchTimes.T1);
    expect(f.projects.B.activate).toHaveBeenCalledExactlyOnceWith({
      canonicalDatabasePath: "B/slopstop.db",
      projectId: switchProjects.B.projectId,
      activationId: switchProjects.B.activationId,
      writerToken: "a".repeat(64),
      activatedAt: switchTimes.T2,
    });
    expect(f.projects.A.storage).toHaveBeenCalledTimes(1);
    await f.owner.stop();
  },
);

const releaseCases = [
  { code: "WRITER_FENCE_RELEASE_FAILED", stage: "A.fence", completed: 0 },
  { code: "WRITER_FENCE_STALE", stage: "A.fence", completed: 0 },
  { code: "WRITER_REPOSITORY_CLOSE_FAILED", stage: "A.repository.close", completed: 1 },
  { code: "WRITER_LEASE_UNLOCK_FAILED", stage: "A.lease.unlock", completed: 2 },
  { code: "WRITER_LEASE_CLOSE_FAILED", stage: "A.lease.close", completed: 3 },
  { code: "PROJECT_STORAGE_RELEASE_FAILED", stage: "A.storage.close", completed: 4 },
  { code: "WRITER_LEASE_OPEN_FAILED", stage: "A.lease.release", completed: 2 },
  { code: "WRITER_LEASE_LOCK_FAILED", stage: "A.lease.release", completed: 2 },
] as const;

function injectReleaseFailure(f: SwitchFixture, row: (typeof releaseCases)[number]) {
  if (row.code === "WRITER_FENCE_STALE") {
    f.projects.A.repository.releaseFence.mockImplementation(async (time) => {
      await f.run("A.fence", `A.fence@${time}`);
      return { status: "stale" };
    });
  } else
    f.faults.set(row.stage, [
      new Error("private release failure"),
      new Error("private repeated failure"),
    ]);
  if (row.code !== "WRITER_LEASE_OPEN_FAILED" && row.code !== "WRITER_LEASE_LOCK_FAILED") return;
  const acquire = f.projects.A.lease.getMockImplementation();
  if (acquire === undefined) throw new Error("Missing lease port.");
  f.faults.set(row.stage, [
    new CanonicalWriterLeaseError(row.code),
    new CanonicalWriterLeaseError(row.code),
  ]);
  f.projects.A.lease.mockImplementationOnce(async () => {
    const result = await acquire();
    if (result.status !== "acquired") throw new Error("Expected retained lease.");
    return {
      status: "acquired",
      lease: {
        release: async () => {
          f.touch("A.lease.release");
          await result.lease.release();
        },
      },
    };
  });
}

function retryTimes(f: SwitchFixture) {
  f.clock.mockReset().mockReturnValue(switchTimes.T5);
  f.times(switchTimes.T3, switchTimes.T5);
}

it.each(releaseCases)(
  "retains the source epoch and resumes only unfinished switch release stages",
  async (row) => {
    const f = switchFixture();
    const switchProject = requireSwitch(f.owner);
    injectReleaseFailure(f, row);
    await activateSwitchSource(f);
    const failure = await switchProject(switchRequests.AB);
    expect(failure).toEqual(switchReleaseFailure(row.code));
    expect(f.log).toEqual([
      ...sourceReleaseOrder.slice(0, row.completed),
      row.stage === "A.fence" ? `A.fence@${switchTimes.T1}` : row.stage,
    ]);
    expectNoSwitchAcquisition(f);
    expect(await f.owner.execute(switchCommands.A)).toEqual(
      switchCommandFailure("coordinator-unavailable"),
    );
    const firstLog = [...f.log];
    await nextTurn();
    expect(f.log).toEqual(firstLog);
    retryTimes(f);
    f.reset();
    expect(await switchProject(switchRequests.AB)).toEqual(switchReleaseFailure(row.code));
    expect(f.log).toEqual([row.stage === "A.fence" ? `A.fence@${switchTimes.T3}` : row.stage]);
    expectNoSwitchAcquisition(f);
    f.projects.A.repository.releaseFence.mockImplementation(async (time) => {
      await f.run("A.fence", `A.fence@${time}`);
      return { status: "current" };
    });
    retryTimes(f);
    f.reset();
    expect(await switchProject(switchRequests.AB)).toEqual(switchTarget());
    const retryOrder = sourceReleaseOrder
      .slice(row.completed)
      .map((key) => key.replace(switchTimes.T1, switchTimes.T3));
    if (row.stage === "A.lease.release") retryOrder.unshift(row.stage);
    expect(f.log).toEqual([
      ...retryOrder,
      ...targetAcquireOrder.map((key) => key.replace(switchTimes.T2, switchTimes.T5)),
    ]);
    expect(f.projects.B.storage).toHaveBeenCalledTimes(1);
    expect(f.projects.A.repository.releaseFence.mock.calls.map((args) => args[0])).toEqual(
      row.completed === 0 ? [switchTimes.T1, switchTimes.T3, switchTimes.T3] : [switchTimes.T1],
    );
    expect(f.projects.A.native.unlock).toHaveBeenCalledTimes(
      row.stage === "A.lease.unlock" ? 3 : 1,
    );
    expect(await f.owner.execute(switchCommands.B)).toEqual(
      switchCommandFailure("settlement-unavailable", switchCommands.B),
    );
    expect(failure).toEqual(switchReleaseFailure(row.code));
    await f.owner.stop();
  },
);

it.each(["canonical", "runtime"] as const)(
  "retains the source epoch and resumes only unfinished switch release stages",
  async (failedClient) => {
    const f = switchFixture();
    const switchProject = requireSwitch(f.owner);
    const counts = { canonical: 0, runtime: 0 };
    const closeClient = async (name: keyof typeof counts) => {
      counts[name]++;
      if (name === failedClient && counts[name] === 1) throw new Error("private database close");
    };
    const release = createOpeningRelease({
      canonical: { close: () => closeClient("canonical") },
      runtime: { close: () => closeClient("runtime") },
    });
    f.projects.A.session.close.mockImplementation(async () => {
      await f.run("A.storage.close");
      await release();
    });
    await activateSwitchSource(f);
    expect(await switchProject(switchRequests.AB)).toEqual(
      switchReleaseFailure("PROJECT_STORAGE_RELEASE_FAILED"),
    );
    expect(counts).toEqual({ canonical: 1, runtime: 1 });
    expectNoSwitchAcquisition(f);
    f.reset();
    retryTimes(f);
    expect(await switchProject(switchRequests.AB)).toEqual(switchTarget());
    expect(counts).toEqual(
      failedClient === "canonical" ? { canonical: 2, runtime: 1 } : { canonical: 1, runtime: 2 },
    );
    expect(f.log).toEqual([
      "A.storage.close",
      ...targetAcquireOrder.map((key) => key.replace(switchTimes.T2, switchTimes.T5)),
    ]);
    expect(f.projects.A.repository.releaseFence).toHaveBeenCalledTimes(1);
    expect(f.projects.A.repository.close).toHaveBeenCalledTimes(1);
    expect(f.projects.A.native.unlock).toHaveBeenCalledTimes(1);
    expect(f.projects.A.descriptor.close).toHaveBeenCalledTimes(1);
    await f.owner.stop();
  },
);

it("reactivates the same Project with a new activation epoch", async () => {
  const f = switchFixture();
  const switchProject = requireSwitch(f.owner);
  await activateSwitchSource(f);
  expect(await switchProject(switchRequests.AA)).toEqual(
    switchTarget(switchActive("A", 2), switchRequests.AA),
  );
  expect(f.log).toEqual([
    ...sourceReleaseOrder,
    ...targetAcquireOrder.map((key) => key.replace(/^B\./, "A.")),
  ]);
  expect(f.projects.A.storage).toHaveBeenCalledTimes(2);
  expect(f.projects.A.lease).toHaveBeenCalledTimes(2);
  expect(await f.owner.execute(switchCommands.A)).toEqual(switchCommandFailure("stale-activation"));
  expect(f.projects.A.repository.verifyFence).toHaveBeenCalledTimes(0);
  expect(await f.owner.execute(switchCommands.ANew)).toEqual(
    switchCommandFailure("settlement-unavailable", switchCommands.ANew),
  );
  expect(f.projects.A.repository.verifyFence).toHaveBeenCalledTimes(1);
  f.reset();
  expect(await switchProject(switchRequests.AA)).toEqual(
    switchSourceFailure("stale-activation", switchRequests.AA),
  );
  expect(f.all).toEqual([]);
  await f.owner.stop();
});

it.each(["success", "storage-failed", "same-project"] as const)(
  "switches from read-only A without inventing Writer ownership",
  async (scenario) => {
    const f = switchFixture();
    const switchProject = requireSwitch(f.owner);
    await activateSwitchSource(f, "read-only");
    if (scenario === "storage-failed")
      f.faults.set("A.storage.close", [new Error("private storage")]);
    const request = scenario === "same-project" ? switchRequests.AA : switchRequests.AB;
    const first = await switchProject(request);
    if (scenario === "storage-failed") {
      expect(first).toEqual(switchReleaseFailure("PROJECT_STORAGE_RELEASE_FAILED"));
      expectNoSwitchAcquisition(f);
      f.reset();
      const stale = { ...request, from: { ...switchProjects.A, activationId: newAEpoch } };
      expect(await switchProject(stale)).toEqual(switchSourceFailure("stale-activation", stale));
      expect(f.all).toEqual([]);
      retryTimes(f);
      expect(await switchProject(request)).toEqual(switchTarget());
      expect(f.projects.A.session.close).toHaveBeenCalledTimes(2);
      expect(f.projects.B.storage).toHaveBeenCalledTimes(1);
    } else if (scenario === "same-project") {
      expect(first).toEqual(switchTarget(switchActive("A", 2, "read-only"), request));
      expect(f.log).toEqual([
        "A.storage.close",
        "A.storage.acquire",
        "A.activation-id",
        "A.lease.acquire",
        "A.lease.close",
      ]);
      expect(await f.owner.execute(switchCommands.A)).toEqual(
        switchCommandFailure("stale-activation"),
      );
    } else {
      expect(first).toEqual(switchTarget());
      expect(f.log).toEqual(["A.storage.close", ...targetAcquireOrder]);
    }
    expect(f.projects.A.repository.releaseFence).toHaveBeenCalledTimes(0);
    expect(f.projects.A.repository.close).toHaveBeenCalledTimes(0);
    expect(f.projects.A.native.unlock).toHaveBeenCalledTimes(0);
    expect(f.projects.A.activate).toHaveBeenCalledTimes(0);
    expect(f.all.filter((key) => key === "A.token")).toEqual([]);
    await f.owner.stop();
  },
);

const targetCases = [
  "writable",
  "contended",
  "safe-mode",
  "not-registered",
  "unavailable",
  "broken",
  "lease-open",
  "lease-lock",
  "repository",
] as const;
function targetOutcome(f: SwitchFixture, kind: (typeof targetCases)[number]) {
  const b = f.projects.B;
  switch (kind) {
    case "writable":
      return switchActive("B");
    case "contended":
      b.native.tryLock.mockReturnValue(false);
      return switchActive("B", 1, "read-only");
    case "safe-mode":
      return safeSwitchStorage(f);
    case "not-registered": {
      const result = { status: "not-registered" as const, request: switchRequests.AB.to };
      b.storage.mockImplementation(async () => {
        await f.run("B.storage.acquire");
        return { ...result, result };
      });
      return result;
    }
    case "unavailable":
    case "broken":
      b.storage.mockImplementation(async () => {
        await f.run("B.storage.acquire");
        return { status: kind, message: "private owner cause" };
      });
      return {
        status: kind,
        request: switchRequests.AB.to,
        diagnostic:
          kind === "broken"
            ? {
                code: "PROJECT_STORAGE_BROKEN",
                message: "Project Storage activation failed.",
                retryable: false,
              }
            : {
                code: "PROJECT_STORAGE_UNAVAILABLE",
                message: "Project Storage is unavailable.",
                retryable: true,
              },
      };
    case "lease-open":
      b.native.openLeaseFile.mockRejectedValueOnce(new Error("private open"));
      return switchBrokenTarget(
        "WRITER_LEASE_OPEN_FAILED",
        "Writer lease file could not be opened.",
      );
    case "lease-lock":
      b.native.tryLock.mockImplementationOnce(() => {
        throw new Error("private lock");
      });
      return switchBrokenTarget("WRITER_LEASE_LOCK_FAILED", "Writer lease could not be acquired.");
    case "repository":
      b.activate.mockResolvedValueOnce({
        status: "broken",
        error: new CanonicalCommandRepositoryError("WRITER_FENCE_ACTIVATION_FAILED"),
      });
      return switchBrokenTarget(
        "WRITER_FENCE_ACTIVATION_FAILED",
        "Writer fence could not be activated.",
      );
  }
}

function expectTargetResources(f: SwitchFixture, kind: (typeof targetCases)[number]) {
  if (["safe-mode", "not-registered", "unavailable", "broken"].includes(kind)) {
    expect(
      f.all.filter((key) =>
        ["B.activation-id", "B.token", "B.lease.acquire", "B.repository.activate"].includes(key),
      ),
    ).toEqual([]);
    expect(f.projects.B.lease).toHaveBeenCalledTimes(0);
    expect(f.projects.B.activate).toHaveBeenCalledTimes(0);
  }
  if (kind === "contended") {
    expect(f.all.filter((key) => key === "B.activation-id")).toHaveLength(1);
    expect(f.all.filter((key) => key === "B.token")).toHaveLength(0);
    expect(f.projects.B.activate).toHaveBeenCalledTimes(0);
  }
  if (kind === "safe-mode") expect(f.projects.B.session.close).toHaveBeenCalledTimes(1);
}

it.each(targetCases)(
  "returns the exact target activation outcome without rolling back released A",
  async (kind) => {
    const f = switchFixture();
    const switchProject = requireSwitch(f.owner);
    await activateSwitchSource(f);
    const target = targetOutcome(f, kind);
    expect(await switchProject(switchRequests.AB)).toEqual(switchTarget(target));
    expect(f.log.slice(0, 5)).toEqual(sourceReleaseOrder);
    expect(f.projects.A.storage).toHaveBeenCalledTimes(1);
    expect(f.projects.A.session.close).toHaveBeenCalledTimes(1);
    expect(f.projects.B.storage).toHaveBeenCalledTimes(1);
    const active = kind === "writable" || kind === "contended";
    expect(await f.owner.execute(switchCommands.A)).toEqual(
      switchCommandFailure(active ? "project-mismatch" : "inactive"),
    );
    const status =
      kind === "writable"
        ? "settlement-unavailable"
        : kind === "contended"
          ? "read-only"
          : "inactive";
    expect(await f.owner.execute(switchCommands.B)).toEqual(
      switchCommandFailure(status, switchCommands.B),
    );
    expectTargetResources(f, kind);
    if (!active) {
      expect(target).not.toHaveProperty("activationId");
      expect(await f.owner.activate(switchRequests.AC.to)).toEqual(switchActive("C"));
      expect(f.projects.C.storage).toHaveBeenCalledTimes(1);
      expect(f.projects.A.storage).toHaveBeenCalledTimes(1);
    }
    await f.owner.stop();
  },
);

const failedCleanupCases = [
  { kind: "unacquired", stage: "B.lease.close", code: "WRITER_LEASE_CLOSE_FAILED" },
  { kind: "repository", stage: "B.repository.close", code: "WRITER_REPOSITORY_CLOSE_FAILED" },
  { kind: "unlock", stage: "B.lease.unlock", code: "WRITER_LEASE_UNLOCK_FAILED" },
  { kind: "close", stage: "B.lease.close", code: "WRITER_LEASE_CLOSE_FAILED" },
  { kind: "safe-mode", stage: "B.storage.close", code: "PROJECT_STORAGE_RELEASE_FAILED" },
] as const;
function failedTargetCleanup(f: SwitchFixture, row: (typeof failedCleanupCases)[number]) {
  f.faults.set(row.stage, [new Error("private failed cleanup"), new Error("private failed stop")]);
  if (row.kind === "safe-mode") {
    safeSwitchStorage(f);
    return;
  }
  if (row.kind === "unacquired") {
    f.projects.B.native.tryLock.mockReturnValue(false);
    return;
  }
  f.projects.B.activate.mockImplementationOnce(async () => {
    if (row.kind !== "repository")
      return {
        status: "broken",
        error: new CanonicalCommandRepositoryError("WRITER_FENCE_ACTIVATION_FAILED"),
      };
    try {
      await f.projects.B.repository.close();
    } catch {
      return {
        status: "broken",
        error: new CanonicalCommandRepositoryError("WRITER_REPOSITORY_CLOSE_FAILED"),
        cleanup: { close: f.projects.B.repository.close },
      };
    }
    throw new Error("Expected failed repository cleanup.");
  });
}

it.each(failedCleanupCases)(
  "fences failed target cleanup without inventing an activation epoch",
  async (row) => {
    const f = switchFixture();
    const switchProject = requireSwitch(f.owner);
    await activateSwitchSource(f);
    failedTargetCleanup(f, row);
    expect(await switchProject(switchRequests.AB)).toEqual(
      switchTarget(switchBrokenTarget(row.code)),
    );
    expect(f.all.filter((key) => key === row.stage)).toHaveLength(1);
    expect(f.all.filter((key) => key === "B.activation-id")).toHaveLength(
      row.kind === "safe-mode" ? 0 : 1,
    );
    for (const input of [switchCommands.A, switchCommands.B])
      expect(await f.owner.execute(input)).toEqual(
        switchCommandFailure("coordinator-unavailable", input),
      );
    f.reset();
    const bc = { from: switchProjects.B, to: switchRequests.AC.to };
    expect(await switchProject(switchRequests.AB)).toEqual(
      switchSourceFailure("coordinator-unavailable"),
    );
    expect(await switchProject(bc)).toEqual(switchSourceFailure("coordinator-unavailable", bc));
    expect(await f.owner.activate(switchRequests.AC.to)).toEqual(switchAlreadyActive("C"));
    expect(f.all).toEqual([]);
    await expect(f.owner.stop()).rejects.toThrow("Canonical Project activation release failed.");
    expect(f.all.filter((key) => key === row.stage)).toHaveLength(1);
    f.reset();
    await f.owner.stop();
    const remaining = {
      unacquired: ["B.lease.close", "B.storage.close"],
      repository: ["B.repository.close", "B.lease.unlock", "B.lease.close", "B.storage.close"],
      unlock: ["B.lease.unlock", "B.lease.close", "B.storage.close"],
      close: ["B.lease.close", "B.storage.close"],
      "safe-mode": ["B.storage.close"],
    };
    expect(f.log).toEqual(remaining[row.kind]);
    expect(f.projects.A.storage).toHaveBeenCalledTimes(1);
    expect(f.projects.B.storage).toHaveBeenCalledTimes(1);
    expectNoSwitchAcquisition(f, "C");
    expect(await f.owner.execute(switchCommands.B)).toEqual(
      switchCommandFailure("coordinator-unavailable", switchCommands.B),
    );
  },
);

it.each(["switch", "stop"] as const)(
  "preserves owned resources when the release clock throws",
  async (operation) => {
    const f = switchFixture();
    const switchProject = operation === "switch" ? requireSwitch(f.owner) : undefined;
    await activateSwitchSource(f);
    const held = switchDeferred<WriterFenceCheck>();
    f.projects.A.repository.verifyFence.mockImplementationOnce(() => held.promise);
    const admitted = f.owner.execute(switchCommands.A);
    const error = new Error("private release clock");
    f.clock
      .mockReset()
      .mockImplementationOnce(() => {
        throw error;
      })
      .mockReturnValue(switchTimes.T5);
    const lifecycle =
      operation === "switch" && switchProject !== undefined
        ? switchProject(switchRequests.AB)
        : f.owner.stop();
    const rejected = expect(lifecycle).rejects.toBe(error);
    if (operation === "stop") expect(f.owner.stop()).toBe(lifecycle);
    await nextTurn();
    expect(f.clock).toHaveBeenCalledTimes(0);
    expect(f.log).toEqual([]);
    held.resolve({ status: "current" });
    const admittedResult = await admitted;
    await rejected;
    expect(f.log).toEqual([]);
    expectNoSwitchAcquisition(f);
    const executable = await f.owner.execute(switchCommands.A);
    expect(executable.status).toBe("settlement-unavailable");
    expect(executable).toEqual(switchCommandFailure("settlement-unavailable"));
    expect(admittedResult).toEqual(switchCommandFailure("settlement-unavailable"));
    f.times(switchTimes.T1, switchTimes.T2);
    if (switchProject !== undefined)
      expect(await switchProject(switchRequests.AB)).toEqual(switchTarget());
    else await f.owner.stop();
    expect(f.log).toEqual(
      { switch: [...sourceReleaseOrder, ...targetAcquireOrder], stop: sourceReleaseOrder }[
        operation
      ],
    );
    expect(f.projects.A.session.close).toHaveBeenCalledTimes(1);
    await f.owner.stop();
  },
);

it("preserves owned resources when the release clock throws", async () => {
  const f = switchFixture();
  const switchProject = requireSwitch(f.owner);
  await activateSwitchSource(f);
  f.faults.set("A.repository.close", [new Error("private close")]);
  expect(await switchProject(switchRequests.AB)).toEqual(
    switchReleaseFailure("WRITER_REPOSITORY_CLOSE_FAILED"),
  );
  f.reset();
  const error = new Error("private release clock");
  f.clock.mockReset().mockImplementationOnce(() => {
    throw error;
  });
  await expect(switchProject(switchRequests.AB)).rejects.toBe(error);
  expect(f.log).toEqual([]);
  const wrong = { ...switchRequests.AB, from: switchProjects.C };
  const stale = { ...switchRequests.AB, from: { ...switchProjects.A, activationId: newAEpoch } };
  expect(await switchProject(wrong)).toEqual(switchSourceFailure("project-mismatch", wrong));
  expect(await switchProject(stale)).toEqual(switchSourceFailure("stale-activation", stale));
  expect(f.clock).toHaveBeenCalledTimes(1);
  expect(await f.owner.execute(switchCommands.A)).toEqual(
    switchCommandFailure("coordinator-unavailable"),
  );
  retryTimes(f);
  expect(await switchProject(switchRequests.AB)).toEqual(switchTarget());
  expect(f.log).toEqual([
    ...sourceReleaseOrder.slice(1),
    ...targetAcquireOrder.map((key) => key.replace(switchTimes.T2, switchTimes.T5)),
  ]);
  expect(f.projects.A.repository.releaseFence).toHaveBeenCalledExactlyOnceWith(switchTimes.T1);
  await f.owner.stop();
});

it("preserves owned resources when the release clock throws", async () => {
  const f = switchFixture();
  const switchProject = requireSwitch(f.owner);
  await activateSwitchSource(f);
  safeSwitchStorage(f);
  const error = new Error("private cleanup clock");
  f.clock
    .mockReset()
    .mockReturnValueOnce(switchTimes.T1)
    .mockImplementationOnce(() => {
      throw error;
    })
    .mockReturnValueOnce(switchTimes.T3);
  await expect(switchProject(switchRequests.AB)).rejects.toBe(error);
  expect(f.clock).toHaveBeenCalledTimes(2);
  expect(f.log).toEqual([...sourceReleaseOrder, "B.storage.acquire"]);
  expect(f.projects.B.session.close).toHaveBeenCalledTimes(0);
  const bc = { from: switchProjects.B, to: switchRequests.AC.to };
  expect(await switchProject(bc)).toEqual(switchSourceFailure("coordinator-unavailable", bc));
  expect(f.clock).toHaveBeenCalledTimes(2);
  expect(await f.owner.execute(switchCommands.B)).toEqual(
    switchCommandFailure("coordinator-unavailable", switchCommands.B),
  );
  await f.owner.stop();
  expect(f.clock).toHaveBeenCalledTimes(3);
  expect(f.projects.B.session.close).toHaveBeenCalledTimes(1);
  expect(f.all.filter((key) => key === "B.activation-id")).toEqual([]);
});

const queuedSwitchCases = ["writable", "same-project", "not-registered", "release-failed"] as const;
async function expectQueuedSwitchOutcome(
  f: SwitchFixture,
  scenario: (typeof queuedSwitchCases)[number],
  second: ReturnType<ReturnType<typeof requireSwitch>>,
) {
  if (scenario === "release-failed") {
    expect(await second).toEqual(switchTarget(switchActive("C"), switchRequests.AC));
    expect(f.projects.A.repository.close).toHaveBeenCalledTimes(2);
    expect(f.projects.C.storage).toHaveBeenCalledTimes(1);
    expectNoSwitchAcquisition(f);
  } else {
    const status =
      scenario === "same-project"
        ? "stale-activation"
        : scenario === "not-registered"
          ? "inactive"
          : "project-mismatch";
    expect(await second).toEqual(switchSourceFailure(status, switchRequests.AC));
    expectNoSwitchAcquisition(f, "C");
    expect(f.projects.B.session.close).toHaveBeenCalledTimes(0);
  }
  expect(f.projects.A.session.close).toHaveBeenCalledTimes(1);
  if (scenario === "writable") {
    expect(f.projects.B.activate).toHaveBeenCalledTimes(1);
    expect(await f.owner.execute(switchCommands.B)).toEqual(
      switchCommandFailure("settlement-unavailable", switchCommands.B),
    );
  }
  if (scenario === "same-project")
    expect(await f.owner.execute(switchCommands.ANew)).toEqual(
      switchCommandFailure("settlement-unavailable", switchCommands.ANew),
    );
}

it.each(queuedSwitchCases)(
  "revalidates queued switch sources against the preceding lifecycle result",
  async (scenario) => {
    const f = switchFixture();
    const switchProject = requireSwitch(f.owner);
    await activateSwitchSource(f);
    const hold = f.hold("A.fence");
    if (scenario === "not-registered") targetOutcome(f, "not-registered");
    if (scenario === "release-failed")
      f.faults.set("A.repository.close", [new Error("private close")]);
    const firstRequest = scenario === "same-project" ? switchRequests.AA : switchRequests.AB;
    const first = switchProject(firstRequest);
    const second = switchProject(switchRequests.AC);
    await nextTurn();
    expect(f.all).toContain("A.fence");
    expectNoSwitchAcquisition(f, "C");
    hold.resolve();
    const firstTarget =
      scenario === "same-project"
        ? switchActive("A", 2)
        : scenario === "not-registered"
          ? { status: "not-registered", request: switchRequests.AB.to }
          : switchActive("B");
    expect(await first).toEqual(
      scenario === "release-failed"
        ? switchReleaseFailure("WRITER_REPOSITORY_CLOSE_FAILED")
        : switchTarget(firstTarget, firstRequest),
    );
    await expectQueuedSwitchOutcome(f, scenario, second);
    await f.owner.stop();
  },
);

it("orders stop and activation behind switching without reopening admission", async () => {
  const f = switchFixture();
  const switchProject = requireSwitch(f.owner);
  await activateSwitchSource(f);
  const aHeld = f.hold("A.fence");
  const bHeld = f.hold("B.fence");
  const switching = switchProject(switchRequests.AB);
  const stop = f.owner.stop();
  const stopped = observeSwitchPromise(stop);
  expect(f.owner.stop()).toBe(stop);
  await nextTurn();
  expect(f.all).toContain("A.fence");
  aHeld.resolve();
  expect(await switching).toEqual(switchTarget());
  expect(await f.owner.execute(switchCommands.B)).toEqual(
    switchCommandFailure("coordinator-unavailable", switchCommands.B),
  );
  await nextTurn();
  expect(f.all).toContain("B.fence");
  expect(stopped.isSettled()).toBe(false);
  expect(f.projects.B.repository.verifyFence).toHaveBeenCalledTimes(0);
  bHeld.resolve();
  await stop;
  expect(f.log).toEqual([
    ...sourceReleaseOrder,
    ...targetAcquireOrder,
    `B.fence@${switchTimes.T5}`,
    "B.repository.close",
    "B.lease.unlock",
    "B.lease.close",
    "B.storage.close",
  ]);
  expect(await f.owner.execute(switchCommands.B)).toEqual(
    switchCommandFailure("coordinator-unavailable", switchCommands.B),
  );
});

it.each([
  "stop-first",
  "activate-rejected",
  "activate-after-missing",
  "wrong-source",
  "failed-stop",
] as const)(
  "orders stop and activation behind switching without reopening admission",
  async (scenario) => {
    const f = switchFixture();
    const switchProject = requireSwitch(f.owner);
    await activateSwitchSource(f);
    if (scenario === "stop-first") {
      const stop = f.owner.stop();
      const switching = switchProject(switchRequests.AB);
      await stop;
      expect(await switching).toEqual(switchSourceFailure("coordinator-unavailable"));
      expectNoSwitchAcquisition(f);
    } else if (scenario === "wrong-source") {
      const wrong = { ...switchRequests.AB, from: switchProjects.C };
      const rejected = switchProject(wrong);
      const valid = switchProject(switchRequests.AB);
      expect(await rejected).toEqual(switchSourceFailure("project-mismatch", wrong));
      expect(await valid).toEqual(switchTarget());
      expect(await f.owner.execute(switchCommands.B)).toEqual(
        switchCommandFailure("settlement-unavailable", switchCommands.B),
      );
    } else if (scenario === "failed-stop") {
      f.faults.set("A.repository.close", [new Error("private stop failure")]);
      await expect(f.owner.stop()).rejects.toThrow("Canonical Project activation release failed.");
      expect(await switchProject(switchRequests.AB)).toEqual(switchTarget());
      await f.owner.stop();
      expect(f.projects.B.session.close).toHaveBeenCalledTimes(1);
    } else await queuedActivation(f, scenario);
    await f.owner.stop();
  },
);

async function queuedActivation(
  f: SwitchFixture,
  scenario: "activate-rejected" | "activate-after-missing",
) {
  const switchProject = requireSwitch(f.owner);
  const hold = f.hold("A.fence");
  if (scenario === "activate-after-missing") targetOutcome(f, "not-registered");
  const switching = switchProject(switchRequests.AB);
  const activation = f.owner.activate(switchRequests.AC.to);
  await nextTurn();
  expect(f.all).toContain("A.fence");
  expectNoSwitchAcquisition(f, "C");
  hold.resolve();
  expect(await switching).toEqual(
    switchTarget(
      scenario === "activate-rejected"
        ? switchActive("B")
        : { status: "not-registered", request: switchRequests.AB.to },
    ),
  );
  expect(await activation).toEqual(
    scenario === "activate-rejected" ? switchAlreadyActive("C") : switchActive("C"),
  );
  if (scenario === "activate-rejected") {
    expectNoSwitchAcquisition(f, "C");
    expect(f.projects.B.session.close).toHaveBeenCalledTimes(0);
    expect(await f.owner.execute(switchCommands.B)).toEqual(
      switchCommandFailure("settlement-unavailable", switchCommands.B),
    );
  } else {
    expect(f.projects.C.storage).toHaveBeenCalledTimes(1);
    expect(f.log).toEqual([
      ...sourceReleaseOrder,
      "B.storage.acquire",
      "C.storage.acquire",
      "C.activation-id",
      "C.lease.acquire",
      "C.token",
      `C.repository.activate@${switchTimes.T2}`,
    ]);
  }
}

import { vi } from "vitest";
import { createUnavailableProjectStorageApplication } from "../../src/project-storage-application.js";
import {
  activateSwitchChannel,
  expectFailedSwitchOwnership,
  injectSwitchCleanupClock,
  injectSwitchException,
  switchChannel,
  switchCleanupFailures,
  switchEvent,
  switchExceptionCases,
  switchInternalFailure,
  switchMessages,
  switchPrivateFailure,
} from "./project-storage-create-fixture.js";

it("round-trips safe switching through real runtime application coordinator and Writer", async () => {
  const f = switchFixture();
  const storage = {
    ...createUnavailableProjectStorageApplication(),
    stop: vi.fn(async () => f.touch("storage.stop")),
  };
  const channel = switchChannel(f.owner, storage);
  const expected = [switchEvent(1, 401, "project.activate.result", switchActive("A"))];
  try {
    await activateSwitchChannel(f, channel);
    await channel.post(switchMessages.switch);
    expected.push(switchEvent(2, 402, "project.switch.result", switchTarget()));
    await channel.expectEvents(expected);
    expect(f.log).toEqual([...sourceReleaseOrder, ...targetAcquireOrder]);
    await channel.post(switchMessages.A);
    expected.push(
      switchEvent(3, 403, "project.command.result", switchCommandFailure("project-mismatch")),
    );
    await channel.expectEvents(expected);
    await channel.post(switchMessages.B);
    expected.push(
      switchEvent(
        4,
        404,
        "project.command.result",
        switchCommandFailure("settlement-unavailable", switchCommands.B),
      ),
    );
    await channel.expectEvents(expected);
    expect(f.projects.A.repository.verifyFence).toHaveBeenCalledTimes(0);
    expect(f.projects.B.repository.verifyFence).toHaveBeenCalledTimes(1);
  } finally {
    await channel.stop();
  }
  expect(f.log).toEqual([
    ...sourceReleaseOrder,
    ...targetAcquireOrder,
    `B.fence@${switchTimes.T5}`,
    "B.repository.close",
    "B.lease.unlock",
    "B.lease.close",
    "B.storage.close",
    "storage.stop",
  ]);
  expect(storage.stop).toHaveBeenCalledTimes(1);
});

it.each(switchExceptionCases)(
  "contains unexpected target exceptions without restoring the source over MessagePorts: $stage",
  async (row) => {
    const f = switchFixture();
    const channel = switchChannel(f.owner);
    try {
      await activateSwitchChannel(f, channel);
      injectSwitchException(f, row.stage, new Error(switchPrivateFailure));
      await channel.post(switchMessages.switch);
      const expected = [
        switchEvent(1, 401, "project.activate.result", switchActive("A")),
        switchEvent(2, 402, "request.failure", switchInternalFailure),
      ];
      await channel.expectEvents(expected);
      const log = [...sourceReleaseOrder, ...row.attempted, ...row.cleanup];
      expect(f.log).toEqual(log);
      await channel.post(switchMessages.A);
      expected.push(
        switchEvent(3, 403, "project.command.result", switchCommandFailure("inactive")),
      );
      await channel.post(switchMessages.B);
      expected.push(
        switchEvent(
          4,
          404,
          "project.command.result",
          switchCommandFailure("inactive", switchCommands.B),
        ),
      );
      await channel.expectEvents(expected);
      expect(f.log).toEqual(log);
      expect(f.projects.A.storage).toHaveBeenCalledTimes(1);
      expect(f.projects.B.repository.close).toHaveBeenCalledTimes(0);
      expect(f.projects.B.repository.releaseFence).toHaveBeenCalledTimes(0);
    } finally {
      await channel.stop();
    }
  },
);

it.each(switchCleanupFailures)(
  "contains unexpected target exceptions without restoring the source over MessagePorts: cleanup $stage",
  async (row) => {
    const f = switchFixture();
    const channel = switchChannel(f.owner);
    const initial = [...sourceReleaseOrder, ...targetAcquireOrder, ...row.completed, row.stage];
    try {
      await activateSwitchChannel(f, channel);
      injectSwitchException(f, "repository.activate", new Error(switchPrivateFailure));
      f.faults.set(row.stage, [new Error("private cleanup failure")]);
      await channel.post(switchMessages.switch);
      await channel.expectEvents([
        switchEvent(1, 401, "project.activate.result", switchActive("A")),
        switchEvent(2, 402, "project.switch.result", switchTarget(switchBrokenTarget(row.code))),
      ]);
      expect(f.log).toEqual(initial);
      await expectFailedSwitchOwnership(f);
    } finally {
      await channel.stop();
    }
    expect(f.log).toEqual([...initial, ...row.remaining]);
  },
);

it("contains unexpected target exceptions without restoring the source over MessagePorts: cleanup clock", async () => {
  const f = switchFixture();
  const channel = switchChannel(f.owner);
  try {
    await activateSwitchChannel(f, channel);
    injectSwitchException(f, "repository.activate", new Error(switchPrivateFailure));
    injectSwitchCleanupClock(f, new Error("private cleanup clock"));
    await channel.post(switchMessages.switch);
    await channel.expectEvents([
      switchEvent(1, 401, "project.activate.result", switchActive("A")),
      switchEvent(2, 402, "request.failure", switchInternalFailure),
    ]);
    expect(f.clock).toHaveBeenCalledTimes(3);
    expect(f.log).toEqual([...sourceReleaseOrder, ...targetAcquireOrder]);
    await expectFailedSwitchOwnership(f);
    expect(f.clock).toHaveBeenCalledTimes(3);
  } finally {
    await channel.stop();
  }
  expect(f.clock).toHaveBeenCalledTimes(4);
  expect(f.log).toEqual([
    ...sourceReleaseOrder,
    ...targetAcquireOrder,
    "B.lease.unlock",
    "B.lease.close",
    "B.storage.close",
  ]);
});

import { createProjectCommand } from "@slopstop/protocol";
import { switchMetadata } from "./project-storage-create-fixture.js";

const admittedFenceStatuses = {
  current: "settlement-unavailable",
  stale: "stale-writer",
  rejected: "broken",
} as const;
type AdmittedFenceOutcome = keyof typeof admittedFenceStatuses;

function settleAdmittedFence(
  check: ReturnType<typeof switchDeferred<WriterFenceCheck>>,
  outcome: AdmittedFenceOutcome,
) {
  if (outcome === "rejected") check.reject(new Error("private rejected fence"));
  else check.resolve({ status: outcome });
}

async function expectAdmittedDrainHeld(
  f: SwitchFixture,
  channel: ReturnType<typeof switchChannel>,
  expected: unknown[],
) {
  await channel.expectEvents(expected);
  expect(f.log).toEqual([]);
  expect(f.clock).toHaveBeenCalledTimes(0);
  expectNoSwitchAcquisition(f);
  expect(f.projects.A.repository.verifyFence).toHaveBeenCalledTimes(2);
}

it.each([
  { first: "current", second: "current" },
  { first: "stale", second: "stale" },
  { first: "rejected", second: "rejected" },
  { first: "current", second: "rejected" },
] as const)(
  "waits for all admitted fence checks before switching ownership over real runtime MessagePorts: $first/$second",
  async ({ first: firstOutcome, second: secondOutcome }) => {
    const f = switchFixture();
    const first = switchDeferred<WriterFenceCheck>();
    const second = switchDeferred<WriterFenceCheck>();
    const channel = switchChannel(f.owner);
    const expected = [switchEvent(1, 401, "project.activate.result", switchActive("A"))];
    try {
      await activateSwitchChannel(f, channel);
      f.projects.A.repository.verifyFence
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise);
      await channel.post(switchMessages.A);
      await channel.post(createProjectCommand(switchMetadata(407), switchCommands.ASecond));
      await expectAdmittedDrainHeld(f, channel, expected);
      await channel.post(switchMessages.switch);
      await expectAdmittedDrainHeld(f, channel, expected);
      await channel.post(createProjectCommand(switchMetadata(408), switchCommands.A));
      expected.push(
        switchEvent(
          2,
          408,
          "project.command.result",
          switchCommandFailure("coordinator-unavailable"),
        ),
      );
      await expectAdmittedDrainHeld(f, channel, expected);
      settleAdmittedFence(first, firstOutcome);
      await nextTurn();
      expected.push(
        switchEvent(
          3,
          403,
          "project.command.result",
          switchCommandFailure(admittedFenceStatuses[firstOutcome]),
        ),
      );
      await expectAdmittedDrainHeld(f, channel, expected);
      settleAdmittedFence(second, secondOutcome);
      await nextTurn();
      expected.push(
        switchEvent(
          4,
          407,
          "project.command.result",
          switchCommandFailure(admittedFenceStatuses[secondOutcome], switchCommands.ASecond),
        ),
        switchEvent(5, 402, "project.switch.result", switchTarget()),
      );
      await channel.expectEvents(expected);
      expect(f.log).toEqual([...sourceReleaseOrder, ...targetAcquireOrder]);
      expect(f.projects.A.repository.verifyFence).toHaveBeenCalledTimes(2);
      expect(f.projects.A.repository.releaseFence).toHaveBeenCalledExactlyOnceWith(switchTimes.T1);
      expect(f.projects.B.storage).toHaveBeenCalledTimes(1);
    } finally {
      first.resolve({ status: "current" });
      second.resolve({ status: "current" });
      await channel.stop();
    }
    expect(f.log).toEqual([
      ...sourceReleaseOrder,
      ...targetAcquireOrder,
      `B.fence@${switchTimes.T5}`,
      "B.repository.close",
      "B.lease.unlock",
      "B.lease.close",
      "B.storage.close",
    ]);
  },
);
