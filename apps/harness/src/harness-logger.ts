import pino, { type DestinationStream, type Logger } from "pino";

/** The harness process logger: JSON lines on stdout, or on `destination` when given. */
export function createHarnessLogger(destination?: DestinationStream): Logger {
  const options = {
    base: { service: "harness" },
    level: process.env["SLOPSTOP_LOG_LEVEL"] ?? "info",
    redact: {
      paths: ["*.apiKey", "*.authorization", "*.password", "*.secret", "*.token"],
      censor: "[redacted]",
    },
  };
  return destination === undefined ? pino(options) : pino(options, destination);
}
