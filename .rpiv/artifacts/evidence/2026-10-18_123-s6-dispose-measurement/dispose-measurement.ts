// #123 s6 opening measurement (brief "Slice u2b-s6-desktop-runtime", order of work step 0;
// P-S6-3, S6-I10 (a), S6-J5), at parent 010ee05 (HEAD de29eec). Not part of the candidate.
// An Electron main script, bundled with esbuild into this folder and run alone:
//   node_modules/.bin/esbuild <this file> --bundle --platform=node --format=cjs \
//     --target=node22 --external:electron --outfile=<this folder>/dispose-measurement.bundle.cjs
//   pnpm --filter @slopstop/desktop exec electron <bundle> <outDir> [--smoke]
// <outDir> receives samples.jsonl, burst-windows.json, summary.json and burst-<n>.log. The tool
// refuses an <outDir> that exists and is not empty, so no run overwrites another.
// Owners (design point 1, today's constructors): the real main logger writing to a temporary
// folder, the real HarnessSupervisor (never started, so there is no child) and the three real
// bridges over the supervisor's real session, in one ManagedRuntime. Each owner is acquired with
// Effect.acquireRelease and exposes a once-latched stop; its release stops it only when no stop
// came first (s3's closeIfNeverStopped). The bridges depend on the supervision, so they release
// first.
// Cells: M-dispose-after-program (the program's stops, the three bridges then the supervisor, ran
// outside the timing, so every release is a no-op) and M-dispose-safety-net (no program ran, so the
// releases stop every owner). Only `runtime.dispose()` is timed. Every sample proves afterwards that
// all four owners are stopped.
// Burst (decisions §116): burst-rg-git-no-node-modules.sh, copied from the s5 tool. A window starts
// only after the previous burst process has exited, each window's end comes from its own log, and
// any overlap fails the run.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { app } from "electron";
import type { Logger } from "pino";
import type { HarnessSessionClient } from "../../../../apps/desktop/src/main/harness-session.js";
import {
  HarnessSupervisor,
  harnessEntryPath,
} from "../../../../apps/desktop/src/main/harness-supervisor.js";
import { createMainLogger } from "../../../../apps/desktop/src/main/logger.js";
import { createProjectEntryBridge } from "../../../../apps/desktop/src/main/project-entry-bridge.js";
import { createProjectStorageHarnessBootstrap } from "../../../../apps/desktop/src/main/project-storage-bootstrap.js";
import { createProjectStorageBridge } from "../../../../apps/desktop/src/main/project-storage-bridge.js";
import { createWorkspaceBridge } from "../../../../apps/desktop/src/main/workspace-bridge.js";

const PARENT = "010ee05";
const repositoryRoot = path.resolve(__dirname, "../../../..");
const burstScript = path.join(__dirname, "burst-rg-git-no-node-modules.sh");

const args = process.argv.slice(2);
const smoke = args.includes("--smoke");
const outDirArgument = args.find((arg) => !arg.startsWith("--"));

/**
 * --smoke: a tool check only, never a result: 2 samples per quiet cell, then the
 * M-dispose-safety-net burst cell in one 30 s window.
 */
const SAMPLES = smoke ? 2 : 200;
const SAMPLE_BOUND_MS = 15_000;
/** The whole run bound (brief: about 30 min); a watchdog exits 2 shortly after it. */
const RUN_BOUND_MS = 30 * 60_000;
const BURST_SECONDS = smoke ? 30 : 180;
/** Time left in a window below which no new sample starts (setup + bound + cleanup). */
const WINDOW_MARGIN_MS = SAMPLE_BOUND_MS + 5_000;
/** Kept free at the end of the run bound for the last burst's exit and the output files. */
const RUN_TAIL_MS = 30_000;
/** Half-the-bound rule (P-S6-3): the 1 000 ms deadline stands when every cell's p99 is at most this. */
const HALF_BOUND_MS = 500;
const SHAPES = ["M-dispose-after-program", "M-dispose-safety-net"] as const;

type Shape = (typeof SHAPES)[number];
type Condition = "quiet" | "burst";
type Latch = Readonly<{ stop(): unknown; stopped(): boolean }>;
type OwnedStop<T> = Readonly<{ stop(): T; stopped(): boolean }>;

class DesktopLogger extends Context.Service<DesktopLogger, Logger>()(
  "slopstop/measure/DesktopLogger",
) {}
class HarnessSupervision extends Context.Service<
  HarnessSupervision,
  OwnedStop<Promise<void>> & Readonly<{ session: HarnessSessionClient }>
>()("slopstop/measure/HarnessSupervision") {}
class ProjectEntryBridge extends Context.Service<ProjectEntryBridge, OwnedStop<void>>()(
  "slopstop/measure/ProjectEntryBridge",
) {}
class ProjectStorageBridge extends Context.Service<ProjectStorageBridge, OwnedStop<void>>()(
  "slopstop/measure/ProjectStorageBridge",
) {}
class WorkspaceBridge extends Context.Service<WorkspaceBridge, OwnedStop<void>>()(
  "slopstop/measure/WorkspaceBridge",
) {}

/** The first call runs the owner's stop; later calls return (or rethrow) that first outcome. */
function once<T>(run: () => T): OwnedStop<T> {
  let outcome: { ok: true; value: T } | { ok: false; error: unknown } | undefined;
  return {
    stop: () => {
      if (outcome === undefined) {
        try {
          outcome = { ok: true, value: run() };
        } catch (error) {
          outcome = { ok: false, error };
        }
      }
      if (outcome.ok) return outcome.value;
      throw outcome.error;
    },
    stopped: () => outcome !== undefined,
  };
}

/** An owner with a latched stop; its release stops it only if nobody did, and a failure is a defect. */
function owned<A, T>(make: () => A, stopOwner: (owner: A) => T) {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const owner = make();
      return { owner, latch: once(() => stopOwner(owner)) };
    }),
    ({ latch }) =>
      latch.stopped()
        ? Effect.void
        : Effect.promise(async () => {
            await latch.stop();
          }),
  );
}

type Roots = Readonly<{ logs: string; userData: string }>;

/** A bridge over the supervision's session; its dependency makes it release first. */
function bridgeOwner(make: (session: HarnessSessionClient) => { stop(): void }) {
  return Effect.gen(function* () {
    const { session } = yield* HarnessSupervision;
    const { latch } = yield* owned(
      () => make(session),
      (bridge) => bridge.stop(),
    );
    return latch;
  });
}

function desktopLayer(roots: Roots) {
  const loggerLayer = Layer.effect(
    DesktopLogger,
    Effect.sync(() => createMainLogger(roots.logs, true)),
  );
  const supervisionLayer = Layer.effect(
    HarnessSupervision,
    Effect.gen(function* () {
      const logger = yield* DesktopLogger;
      const { owner, latch } = yield* owned(
        () =>
          new HarnessSupervisor(
            harnessEntryPath(path.join(repositoryRoot, "apps/desktop/.vite/build")),
            logger,
            createProjectStorageHarnessBootstrap({
              userDataRoot: roots.userData,
              migrationResourcesRoot: path.join(repositoryRoot, "apps/harness/drizzle"),
            }),
          ),
        (supervisor) => supervisor.stop(),
      );
      return { session: owner.getSession(), stop: latch.stop, stopped: latch.stopped };
    }),
  );
  const options = (session: HarnessSessionClient) => ({
    session,
    createId: randomUUID,
    now: () => new Date().toISOString(),
  });
  return Layer.mergeAll(
    Layer.effect(
      ProjectEntryBridge,
      bridgeOwner((session) => createProjectEntryBridge(options(session))),
    ),
    Layer.effect(
      ProjectStorageBridge,
      bridgeOwner((session) => createProjectStorageBridge(options(session))),
    ),
    Layer.effect(
      WorkspaceBridge,
      bridgeOwner((session) => createWorkspaceBridge(options(session))),
    ),
  ).pipe(Layer.provideMerge(supervisionLayer), Layer.provideMerge(loggerLayer));
}

const readServices = Effect.gen(function* () {
  return {
    storage: yield* ProjectStorageBridge,
    workspace: yield* WorkspaceBridge,
    entry: yield* ProjectEntryBridge,
    supervision: yield* HarnessSupervision,
  };
});

type Timed = { start: number; end: number; outcome: "settled" | "bound" };
type Sample = {
  cell: string;
  index: number;
  window: number | null;
  startIso: string;
  disposeMs: number;
  outcome: "settled" | "bound" | "failed";
  diagnostic?: string;
  inWindow: boolean | null;
  disposeStartMs?: number;
  disposeEndMs?: number;
};
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

const runStart = performance.now();
const elapsed = () => performance.now() - runStart;
const epochNow = () => performance.timeOrigin + performance.now();
const iso = (ms: number | undefined) => (ms === undefined ? null : new Date(ms).toISOString());
const windows: Window[] = [];

function withinBound<T>(promise: Promise<T>) {
  return Promise.race([
    promise.then(() => "settled" as const),
    delay(SAMPLE_BOUND_MS).then(() => "bound" as const),
  ]);
}

/** Untimed steps must settle within the sample bound, or the sample fails. */
async function untimed(label: string, promise: Promise<unknown>) {
  if ((await withinBound(promise)) === "bound") throw new Error(`${label} did not settle`);
}

/** One fresh runtime with its services read; all outside the timed window. */
function freshProgram(roots: Roots) {
  const runtime = ManagedRuntime.make(desktopLayer(roots));
  const services = runtime.runSync(readServices);
  const latches: Latch[] = [
    services.storage,
    services.workspace,
    services.entry,
    services.supervision,
  ];
  return { runtime, services, latches };
}

async function timedDispose(program: ReturnType<typeof freshProgram>): Promise<Timed> {
  const start = performance.now();
  const outcome = await withinBound(program.runtime.dispose());
  const end = performance.now();
  const unstopped = program.latches.filter((latch) => !latch.stopped()).length;
  if (outcome === "settled" && unstopped > 0) {
    throw new Error(`${unstopped} owners not stopped after dispose`);
  }
  return { start, end, outcome };
}

/** M-dispose-after-program: the s6 program's stops ran first, so every release is a no-op. */
async function afterProgramSample(roots: Roots): Promise<Timed> {
  const program = freshProgram(roots);
  const { storage, workspace, entry, supervision } = program.services;
  storage.stop();
  workspace.stop();
  entry.stop();
  await untimed("supervisor stop", supervision.stop());
  return timedDispose(program);
}

/** M-dispose-safety-net: no program ran, so the releases stop every owner. */
function safetyNetSample(roots: Roots): Promise<Timed> {
  return timedDispose(freshProgram(roots));
}

const measure: Record<Shape, (roots: Roots) => Promise<Timed>> = {
  "M-dispose-after-program": afterProgramSample,
  "M-dispose-safety-net": safetyNetSample,
};

async function burstLogLine(log: string, prefix: string): Promise<string | undefined> {
  const text = await readFile(log, "utf8").catch(() => "");
  return text.split("\n").find((line) => line.startsWith(prefix));
}

/**
 * Starts one burst once the previous one has exited. The burst stops itself after
 * BURST_SECONDS; its start line gives the deadline its loops use.
 */
async function openBurstWindow(outDir: string): Promise<Window> {
  const previous = windows.at(-1);
  if (previous !== undefined) await previous.exited;
  const index = windows.length + 1;
  const log = path.join(outDir, `burst-${index}.log`);
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

async function runCell(shape: Shape, condition: Condition, roots: Roots, outDir: string) {
  const cell = `${shape} ${condition}`;
  const samplesFile = path.join(outDir, "samples.jsonl");
  const results: Sample[] = [];
  let window: Window | undefined;
  for (let index = 0; index < SAMPLES; index += 1) {
    const needsWindow =
      condition === "burst" &&
      (window === undefined || window.endMs - epochNow() < WINDOW_MARGIN_MS);
    if (runBoundReached(needsWindow)) break;
    if (needsWindow) window = await openBurstWindow(outDir);
    const startIso = new Date().toISOString();
    let sample: Sample;
    try {
      const { start, end, outcome } = await measure[shape](roots);
      const current = window;
      const disposeStartMs = performance.timeOrigin + start;
      const disposeEndMs = performance.timeOrigin + end;
      sample = {
        cell,
        index,
        window: current?.index ?? null,
        startIso,
        disposeMs: outcome === "bound" ? SAMPLE_BOUND_MS : end - start,
        outcome,
        inWindow:
          current === undefined
            ? null
            : disposeStartMs >= current.startMs && disposeEndMs <= current.endMs,
        disposeStartMs,
        disposeEndMs,
      };
    } catch (error) {
      sample = {
        cell,
        index,
        window: window?.index ?? null,
        startIso,
        disposeMs: Number.NaN,
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
  const sorted = counted.map((sample) => sample.disposeMs).sort((a, b) => a - b);
  const failed = results.filter((sample) => sample.outcome === "failed");
  const outside = results.filter((sample) => sample.inWindow === false);
  const broken: string[] = [];
  if (results.length < SAMPLES) broken.push(`incomplete: ${results.length}/${SAMPLES} samples`);
  if (failed.length > 0) broken.push(`${failed.length} failed samples: ${failed[0]?.diagnostic}`);
  if (outside.length > 0)
    broken.push(`${outside.length} timed disposes outside their burst window`);
  const p99 = percentile(sorted, 99);
  return {
    samples: results.length,
    bound: results.filter((sample) => sample.outcome === "bound").length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99,
    max: sorted.at(-1),
    halfBoundMs: HALF_BOUND_MS,
    withinHalfBound: p99 !== undefined && p99 <= HALF_BOUND_MS,
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

/** The output folder is an argument; an existing non-empty folder is refused. */
function preparedOutDir(): string | undefined {
  if (outDirArgument === undefined) {
    process.stderr.write("usage: electron <bundle> <outDir> [--smoke]\n");
    return undefined;
  }
  const outDir = path.resolve(outDirArgument);
  if (existsSync(outDir) && readdirSync(outDir).length > 0) {
    process.stderr.write(`refused: ${outDir} exists and is not empty\n`);
    return undefined;
  }
  return outDir;
}

async function main(outDir: string): Promise<number> {
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "samples.jsonl"), "");
  const temporary = await mkdtemp(path.join(os.tmpdir(), "slopstop-s6-dispose-"));
  const roots = { logs: path.join(temporary, "logs"), userData: path.join(temporary, "userData") };
  const allCells = (["quiet", "burst"] as const).flatMap((condition) =>
    SHAPES.map((shape) => [shape, condition] as const),
  );
  const cells = allCells.filter(
    ([shape, condition]) => !smoke || condition === "quiet" || shape === "M-dispose-safety-net",
  );
  const summary: Record<string, ReturnType<typeof summarize>> = {};
  try {
    for (const [shape, condition] of cells) {
      summary[`${shape} ${condition}`] = summarize(await runCell(shape, condition, roots, outDir));
    }
  } finally {
    await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
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
  const result = {
    parent: PARENT,
    smoke,
    electron: process.versions.electron,
    elapsedMs: elapsed(),
    bounds,
    overlaps,
    failedBursts,
    summary,
  };
  await writeFile(path.join(outDir, "burst-windows.json"), `${JSON.stringify(records, null, 2)}\n`);
  await writeFile(path.join(outDir, "summary.json"), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ ...result, windows: records }, null, 2)}\n`);
  const broken = Object.values(summary).some((cell) => cell.broken.length > 0);
  return overlaps.length > 0 || failedBursts.length > 0 || broken ? 1 : 0;
}

const outDir = preparedOutDir();
if (outDir === undefined) {
  app.exit(3);
} else {
  const watchdog = setTimeout(() => {
    process.stderr.write("run bound exceeded\n");
    app.exit(2);
  }, RUN_BOUND_MS + 60_000);
  app
    .whenReady()
    .then(() => main(outDir))
    .then(
      (code) => {
        clearTimeout(watchdog);
        app.exit(code);
      },
      (error: unknown) => {
        clearTimeout(watchdog);
        process.stderr.write(`measurement failed: ${String(error)}\n`);
        app.exit(1);
      },
    );
}
