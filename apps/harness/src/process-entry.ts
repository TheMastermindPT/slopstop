import { randomUUID } from "node:crypto";
import { HarnessBootstrapSchema } from "@slopstop/protocol";
import pino from "pino";
import { type HarnessTransport, startHarnessRuntime } from "./harness-runtime.js";
import { createUnavailableWorkspaceApplication } from "./workspace-application.js";

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

const utilityProcess = process as UtilityProcess;
const parentPort = utilityProcess.parentPort;

if (parentPort === undefined) {
  failStartup("Harness utility process has no parent port.");
}

parentPort.once("message", (event) => {
  const bootstrap = HarnessBootstrapSchema.safeParse(event.data);
  const port = event.ports[0];

  if (!bootstrap.success || port === undefined) {
    failStartup("Harness received an invalid bootstrap message.");
  }

  const stopRuntime = startHarnessRuntime({
    transport: createTransport(port),
    workspaceApplication: createUnavailableWorkspaceApplication(),
    harnessVersion: "0.0.0",
    createId: randomUUID,
    now: () => new Date().toISOString(),
  });

  port.on("close", () => {
    stopRuntime();
    logger.info("Harness message port closed.");
  });
  port.start();
  logger.info("Harness message port connected.");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Harness encountered an uncaught exception.");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Harness encountered an unhandled rejection.");
  process.exit(1);
});
