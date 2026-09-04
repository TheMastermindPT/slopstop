import pino from "pino";
import type { HarnessTransport, StopHarnessRuntime } from "./harness-runtime.js";
import { startHarnessProcessRuntime } from "./process-bootstrap.js";
import { createHarnessFatalHandlers } from "./process-fatal-diagnostics.js";
import { createHarnessPortCloseHandler } from "./process-shutdown.js";

type UtilityMessageEvent = Readonly<{
  data: unknown;
  ports: readonly UtilityMessagePort[];
}>;

interface UtilityMessagePort {
  close(): void;
  off(event: "close", listener: () => void): this;
  off(event: "message", listener: (event: Readonly<{ data: unknown }>) => void): this;
  on(event: "close", listener: () => void): this;
  on(event: "message", listener: (event: Readonly<{ data: unknown }>) => void): this;
  postMessage(message: unknown): void;
  start(): void;
}

interface UtilityParentPort {
  once(event: "message", listener: (event: UtilityMessageEvent) => void): this;
}

type UtilityProcess = NodeJS.Process & {
  readonly parentPort?: UtilityParentPort;
};

const logger = pino({
  base: { service: "harness" },
  level: process.env["SLOPSTOP_LOG_LEVEL"] ?? "info",
  redact: {
    paths: ["*.apiKey", "*.authorization", "*.password", "*.secret", "*.token"],
    censor: "[redacted]",
  },
});

function failStartup(message: string): never {
  logger.fatal({ code: "HARNESS_START_FAILED" }, message);
  process.exit(1);
}

function failShutdown(message: "Harness shutdown failed."): never {
  logger.fatal({ code: "HARNESS_SHUTDOWN_FAILED" }, message);
  process.exit(1);
}

function createTransport(port: UtilityMessagePort): HarnessTransport {
  return {
    send: (message) => {
      port.postMessage(message);
    },
    subscribe: (listener) => {
      const receive = (event: Readonly<{ data: unknown }>) => {
        listener(event.data);
      };
      port.on("message", receive);
      return () => {
        port.off("message", receive);
      };
    },
  };
}

const fatalHandlers = createHarnessFatalHandlers({
  fatal: (metadata, message) => logger.fatal(metadata, message),
  exit: (code) => {
    process.exit(code);
  },
});

const utilityProcess = process as UtilityProcess;
const parentPort = utilityProcess.parentPort;

if (parentPort === undefined) {
  failStartup("Harness utility process has no parent port.");
}

parentPort.once("message", (event) => {
  const port = event.ports[0];
  if (port === undefined) {
    failStartup("Harness received an invalid bootstrap message.");
  }

  let stopRuntime: StopHarnessRuntime;
  try {
    stopRuntime = startHarnessProcessRuntime({
      bootstrap: event.data,
      transport: createTransport(port),
    });
  } catch {
    failStartup("Harness received an invalid bootstrap message.");
  }

  port.on(
    "close",
    createHarnessPortCloseHandler({
      stopRuntime,
      succeeded: (message) => logger.info(message),
      failed: failShutdown,
    }),
  );
  port.start();
  logger.info("Harness message port connected.");
});

process.on("uncaughtException", fatalHandlers.uncaughtException);
process.on("unhandledRejection", fatalHandlers.unhandledRejection);
