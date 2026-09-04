import fs from "node:fs";
import type { DestinationStream } from "pino";

const maxLogBytes = 5 * 1024 * 1024;
const maxRecordBytes = 8 * 1024;
const canonicalMetadataPattern = /^\{"level":(-?\d+),"time":(\d+),"service":"desktop-main"(?:,|})/;

function restorePreviousArchive(
  archivePath: string,
  previousArchivePath: string,
  hadArchive: boolean,
): void {
  if (!hadArchive) return;
  if (!fs.existsSync(previousArchivePath)) return;
  fs.renameSync(previousArchivePath, archivePath);
}

function rotate(logPath: string): void {
  const archivePath = `${logPath}.1`;
  const previousArchivePath = `${archivePath}.previous`;
  fs.rmSync(previousArchivePath, { force: true });
  const hadArchive = fs.existsSync(archivePath);
  if (hadArchive) fs.renameSync(archivePath, previousArchivePath);
  try {
    fs.renameSync(logPath, archivePath);
  } catch (error) {
    restorePreviousArchive(archivePath, previousArchivePath, hadArchive);
    throw error;
  }
  try {
    fs.rmSync(previousArchivePath, { force: true });
  } catch (error) {
    fs.renameSync(archivePath, logPath);
    restorePreviousArchive(archivePath, previousArchivePath, hadArchive);
    throw error;
  }
}

function reconcileInterruptedRotation(logPath: string): void {
  const archivePath = `${logPath}.1`;
  const previousArchivePath = `${archivePath}.previous`;
  if (!fs.existsSync(previousArchivePath)) return;
  if (fs.existsSync(archivePath)) {
    fs.rmSync(previousArchivePath, { force: true });
    return;
  }
  fs.renameSync(previousArchivePath, archivePath);
}

function normalizeRetainedLog(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  if (fs.statSync(filePath).size > maxLogBytes) {
    fs.rmSync(filePath, { force: true });
    return 0;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const completeContent = content.slice(0, content.lastIndexOf("\n") + 1);
  const normalizedContent = completeContent
    .split("\n")
    .filter((line) => {
      if (line.length === 0) return false;
      try {
        JSON.parse(line);
        return true;
      } catch {
        return false;
      }
    })
    .map((line) => boundLogRecord(`${line}\n`))
    .join("");
  if (normalizedContent !== content) fs.writeFileSync(filePath, normalizedContent, "utf8");
  return Buffer.byteLength(normalizedContent);
}

function initialLogBytes(logPath: string): number {
  reconcileInterruptedRotation(logPath);
  normalizeRetainedLog(`${logPath}.1`);
  const bytes = normalizeRetainedLog(logPath);
  if (bytes < maxLogBytes) return bytes;
  rotate(logPath);
  return 0;
}

export function createBoundedLogDestination(logPath: string): DestinationStream {
  let activeBytes = initialLogBytes(logPath);
  return {
    write(record) {
      const bytes = Buffer.byteLength(record);
      if (bytes > maxLogBytes) {
        throw new Error("Log record exceeds the active log limit.");
      }
      if (activeBytes + bytes > maxLogBytes) {
        rotate(logPath);
        activeBytes = 0;
      }
      fs.appendFileSync(logPath, record, "utf8");
      activeBytes += bytes;
    },
  };
}

export function boundLogRecord(record: string): string {
  const bytes = Buffer.byteLength(record);
  if (bytes <= maxRecordBytes) return record;

  const metadata = canonicalMetadataPattern.exec(record);
  const level = Number(metadata?.[1]);
  const time = Number(metadata?.[2]);
  return `${JSON.stringify({
    ...(Number.isFinite(level) ? { level } : {}),
    ...(Number.isFinite(time) ? { time } : {}),
    service: "desktop-main",
    code: "LOG_RECORD_TRUNCATED",
    bytes,
    msg: "Log record exceeded the local limit.",
  })}\n`;
}
