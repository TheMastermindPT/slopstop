import { Writable } from "node:stream";
import {
  decodeStrict,
  HarnessUpgradeLogLineSchema,
  ProjectIdSchema,
  ProjectStorageCreateRequestIdSchema,
} from "@slopstop/protocol";
import { expect, it } from "vitest";
import { createHarnessLogger } from "../../src/harness-logger.js";
import { createUpgradeDiagnosticsLogger } from "../../src/upgrade-diagnostics-logger.js";

const projectId = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-000000000010");
const upgradeId = decodeStrict(
  ProjectStorageCreateRequestIdSchema,
  "00000000-0000-4000-8000-0000000000a1",
);

/** A destination that keeps every line the logger writes. */
function memoryDestination() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(
        ...chunk
          .toString("utf8")
          .split("\n")
          .filter((line) => line !== ""),
      );
      done();
    },
  });
  return { lines, stream };
}

it("writes upgrade log lines the desktop accepts", () => {
  const destination = memoryDestination();
  const diagnostics = createUpgradeDiagnosticsLogger(createHarnessLogger(destination.stream));
  diagnostics.abandoned({ projectId, upgradeId, reason: "interrupted" });
  diagnostics.discardFailed({ projectId, upgradeId, cause: "busy" });
  expect(destination.lines).toHaveLength(2);
  const [abandoned, discardFailed] = destination.lines.map((line) =>
    decodeStrict(HarnessUpgradeLogLineSchema, JSON.parse(line)),
  );
  expect(abandoned).toEqual({
    level: 30,
    time: expect.any(Number),
    service: "harness",
    event: "project-storage.upgrade.abandoned",
    projectId,
    upgradeId,
    reason: "interrupted",
  });
  expect(discardFailed).toEqual({
    level: 40,
    time: expect.any(Number),
    service: "harness",
    event: "project-storage.upgrade.discard-failed",
    projectId,
    upgradeId,
    cause: "busy",
  });
});
