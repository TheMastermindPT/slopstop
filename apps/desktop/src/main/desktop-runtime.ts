import type { HarnessBootstrap } from "@slopstop/protocol";
import { Context, Effect, Layer, ManagedRuntime, Scope } from "effect";
import type { Logger } from "pino";
import type { HarnessBridgesInput, HarnessBridges as SharedBridges } from "./harness-bridges.js";
import type { HarnessSessionClient } from "./harness-session.js";
import type { HarnessSupervisor } from "./harness-supervisor.js";
import type { ProjectEntryBridge as ProjectEntryBridgeClient } from "./project-entry-bridge.js";
import type { ProjectStorageBridgeClient } from "./project-storage-bridge.js";
import type { WorkspaceBridgeClient } from "./workspace-bridge.js";

/** The supervisor surface Electron main uses. */
export type DesktopSupervisor = Pick<
  HarnessSupervisor,
  "start" | "stop" | "subscribe" | "getStatus" | "retry" | "getSession"
>;

/** What the shared bridges' constructor receives. */
type DesktopBridgeInput = HarnessBridgesInput;

/**
 * The runtime's ports. The value ports are thunks evaluated inside the Layer build, never at
 * module load; the owner ports are the constructors.
 */
export type DesktopRuntimePorts = Readonly<{
  createLogger(): Logger;
  harnessEntryPath(): string;
  harnessBootstrap(): HarnessBootstrap;
  createId(): string;
  now(): string;
  createSupervisor(
    logger: Logger,
    entryPath: string,
    bootstrap: HarnessBootstrap,
  ): DesktopSupervisor;
  createHarnessBridges(input: DesktopBridgeInput): SharedBridges;
}>;

/** An owner with its stop. */
type Owned<Owner, Stop> = Readonly<{ owner: Owner; stop(): Stop }>;

class DesktopLogger extends Context.Service<DesktopLogger, Logger>()(
  "slopstop/desktop/DesktopLogger",
) {}
class HarnessSupervision extends Context.Service<
  HarnessSupervision,
  Owned<DesktopSupervisor, Promise<void>> & Readonly<{ session: HarnessSessionClient }>
>()("slopstop/desktop/HarnessSupervision") {}
/** The three bridges over one shared core, each with its own latched stop (S6-I15). */
class HarnessBridges extends Context.Service<
  HarnessBridges,
  Readonly<{
    projectEntry: Owned<ProjectEntryBridgeClient, void>;
    projectStorage: Owned<ProjectStorageBridgeClient, void>;
    workspace: Owned<WorkspaceBridgeClient, void>;
  }>
>()("slopstop/desktop/HarnessBridges") {}

/** The services Electron main reads. */
export type DesktopServices = Readonly<{
  logger: Logger;
  harness: HarnessSupervision["Service"];
  projectEntry: HarnessBridges["Service"]["projectEntry"];
  projectStorage: HarnessBridges["Service"]["projectStorage"];
  workspace: HarnessBridges["Service"]["workspace"];
}>;

export type DesktopRuntime = ManagedRuntime.ManagedRuntime<
  DesktopLogger | HarnessSupervision | HarnessBridges,
  never
>;

/** Reads every desktop service; the first read builds the Layers. */
export const readDesktopServices = Effect.gen(function* () {
  return {
    logger: yield* DesktopLogger,
    harness: yield* HarnessSupervision,
    ...(yield* HarnessBridges),
  } satisfies DesktopServices;
});

/**
 * The services of a runtime that was built, without building it; `undefined` before the build.
 *
 * It reads `ManagedRuntime.cachedContext`, which effect marks internal: an effect upgrade may
 * change it. `disposes the main runtime before quit`, `retains %s shutdown`, the B2 main row
 * (`stops every bridge when the workspace stop throws`, through its `logError` assertion) and
 * `package:smoke` catch that drift.
 */
export function builtDesktopServices(runtime: DesktopRuntime): DesktopServices | undefined {
  const context = runtime.cachedContext;
  if (context === undefined) return undefined;
  return {
    logger: Context.get(context, DesktopLogger),
    harness: Context.get(context, HarnessSupervision),
    ...Context.get(context, HarnessBridges),
  };
}

/** Runs `run` once; every later call returns, or rethrows, that first outcome. */
function once<T>(run: () => T): Readonly<{ call(): T; called(): boolean }> {
  let outcome:
    | Readonly<{ ok: true; value: T }>
    | Readonly<{ ok: false; error: unknown }>
    | undefined;
  return {
    call: () => {
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
    called: () => outcome !== undefined,
  };
}

/**
 * An owner with one latched stop, shared by the explicit shutdown program and the Layer release.
 * The release stops the owner only when no stop came first, and its failure is a defect of the
 * release, so dispose reports it.
 */
function owned<Owner, Stop>(
  owners: Scope.Scope,
  make: () => Owner,
  stopOwner: (owner: Owner) => Stop,
) {
  const acquired = Effect.map(
    Effect.acquireRelease(
      Effect.sync(() => {
        const owner = make();
        return { owner, latch: once(() => stopOwner(owner)) };
      }),
      ({ latch }) =>
        latch.called()
          ? Effect.void
          : Effect.promise(async () => {
              await latch.call();
            }),
    ),
    ({ owner, latch }): Owned<Owner, Stop> => ({ owner, stop: latch.call }),
  );
  return Scope.provide(acquired, owners);
}

/** The owners' Layers; every owner's release lives in `owners`. */
function desktopLayer(ports: DesktopRuntimePorts, owners: Scope.Scope) {
  const loggerLayer = Layer.effect(DesktopLogger, Effect.sync(ports.createLogger));
  const supervisionLayer = Layer.effect(
    HarnessSupervision,
    Effect.gen(function* () {
      const logger = yield* DesktopLogger;
      const supervision = yield* owned(
        owners,
        () => ports.createSupervisor(logger, ports.harnessEntryPath(), ports.harnessBootstrap()),
        (supervisor) => supervisor.stop(),
      );
      return { ...supervision, session: supervision.owner.getSession() };
    }),
  );
  // The bridges depend on the supervision, so they release first. The release always runs
  // `release()` once at dispose; it skips the bridges whose latched stop already ran (S7-S4).
  const bridgesLayer = Layer.effect(
    HarnessBridges,
    Effect.gen(function* () {
      const { session } = yield* HarnessSupervision;
      const bridges = yield* Scope.provide(
        Effect.acquireRelease(
          Effect.sync(() =>
            ports.createHarnessBridges({ session, createId: ports.createId, now: ports.now }),
          ),
          (shared) => Effect.sync(() => shared.release()),
        ),
        owners,
      );
      const stoppable = <Owner extends Readonly<{ stop(): void }>>(owner: Owner) => ({
        owner,
        stop: () => owner.stop(),
      });
      return {
        projectEntry: stoppable(bridges.projectEntry),
        projectStorage: stoppable(bridges.projectStorage),
        workspace: stoppable(bridges.workspace),
      };
    }),
  );
  return bridgesLayer.pipe(Layer.provideMerge(supervisionLayer), Layer.provideMerge(loggerLayer));
}

/**
 * One lazily built runtime over the desktop owners.
 *
 * The owners' releases live in their own scope, a child of the runtime's scope forked after the
 * Layer scope, so dispose closes it first, in reverse acquisition order: the bridges, then the
 * supervisor. A failed build does not close it: the read fails with the build's own error, without
 * waiting on an asynchronous release, and the owners built so far stop at dispose (S6-K2).
 */
export function makeDesktopRuntime(ports: DesktopRuntimePorts): DesktopRuntime {
  const runtime: DesktopRuntime = ManagedRuntime.make(
    Layer.suspend(() => desktopLayer(ports, owners)),
  );
  // `runtime.scope` is marked internal by effect. The owners close first only because
  // `ManagedRuntime.make` forks the layer and fiber scopes before this one
  // (effect/src/ManagedRuntime.ts:292-294) and a sequential scope closes its children in reverse.
  // The default strategy is sequential (effect/src/internal/effect.ts:4092).
  const owners = Scope.forkUnsafe(runtime.scope);
  return runtime;
}
