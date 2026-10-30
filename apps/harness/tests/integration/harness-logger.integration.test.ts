import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  decodeStrict,
  HarnessFatalLogLineSchema,
  HarnessUpgradeLogLineSchema,
  ProjectIdSchema,
  ProjectStorageCreateRequestIdSchema,
} from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import { createHarnessLogger } from "../../src/harness-logger.js";
import { connectHarnessProcess } from "../../src/process-connection.js";
import {
  createHarnessFatalHandlers,
  type HarnessFatalSink,
  reportHarnessFailure,
} from "../../src/process-fatal-diagnostics.js";
import { createHarnessPortCloseHandler } from "../../src/process-shutdown.js";
import { createUpgradeDiagnosticsLogger } from "../../src/upgrade-diagnostics-logger.js";
import { memoryLogDestination } from "./request-diagnostics-fixture.js";

const projectId = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-000000000010");
const upgradeId = decodeStrict(
  ProjectStorageCreateRequestIdSchema,
  "00000000-0000-4000-8000-0000000000a1",
);

it("writes upgrade log lines the desktop accepts", () => {
  const destination = memoryLogDestination();
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

/** A fatal sink on the real logger whose exit is recorded, never taken. */
function recordingFatalSink(logger: ReturnType<typeof createHarnessLogger>) {
  const exits: number[] = [];
  const sink: HarnessFatalSink = {
    fatal: (metadata, message) => logger.fatal(metadata, message),
    exit: (code) => {
      exits.push(code);
    },
  };
  return { sink, exits };
}

it("writes fatal lines the desktop accepts", () => {
  const destination = memoryLogDestination();
  const logger = createHarnessLogger(destination.stream);
  const { sink, exits } = recordingFatalSink(logger);
  const privatePath = new Error("C:\\private\\project\\slopstop.db");
  const cleanup = Object.assign(new Error("Project registration cleanup is unconfirmed."), {
    _tag: "RegistrationCleanupUnconfirmed",
    parts: ["registry", "listing"],
    cause: privatePath,
  });
  reportHarnessFailure(
    sink,
    "HARNESS_SHUTDOWN_FAILED",
    "Harness shutdown failed.",
    new AggregateError([cleanup, privatePath], "C:\\private\\aggregate"),
  );
  const tagged = Object.assign(new Error("C:\\private\\start"), { _tag: "UpgradeFailed" });
  reportHarnessFailure(
    sink,
    "HARNESS_RUNTIME_START_FAILED",
    "Harness runtime failed to start.",
    tagged,
  );
  reportHarnessFailure(
    sink,
    "HARNESS_START_FAILED",
    "Harness received an invalid bootstrap message.",
    privatePath,
  );
  // The `failStartup` shape of `process-entry.ts`: the code and its fixed message, no metadata.
  logger.fatal({ code: "HARNESS_START_FAILED" }, "Harness utility process has no parent port.");
  const handlers = createHarnessFatalHandlers(sink);
  handlers.uncaughtException(privatePath);
  handlers.unhandledRejection("C:\\private\\rejection");

  expect(exits).toEqual([1, 1, 1, 1, 1]);
  expect(destination.lines).toHaveLength(6);
  for (const line of destination.lines) {
    expect(line).not.toContain("private");
    expect(decodeStrict(HarnessFatalLogLineSchema, JSON.parse(line))).toMatchObject({
      level: 60,
      service: "harness",
    });
  }
  expect(destination.lines.map((line) => JSON.parse(line).code)).toEqual([
    "HARNESS_SHUTDOWN_FAILED",
    "HARNESS_RUNTIME_START_FAILED",
    "HARNESS_START_FAILED",
    "HARNESS_START_FAILED",
    "HARNESS_UNCAUGHT_EXCEPTION",
    "HARNESS_UNHANDLED_REJECTION",
  ]);
});

it("writes the real call sites' fatal lines the desktop accepts", async () => {
  const destination = memoryLogDestination();
  const { sink, exits } = recordingFatalSink(createHarnessLogger(destination.stream));
  const privateFailure = new Error("C:\\private\\project\\slopstop.db");
  await connectHarnessProcess({
    bootstrap: undefined,
    prepare: () => {
      throw privateFailure;
    },
    launch: () => Promise.reject(new Error("Unexpected launch.")),
    attach: () => undefined,
    sink,
  });
  await connectHarnessProcess({
    bootstrap: undefined,
    prepare: () => undefined,
    launch: () => Promise.reject(privateFailure),
    attach: () => undefined,
    sink,
  });
  createHarnessPortCloseHandler({
    stopRuntime: () => Promise.reject(privateFailure),
    succeeded: () => undefined,
    sink,
  })();
  // The close handler reports its failure asynchronously; wait for its exit.
  await vi.waitFor(() => expect(exits).toHaveLength(3));

  expect(exits).toEqual([1, 1, 1]);
  expect(
    destination.lines.map((line) => {
      expect(line).not.toContain("private");
      const decoded = decodeStrict(HarnessFatalLogLineSchema, JSON.parse(line));
      return [decoded.code, decoded.msg];
    }),
  ).toEqual([
    ["HARNESS_START_FAILED", "Harness received an invalid bootstrap message."],
    ["HARNESS_RUNTIME_START_FAILED", "Harness runtime failed to start."],
    ["HARNESS_SHUTDOWN_FAILED", "Harness shutdown failed."],
  ]);
});

/** The child: the real default logger writes one fatal line, then the process exits at once. */
const fatalChildScript = `
const { createHarnessLogger } = await import(process.argv[1]);
createHarnessLogger().fatal(
  { code: "HARNESS_START_FAILED" },
  "Harness utility process has no parent port.",
);
process.exit(1);
`;

it("flushes the fatal line before the exit", async () => {
  const loggerUrl = pathToFileURL(path.resolve(import.meta.dirname, "../../src/harness-logger.ts"));
  const child = spawn(
    process.execPath,
    ["--input-type=module", "-e", fatalChildScript, loggerUrl.href],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const stdout: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
  const [exitCode] = await once(child, "close");
  const lines = Buffer.concat(stdout)
    .toString("utf8")
    .split("\n")
    .filter((line) => line !== "");
  expect(exitCode).toBe(1);
  expect(lines).toHaveLength(1);
  expect(decodeStrict(HarnessFatalLogLineSchema, JSON.parse(lines[0] ?? ""))).toMatchObject({
    code: "HARNESS_START_FAILED",
    msg: "Harness utility process has no parent port.",
  });
});
