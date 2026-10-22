// #123 s5 opening measurement (brief "Success Criteria: u2b-s5-harness-runtime", round-1 Y15
// and round-2 W3/W10 amendments), at parent df16fb7. Not part of the candidate. Run alone,
// from apps/harness:
//   pnpm exec vitest run --config <this folder>/shutdown-measurement.vitest.config.ts
// Output (this folder, overwritten per run): samples.jsonl, burst-windows.json, summary.json,
// burst-<n>.log. MEASURE_SMOKE=1 writes smoke-* files instead.
// Access path (W10): ManagedRuntime.make(harnessServicesLayer(roots, logger)) over a migrated
// root; the exported ApplicationDatabase is extracted, and the registration ports are built with
// their exported constructors, mirroring projectRegistrationLayer (process-bootstrap.ts:205-244),
// over options that inject that authority. No product code changes.
// Cells: M-listing (the production listing stop chain, nothing in flight), M-listing-drain (one
// real registry admission, `registry.hasUnsettled()`, started in the same synchronous turn right
// before the stop), M-dispose (`runtime.dispose()` after the listing and the authority stopped).
// Burst (decisions §116): burst-rg-git-no-node-modules.sh, copied from the s3 tool. A window starts
// only after the previous burst process has exited, each window's end comes from its own log, and
// any overlap fails the run.
import { spawn } from "node:child_process";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { Effect, ManagedRuntime } from "effect";
import { expect, it } from "vitest";
import {
  ApplicationDatabase,
  harnessServicesLayer,
} from "../../../../apps/harness/src/process-bootstrap.js";
import { createProjectRegistrationObserver } from "../../../../apps/harness/src/project-registration-observer.js";
import { createGitVersionInspection } from "../../../../apps/harness/src/registration/git-version-inspection.js";
import { createDirectoryHandoff } from "../../../../apps/harness/src/registration/project-registration-flow.js";
import { createProjectRegistrationOwner } from "../../../../apps/harness/src/registration/project-registration-owner.js";
import { createRegistrationListing } from "../../../../apps/harness/src/registration/registration-listing.js";
import { createRegistrationRegistry } from "../../../../apps/harness/src/registration/registration-registry.js";
import { createVersionObservationExecution } from "../../../../apps/harness/src/registration/version-observation-execution.js";
import { createWindowsVersionChild } from "../../../../apps/harness/src/registration/windows-version-child.js";
import type { ApplicationDatabaseAuthority } from "../../../../apps/harness/src/storage/application-database-authority.js";
import { createApplicationDatabaseAuthority } from "../../../../apps/harness/src/storage/application-database-authority.js";
import { observeSelectedExecutable } from "../../../../apps/harness/src/storage/repository-identity-observer.js";

const PARENT = "df16fb7";
const here = import.meta.dirname;
const migrationResourcesRoot = path.resolve(here, "../../../../apps/harness/drizzle");
const burstScript = path.join(here, "burst-rg-git-no-node-modules.sh");

/**
 * MEASURE_SMOKE=1: a tool check only, never a result: 2 samples per quiet cell, then the
 * M-listing-drain burst cell in one 30 s window, with separate output files.
 */
const smoke = process.env.MEASURE_SMOKE === "1";
const SAMPLES = smoke ? 2 : 200;
const SAMPLE_BOUND_MS = 15_000;
/** The hard run bound (W10): the Vitest timeout below is this value, not more. */
const RUN_BOUND_MS = 30 * 60_000;
const BURST_SECONDS = smoke ? 30 : 180;
/** Time left in a window below which no new sample starts (setup + bound + cleanup). */
const WINDOW_MARGIN_MS = SAMPLE_BOUND_MS + 5_000;
/** Kept free at the end of the run bound for the last burst's exit and the output files. */
const RUN_TAIL_MS = 30_000;
/** Half-the-bound rule (s3 §114 T3/T4): the value stands when the cell's p99 is at most this. */
const HALF_BOUND_MS = { "M-listing": 1_500, "M-listing-drain": 1_500, "M-dispose": 250 } as const;

type Shape = keyof typeof HALF_BOUND_MS;
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
/** M-listing-drain only: the two in-flight facts every sample must carry (W3). */
type DrainProof = { pendingAtStop: boolean; settledAtStopEnd: boolean };
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
  drain?: DrainProof;
};
type Timed = { start: number; end: number; outcome: "settled" | "bound"; drain?: DrainProof };

const runStart = performance.now();
const elapsed = () => performance.now() - runStart;
const out = (name: string) => path.join(here, smoke ? `smoke-${name}` : name);
const samplesFile = out("samples.jsonl");
const windows: Window[] = [];
const epochNow = () => performance.timeOrigin + performance.now();
const iso = (ms: number | undefined) => (ms === undefined ? null : new Date(ms).toISOString());
const silentLogger = { info: () => undefined, warn: () => undefined };

function withinBound<T>(promise: Promise<T>) {
  return Promise.race([
    promise.then(() => "settled" as const),
    delay(SAMPLE_BOUND_MS).then(() => "bound" as const),
  ]);
}

/** Untimed cleanup must settle within the sample bound, or the sample fails. */
async function cleanup(label: string, promise: Promise<unknown>) {
  if ((await withinBound(promise)) === "bound") throw new Error(`${label} did not settle`);
}

/** Migrates one root once, outside every timed window. */
async function migratedRoot(shape: Shape): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), `slopstop-s5-shutdown-${shape}-`));
  const authority = createApplicationDatabaseAuthority({
    applicationStorageRoot: root,
    migrationResourcesRoot,
  });
  expect(await authority.ensureCurrent({ createIfMissing: true })).toBe("current");
  await authority.stop();
  return root;
}

/** The registration ports as projectRegistrationLayer builds them, over the injected authority. */
function registrationPorts(root: string, applicationDatabase: ApplicationDatabaseAuthority) {
  const options = {
    applicationStorageRoot: root,
    migrationResourcesRoot,
    applicationVersion: "0.0.0",
    applicationDatabase,
  };
  const selection = createDirectoryHandoff();
  const registry = createRegistrationRegistry(options, selection.port);
  const observer = createProjectRegistrationObserver(
    createGitVersionInspection(
      registry,
      createVersionObservationExecution({
        inspectIdentity: observeSelectedExecutable,
        journal: registry,
        child: createWindowsVersionChild(root),
      }),
    ),
    registry,
  );
  const owner = createProjectRegistrationOwner(registry, options, root);
  return { registry, observer, owner };
}

/** A real process runtime with a live authority and its listing; all outside the timed window. */
async function freshProgram(root: string) {
  const runtime = ManagedRuntime.make(
    harnessServicesLayer({ applicationStorageRoot: root, migrationResourcesRoot }, silentLogger),
  );
  const authority = await runtime.runPromise(
    Effect.gen(function* () {
      return yield* ApplicationDatabase;
    }),
  );
  const state = await authority.ensureCurrent({ createIfMissing: false });
  if (state !== "current") throw new Error(`ensureCurrent answered ${state}`);
  const ports = registrationPorts(root, authority);
  return { runtime, authority, ports, listing: createRegistrationListing(ports) };
}

/** M-listing: nothing in flight; only the listing stop chain is timed. */
async function listingSample(root: string): Promise<Timed> {
  const program = await freshProgram(root);
  const start = performance.now();
  const outcome = await withinBound(program.listing.stop());
  const end = performance.now();
  await cleanup("authority stop", program.authority.stop());
  await cleanup("runtime dispose", program.runtime.dispose());
  return { start, end, outcome };
}

/**
 * M-listing-drain: a real registry admission is started in the same synchronous turn, right
 * before the listing stop; `track` records it as pending at once, so `registry.stop` awaits it.
 * The time runs from the stop call until it settles.
 */
async function drainSample(root: string): Promise<Timed> {
  const program = await freshProgram(root);
  let admissionSettled = false;
  const admission = program.ports.registry.hasUnsettled().finally(() => {
    admissionSettled = true;
  });
  // A rejected admission is reported by `cleanup` below, never as an unhandled rejection.
  admission.catch(() => undefined);
  const start = performance.now();
  const stopping = program.listing.stop();
  const pendingAtStop = !admissionSettled;
  const outcome = await withinBound(stopping);
  const end = performance.now();
  const settledAtStopEnd = admissionSettled;
  const drain = { pendingAtStop, settledAtStopEnd };
  await cleanup("admission", admission);
  await cleanup("authority stop", program.authority.stop());
  await cleanup("runtime dispose", program.runtime.dispose());
  if (outcome === "settled" && !(pendingAtStop && settledAtStopEnd)) {
    throw new Error(`in-flight proof missing: ${JSON.stringify(drain)}`);
  }
  return { start, end, outcome, drain };
}

/** M-dispose: the listing and the authority are stopped first; only `dispose()` is timed. */
async function disposeSample(root: string): Promise<Timed> {
  const program = await freshProgram(root);
  await cleanup("listing stop", program.listing.stop());
  await cleanup("authority stop", program.authority.stop());
  const start = performance.now();
  const outcome = await withinBound(program.runtime.dispose());
  return { start, end: performance.now(), outcome };
}

const measure: Record<Shape, (root: string) => Promise<Timed>> = {
  "M-listing": listingSample,
  "M-listing-drain": drainSample,
  "M-dispose": disposeSample,
};

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

/** No new sample starts once the run bound, less the tail (and a whole window), is near. */
function runBoundReached(needsWindow: boolean) {
  const window = needsWindow ? BURST_SECONDS * 1000 + 5_000 : 0;
  return elapsed() > RUN_BOUND_MS - RUN_TAIL_MS - WINDOW_MARGIN_MS - window;
}

async function runCell(shape: Shape, condition: Condition, root: string) {
  const cell = `${shape} ${condition}`;
  const results: Sample[] = [];
  let window: Window | undefined;
  for (let index = 0; index < SAMPLES; index += 1) {
    const needsWindow =
      condition === "burst" &&
      (window === undefined || window.endMs - epochNow() < WINDOW_MARGIN_MS);
    if (runBoundReached(needsWindow)) break;
    if (needsWindow) window = await openBurstWindow();
    const startIso = new Date().toISOString();
    let sample: Sample;
    try {
      const { start, end, outcome, drain } = await measure[shape](root);
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
        ...(drain === undefined ? {} : { drain }),
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

function summarize(shape: Shape, results: Sample[]) {
  const counted = results.filter((sample) => sample.outcome !== "failed");
  const sorted = counted.map((sample) => sample.stopMs).sort((a, b) => a - b);
  const failed = results.filter((sample) => sample.outcome === "failed");
  const outside = results.filter((sample) => sample.inWindow === false);
  const broken: string[] = [];
  if (results.length < SAMPLES) broken.push(`incomplete: ${results.length}/${SAMPLES} samples`);
  if (failed.length > 0) broken.push(`${failed.length} failed samples: ${failed[0]?.diagnostic}`);
  if (outside.length > 0) broken.push(`${outside.length} timed stops outside their burst window`);
  if (shape === "M-listing-drain") {
    const unproven = counted.filter(
      (sample) => !(sample.drain?.pendingAtStop && sample.drain.settledAtStopEnd),
    );
    if (unproven.length > 0) broken.push(`${unproven.length} samples without the in-flight proof`);
  }
  const p99 = percentile(sorted, 99);
  const halfBoundMs = HALF_BOUND_MS[shape];
  return {
    samples: results.length,
    bound: results.filter((sample) => sample.outcome === "bound").length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99,
    max: sorted.at(-1),
    halfBoundMs,
    withinHalfBound: p99 !== undefined && p99 <= halfBoundMs,
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
  "measures the harness shutdown chain and the runtime dispose",
  async () => {
    await writeFile(samplesFile, "");
    const shapes = Object.keys(HALF_BOUND_MS) as Shape[];
    const roots = new Map<Shape, string>();
    for (const shape of shapes) roots.set(shape, await migratedRoot(shape));
    const allCells = (["quiet", "burst"] as const).flatMap((condition) =>
      shapes.map((shape) => [shape, condition] as const),
    );
    const cells = allCells.filter(
      ([shape, condition]) => !smoke || condition === "quiet" || shape === "M-listing-drain",
    );
    const summary: Record<string, ReturnType<typeof summarize>> = {};
    try {
      for (const [shape, condition] of cells) {
        const root = roots.get(shape) ?? "";
        summary[`${shape} ${condition}`] = summarize(shape, await runCell(shape, condition, root));
      }
    } finally {
      for (const root of roots.values()) {
        await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
      }
    }
    const elapsedMs = elapsed();
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
    const bounds = {
      samplesPerCell: SAMPLES,
      sampleBoundMs: SAMPLE_BOUND_MS,
      runBoundMs: RUN_BOUND_MS,
      burstSeconds: BURST_SECONDS,
      halfBoundMs: HALF_BOUND_MS,
    };
    const result = { parent: PARENT, smoke, elapsedMs, bounds, overlaps, failedBursts, summary };
    await writeFile(out("burst-windows.json"), `${JSON.stringify(records, null, 2)}\n`);
    await writeFile(out("summary.json"), `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({ ...result, windows: records }, null, 2));
    expect(overlaps).toEqual([]);
    expect(failedBursts).toEqual([]);
  },
  RUN_BOUND_MS,
);
