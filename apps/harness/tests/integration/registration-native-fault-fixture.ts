import * as koffi from "koffi";
import {
  createWindowsObserverApi,
  nativeInteger,
  requireWindowsSuccess,
} from "../../src/registration/windows-observer-api.js";
import { createWindowsVersionChild } from "../../src/registration/windows-version-child.js";
import {
  createHeldNativeVersionScenario,
  createRegistryVersionScenario,
  readObserverRows,
} from "./registration-version-fixture.js";

type Trigger = "stdout" | "stderr" | "deadline" | "cancellation";
type Fault = "none" | "resource-close" | "job-query" | "native-wait";

export const nativeTriggerCases: ReadonlyArray<
  Readonly<{ trigger: Trigger; fault: Fault; expectedTrigger: string }>
> = [
  { trigger: "stdout", fault: "none", expectedTrigger: "OBSERVATION_LIMIT_EXCEEDED" },
  { trigger: "cancellation", fault: "job-query", expectedTrigger: "CANCELLED" },
];

export function cleanupFault(api: ReturnType<typeof createWindowsObserverApi>, fault: Fault) {
  const readers = new Set<bigint>();
  let failures = 0;
  return {
    failures: () => failures,
    api: {
      ...api,
      createPipe: (...args: readonly unknown[]) => {
        const result = api.createPipe(...args);
        const reader = args[0];
        if (Array.isArray(reader)) readers.add(koffi.address(reader[0]));
        return result;
      },
      close: (handle: unknown) => {
        const result = api.close(handle);
        if (fault === "resource-close" && readers.has(koffi.address(handle))) {
          failures += 1;
          throw new Error("private-resource-close-acknowledgement");
        }
        return result;
      },
      queryJob: (...args: readonly unknown[]) => {
        if (fault === "job-query") {
          failures += 1;
          throw new Error("private-job-query-failure");
        }
        return api.queryJob(...args);
      },
      wait: (...args: readonly unknown[]) => {
        if (fault === "native-wait") {
          failures += 1;
          return 0xffffffff;
        }
        return api.wait(...args);
      },
    },
  };
}

async function createNativeTriggerScenario(root: string, trigger: Trigger, fault: Fault) {
  const source =
    trigger === "stdout" || trigger === "stderr"
      ? createNativeOverflowApi(trigger)
      : { api: createWindowsObserverApi(), injectedBytes: () => 0 };
  const injected = cleanupFault(source.api, fault);
  const native = createWindowsVersionChild(root, () => injected.api);
  if (trigger === "deadline" || trigger === "cancellation") {
    const scenario = await createHeldNativeVersionScenario(root, native);
    return {
      ...scenario,
      ready: scenario.owned.promise,
      release: () => scenario.release.resolve(),
      injectedBytes: source.injectedBytes,
      failures: injected.failures,
    };
  }
  const scenario = await createRegistryVersionScenario(root, native);
  return {
    ...scenario,
    ready: Promise.resolve(),
    release: () => undefined,
    injectedBytes: source.injectedBytes,
    failures: injected.failures,
  };
}

export async function observeNativeTrigger(root: string, trigger: Trigger, fault: Fault) {
  const scenario = await createNativeTriggerScenario(root, trigger, fault);
  const observation = scenario.observer.inspectGitVersion(scenario.request);
  try {
    await scenario.ready;
    const close = trigger === "cancellation" ? await scenario.observer.close() : undefined;
    const result = await observation;
    return {
      result,
      close,
      injectedBytes: scenario.injectedBytes(),
      failures: scenario.failures(),
      unsettled: await scenario.registry.hasUnsettled(),
      terminals: await readObserverRows(root, "terminals"),
      outcomes: await readObserverRows(root, "outcomes"),
      subsequent: await scenario.observer.inspectGitVersion(scenario.request),
    };
  } finally {
    scenario.release();
    await observation;
    await scenario.registry.stop();
  }
}

export async function observeHeldDeadline(root: string) {
  const scenario = await createHeldNativeVersionScenario(root);
  const observation = scenario.observer.inspectGitVersion(scenario.request);
  const limit = setTimeout(() => scenario.release.resolve(), 10000);
  let guard: ReturnType<typeof setTimeout> | undefined;
  try {
    await scenario.owned.promise;
    const result = await Promise.race([
      observation,
      new Promise((resolve) => {
        guard = setTimeout(() => resolve("deadline-not-settled"), 7500);
      }),
    ]);
    const unsettled = await scenario.registry.hasUnsettled();
    scenario.release.resolve();
    return {
      result,
      unsettled,
      settledResult: await observation,
      subsequent: await scenario.observer.inspectGitVersion(scenario.request),
    };
  } finally {
    clearTimeout(limit);
    clearTimeout(guard);
    scenario.release.resolve();
    await observation;
    await scenario.registry.stop();
  }
}

function createNativeOverflowApi(stream: "stdout" | "stderr") {
  const api = createWindowsObserverApi();
  const kernel = koffi.load("kernel32.dll");
  const info = kernel.func(
    "int __stdcall GetNamedPipeInfo(void *pipe, _Out_ uint32_t *flags, _Out_ uint32_t *outSize, _Out_ uint32_t *inSize, void *instances)",
  );
  const write = kernel.func(
    "int __stdcall WriteFile(void *file, void *buffer, uint32_t size, _Out_ uint32_t *written, void *overlapped)",
  );
  let pipes = 0;
  let injectedBytes = 0;
  function requireCapacity(reader: unknown): void {
    const flags: unknown[] = [0],
      outgoing: unknown[] = [0],
      incoming: unknown[] = [0];
    requireWindowsSuccess(api, info(reader, flags, outgoing, incoming, null));
    if ((nativeInteger(flags[0]) & 1) !== 1 || nativeInteger(incoming[0]) < 8193) {
      throw new Error("Fixture pipe capacity cannot hold the bounded write.");
    }
  }
  function fillPipe(reader: unknown, writer: unknown): void {
    if (!Array.isArray(reader) || !Array.isArray(writer)) throw new Error("Invalid pipe outputs.");
    try {
      requireCapacity(reader[0]);
      const bytes = Buffer.alloc(8193, 0x61);
      const written: unknown[] = [0];
      requireWindowsSuccess(api, write(writer[0], bytes, bytes.length, written, null));
      injectedBytes = nativeInteger(written[0]);
    } catch (error) {
      api.close(reader[0]);
      api.close(writer[0]);
      throw error;
    }
  }
  return {
    injectedBytes: () => injectedBytes,
    api: {
      ...api,
      createPipe: (reader: unknown, writer: unknown, security: unknown, size: unknown) => {
        const target = pipes++ === (stream === "stdout" ? 0 : 1);
        const result = api.createPipe(reader, writer, security, target ? 16384 : size);
        requireWindowsSuccess(api, result);
        if (target) fillPipe(reader, writer);
        return result;
      },
    },
  };
}
