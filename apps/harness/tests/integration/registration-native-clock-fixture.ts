import type { ObserverClock } from "../../src/registration/observer-clock.js";
import {
  createWindowsObserverApi,
  requireWindowsSuccess,
} from "../../src/registration/windows-observer-api.js";
import { createWindowsVersionChild } from "../../src/registration/windows-version-child.js";
import { switchDeferred } from "./project-storage-runtime-fixture.js";
import { cleanupFault } from "./registration-native-fault-fixture.js";
import {
  createHeldNativeVersionScenario,
  createRegistryVersionScenario,
} from "./registration-version-fixture.js";

type BoundaryCase = Readonly<{
  name: string;
  processAt: number;
  eofAt: number;
  finishAt: number;
  confirmed: boolean;
  forceOffsets: readonly number[];
  failure?: "job" | "wait" | "close";
  processCost?: number;
  terminalCost?: number;
  observeAt?: number;
  queryCostAt?: number;
  successfulCloseCost?: number;
}>;

export const nativeCleanupBoundaries: readonly BoundaryCase[] = [
  {
    name: "NR-2 successful close at4999",
    processAt: 3999,
    eofAt: 4999,
    finishAt: 4999,
    confirmed: true,
    forceOffsets: [2000],
    successfulCloseCost: 0,
  },
  {
    name: "NR-2 successful close at5000",
    processAt: 3999,
    eofAt: 4999,
    finishAt: 5000,
    observeAt: 4999,
    confirmed: false,
    forceOffsets: [2000],
    successfulCloseCost: 1,
  },
  {
    name: "NR-2 successful close at5001",
    processAt: 3999,
    eofAt: 4999,
    finishAt: 5001,
    observeAt: 4999,
    confirmed: false,
    forceOffsets: [2000],
    successfulCloseCost: 2,
  },
  {
    name: "process at3999 and EOF at4999",
    processAt: 3999,
    eofAt: 4999,
    finishAt: 4999,
    confirmed: true,
    forceOffsets: [2000],
  },
  {
    name: "process at4000 is too late",
    processAt: 4000,
    eofAt: 4000,
    finishAt: 5000,
    confirmed: false,
    forceOffsets: [2000],
  },
  {
    name: "process after4000 is too late",
    processAt: 4001,
    eofAt: 4001,
    finishAt: 5000,
    confirmed: false,
    forceOffsets: [2000],
  },
  {
    name: "EOF at5000 is too late",
    processAt: 3999,
    eofAt: 5000,
    finishAt: 5000,
    confirmed: false,
    forceOffsets: [2000],
  },
  {
    name: "EOF never proves process exit",
    processAt: Infinity,
    eofAt: 0,
    finishAt: 5000,
    confirmed: false,
    forceOffsets: [2000],
  },
  {
    name: "process exit never proves EOF",
    processAt: 0,
    eofAt: Infinity,
    finishAt: 5000,
    confirmed: false,
    forceOffsets: [],
  },
  {
    name: "failed Job query keeps the absolute budget",
    processAt: Infinity,
    eofAt: 0,
    finishAt: 5000,
    confirmed: false,
    forceOffsets: [2000],
    failure: "job",
  },
  {
    name: "failed wait keeps the absolute budget",
    processAt: Infinity,
    eofAt: 0,
    finishAt: 5000,
    confirmed: false,
    forceOffsets: [2000],
    failure: "wait",
  },
  {
    name: "process proof completing at4000 is too late",
    processAt: 3999,
    eofAt: 4999,
    finishAt: 5000,
    confirmed: false,
    forceOffsets: [2000],
    processCost: 1,
  },
  {
    name: "terminal proof completing at5000 is too late",
    processAt: 3999,
    eofAt: 4999,
    finishAt: 5000,
    observeAt: 4999,
    confirmed: false,
    forceOffsets: [2000],
    terminalCost: 1,
  },
  {
    name: "resource close retains the first failure budget",
    processAt: 0,
    eofAt: 3999,
    finishAt: 5000,
    confirmed: false,
    forceOffsets: [],
    failure: "close",
  },
  {
    name: "force boundary reached during a native query",
    processAt: Infinity,
    eofAt: 0,
    finishAt: 5000,
    confirmed: false,
    forceOffsets: [2000],
    queryCostAt: 1999,
  },
];

function manualClock() {
  let now = 0;
  const timers = new Set<{ at: number; callback: () => void }>();
  const events: Array<"waiting" | "done"> = [];
  let listener: ((event: "waiting" | "done") => void) | undefined;
  const emit = (event: "waiting" | "done") => {
    if (listener === undefined) events.push(event);
    else {
      const notify = listener;
      listener = undefined;
      notify(event);
    }
  };
  const schedule = (milliseconds: number, callback: () => void) => {
    const timer = { at: now + milliseconds, callback };
    timers.add(timer);
    return () => {
      timers.delete(timer);
    };
  };
  const clock: ObserverClock = {
    now: () => now,
    schedule,
    wait: (milliseconds) =>
      new Promise((resolve) => {
        schedule(milliseconds, resolve);
        emit("waiting");
      }),
  };
  const jump = (time: number) => {
    if (time < now) throw new Error("The fixture clock cannot go backwards.");
    now = time;
    let fired = 0;
    for (const timer of [...timers]) {
      if (timer.at <= now) {
        timers.delete(timer);
        timer.callback();
        fired += 1;
      }
    }
    return fired;
  };
  const nextEvent = (): Promise<"waiting" | "done"> =>
    new Promise((resolve) => {
      const event = events.shift();
      if (event === undefined) listener = resolve;
      else resolve(event);
    });
  return {
    clock,
    jump,
    nextEvent,
    follow: (work: Promise<unknown>) => {
      void work.then(
        () => emit("done"),
        () => emit("done"),
      );
    },
    at: (time: number): Promise<"waiting" | "done"> => {
      const fired = jump(time);
      if (fired === 0) return Promise.resolve("waiting");
      return nextEvent();
    },
  };
}

async function createNativeBoundaryScenario(root: string, example: BoundaryCase) {
  const time = manualClock();
  const api = createWindowsObserverApi();
  const forceOffsets: number[] = [];
  let successfulClosures = 0;
  let pipeError = false;
  const elapsed = () => time.clock.now() - 2000;
  const observedApi: ReturnType<typeof createWindowsObserverApi> = {
    ...api,
    deleteAttributes: (...args) => {
      const result = api.deleteAttributes(...args);
      if (example.successfulCloseCost !== undefined) {
        successfulClosures += 1;
        time.jump(time.clock.now() + example.successfulCloseCost);
      }
      return result;
    },
    wait: () =>
      example.failure === "wait" ? 0xffffffff : elapsed() >= example.processAt ? 0 : 258,
    queryJob: (_job, _kind, buffer) => {
      if (example.failure === "job") throw new Error("Injected Job observation failure.");
      if (!Buffer.isBuffer(buffer)) throw new Error("Invalid Job buffer.");
      buffer.writeUInt32LE(elapsed() >= example.processAt ? 0 : 1, 40);
      if (elapsed() === example.queryCostAt) time.jump(time.clock.now() + 1);
      if (elapsed() >= example.processAt) time.jump(time.clock.now() + (example.processCost ?? 0));
      return 1;
    },
    peekPipe: (...args) => {
      const available = args[4];
      if (!Array.isArray(available)) throw new Error("Invalid pipe output.");
      available[0] = 0;
      pipeError = elapsed() >= example.eofAt;
      return pipeError ? 0 : 1;
    },
    lastError: () => (pipeError ? 109 : api.lastError()),
    exitCode: (_process, output) => {
      if (!Array.isArray(output)) throw new Error("Invalid exit output.");
      output[0] = 0;
      time.jump(time.clock.now() + (example.terminalCost ?? 0));
      return 1;
    },
    terminateJob: (...args) => {
      forceOffsets.push(elapsed());
      const result = api.terminateJob(...args);
      requireWindowsSuccess(api, result);
      return result;
    },
  };
  const selectedApi =
    example.failure === "close" ? cleanupFault(observedApi, "resource-close").api : observedApi;
  const native = createWindowsVersionChild(root, () => selectedApi, time.clock);
  return {
    ...(await createHeldNativeVersionScenario(root, native)),
    time,
    forceOffsets,
    successfulClosures: () => successfulClosures,
  };
}

async function createCancellationLagScenario(root: string) {
  const time = manualClock();
  const native = createWindowsVersionChild(root, createWindowsObserverApi, time.clock);
  return { ...(await createHeldNativeVersionScenario(root, native)), time };
}

async function createNativeCompletionScenario(
  input: Readonly<{ root: string; completedAt: number }>,
) {
  const { root, completedAt } = input;
  const time = manualClock();
  const api = createWindowsObserverApi();
  const ready = switchDeferred<void>();
  let processHandle: unknown;
  let jobHandle: unknown;
  let terminalReads = 0;
  const native = createWindowsVersionChild(
    root,
    () => ({
      ...api,
      inJob: (...args) => {
        processHandle = args[0];
        jobHandle = args[1];
        return api.inJob(...args);
      },
      resume: (...args) => {
        const result = api.resume(...args);
        try {
          waitForFixtureExit(api, processHandle, jobHandle);
          ready.resolve();
        } catch (error) {
          ready.reject(error instanceof Error ? error : new Error("Fixture wait failed."));
          throw error;
        }
        return result;
      },
      exitCode: (...args) => {
        const result = api.exitCode(...args);
        terminalReads += 1;
        time.jump(completedAt);
        return result;
      },
    }),
    time.clock,
  );
  return {
    ...(await createRegistryVersionScenario(root, native)),
    time,
    ready: ready.promise,
    terminalReads: () => terminalReads,
  };
}

function waitForFixtureExit(
  api: ReturnType<typeof createWindowsObserverApi>,
  processHandle: unknown,
  jobHandle: unknown,
) {
  if (api.wait(processHandle, 5000) !== 0) throw new Error("Fixture child did not exit.");
  const deadline = performance.now() + 5000;
  const accounting = Buffer.alloc(48);
  for (;;) {
    requireWindowsSuccess(api, api.queryJob(jobHandle, 1, accounting, accounting.length, null));
    if (accounting.readUInt32LE(40) === 0) return;
    if (performance.now() >= deadline) throw new Error("Fixture child tree did not exit.");
  }
}

const boundaryOffsets = [0, 1999, 2000, 3999, 4000, 4001, 4999, 5000];
export function expectedBoundaryTrace(example: BoundaryCase) {
  const finish = example.observeAt ?? example.finishAt;
  return boundaryOffsets
    .filter((offset) => offset <= finish)
    .map((offset) => [offset, offset === finish ? "done" : "waiting"]);
}

export async function observeNativeBoundary(root: string, example: BoundaryCase) {
  const scenario = await createNativeBoundaryScenario(root, example);
  const observation = scenario.observer.inspectGitVersion(scenario.request);
  scenario.time.follow(observation);
  const trace: Array<readonly [number, "waiting" | "done"]> = [];
  try {
    await scenario.owned.promise;
    for (const offset of boundaryOffsets) {
      const event = await scenario.time.at(2000 + offset);
      trace.push([offset, event]);
      if (event === "done") break;
    }
    const at = scenario.time.clock.now();
    if (trace.at(-1)?.[1] !== "done") scenario.time.jump(25000);
    return {
      trace,
      at,
      result: await observation,
      forceOffsets: scenario.forceOffsets,
      successfulClosures: scenario.successfulClosures(),
      unsettled: await scenario.registry.hasUnsettled(),
    };
  } finally {
    scenario.release.resolve();
    scenario.time.jump(25000);
    await observation;
    await scenario.registry.stop();
  }
}

export async function observeCancellationLag(root: string) {
  const scenario = await createCancellationLagScenario(root);
  const observation = scenario.observer.inspectGitVersion(scenario.request);
  scenario.time.follow(observation);
  let closing: ReturnType<typeof scenario.observer.close> | undefined;
  try {
    await scenario.owned.promise;
    closing = scenario.observer.close();
    const event = await scenario.time.at(5000);
    if (event !== "done") scenario.time.jump(25000);
    return { event, result: await observation, close: await closing };
  } finally {
    scenario.release.resolve();
    scenario.time.jump(25000);
    await observation;
    await closing;
    await scenario.registry.stop();
  }
}

export async function observeNativeCompletion(root: string, completedAt: number) {
  const scenario = await createNativeCompletionScenario({ root, completedAt });
  const observation = scenario.observer.inspectGitVersion(scenario.request);
  scenario.time.follow(observation);
  try {
    await scenario.ready;
    let event = await scenario.time.nextEvent();
    for (let tick = 10; event !== "done" && tick <= 1000; tick += 10)
      event = await scenario.time.at(tick);
    const at = scenario.time.clock.now();
    if (event !== "done") scenario.time.jump(25000);
    return {
      event,
      at,
      result: await observation,
      terminalReads: scenario.terminalReads(),
      unsettled: await scenario.registry.hasUnsettled(),
    };
  } finally {
    scenario.time.jump(25000);
    await observation;
    await scenario.registry.stop();
  }
}

type PostResumeCancellationCase = Readonly<{
  name: string;
  cancelAt: number;
  pollAt: number;
  causeAt: number;
  trigger: "CANCELLED" | "OBSERVATION_LIMIT_EXCEEDED";
}>;

export const postResumeCancellationCases: readonly PostResumeCancellationCase[] = [
  {
    name: "cancel1999 then poll2000",
    cancelAt: 1999,
    pollAt: 2000,
    causeAt: 1999,
    trigger: "CANCELLED",
  },
  {
    name: "cancel1000 then poll1500",
    cancelAt: 1000,
    pollAt: 1500,
    causeAt: 1000,
    trigger: "CANCELLED",
  },
  {
    name: "cancel and deadline exactly2000",
    cancelAt: 2000,
    pollAt: 2000,
    causeAt: 2000,
    trigger: "OBSERVATION_LIMIT_EXCEEDED",
  },
  {
    name: "deadline2000 precedes cancel2001",
    cancelAt: 2001,
    pollAt: 2001,
    causeAt: 2000,
    trigger: "OBSERVATION_LIMIT_EXCEEDED",
  },
];

async function createPostResumeCancellationScenario(root: string) {
  const time = manualClock();
  const api = createWindowsObserverApi();
  const resumed = switchDeferred<void>();
  let resumes = 0;
  const forcedAt: number[] = [];
  const native = createWindowsVersionChild(
    root,
    () => ({
      ...api,
      resume: (...args) => {
        const result = api.resume(...args);
        if (result !== 1) {
          resumed.reject(new Error("Fixture ResumeThread failed."));
          return result;
        }
        resumes += 1;
        resumed.resolve();
        return result;
      },
      wait: () => 258,
      queryJob: (_job, _kind, buffer) => {
        if (!Buffer.isBuffer(buffer)) throw new Error("Invalid Job buffer.");
        buffer.writeUInt32LE(1, 40);
        return 1;
      },
      peekPipe: (...args) => {
        const available = args[4];
        if (!Array.isArray(available)) throw new Error("Invalid pipe output.");
        available[0] = 0;
        return 1;
      },
      terminateJob: (...args) => {
        forcedAt.push(time.clock.now());
        return api.terminateJob(...args);
      },
    }),
    time.clock,
  );
  return {
    ...(await createRegistryVersionScenario(root, native)),
    time,
    resumed: resumed.promise,
    resumes: () => resumes,
    forcedAt,
  };
}

export async function observePostResumeCancellation(
  root: string,
  example: PostResumeCancellationCase,
) {
  const scenario = await createPostResumeCancellationScenario(root);
  const observation = scenario.observer.inspectGitVersion(scenario.request);
  scenario.time.follow(observation);
  let closing: ReturnType<typeof scenario.observer.close> | undefined;
  try {
    await scenario.resumed;
    const initialEvent = await scenario.time.nextEvent();
    scenario.time.jump(example.cancelAt);
    closing = scenario.observer.close();
    scenario.time.jump(example.pollAt);
    let event = await scenario.time.nextEvent();
    for (const offset of [1999, 2000, 3999, 4000, 4999, 5000]) {
      if (event === "done") break;
      event = await scenario.time.at(example.causeAt + offset);
    }
    const settledAt = scenario.time.clock.now();
    const forcedAt = [...scenario.forcedAt];
    if (event !== "done") scenario.time.jump(25000);
    return {
      resumes: scenario.resumes(),
      initialEvent,
      event,
      settledAt,
      forcedAt,
      result: await observation,
      unsettled: await scenario.registry.hasUnsettled(),
    };
  } finally {
    scenario.time.jump(25000);
    await observation;
    await closing;
    await scenario.registry.stop();
  }
}
