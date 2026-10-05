import { setImmediate as nextTurn } from "node:timers/promises";
import { expect, vi } from "vitest";
import { startHarnessRuntime } from "../../src/index.js";
import { CanonicalCommandRepositoryError } from "../../src/storage/canonical-command-repository.js";
import { migratedUnsupported } from "./conformance-counter-command.js";
import { TestTransport } from "./harness-test-transport.js";
import {
  activateSwitchSource,
  newAEpoch,
  requireSwitch,
  switchActive,
  switchAlreadyActive,
  switchBrokenTarget,
  switchCommandFailure,
  switchCommands,
  switchDeferred,
  switchEvent,
  switchFixture,
  switchMessages,
  switchProjects,
  switchRequests,
  type switchRuntimeLifecycles,
  switchRuntimeOptions,
  switchSourceFailure,
  switchTarget,
} from "./project-storage-create-fixture.js";

type IneligibleSource =
  | "inactive"
  | "stopped"
  | "wrong-project"
  | "wrong-epoch"
  | "failed-acquisition";

async function arrangeIneligibleSource(
  f: ReturnType<typeof switchFixture>,
  state: IneligibleSource,
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

/** Shared body of "rejects ineligible switch sources before touching dependencies". */
export async function rejectsIneligibleSwitchSource(state: IneligibleSource): Promise<void> {
  const f = switchFixture(state === "wrong-project" || state === "wrong-epoch");
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
    expect(await f.owner.execute(switchCommands.B)).toEqual(migratedUnsupported(switchCommands.B));
  if (state === "wrong-epoch")
    expect(await f.owner.execute(switchCommands.ANew)).toEqual(
      migratedUnsupported(switchCommands.ANew),
    );
  if (state === "failed-acquisition")
    expect(await f.owner.execute(switchCommands.A)).toEqual(
      switchCommandFailure("coordinator-unavailable"),
    );
  await f.owner.stop();
}

/** Shared body of the coordinator "closes command admission in the same turn as lifecycle enqueue" cases. */
export async function closesCoordinatorAdmission(
  operation: "switch" | "activate" | "stop" | "initial",
): Promise<void> {
  const f = switchFixture(operation === "switch" || operation === "activate");
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
  expect(f.projects.A.repository.settle).toHaveBeenCalledTimes(0);
  const result = await lifecycle;
  if (operation === "switch") {
    expect(result).toEqual(switchTarget());
    expect(await f.owner.execute(switchCommands.B)).toEqual(migratedUnsupported(switchCommands.B));
    expect(await f.owner.execute(switchCommands.A)).toEqual(
      switchCommandFailure("project-mismatch"),
    );
  }
  if (operation === "activate") {
    expect(result).toEqual(switchAlreadyActive("B"));
    expect(await f.owner.execute(switchCommands.A)).toEqual(migratedUnsupported(switchCommands.A));
  }
  if (operation === "initial") expect(result).toEqual(switchActive("A"));
  await f.owner.stop();
}

export async function observeRuntimeSend(transport: TestTransport, trigger: () => void) {
  const emitted = switchDeferred<void>();
  const original = transport.send.bind(transport);
  const observer = vi.spyOn(transport, "send").mockImplementationOnce((message) => {
    original(message);
    emitted.resolve();
  });
  try {
    trigger();
    await emitted.promise;
  } finally {
    observer.mockRestore();
  }
}

/** Shared body of the "closes command admission in the same turn as lifecycle enqueue: runtime $kind" cases. */
export async function closesRuntimeAdmission({
  kind,
  message,
  event,
}: (typeof switchRuntimeLifecycles)[number]): Promise<void> {
  const f = switchFixture(kind === "activate");
  if (kind !== "initial activate") await activateSwitchSource(f);
  const transport = new TestTransport();
  const stop = startHarnessRuntime(switchRuntimeOptions(f.owner, transport));
  try {
    const lifecycle = message === undefined ? f.owner.stop() : transport.emit(message);
    transport.emit(switchMessages.A);
    await lifecycle;
    await nextTurn();
    const expected = [
      switchEvent(
        1,
        403,
        "project.command.result",
        switchCommandFailure("coordinator-unavailable"),
      ),
    ];
    if (event !== undefined) expected.push(event);
    expect(transport.sent).toEqual(expected);
    expect(f.projects.A.repository.settle).toHaveBeenCalledTimes(0);
    if (kind === "activate") {
      await observeRuntimeSend(transport, () => transport.emit(switchMessages.A));
      expected.push(
        switchEvent(3, 403, "project.command.result", migratedUnsupported(switchCommands.A)),
      );
      expect(transport.sent).toEqual(expected);
      expect(f.projects.A.repository.settle).toHaveBeenCalledTimes(1);
    }
  } finally {
    await stop();
  }
}
