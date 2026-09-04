import fs from "node:fs";
import path from "node:path";
import pino, { type Logger } from "pino";
import pretty from "pino-pretty";
import { boundLogRecord, createBoundedLogDestination } from "./bounded-log-destination.js";

const sensitiveLogFields = [
  "accessToken",
  "access_token",
  "apiKey",
  "api_key",
  "authorization",
  "password",
  "privateKey",
  "private_key",
  "refreshToken",
  "refresh_token",
  "secret",
  "token",
];

export function createMainLogger(logDirectory: string, isPackaged: boolean): Logger {
  fs.mkdirSync(logDirectory, { recursive: true });
  const logPath = path.join(logDirectory, "slopstop.jsonl");

  const streams: pino.StreamEntry[] = [
    {
      stream: createBoundedLogDestination(logPath),
    },
  ];

  if (!isPackaged) {
    streams.push({
      stream: pretty({ colorize: true, singleLine: true }),
    });
  }

  return pino(
    {
      base: { service: "desktop-main" },
      level: process.env["SLOPSTOP_LOG_LEVEL"] ?? "info",
      redact: {
        paths: sensitiveLogFields.flatMap((field) => [field, `*.${field}`]),
        censor: "[redacted]",
      },
      hooks: { streamWrite: boundLogRecord },
    },
    pino.multistream(streams),
  );
}
