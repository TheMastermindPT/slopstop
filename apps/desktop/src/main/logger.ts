import fs from "node:fs";
import path from "node:path";
import pino, { type Logger } from "pino";
import pretty from "pino-pretty";

const maxLogBytes = 5 * 1024 * 1024;

function rotateLog(logPath: string): void {
  if (!fs.existsSync(logPath) || fs.statSync(logPath).size < maxLogBytes) {
    return;
  }

  const previousLogPath = `${logPath}.1`;
  fs.rmSync(previousLogPath, { force: true });
  fs.renameSync(logPath, previousLogPath);
}

export function createMainLogger(logDirectory: string, isPackaged: boolean): Logger {
  fs.mkdirSync(logDirectory, { recursive: true });
  const logPath = path.join(logDirectory, "slopstop.jsonl");
  rotateLog(logPath);

  const streams: pino.StreamEntry[] = [
    {
      stream: pino.destination({ dest: logPath, mkdir: true, sync: false }),
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
        paths: ["*.apiKey", "*.authorization", "*.password", "*.secret", "*.token"],
        censor: "[redacted]",
      },
    },
    pino.multistream(streams),
  );
}
