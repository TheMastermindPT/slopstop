import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const helperUrl = pathToFileURL(path.join(import.meta.dirname, "trace-94.ts")).href;
const roots: string[] = [];
// A traced lane run owns the process-wide trace state; each case keeps it aside while its own
// fresh helpers run and hands it back, so the lane still records this file's summaries.
let laneState: typeof globalThis.slopstopTrace94;

beforeEach(() => {
  laneState = globalThis.slopstopTrace94;
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.resetModules();
  globalThis.slopstopTrace94 = laneState;
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function traceDirectory() {
  const root = await mkdtemp(path.join(tmpdir(), "slopstop-trace-94-test-"));
  roots.push(root);
  return path.join(root, "out");
}

/** Imports the helpers fresh with the tracing variable set to `enabled` and output in `dir`. */
async function helpers(enabled: "0" | "1", dir: string) {
  vi.stubEnv("SLOPSTOP_TRACE_94", enabled);
  vi.stubEnv("SLOPSTOP_TRACE_94_DIR", dir);
  // Fresh state here, after the lane's beforeEach span may have recreated its own.
  globalThis.slopstopTrace94 = undefined;
  vi.resetModules();
  return import("./trace-94.js");
}

function lines(dir: string) {
  return readdirSync(dir).flatMap((file) =>
    readFileSync(path.join(dir, file), "utf8")
      .trim()
      .split("\n")
      .map((line): unknown => JSON.parse(line)),
  );
}

const client = { execute: async (sql: string) => ({ rows: [sql] }) };

describe("#94 trace helpers with tracing off", () => {
  it("throws the plain label from the call site and writes nothing", async () => {
    const dir = await traceDirectory();
    const trace = await helpers("0", dir);

    const error = trace.missing94("Proposal missing", { status: "limit" });
    const step = trace.begin94({ kind: "exchange", label: "project.registration" });
    trace.end94(step, { reply: "x" });
    trace.enterTest94({ id: "t", name: "name", file: "file" });
    trace.abortTest94({ test: "t", outcome: "timeout", extra: {} });
    trace.finishTest94({ test: "t", outcome: "fail", extra: {} });

    expect(trace.trace94Enabled).toBe(false);
    expect(error.message).toBe("Proposal missing");
    expect(error.stack?.split("\n")[1]).not.toContain("trace-94.ts");
    expect(step).toBe(0);
    expect(existsSync(dir)).toBe(false);
  });

  it("answers the same client object", async () => {
    const trace = await helpers("0", await traceDirectory());

    expect(trace.traced94(client, "probe")).toBe(client);
  });

  it("answers the step's own promise", async () => {
    const trace = await helpers("0", await traceDirectory());
    const pending = Promise.resolve("done");

    expect(trace.step94("seed", () => pending)).toBe(pending);
  });
});

const integrationConfigs = [
  "../../vitest.integration.config.js",
  "../../vitest.registration.config.js",
  "../../vitest.native-long.config.js",
];

/** The `test` options of one integration config, imported fresh with tracing set to `enabled`. */
async function testOptions(config: string, enabled: "0" | "1") {
  vi.stubEnv("SLOPSTOP_TRACE_94", enabled);
  vi.resetModules();
  const loaded: unknown = (await import(config)).default;
  return Object(Reflect.get(Object(loaded), "test"));
}

const errorEqualitySetup = expect.stringMatching(/[\\/]tests[\\/]error-equality\.ts$/);

describe("#94 trace wiring in the integration configs", () => {
  it.each(integrationConfigs)(
    "adds no trace setup file or runner to %s when off",
    async (config) => {
      const options = await testOptions(config, "0");

      expect(options.setupFiles).toEqual([errorEqualitySetup]);
      expect(Object.keys(options)).not.toContain("runner");
    },
  );

  it.each(integrationConfigs)(
    "adds the trace setup file after the error equality setup, and the runner, to %s when on",
    async (config) => {
      const options = await testOptions(config, "1");

      expect(options.setupFiles).toEqual([
        errorEqualitySetup,
        expect.stringMatching(/[\\/]integration[\\/]trace-94-setup\.ts$/),
      ]);
      expect(options.runner).toEqual(
        expect.stringMatching(/[\\/]integration[\\/]trace-94-runner\.ts$/),
      );
    },
  );
});

describe("#94 trace helpers with tracing on", () => {
  it("keeps the label and outcomes while recording the envelope and the call", async () => {
    const dir = await traceDirectory();
    const trace = await helpers("1", dir);

    trace.enterTest94({ id: "t1", name: "a slow test", file: "file.test.ts" });
    const error = trace.missing94("Proposal missing", { status: "limit" });
    const traced = trace.traced94(client, "probe");
    const result = await traced.execute("SELECT 1");
    trace.finishTest94({ test: "t1", outcome: "fail", extra: null });

    expect(error.message).toBe("Proposal missing");
    expect(result).toEqual({ rows: ["SELECT 1"] });
    expect(lines(dir)).toEqual([
      expect.objectContaining({ kind: "missing", test: "t1", actual: { status: "limit" } }),
      expect.objectContaining({ kind: "call-start", label: "probe", concurrent: 0 }),
      expect.objectContaining({ kind: "call-end", label: "probe", outcome: { ok: true } }),
      expect.objectContaining({ kind: "summary", test: "t1", state: "fail", keep: true }),
    ]);
  });

  it("times a fixture step and keeps its value", async () => {
    const dir = await traceDirectory();
    const trace = await helpers("1", dir);

    trace.enterTest94({ id: "t3", name: "a step", file: "file.test.ts" });
    const value = await trace.step94("canonical-db.create", async () => "created");
    trace.finishTest94({ test: "t3", outcome: "fail", extra: null });

    expect(value).toBe("created");
    expect(lines(dir)).toEqual([
      expect.objectContaining({ kind: "step-start", label: "canonical-db.create" }),
      expect.objectContaining({ kind: "step-end", label: "canonical-db.create" }),
      expect.objectContaining({ kind: "summary", test: "t3" }),
    ]);
  });

  it("dumps the call still in flight at abort and its late settle", async () => {
    const dir = await traceDirectory();
    const trace = await helpers("1", dir);
    let release: (value: string) => void = () => undefined;
    const pending = { execute: () => new Promise<string>((resolve) => (release = resolve)) };

    trace.enterTest94({ id: "t2", name: "a stalled test", file: "file.test.ts" });
    const call = trace.traced94(pending, "stall").execute();
    trace.abortTest94({ test: "t2", outcome: "Test timed out", extra: {} });
    trace.finishTest94({ test: "t2", outcome: "fail", extra: {} });
    release("late");
    await call;

    expect(lines(dir).map((line) => Reflect.get(Object(line), "kind"))).toEqual([
      "call-start",
      "abort",
      "summary",
      "late-settle",
    ]);
  });
});

/** Runs a module script in plain Node with tracing on, after importing the helpers. */
function runTraced(body: string, dir: string) {
  const script = `const { traced94 } = await import(${JSON.stringify(helperUrl)});
const client = { execute: () => Promise.reject(new Error("trace94-probe-rejection")) };
${body}`;
  return spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    encoding: "utf8",
    env: { ...process.env, SLOPSTOP_TRACE_94: "1", SLOPSTOP_TRACE_94_DIR: dir },
  });
}

describe("#94 traced calls keep unhandled rejections visible", () => {
  it("reports an unobserved rejection with tracing on", async () => {
    const run = runTraced(`traced94(client, "probe").execute("SELECT 1");`, await traceDirectory());

    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("trace94-probe-rejection");
  });

  it("reports nothing when the caller observes the rejection", async () => {
    const run = runTraced(
      `await traced94(client, "probe").execute("SELECT 1").catch(() => undefined);
await (await import("node:timers/promises")).setTimeout(20);`,
      await traceDirectory(),
    );

    expect(run.stderr).not.toContain("trace94-probe-rejection");
    expect(run.status).toBe(0);
  });
});
