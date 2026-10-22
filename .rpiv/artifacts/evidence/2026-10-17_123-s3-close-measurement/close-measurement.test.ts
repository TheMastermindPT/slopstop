// #123 s3 opening measurement (brief "Opening measurement"): time from `stop()` to its
// settlement on a real worker-backed ApplicationDatabaseAuthority, at parent fb7bde7.
// Not part of the candidate. Run alone, from apps/harness:
//   pnpm exec vitest run --config <this folder>/close-measurement.vitest.config.ts
// Output (this folder, overwritten per run): samples.jsonl, burst-windows.json, summary.json,
// burst-<n>.log. MEASURE_SMOKE=1 writes smoke-* files instead.
// Burst (decisions §116): burst-rg-git-no-node-modules.sh, the #94 burst whose rg loops skip
// node_modules. A window starts only after the previous burst process has exited, each
// window's end comes from its own log, and any overlap fails the run.
import { spawn } from "node:child_process";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it } from "vitest";
import { createApplicationDatabaseAuthority } from "../../../../apps/harness/src/storage/application-database-authority.js";
import { createWorkerLocalLibsqlClient } from "../../../../apps/harness/src/storage/local-libsql-worker-client.js";

const here = import.meta.dirname;
const migrationResourcesRoot = path.resolve(here, "../../../../apps/harness/drizzle");
const burstScript = path.join(here, "burst-rg-git-no-node-modules.sh");

/**
 * MEASURE_SMOKE=1: a tool check only, never a result: 2 samples per quiet cell, then the
 * M-drain burst cell in one 30 s window, with separate output files.
 */
const smoke = process.env.MEASURE_SMOKE === "1";
const SAMPLES = smoke ? 2 : 200;
const SAMPLE_BOUND_MS = 15_000;
const RUN_BOUND_MS = 30 * 60_000;
const BURST_SECONDS = smoke ? 30 : 180;
/** Time left in a window below which no new sample starts (setup + bound). */
const WINDOW_MARGIN_MS = SAMPLE_BOUND_MS + 5_000;

type Shape = "M-idle" | "M-drain";
type Condition = "quiet" | "burst";
/**
 * One burst, in epoch ms. `startMs`..`endMs` is when all six loops run: from 3 s after the
 * spawn (the loops are started) to the burst's own deadline, read from its log (`END`, whole
 * seconds). `exitedMs` is when the burst process has exited, every loop ended.
 */
type Window = {
  index: number;
  spawnedMs: number;
  startMs: number;
  endMs: number;
  exitedMs?: number;
  exitCode?: number | null;
  preflight?: string | undefined;
  exited: Promise<void>;
};
type Sample = {
  cell: string;
  index: number;
  window: number | null;
  startIso: string;
  stopMs: number;
  outcome: "settled" | "bound" | "failed";
  diagnostic?: string;
  inWindow: boolean | null;
  stopStartMs?: number;
  stopEndMs?: number;
};

const runStart = performance.now();
const out = (name: string) => path.join(here, smoke ? `smoke-${name}` : name);
const samplesFile = out("samples.jsonl");
const windows: Window[] = [];
const epochNow = () => performance.timeOrigin + performance.now();
const iso = (ms: number | undefined) => (ms === undefined ? null : new Date(ms).toISOString());

function withinBound<T>(promise: Promise<T>) {
  return Promise.race([
    promise.then(() => "settled" as const),
    delay(SAMPLE_BOUND_MS).then(() => "bound" as const),
  ]);
}

/** Migrates one root once, outside every timed window. */
async function migratedRoot(shape: Shape): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), `slopstop-s3-close-${shape}-`));
  const authority = createApplicationDatabaseAuthority({
    applicationStorageRoot: root,
    migrationResourcesRoot,
  });
  expect(await authority.ensureCurrent({ createIfMissing: true })).toBe("current");
  await authority.stop();
  return root;
}

async function freshAuthority(root: string) {
  const authority = createApplicationDatabaseAuthority({
    applicationStorageRoot: root,
    migrationResourcesRoot,
  });
  const state = await authority.ensureCurrent({ createIfMissing: false });
  if (state !== "current") throw new Error(`ensureCurrent answered ${state}`);
  return authority;
}

/** M-idle: no work in flight; only `stop()` is timed. */
async function idleSample(root: string) {
  const authority = await freshAuthority(root);
  const start = performance.now();
  const outcome = await withinBound(authority.stop());
  return { start, end: performance.now(), outcome };
}

/**
 * M-drain: one admitted write transaction on a TEMP scratch table (the application schema
 * verifier refuses any extra main-schema table) runs three statements, then commits and closes;
 * `stop()` is called after its first statement settles.
 */
async function drainSample(root: string) {
  const authority = await freshAuthority(root);
  const client = authority.admitClient(
    createWorkerLocalLibsqlClient(authority.applicationDatabasePath, "application"),
  );
  try {
    const transaction = await client.transaction("write");
    await transaction.execute(
      "CREATE TEMP TABLE IF NOT EXISTS close_scratch (id INTEGER PRIMARY KEY, v TEXT NOT NULL)",
    );
    await transaction.execute("INSERT INTO close_scratch (v) VALUES ('one')");
    const start = performance.now();
    const stopping = authority.stop();
    const work = (async () => {
      await transaction.execute("INSERT INTO close_scratch (v) VALUES ('two')");
      await transaction.execute("UPDATE close_scratch SET v = v || '!'");
      await transaction.commit();
      await transaction.close();
    })();
    const outcome = await withinBound(stopping);
    const end = performance.now();
    // Drain proof: a settled stop must find the admitted transaction already closed.
    const drained = transaction.closed;
    await work;
    if (outcome === "settled" && !drained) throw new Error("stop settled before the drain");
    return { start, end, outcome };
  } finally {
    await client.close();
  }
}

async function burstLogLine(log: string, prefix: string): Promise<string | undefined> {
  const text = await readFile(log, "utf8").catch(() => "");
  return text.split("\n").find((line) => line.startsWith(prefix));
}

/**
 * Starts one burst once the previous one has exited. The burst stops itself after
 * BURST_SECONDS; its start line gives the deadline its loops use.
 */
async function openBurstWindow(): Promise<Window> {
  const previous = windows.at(-1);
  if (previous !== undefined) await previous.exited;
  const index = windows.length + 1;
  const log = path.join(here, smoke ? `smoke-burst-${index}.log` : `burst-${index}.log`);
  const spawnedMs = epochNow();
  const child = spawn("bash", [burstScript, log, String(BURST_SECONDS)], {
    stdio: "ignore",
    windowsHide: true,
  });
  const window: Window = {
    index,
    spawnedMs,
    startMs: spawnedMs + 3_000,
    endMs: Number.NaN,
    exited: new Promise((resolve) => {
      child.once("exit", (code) => {
        window.exitedMs = epochNow();
        window.exitCode = code;
        resolve();
      });
    }),
  };
  windows.push(window);
  const failed = new Promise<never>((_, reject) => child.once("error", reject));
  await Promise.race([delay(3_000), failed]);
  window.startMs = Math.max(window.startMs, epochNow());
  window.preflight = await burstLogLine(log, "preflight ");
  const started = await burstLogLine(log, "burst start utc ");
  const loggedStart = Date.parse(started?.split(" ")[3] ?? "");
  // END = floor(start in s) + BURST_SECONDS: every loop runs until then.
  window.endMs = Math.floor(loggedStart / 1000) * 1000 + BURST_SECONDS * 1000;
  if (!Number.isFinite(window.endMs)) {
    throw new Error(`burst ${index} did not start: ${window.preflight ?? "no preflight line"}`);
  }
  return window;
}

async function runCell(shape: Shape, condition: Condition, root: string) {
  const cell = `${shape} ${condition}`;
  const results: Sample[] = [];
  let window: Window | undefined;
  for (let index = 0; index < SAMPLES; index += 1) {
    if (performance.now() - runStart > RUN_BOUND_MS - WINDOW_MARGIN_MS) break;
    if (
      condition === "burst" &&
      (window === undefined || window.endMs - epochNow() < WINDOW_MARGIN_MS)
    ) {
      window = await openBurstWindow();
    }
    const startIso = new Date().toISOString();
    let sample: Sample;
    try {
      const { start, end, outcome } =
        shape === "M-idle" ? await idleSample(root) : await drainSample(root);
      const current = window;
      const stopStartMs = performance.timeOrigin + start;
      const stopEndMs = performance.timeOrigin + end;
      sample = {
        cell,
        index,
        window: current?.index ?? null,
        startIso,
        stopMs: outcome === "bound" ? SAMPLE_BOUND_MS : end - start,
        outcome,
        inWindow:
          current === undefined
            ? null
            : stopStartMs >= current.startMs && stopEndMs <= current.endMs,
        stopStartMs,
        stopEndMs,
      };
    } catch (error) {
      sample = {
        cell,
        index,
        window: window?.index ?? null,
        startIso,
        stopMs: Number.NaN,
        outcome: "failed",
        diagnostic: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        inWindow: null,
      };
    }
    results.push(sample);
    await appendFile(samplesFile, `${JSON.stringify(sample)}\n`);
  }
  if (window !== undefined) await window.exited;
  return results;
}

/** Nearest-rank percentile over the sorted durations. */
function percentile(sorted: number[], p: number) {
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

function summarize(results: Sample[]) {
  const counted = results.filter((sample) => sample.outcome !== "failed");
  const sorted = counted.map((sample) => sample.stopMs).sort((a, b) => a - b);
  const failed = results.filter((sample) => sample.outcome === "failed");
  const outside = results.filter((sample) => sample.inWindow === false);
  const broken: string[] = [];
  if (results.length < SAMPLES) broken.push(`incomplete: ${results.length}/${SAMPLES} samples`);
  if (failed.length > 0) broken.push(`${failed.length} failed samples: ${failed[0]?.diagnostic}`);
  if (outside.length > 0) broken.push(`${outside.length} timed stops outside their burst window`);
  return {
    samples: results.length,
    bound: results.filter((sample) => sample.outcome === "bound").length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.at(-1),
    broken,
  };
}

/** Every window must start only after the one before it has exited, and exit cleanly. */
function windowFaults() {
  const overlaps = windows.slice(1).flatMap((window, at) => {
    const before = windows[at];
    return before?.exitedMs === undefined || window.spawnedMs < before.exitedMs
      ? [`window ${window.index} spawned before window ${before?.index} exited`]
      : [];
  });
  const failedBursts = windows.flatMap((window) =>
    window.exitCode === 0 ? [] : [`burst ${window.index} exit ${window.exitCode}`],
  );
  return { overlaps, failedBursts };
}

it(
  "measures the application database close",
  async () => {
    await writeFile(samplesFile, "");
    const idleRoot = await migratedRoot("M-idle");
    const drainRoot = await migratedRoot("M-drain");
    const allCells: Array<[Shape, Condition, string]> = [
      ["M-idle", "quiet", idleRoot],
      ["M-drain", "quiet", drainRoot],
      ["M-idle", "burst", idleRoot],
      ["M-drain", "burst", drainRoot],
    ];
    const cells = allCells.filter(
      ([shape, condition]) => !smoke || condition === "quiet" || shape === "M-drain",
    );
    const summary: Record<string, ReturnType<typeof summarize>> = {};
    try {
      for (const [shape, condition, root] of cells) {
        summary[`${shape} ${condition}`] = summarize(await runCell(shape, condition, root));
      }
    } finally {
      await rm(idleRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
      await rm(drainRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
    const elapsedMs = performance.now() - runStart;
    const records = windows.map((window) => ({
      index: window.index,
      spawned: iso(window.spawnedMs),
      start: iso(window.startMs),
      end: iso(window.endMs),
      exited: iso(window.exitedMs),
      exitCode: window.exitCode,
      preflight: window.preflight,
    }));
    const { overlaps, failedBursts } = windowFaults();
    const result = { parent: "fb7bde7", smoke, elapsedMs, overlaps, failedBursts, summary };
    await writeFile(out("burst-windows.json"), `${JSON.stringify(records, null, 2)}\n`);
    await writeFile(out("summary.json"), `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({ ...result, windows: records }, null, 2));
    expect(overlaps).toEqual([]);
    expect(failedBursts).toEqual([]);
  },
  RUN_BOUND_MS + 5 * 60_000,
);
