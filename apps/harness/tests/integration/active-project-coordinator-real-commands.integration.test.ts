import {
  type CanonicalProjectCommandRequest,
  decodeStrict,
  ProjectActivationIdSchema,
  ProjectIdSchema,
} from "@slopstop/protocol";
import { expect, it } from "vitest";
import type { ProjectStorageActivationOutcome } from "../../src/project-storage-application.js";
import { command, failure, fixture, request } from "./active-project-coordinator-fixture.js";
import {
  closesCoordinatorAdmission,
  rejectsIneligibleSwitchSource,
} from "./command-admission-cases.js";
import { migratedUnsupported } from "./conformance-counter-command.js";
import {
  activateSwitchSource,
  observeSwitchPromise,
  requireSwitch,
  switchCommandFailure,
  switchCommands,
  switchFixture,
  switchRequests,
  switchTarget,
} from "./project-storage-create-fixture.js";

function deferred<Value>() {
  let resolve: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

it("admits Typed commands in Project, activation, access, then fence order", async () => {
  const f = fixture(true);
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
    activationId: decodeStrict(ProjectActivationIdSchema, "00000000-0000-4000-8000-000000000021"),
  };
  const wrong: CanonicalProjectCommandRequest = {
    ...stale,
    projectId: decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-000000000020"),
  };
  expect(await f.owner.execute(wrong)).toEqual(failure("project-mismatch", wrong));
  expect(await f.owner.execute(stale)).toEqual(failure("stale-activation", stale));
  expect(f.repository.settle).not.toHaveBeenCalled();
  expect(await f.owner.execute(command)).toEqual(migratedUnsupported(command));
  f.real.observation.after = (sql, rows) =>
    sql.includes("FROM writer_fence") ? { ...rows, rows: [] } : rows;
  expect(await f.owner.execute(command)).toEqual(failure("stale-writer"));
  const sentinel = new Error("secret command payload");
  f.real.observation.after = () => {
    throw sentinel;
  };
  await expect(f.owner.execute(command)).rejects.toBe(sentinel);
  delete f.real.observation.after;
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

it.each(["wrong-project", "wrong-epoch"] as const)(
  "rejects ineligible switch sources before touching dependencies",
  rejectsIneligibleSwitchSource,
);

it.each(["switch", "activate"] as const)(
  "closes command admission in the same turn as lifecycle enqueue",
  closesCoordinatorAdmission,
);

it.each(["A.fence", "B.storage.acquire"])(
  "closes command admission in the same turn as lifecycle enqueue",
  async (stage) => {
    const f = switchFixture(true);
    const switchProject = requireSwitch(f.owner);
    await activateSwitchSource(f);
    const hold = f.hold(stage);
    const switching = observeSwitchPromise(switchProject(switchRequests.AB));
    await hold.entered;
    expect(f.all).toContain(stage);
    expect(switching.isSettled()).toBe(false);
    for (const input of [switchCommands.A, switchCommands.B]) {
      expect(await f.owner.execute(input)).toEqual(
        switchCommandFailure("coordinator-unavailable", input),
      );
    }
    expect(f.projects.A.repository.settle).toHaveBeenCalledTimes(0);
    expect(f.projects.B.repository.settle).toHaveBeenCalledTimes(0);
    expect(f.projects.A.storage).toHaveBeenCalledTimes(1);
    hold.resolve();
    expect(await switching.promise).toEqual(switchTarget());
    expect(await f.owner.execute(switchCommands.B)).toEqual(migratedUnsupported(switchCommands.B));
    expect(await f.owner.execute(switchCommands.A)).toEqual(
      switchCommandFailure("project-mismatch"),
    );
    await f.owner.stop();
  },
);
