import { setImmediate as nextTurn } from "node:timers/promises";
import {
  decodeStrict,
  ProjectStorageOpenResultSchema,
  projectUpgradeDiagnostics,
} from "@slopstop/protocol";
import { describe, expect, it, vi } from "vitest";
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

import { CanonicalProjectSwitchResultSchema } from "@slopstop/protocol";
import { unusedProjectUpgrade } from "../tests/integration/canonical-runtime-application-fixture.js";
import { createActiveProjectCoordinator } from "./active-project-coordinator.js";
import {
  CanonicalProjectWriterReleaseError,
  createCanonicalProjectWriter,
} from "./canonical-project-writer.js";

it.each(["WRITER_CLIENT_ABANDON_FAILED", "WRITER_FENCE_RELEASE_FAILED"] as const)(
  "answers a switch whose writer release fails with %s as release-failed (CNV-B36)",
  async (code) => {
    const f = switchFixture();
    const owner = createActiveProjectCoordinator({
      ...f.dependencies,
      storage: { ...f.dependencies.storage, upgrade: unusedProjectUpgrade },
      createWriter: (input) => ({
        ...createCanonicalProjectWriter(input),
        close: async () => {
          throw new CanonicalProjectWriterReleaseError(code);
        },
      }),
    });
    expect(await owner.activate({ projectId: switchProjects.A.projectId })).toMatchObject({
      status: "active",
      access: "read-write",
    });
    const result = await owner.switchProject?.(switchRequests.AB);
    expect(decodeStrict(CanonicalProjectSwitchResultSchema, result)).toEqual({
      status: "release-failed",
      request: switchRequests.AB,
      diagnostic: {
        code,
        message: "Project activation resources could not be released.",
        retryable: true,
      },
    });
  },
);

type AdmissionRow = Readonly<{
  pending: boolean;
  state: "inactive" | "active" | "stopped" | "release-failed";
  project: "same" | "other";
  activation: "same" | "stale";
  access: "read-write" | "read-only";
  expected: string;
}>;

const admissionRows: readonly AdmissionRow[] = [
  {
    pending: true,
    state: "active",
    project: "same",
    activation: "same",
    access: "read-write",
    expected: "coordinator-unavailable",
  },
  {
    pending: true,
    state: "inactive",
    project: "same",
    activation: "same",
    access: "read-write",
    expected: "coordinator-unavailable",
  },
  {
    pending: false,
    state: "inactive",
    project: "same",
    activation: "same",
    access: "read-write",
    expected: "inactive",
  },
  {
    pending: false,
    state: "stopped",
    project: "same",
    activation: "same",
    access: "read-write",
    expected: "coordinator-unavailable",
  },
  {
    pending: false,
    state: "release-failed",
    project: "same",
    activation: "same",
    access: "read-write",
    expected: "coordinator-unavailable",
  },
  {
    pending: false,
    state: "active",
    project: "other",
    activation: "same",
    access: "read-write",
    expected: "project-mismatch",
  },
  {
    pending: false,
    state: "active",
    project: "other",
    activation: "same",
    access: "read-only",
    expected: "project-mismatch",
  },
  {
    pending: false,
    state: "active",
    project: "same",
    activation: "stale",
    access: "read-write",
    expected: "stale-activation",
  },
  {
    pending: false,
    state: "active",
    project: "same",
    activation: "stale",
    access: "read-only",
    expected: "stale-activation",
  },
  {
    pending: false,
    state: "active",
    project: "same",
    activation: "same",
    access: "read-only",
    expected: "read-only",
  },
];

/** Brings the switch fixture into the row's state; returns the still-pending lifecycle, if any. */
async function arrangeAdmission(f: ReturnType<typeof switchFixture>, row: AdmissionRow) {
  const held = row.project === "same" ? "A" : "B";
  if (row.state !== "inactive") {
    if (row.access === "read-only") f.projects[held].native.tryLock.mockReturnValue(false);
    expect(await f.owner.activate({ projectId: switchProjects[held].projectId })).toMatchObject({
      status: "active",
      access: row.access,
    });
  }
  if (row.state === "stopped") await f.owner.stop();
  if (row.state === "release-failed") {
    f.faults.set(`${held}.repository.close`, [new Error("private release failure")]);
    await expect(f.owner.stop()).rejects.toThrow();
  }
  if (!row.pending) return { lifecycle: undefined };
  // Wrapped, so awaiting this arrangement does not await the lifecycle it starts.
  return {
    lifecycle:
      row.state === "inactive"
        ? f.owner.activate({ projectId: switchProjects.A.projectId })
        : f.owner.stop(),
  };
}

it.each(admissionRows)(
  "refuses $expected when lifecycle pending=$pending, state=$state, project=$project, activation=$activation, access=$access (CNV-B29)",
  async (row) => {
    // A fake read-only reader: the admitted read-only row reads its page without a worker.
    const f = switchFixture(false, {
      readConversationReadOnly: () => Effect.succeed({ conversation: null }),
    });
    const { lifecycle } = await arrangeAdmission(f, row);
    const activationId = row.activation === "same" ? switchProjects.A.activationId : newAEpoch;
    const command = { ...switchCommands.A, activationId };
    const target = { projectId: switchProjects.A.projectId, activationId };
    const [executed, saved, read] = await Promise.all([
      f.owner.execute(command),
      f.owner.conversationSave({
        ...target,
        saveId: "00000000-0000-4000-8000-000000000031",
        expectedRevision: 0,
        text: "refused",
      }),
      f.owner.conversationRead({ ...target, after: null }),
    ]);
    await lifecycle;
    expect(executed.status).toBe(row.expected);
    expect(saved.status).toBe(row.expected);
    if (row.expected === "read-only")
      expect(read).toMatchObject({ status: "read", conversation: null });
    else expect(read.status).toBe(row.expected);
  },
);

import { Effect } from "effect";
import type { ConversationPorts } from "./active-project-conversation.js";

/** A gate a test opens; until then, the work behind it waits. */
function gate() {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

/**
 * A coordinator over the switch fixture whose read-only reads and writer saves wait for `held`;
 * the order of the read, save and lifecycle answers is recorded.
 */
function heldConversationCoordinator(held: Promise<void>) {
  const f = switchFixture();
  const order: string[] = [];
  const owner = createActiveProjectCoordinator({
    ...f.dependencies,
    storage: { ...f.dependencies.storage, upgrade: unusedProjectUpgrade },
    readConversationReadOnly: () =>
      Effect.promise(async () => {
        await held;
        return { conversation: null };
      }),
    createWriter: (input) => {
      const writer = createCanonicalProjectWriter(input);
      return {
        ...writer,
        conversation: async () => {
          await held;
          return { status: "writer-unavailable" } as const;
        },
        // Refuses every read in its slot, so reads fall back to the held read-only reader.
        conversationRead: async () => ({ status: "writer-unavailable" }) as const,
        close: async (time) => {
          order.push("writer.close");
          return writer.close(time);
        },
      };
    },
  });
  return { f, owner, order };
}

const sameTurnLifecycles = ["switch", "stop"] as const;

type HeldOwner = ReturnType<typeof heldConversationCoordinator>["owner"];

/** Same-turn rows: the work sent, its access, and the answers in order before the lifecycle. */
const sameTurnRows = [
  {
    work: "read-only read",
    access: "read-only",
    send: (owner: HeldOwner) => owner.conversationRead({ ...switchProjects.A, after: null }),
    answered: ["read"],
  },
  {
    work: "save",
    access: "read-write",
    send: (owner: HeldOwner) =>
      owner.conversationSave({
        ...switchProjects.A,
        saveId: "00000000-0000-4000-8000-000000000051",
        expectedRevision: 0,
        text: "held",
      }),
    answered: ["writer-unavailable", "writer.close"],
  },
  {
    work: "fallback read (phase 2)",
    access: "read-write",
    send: (owner: HeldOwner) => owner.conversationRead({ ...switchProjects.A, after: null }),
    answered: ["read", "writer.close"],
  },
] as const;

describe.each(sameTurnRows)("a $work sent in the same turn as a lifecycle", (row) => {
  it.each(sameTurnLifecycles)("is drained before %s releases (CNV-B14)", async (lifecycle) => {
    const held = gate();
    const { f, owner, order } = heldConversationCoordinator(held.opened);
    if (row.access === "read-only") f.projects.A.native.tryLock.mockReturnValue(false);
    expect(await owner.activate({ projectId: switchProjects.A.projectId })).toMatchObject({
      access: row.access,
    });
    const work = row.send(owner).then((result) => order.push(result.status));
    const released = (
      lifecycle === "switch" ? owner.switchProject(switchRequests.AB) : owner.stop()
    ).then(() => order.push(lifecycle));
    await nextTurn();
    await nextTurn();
    expect(order).toEqual([]);
    expect(f.projects.A.session.close).not.toHaveBeenCalled();
    held.open();
    await Promise.all([work, released]);
    expect(order).toEqual([...row.answered, lifecycle]);
    expect(f.projects.A.session.close).toHaveBeenCalledOnce();
  });
});

import type { CanonicalProjectWriter } from "./canonical-project-writer.js";
import {
  ConversationStorageBroken,
  ConversationStorageBusy,
} from "./conversation/conversation-errors.js";
import type { ProjectConversationPage } from "./conversation/conversation-store.js";
import type { LocalLibsqlTransaction } from "./storage/local-libsql-worker-client.js";

const fallbackPage: ProjectConversationPage = {
  conversation: {
    conversationId: "00000000-0000-4000-8000-000000000061",
    branchId: "00000000-0000-4000-8000-000000000062",
    revision: 101,
    messages: [
      {
        messageId: "00000000-0000-4000-8000-000000000063",
        cursor: 101,
        author: "user",
        text: "m101",
        savedAt: "2026-10-10T12:00:00.000Z",
      },
    ],
    nextCursor: null,
  },
};

type WriterReadAnswer = "refused" | "page";

/** A transaction whose every statement answers no rows: a read of it finds no conversation. */
const emptyTransaction: LocalLibsqlTransaction = {
  closed: false,
  execute: async () => ({ columns: [], rows: [], rowsAffected: 0, lastInsertRowid: null }),
  commit: async () => undefined,
  rollback: async () => undefined,
  close: async () => undefined,
};

/** A writer read that refuses, or runs the work on an empty transaction. */
function writerRead(answer: WriterReadAnswer): CanonicalProjectWriter["conversationRead"] {
  return async (work) =>
    answer === "refused"
      ? { status: "writer-unavailable" }
      : {
          status: "completed",
          result: await Effect.runPromise(Effect.result(work(emptyTransaction))),
        };
}

/**
 * A coordinator over the switch fixture whose writer answers reads with `writerRead` (a refusal
 * or a page) and saves with writer-unavailable, and whose read-only port answers `port`.
 */
function fallbackCoordinator(
  readAnswer: WriterReadAnswer,
  port: ConversationPorts["readConversationReadOnly"],
) {
  const f = switchFixture();
  const readConversationReadOnly = vi.fn(port);
  const owner = createActiveProjectCoordinator({
    ...f.dependencies,
    storage: { ...f.dependencies.storage, upgrade: unusedProjectUpgrade },
    readConversationReadOnly,
    createWriter: (input) => ({
      ...createCanonicalProjectWriter(input),
      conversationRead: writerRead(readAnswer),
      conversation: async () => ({ status: "writer-unavailable" }) as const,
    }),
  });
  return { f, owner, readConversationReadOnly };
}

it.each([null, 100])(
  "routes a refused read to the read-only reader with after=%s (CNV-B38)",
  async (after) => {
    const { owner, readConversationReadOnly } = fallbackCoordinator("refused", () =>
      Effect.succeed(fallbackPage),
    );
    await owner.activate({ projectId: switchProjects.A.projectId });
    expect(await owner.conversationRead({ ...switchProjects.A, after })).toMatchObject({
      status: "read",
      conversation: { revision: 101, messages: [{ cursor: 101, text: "m101" }] },
    });
    expect(readConversationReadOnly).toHaveBeenCalledExactlyOnceWith({
      canonicalDatabasePath: "A/slopstop.db",
      projectId: switchProjects.A.projectId,
      after,
    });
    await owner.stop();
  },
);

it("keeps a writer's page and a refused save as they are (CNV-B38)", async () => {
  const { owner, readConversationReadOnly } = fallbackCoordinator("page", () =>
    Effect.succeed(fallbackPage),
  );
  await owner.activate({ projectId: switchProjects.A.projectId });
  expect(await owner.conversationRead({ ...switchProjects.A, after: null })).toMatchObject({
    status: "read",
    conversation: null,
  });
  expect(
    await owner.conversationSave({
      ...switchProjects.A,
      saveId: "00000000-0000-4000-8000-000000000064",
      expectedRevision: 0,
      text: "refused",
    }),
  ).toMatchObject({ status: "writer-unavailable" });
  expect(readConversationReadOnly).not.toHaveBeenCalled();
  await owner.stop();
});

it("reads a read-only activation through the read-only reader directly (CNV-B38)", async () => {
  const { f, owner, readConversationReadOnly } = fallbackCoordinator("page", () =>
    Effect.succeed(fallbackPage),
  );
  f.projects.A.native.tryLock.mockReturnValue(false);
  await owner.activate({ projectId: switchProjects.A.projectId });
  expect(await owner.conversationRead({ ...switchProjects.A, after: null })).toMatchObject({
    status: "read",
    conversation: { revision: 101 },
  });
  expect(readConversationReadOnly).toHaveBeenCalledExactlyOnceWith({
    canonicalDatabasePath: "A/slopstop.db",
    projectId: switchProjects.A.projectId,
    after: null,
  });
  await owner.stop();
});

it.each([
  [
    "busy",
    new ConversationStorageBusy({ cause: "held" }),
    "unavailable",
    "PROJECT_STORAGE_UNAVAILABLE",
  ],
  [
    "broken",
    new ConversationStorageBroken({ cause: "corrupt" }),
    "broken",
    "PROJECT_STORAGE_BROKEN",
  ],
] as const)(
  "answers a %s read-only reader after a refused read with its row (CNV-B38)",
  async (_name, failure, status, code) => {
    const { owner } = fallbackCoordinator("refused", () => Effect.fail(failure));
    await owner.activate({ projectId: switchProjects.A.projectId });
    expect(await owner.conversationRead({ ...switchProjects.A, after: null })).toMatchObject({
      status,
      diagnostic: { code },
    });
    await owner.stop();
  },
);

it("routes a read to the read-only reader after a failed command snapshot closes admission (G17)", async () => {
  const readConversationReadOnly = vi.fn(() => Effect.succeed(fallbackPage));
  const f = switchFixture(false, { readConversationReadOnly });
  expect(await f.owner.activate({ projectId: switchProjects.A.projectId })).toMatchObject({
    access: "read-write",
  });
  const command = { ...switchCommands.A, command: { ...switchCommands.A.command } };
  const unreadable = new Error("private unreadable payload");
  Object.defineProperty(command.command, "payload", {
    enumerable: true,
    get: () => {
      throw unreadable;
    },
  });
  await expect(f.owner.execute(command)).rejects.toBe(unreadable);
  expect(await f.owner.conversationRead({ ...switchProjects.A, after: 100 })).toMatchObject({
    status: "read",
    conversation: { revision: 101 },
  });
  expect(readConversationReadOnly).toHaveBeenCalledExactlyOnceWith({
    canonicalDatabasePath: "A/slopstop.db",
    projectId: switchProjects.A.projectId,
    after: 100,
  });
  await f.owner.stop();
});

import type { ActiveProjectCoordinatorDependencies } from "./active-project-coordinator.js";

/** A coordinator over the switch fixture whose writer answers saves with `save`. */
function saveCoordinator(
  save: CanonicalProjectWriter["conversation"],
  ports: Pick<
    ActiveProjectCoordinatorDependencies,
    "createConversationId" | "openReconciliationClient"
  >,
) {
  const f = switchFixture();
  return createActiveProjectCoordinator({
    ...f.dependencies,
    storage: { ...f.dependencies.storage, upgrade: unusedProjectUpgrade },
    ...ports,
    createWriter: (input) => ({ ...createCanonicalProjectWriter(input), conversation: save }),
  });
}

const portSave = {
  ...switchProjects.A,
  saveId: "00000000-0000-4000-8000-000000000065",
  expectedRevision: 0,
  text: "ported",
};

it("saves with the injected conversation ids (CNV-B29)", async () => {
  const id = "00000000-0000-4000-8000-000000000066";
  const owner = saveCoordinator(
    async (work) => ({
      status: "completed",
      result: await Effect.runPromise(Effect.result(work(emptyTransaction))),
    }),
    { createConversationId: () => id },
  );
  await owner.activate({ projectId: switchProjects.A.projectId });
  expect(await owner.conversationSave(portSave)).toMatchObject({
    status: "saved",
    conversationMessageId: id,
    cursor: 1,
  });
  await owner.stop();
});

it("reconciles an uncertain save through the injected opener (CNV-B29)", async () => {
  const openReconciliationClient = vi.fn((): never => {
    throw Object.assign(new Error("SQLITE_CANTOPEN"), { code: "SQLITE_CANTOPEN" });
  });
  const owner = saveCoordinator(async () => ({ status: "commit-uncertain" }), {
    openReconciliationClient,
  });
  await owner.activate({ projectId: switchProjects.A.projectId });
  expect(await owner.conversationSave(portSave)).toMatchObject({ status: "uncertain" });
  expect(openReconciliationClient).toHaveBeenCalledExactlyOnceWith("A/slopstop.db");
  await owner.stop();
});

it.each([
  {
    code: "WRITER_FENCE_STALE",
    fail: (f: ReturnType<typeof fixture>) =>
      f.repository.releaseFence.mockResolvedValue({ status: "stale" }),
    attempts: (f: ReturnType<typeof fixture>) => f.repository.releaseFence.mock.calls.length,
  },
  {
    code: "PROJECT_STORAGE_RELEASE_FAILED",
    fail: (f: ReturnType<typeof fixture>) => f.faults.set("storage", new Error("close failed")),
    attempts: (f: ReturnType<typeof fixture>) =>
      f.calls.filter((call) => call === "storage").length,
  },
] as const)("fails stop with the release code: $code", async ({ code, fail, attempts }) => {
  const f = fixture();
  await f.owner.activate(request);
  fail(f);
  const failure = await f.owner.stop().then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(failure).toMatchObject({ _tag: "CanonicalProjectReleaseFailed", code });
  const released = attempts(f);
  await f.owner.stop().catch(() => undefined);
  expect(attempts(f)).toBe(released + 1);
});
