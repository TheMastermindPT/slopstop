import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  createHandshakeCommand,
  HarnessBootstrapSchema,
  type HarnessStatus,
  HarnessStatusSchema,
  parseHarnessMessage,
  type RetryHarnessResult,
} from "@slopstop/protocol";
import {
  MessageChannelMain,
  type MessagePortMain,
  type UtilityProcess,
  utilityProcess,
} from "electron";
import type { Logger } from "pino";
import { reportHarnessCrash } from "./crash-reporting.js";

const handshakeTimeoutMs = 5_000;
const maxAutomaticAttempts = 3;
const restartBaseDelayMs = 250;

type StatusListener = (status: HarnessStatus) => void;

export class HarnessSupervisor {
  readonly #entryPath: string;
  readonly #logger: Logger;
  readonly #listeners = new Set<StatusListener>();
  #attempt = 0;
  #child: UtilityProcess | undefined;
  #handshakeTimer: NodeJS.Timeout | undefined;
  #port: MessagePortMain | undefined;
  #restartBlocked = false;
  #restartTimer: NodeJS.Timeout | undefined;
  #status: HarnessStatus = { state: "stopped" };
  #stopping = false;

  constructor(entryPath: string, logger: Logger) {
    this.#entryPath = entryPath;
    this.#logger = logger;
  }

  getStatus(): HarnessStatus {
    return this.#status;
  }

  retry(): RetryHarnessResult {
    if (this.#status.state !== "crashed") {
      return {
        ok: false,
        error: {
          code: "HARNESS_RETRY_UNAVAILABLE",
          message: "Harness retry is available only after automatic recovery stops.",
        },
      };
    }

    this.#attempt = 0;
    this.#restartBlocked = false;
    this.#stopping = false;
    this.#spawn();
    return { ok: true };
  }

  start(): void {
    if (this.#child !== undefined || this.#restartTimer !== undefined) {
      return;
    }

    this.#stopping = false;
    this.#spawn();
  }

  stop(): void {
    this.#stopping = true;
    this.#clearTimers();
    this.#port?.close();
    this.#port = undefined;
    this.#child?.kill();
    this.#child = undefined;
    this.#setStatus({ state: "stopped" });
  }

  subscribe(listener: StatusListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #clearTimers(): void {
    if (this.#handshakeTimer !== undefined) {
      clearTimeout(this.#handshakeTimer);
      this.#handshakeTimer = undefined;
    }
    if (this.#restartTimer !== undefined) {
      clearTimeout(this.#restartTimer);
      this.#restartTimer = undefined;
    }
  }

  #handleHarnessMessage(value: unknown): void {
    const parsed = parseHarnessMessage(value);
    if (!parsed.ok) {
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
      this.#child?.kill();
      return;
    }

    if (parsed.value.event === "system.failure") {
      this.#restartBlocked = true;
      this.#setStatus({
        state: "crashed",
        attempt: this.#attempt,
        canRetry: true,
        diagnostic: {
          code: "HARNESS_PROTOCOL_ERROR",
          message: parsed.value.payload.message,
        },
      });
      this.#child?.kill();
      return;
    }

    if (this.#handshakeTimer !== undefined) {
      clearTimeout(this.#handshakeTimer);
      this.#handshakeTimer = undefined;
    }
    this.#setStatus({
      state: "ready",
      attempt: this.#attempt,
      harnessVersion: parsed.value.payload.harnessVersion,
    });
  }

  #handleProcessExit(child: UtilityProcess, exitCode: number): void {
    if (this.#child !== child) {
      return;
    }

    this.#child = undefined;
    this.#port?.close();
    this.#port = undefined;
    if (this.#handshakeTimer !== undefined) {
      clearTimeout(this.#handshakeTimer);
      this.#handshakeTimer = undefined;
    }

    if (this.#stopping || this.#restartBlocked) {
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
    this.#restartTimer = setTimeout(() => {
      this.#restartTimer = undefined;
      this.#spawn();
    }, delay);
  }

  #setStatus(status: HarnessStatus): void {
    this.#status = HarnessStatusSchema.parse(status);
    for (const listener of this.#listeners) {
      listener(this.#status);
    }
  }

  #spawn(): void {
    this.#attempt += 1;
    this.#setStatus({ state: "starting", attempt: this.#attempt });

    let child: UtilityProcess;
    try {
      child = utilityProcess.fork(this.#entryPath, [], {
        serviceName: "SlopStop Harness",
        stdio: "pipe",
      });
    } catch (error) {
      this.#logger.error({ error, attempt: this.#attempt }, "Harness process failed to start.");
      this.#setStatus({
        state: "crashed",
        attempt: this.#attempt,
        canRetry: true,
        diagnostic: {
          code: "HARNESS_START_FAILED",
          message: "Harness process could not be started.",
        },
      });
      return;
    }

    this.#child = child;
    child.stdout?.on("data", (chunk: Buffer) => {
      this.#logger.info({ output: chunk.toString("utf8").trimEnd() }, "Harness output.");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      this.#logger.error({ output: chunk.toString("utf8").trimEnd() }, "Harness error output.");
    });
    child.once("error", (type, location) => {
      this.#logger.error({ type, location }, "Harness process reported a fatal error.");
    });
    child.once("exit", (exitCode) => {
      this.#handleProcessExit(child, exitCode);
    });
    child.once("spawn", () => {
      const { port1, port2 } = new MessageChannelMain();
      this.#port = port2;
      port2.on("message", (event) => {
        this.#handleHarnessMessage(event.data);
      });
      port2.start();
      child.postMessage(HarnessBootstrapSchema.parse({ kind: "harness.connect" }), [port1]);
      port2.postMessage(
        createHandshakeCommand(
          {
            messageId: randomUUID(),
            sentAt: new Date().toISOString(),
          },
          "0.0.0",
        ),
      );
      this.#handshakeTimer = setTimeout(() => {
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
      }, handshakeTimeoutMs);
    });
  }
}

export function harnessEntryPath(directory: string): string {
  return path.join(directory, "harness.cjs");
}
