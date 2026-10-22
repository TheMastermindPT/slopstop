import { createHarnessLogger } from "./harness-logger.js";
import type { HarnessTransport, StopHarnessRuntime } from "./harness-runtime.js";
import { checkHarnessBootstrap, launchHarnessProcessRuntime } from "./process-bootstrap.js";
import { connectHarnessProcess } from "./process-connection.js";
import { createHarnessFatalHandlers, type HarnessFatalSink } from "./process-fatal-diagnostics.js";
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

const logger = createHarnessLogger();

const fatalSink: HarnessFatalSink = {
  fatal: (metadata, message) => logger.fatal(metadata, message),
  exit: (code) => {
    process.exit(code);
  },
};

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

const fatalHandlers = createHarnessFatalHandlers(fatalSink);

const utilityProcess = process as UtilityProcess;
const parentPort = utilityProcess.parentPort;

if (parentPort === undefined) {
  failStartup("Harness utility process has no parent port.");
}

/** Starts the harness on `port`; a failed start is reported only after its bounded dispose settled. */
function connect(port: UtilityMessagePort, bootstrap: unknown): Promise<void> {
  return connectHarnessProcess({
    bootstrap,
    prepare: checkHarnessBootstrap,
    launch: (roots) =>
      launchHarnessProcessRuntime(roots, { transport: createTransport(port), logger }),
    attach: (stopRuntime: StopHarnessRuntime) => {
      port.on(
        "close",
        createHarnessPortCloseHandler({
          stopRuntime,
          succeeded: (message) => logger.info(message),
          sink: fatalSink,
        }),
      );
      port.start();
      logger.info("Harness message port connected.");
    },
    sink: fatalSink,
  });
}

parentPort.once("message", (event) => {
  const port = event.ports[0];
  if (port === undefined) {
    failStartup("Harness received an invalid bootstrap message.");
  }
  // A rejection here would be a defect after startup; the unhandled-rejection handler reports it.
  void connect(port, event.data);
});

process.on("uncaughtException", fatalHandlers.uncaughtException);
process.on("unhandledRejection", fatalHandlers.unhandledRejection);
