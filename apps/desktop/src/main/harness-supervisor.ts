import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  createHandshakeCommand,
  decodeStrict,
  type HarnessBootstrap,
  HarnessBootstrapSchema,
  type HarnessMessage,
  type HarnessStatus,
  HarnessStatusSchema,
  type RetryHarnessResult,
} from "@slopstop/protocol";
import { Deferred, Duration, Effect, type Fiber } from "effect";
import { MessageChannelMain, type UtilityProcess, utilityProcess } from "electron";
import type { Logger } from "pino";
import { reportHarnessCrash } from "./crash-reporting.js";
import {
  HarnessSession,
  type HarnessSessionClient,
  type HarnessSessionEvent,
} from "./harness-session.js";

const handshakeTimeoutMs = 5_000;
const harnessShutdownGraceMs = 5_000;
const maxAutomaticAttempts = 3;
const restartBaseDelayMs = 250;
const statusNeutralEvents: ReadonlySet<HarnessMessage["event"]> = new Set([
  "request.failure",
  "project.open.result",
  "project.create.result",
  "project.close.result",
  "workspace.intent.result",
  "workspace.projection.invalidated",
  "workspace.query.result",
]);

type StatusListener = (status: HarnessStatus) => void;

export class HarnessSupervisor {
  readonly #bootstrap: HarnessBootstrap;
  readonly #entryPath: string;
  readonly #errorGuards = new Map<UtilityProcess, () => void>();
  readonly #logger: Logger;
  readonly #listeners = new Set<StatusListener>();
  readonly #observationCleanup = new Map<UtilityProcess, () => void>();
  #attempt = 0;
  #child: UtilityProcess | undefined;
  #handshakeTimer: Fiber.Fiber<void> | undefined;
  #manualRetryPending = false;
  #restartBlocked = false;
  #restartTimer: Fiber.Fiber<void> | undefined;
  readonly #session = new HarnessSession();
  #status: HarnessStatus = { state: "stopped" };
  #stopPromise: Promise<void> | undefined;
  #stopping = false;

  constructor(entryPath: string, logger: Logger, bootstrap: HarnessBootstrap) {
    this.#entryPath = entryPath;
    this.#logger = logger;
    this.#bootstrap = decodeStrict(HarnessBootstrapSchema, bootstrap);
    this.#session.subscribe((event) => {
      this.#handleSessionEvent(event);
    });
  }

  getStatus(): HarnessStatus {
    return this.#status;
  }

  getSession(): HarnessSessionClient {
    return this.#session;
  }

  retry(): RetryHarnessResult {
    const unavailable = {
      ok: false,
      error: {
        code: "HARNESS_RETRY_UNAVAILABLE",
        message: "Harness retry is available only after automatic recovery stops.",
      },
    } as const;
    if (this.#stopping) return unavailable;
    if (this.#status.state !== "crashed") return unavailable;

    if (this.#child === undefined) {
      this.#restartAfterFailure();
    } else {
      this.#manualRetryPending = true;
    }
    return { ok: true };
  }

  start(): void {
    if (this.#child !== undefined) return;
    if (this.#restartTimer !== undefined) return;
    if (this.#stopping) return;

    this.#stopPromise = undefined;
    this.#spawn();
  }

  stop(): Promise<void> {
    if (this.#stopPromise !== undefined) return this.#stopPromise;
    this.#stopping = true;
    this.#manualRetryPending = false;
    this.#session.detach();
    this.#clearTimers();
    const child = this.#child;
    if (child === undefined) {
      this.#setStatus({ state: "stopped" });
      this.#stopping = false;
      this.#stopPromise = Promise.resolve();
      return this.#stopPromise;
    }
    this.#removeChildObservation(child);
    this.#guardChildErrors(child);
    this.#stopPromise = this.#stopChild(child);
    return this.#stopPromise;
  }

  subscribe(listener: StatusListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #clearTimers(): void {
    this.#handshakeTimer?.interruptUnsafe();
    this.#handshakeTimer = undefined;
    this.#restartTimer?.interruptUnsafe();
    this.#restartTimer = undefined;
  }

  // Waits for the child's exit for one grace period, kills it, then waits one more grace
  // period; still running then is a shutdown timeout. A late exit only clears the child.
  #stopChild(child: UtilityProcess): Promise<void> {
    const exited = Deferred.makeUnsafe<void>();
    let terminalTimedOut = false;
    child.once("exit", () => {
      if (this.#child === child) this.#child = undefined;
      if (terminalTimedOut) this.#stopping = false;
      Deferred.doneUnsafe(exited, Effect.void);
    });
    const kill = Effect.sync(() => {
      try {
        child.kill();
      } catch {
        // The terminal deadline remains authoritative when kill itself fails.
      }
    });
    const timedOut = Effect.suspend(() => {
      terminalTimedOut = true;
      this.#setStatus({
        state: "degraded",
        attempt: this.#attempt,
        diagnostic: {
          code: "HARNESS_SHUTDOWN_TIMEOUT",
          message: "Harness shutdown timed out.",
        },
      });
      return Effect.fail(new Error("Harness shutdown timed out."));
    });
    const graceful = Deferred.await(exited).pipe(
      Effect.timeoutOrElse({
        duration: Duration.millis(harnessShutdownGraceMs),
        orElse: () =>
          kill.pipe(
            Effect.andThen(
              Deferred.await(exited).pipe(
                Effect.timeoutOrElse({
                  duration: Duration.millis(harnessShutdownGraceMs),
                  orElse: () => timedOut,
                }),
              ),
            ),
          ),
      }),
      Effect.andThen(
        Effect.sync(() => {
          this.#setStatus({ state: "stopped" });
          this.#stopping = false;
        }),
      ),
    );
    return Effect.runPromise(graceful);
  }

  #after(delayMs: number, action: () => void): Fiber.Fiber<void> {
    return Effect.runFork(
      Effect.sleep(Duration.millis(delayMs)).pipe(Effect.andThen(Effect.sync(action))),
    );
  }

  #handleHarnessMessage(message: HarnessMessage): void {
    if (statusNeutralEvents.has(message.event)) return;
    switch (message.event) {
      case "system.failure":
        this.#restartBlocked = true;
        this.#setStatus({
          state: "crashed",
          attempt: this.#attempt,
          canRetry: true,
          diagnostic: {
            code: "HARNESS_PROTOCOL_ERROR",
            message: message.payload.message,
          },
        });
        if (this.#child !== undefined) {
          this.#quarantineChild(this.#child);
          this.#child.kill();
        }
        return;
      case "system.ready":
        this.#handshakeTimer?.interruptUnsafe();
        this.#handshakeTimer = undefined;
        this.#setStatus({
          state: "ready",
          attempt: this.#attempt,
          harnessVersion: message.payload.harnessVersion,
        });
        return;
    }
  }

  #handleSessionEvent(event: HarnessSessionEvent): void {
    switch (event.type) {
      case "disconnected":
        return;
      case "protocol-error":
        this.#restartBlocked = true;
        this.#setStatus({
          state: "crashed",
          attempt: this.#attempt,
          canRetry: true,
          diagnostic: {
            code: "HARNESS_PROTOCOL_ERROR",
            message: "Harness returned an invalid or incompatible protocol message.",
          },
        });
        if (this.#child !== undefined) {
          this.#quarantineChild(this.#child);
          this.#child.kill();
        }
        return;
      case "message":
        this.#handleHarnessMessage(event.message);
    }
  }

  #handleProcessExit(child: UtilityProcess, exitCode: number): void {
    if (this.#child !== child) {
      return;
    }

    this.#child = undefined;
    this.#session.detach();
    this.#handshakeTimer?.interruptUnsafe();
    this.#handshakeTimer = undefined;

    if (this.#stopping) {
      return;
    }
    if (this.#restartBlocked) {
      if (this.#manualRetryPending) this.#restartAfterFailure();
      return;
    }

    this.#logger.error({ exitCode, attempt: this.#attempt }, "Harness process exited.");
    reportHarnessCrash(exitCode);

    if (this.#attempt >= maxAutomaticAttempts) {
      this.#setStatus({
        state: "crashed",
        attempt: this.#attempt,
        canRetry: true,
        diagnostic: {
          code: "HARNESS_PROCESS_EXITED",
          message: `Harness exited with code ${exitCode}.`,
        },
      });
      return;
    }

    this.#setStatus({
      state: "degraded",
      attempt: this.#attempt,
      diagnostic: {
        code: "HARNESS_PROCESS_EXITED",
        message: `Harness exited with code ${exitCode}; automatic recovery is pending.`,
      },
    });
    const delay = restartBaseDelayMs * 2 ** Math.max(0, this.#attempt - 1);
    this.#restartTimer = this.#after(delay, () => {
      this.#restartTimer = undefined;
      this.#spawn();
    });
  }

  #setStatus(status: HarnessStatus): void {
    this.#status = decodeStrict(HarnessStatusSchema, status);
    for (const listener of this.#listeners) {
      listener(this.#status);
    }
  }

  #restartAfterFailure(): void {
    this.#manualRetryPending = false;
    this.#clearTimers();
    this.#session.detach();
    this.#attempt = 0;
    this.#restartBlocked = false;
    this.#spawn();
  }

  #createChild(): UtilityProcess | undefined {
    try {
      return utilityProcess.fork(this.#entryPath, [], {
        serviceName: "SlopStop Harness",
        stdio: "pipe",
      });
    } catch {
      this.#logger.error(
        { attempt: this.#attempt, code: "HARNESS_START_FAILED" },
        "Harness process failed to start.",
      );
      this.#setStatus({
        state: "crashed",
        attempt: this.#attempt,
        canRetry: true,
        diagnostic: {
          code: "HARNESS_START_FAILED",
          message: "Harness process could not be started.",
        },
      });
      return undefined;
    }
  }

  #observeChild(child: UtilityProcess): void {
    const attempt = this.#attempt;
    const observeOutput = (stream: "stdout" | "stderr", chunk: Buffer): void => {
      const metadata = { attempt, stream, bytes: chunk.byteLength };
      if (stream === "stdout") {
        this.#logger.info(metadata, "Harness process output observed.");
      } else {
        this.#logger.error(metadata, "Harness process output observed.");
      }
    };
    const onStdout = (chunk: Buffer) => observeOutput("stdout", chunk);
    const onStderr = (chunk: Buffer) => observeOutput("stderr", chunk);
    const onError = () => {
      this.#logger.error(
        { attempt, code: "HARNESS_PROCESS_ERROR" },
        "Harness process reported a fatal error.",
      );
    };
    child.stdout?.on("data", onStdout);
    child.stderr?.on("data", onStderr);
    child.once("error", onError);
    this.#observationCleanup.set(child, () => {
      child.stdout?.off("data", onStdout);
      child.stderr?.off("data", onStderr);
      child.off("error", onError);
    });
    child.once("exit", (exitCode) => {
      this.#removeChildObservation(child);
      this.#removeChildErrorGuard(child);
      this.#handleProcessExit(child, exitCode);
    });
    child.once("spawn", () => {
      if (this.#stopping || this.#child !== child) return;
      this.#connectChild(child);
    });
  }

  #removeChildObservation(child: UtilityProcess): void {
    const cleanup = this.#observationCleanup.get(child);
    if (cleanup === undefined) return;
    this.#observationCleanup.delete(child);
    cleanup();
  }

  #guardChildErrors(child: UtilityProcess): void {
    if (this.#errorGuards.has(child)) return;
    const ignoreError = () => {};
    this.#errorGuards.set(child, ignoreError);
    child.on("error", ignoreError);
  }

  #removeChildErrorGuard(child: UtilityProcess): void {
    const guard = this.#errorGuards.get(child);
    if (guard === undefined) return;
    this.#errorGuards.delete(child);
    child.off("error", guard);
  }

  #quarantineChild(child: UtilityProcess): void {
    this.#session.detach();
    this.#removeChildObservation(child);
    this.#guardChildErrors(child);
  }

  #connectChild(child: UtilityProcess): void {
    const { port1, port2 } = new MessageChannelMain();
    this.#session.attach(port2);
    child.postMessage(this.#bootstrap, [port1]);
    const handshake = this.#session.send(
      createHandshakeCommand(
        {
          messageId: randomUUID(),
          sentAt: new Date().toISOString(),
        },
        "0.0.0",
      ),
    );
    if (!handshake.ok) {
      this.#restartBlocked = true;
      this.#logger.error(
        { attempt: this.#attempt, code: handshake.error.code },
        "Harness handshake could not be sent.",
      );
      this.#setStatus({
        state: "crashed",
        attempt: this.#attempt,
        canRetry: true,
        diagnostic: {
          code: "HARNESS_START_FAILED",
          message: "Harness handshake could not be sent.",
        },
      });
      this.#quarantineChild(child);
      child.kill();
      return;
    }
    this.#handshakeTimer = this.#after(handshakeTimeoutMs, () => {
      this.#logger.error({ attempt: this.#attempt }, "Harness handshake timed out.");
      this.#setStatus({
        state: "degraded",
        attempt: this.#attempt,
        diagnostic: {
          code: "HARNESS_HANDSHAKE_TIMEOUT",
          message: "Harness did not complete its startup handshake in time.",
        },
      });
      child.kill();
    });
  }

  #spawn(): void {
    this.#attempt += 1;
    this.#setStatus({ state: "starting", attempt: this.#attempt });
    const child = this.#createChild();
    if (child === undefined) {
      return;
    }
    this.#child = child;
    this.#observeChild(child);
  }
}

export function harnessEntryPath(directory: string): string {
  return path.join(directory, "harness.cjs");
}
