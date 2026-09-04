import { beforeEach, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  appendFileSync: vi.fn(),
  existsSync: vi.fn<(filePath: string) => boolean>(() => false),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
  readFileSync: vi.fn(),
  rmSync: vi.fn(),
  statSync: vi.fn<(filePath: string) => { size: number }>(() => ({ size: 0 })),
  writeFileSync: vi.fn(),
}));
const pinoMocks = vi.hoisted(() => {
  const logger = { info: vi.fn() };
  const create = Object.assign(
    vi.fn((_options: unknown, _stream: unknown) => logger),
    {
      destination: vi.fn(),
      multistream: vi.fn((streams: unknown) => ({ streams })),
    },
  );
  return { create };
});

vi.mock("node:fs", () => ({ default: fsMocks }));
vi.mock("pino", () => ({ default: pinoMocks.create }));
vi.mock("pino-pretty", () => ({ default: vi.fn() }));

import { createBoundedLogDestination } from "./bounded-log-destination.js";
import { createMainLogger } from "./logger.js";

const maxRecordBytes = 8 * 1024;
const maxLogBytes = 5 * 1024 * 1024;
let files: Map<string, string>;

beforeEach(() => {
  vi.clearAllMocks();
  files = new Map();
  fsMocks.existsSync.mockImplementation((filePath) => files.has(String(filePath)));
  fsMocks.statSync.mockImplementation((filePath) => ({
    size: Buffer.byteLength(files.get(String(filePath)) ?? ""),
  }));
  fsMocks.readFileSync.mockImplementation((filePath) => files.get(String(filePath)) ?? "");
  fsMocks.rmSync.mockImplementation((filePath) => {
    files.delete(String(filePath));
  });
  fsMocks.renameSync.mockImplementation((source, destination) => {
    const sourcePath = String(source);
    const content = files.get(sourcePath);
    if (content !== undefined) files.set(String(destination), content);
    files.delete(sourcePath);
  });
  fsMocks.writeFileSync.mockImplementation((filePath, content) => {
    files.set(String(filePath), String(content));
  });
  fsMocks.appendFileSync.mockImplementation((filePath, content) => {
    const key = String(filePath);
    files.set(key, `${files.get(key) ?? ""}${String(content)}`);
  });
});

function serializedRecord(bytes: number): string {
  const fixed =
    '{"level":30,"time":1788404400000,"service":"desktop-main",' +
    '"level":999,"time":777,"service":"private-service",' +
    '"secret":"private-record-content","msg":"';
  return `${fixed}${"x".repeat(bytes - Buffer.byteLength(fixed) - 3)}"}\n`;
}

it("replaces an oversized record with bounded valid JSON", () => {
  createMainLogger("C:/logs", true);
  const options = pinoMocks.create.mock.calls[0]?.[0] as
    | { hooks?: { streamWrite?(record: string): string } }
    | undefined;
  const streamWrite = options?.hooks?.streamWrite;
  expect(streamWrite).toBeTypeOf("function");
  if (streamWrite === undefined) throw new Error("Expected a Pino stream-write hook.");

  const accepted = serializedRecord(maxRecordBytes);
  expect(Buffer.byteLength(accepted)).toBe(maxRecordBytes);
  expect(streamWrite(accepted)).toBe(accepted);

  const oversized = serializedRecord(maxRecordBytes + 1);
  const bounded = streamWrite(oversized);
  expect(Buffer.byteLength(bounded)).toBeLessThanOrEqual(maxRecordBytes);
  expect(JSON.parse(bounded)).toEqual({
    level: 30,
    time: 1_788_404_400_000,
    service: "desktop-main",
    code: "LOG_RECORD_TRUNCATED",
    bytes: maxRecordBytes + 1,
    msg: "Log record exceeded the local limit.",
  });
  expect(bounded).not.toContain("private-record-content");
  expect(bounded).not.toContain("private-service");
  expect(bounded).not.toContain("x".repeat(32));
});

it("reconciles both interrupted archive states", () => {
  const logPath = "C:/logs/slopstop.jsonl";
  const archivePath = `${logPath}.1`;
  const previousArchivePath = `${archivePath}.previous`;
  files.set(archivePath, "{}\n");
  files.set(previousArchivePath, '{"old":true}\n');

  createBoundedLogDestination(logPath);
  expect(files.has(previousArchivePath)).toBe(false);
  expect(files.get(archivePath)).toBe("{}\n");

  files.clear();
  files.set(previousArchivePath, '{"old":true}\n');
  createBoundedLogDestination(logPath);
  expect(files.has(previousArchivePath)).toBe(false);
  expect(files.get(archivePath)).toBe('{"old":true}\n');
});

it("removes invalid complete and partial retained records", () => {
  const logPath = "C:/logs/slopstop.jsonl";
  files.set(logPath, '{}\nnot-json\n{"partial"');

  createBoundedLogDestination(logPath);

  expect(files.get(logPath)).toBe("{}\n");
});

it("restores the previous archive when active-log rotation fails", () => {
  const logPath = "C:/logs/slopstop.jsonl";
  const archivePath = `${logPath}.1`;
  const previousArchivePath = `${archivePath}.previous`;
  files.set(archivePath, '{"old":true}\n');
  const destination = createBoundedLogDestination(logPath);
  destination.write("x".repeat(maxLogBytes));
  const defaultRename = fsMocks.renameSync.getMockImplementation();
  fsMocks.renameSync.mockImplementation((source, target) => {
    if (String(source) === logPath && String(target) === archivePath) {
      throw new Error("rotation failed");
    }
    defaultRename?.(source, target);
  });

  expect(() => destination.write("x")).toThrowError("rotation failed");
  expect(files.get(archivePath)).toBe('{"old":true}\n');
  expect(files.has(previousArchivePath)).toBe(false);
});

it("rolls back a committed rotation when old-archive cleanup fails", () => {
  const logPath = "C:/logs/slopstop.jsonl";
  const archivePath = `${logPath}.1`;
  const previousArchivePath = `${archivePath}.previous`;
  const oldArchive = '{"old":true}\n';
  files.set(archivePath, oldArchive);
  const destination = createBoundedLogDestination(logPath);
  destination.write("x".repeat(maxLogBytes));
  const defaultRemove = fsMocks.rmSync.getMockImplementation();
  fsMocks.rmSync.mockImplementation((filePath, options) => {
    if (String(filePath) === previousArchivePath && files.has(previousArchivePath)) {
      throw new Error("cleanup failed");
    }
    defaultRemove?.(filePath, options);
  });

  expect(() => destination.write("x")).toThrowError("cleanup failed");
  expect(Buffer.byteLength(files.get(logPath) ?? "")).toBe(maxLogBytes);
  expect(files.get(archivePath)).toBe(oldArchive);
  expect(files.has(previousArchivePath)).toBe(false);
});

it("rejects a single record larger than the active log limit", () => {
  const destination = createBoundedLogDestination("C:/logs/slopstop.jsonl");

  expect(() => destination.write("x".repeat(maxLogBytes + 1))).toThrowError(
    "Log record exceeds the active log limit.",
  );
  expect(fsMocks.appendFileSync).not.toHaveBeenCalled();
});
