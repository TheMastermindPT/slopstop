import { setImmediate as nextTurn } from "node:timers/promises";
import { expect, it } from "vitest";
import { startHarnessRuntime } from "../../src/index.js";
import { closesRuntimeAdmission, observeRuntimeSend } from "./command-admission-cases.js";
import { migratedUnsupported } from "./conformance-counter-command.js";
import { TestTransport } from "./harness-test-transport.js";
import {
  activateSwitchSource,
  switchCommandFailure,
  switchCommands,
  switchEvent,
  switchFixture,
  switchMessages,
  switchRuntimeLifecycles,
  switchRuntimeOptions,
  switchTarget,
} from "./project-storage-create-fixture.js";

it.each(switchRuntimeLifecycles.filter(({ kind }) => kind === "activate"))(
  "closes command admission in the same turn as lifecycle enqueue: runtime $kind",
  closesRuntimeAdmission,
);

it.each(["A.fence", "B.storage.acquire"])(
  "closes command admission in the same turn as lifecycle enqueue: held runtime %s",
  async (stage) => {
    const f = switchFixture(true);
    await activateSwitchSource(f);
    const hold = f.hold(stage);
    const transport = new TestTransport();
    const stop = startHarnessRuntime(switchRuntimeOptions(f.owner, transport));
    try {
      transport.emit(switchMessages.switch);
      await hold.entered;
      expect(f.all).toContain(stage);
      expect(transport.sent).toEqual([]);
      transport.emit(switchMessages.A);
      transport.emit(switchMessages.B);
      await nextTurn();
      const expected = [
        switchEvent(
          1,
          403,
          "project.command.result",
          switchCommandFailure("coordinator-unavailable"),
        ),
        switchEvent(
          2,
          404,
          "project.command.result",
          switchCommandFailure("coordinator-unavailable", switchCommands.B),
        ),
      ];
      expect(transport.sent).toEqual(expected);
      expect(f.projects.A.repository.settle).toHaveBeenCalledTimes(0);
      expect(f.projects.B.repository.settle).toHaveBeenCalledTimes(0);
      await observeRuntimeSend(transport, hold.resolve);
      expected.push(switchEvent(3, 402, "project.switch.result", switchTarget()));
      expect(transport.sent).toEqual(expected);
      await observeRuntimeSend(transport, () => transport.emit(switchMessages.B));
      expected.push(
        switchEvent(4, 404, "project.command.result", migratedUnsupported(switchCommands.B)),
      );
      transport.emit(switchMessages.A);
      await nextTurn();
      expected.push(
        switchEvent(5, 403, "project.command.result", switchCommandFailure("project-mismatch")),
      );
      expect(transport.sent).toEqual(expected);
      expect(f.projects.A.repository.settle).toHaveBeenCalledTimes(0);
      expect(f.projects.B.repository.settle).toHaveBeenCalledTimes(1);
    } finally {
      hold.resolve();
      await stop();
    }
  },
);
