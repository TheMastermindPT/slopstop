import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const logDirectory = "C:/logs";
const logPath = path.join(logDirectory, "slopstop.jsonl");

const fsMocks = vi.hoisted(() => ({
  appendFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  renameSync: vi.fn(),
  rmSync: vi.fn(),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

const pinoMocks = vi.hoisted(() => {
  const logger = { info: vi.fn() };
  const create = Object.assign(
    vi.fn(() => logger),
    {
      destination: vi.fn(() => ({ destination: true })),
      multistream: vi.fn((streams: unknown) => ({ streams })),
    },
  );
  return { create, logger };
});

const prettyMock = vi.hoisted(() => vi.fn(() => ({ pretty: true })));
let files: Map<string, string>;

vi.mock("node:fs", () => ({ default: fsMocks }));
vi.mock("pino", () => ({ default: pinoMocks.create }));
vi.mock("pino-pretty", () => ({ default: prettyMock }));

import { createMainLogger } from "./logger.js";

type LogDestination = { write(record: string): void };

function latestFileDestination(): LogDestination {
  const streams = pinoMocks.create.multistream.mock.calls.at(-1)?.[0] as
    | Array<{ stream: LogDestination }>
    | undefined;
  const destination = streams?.[0]?.stream;
  if (destination === undefined) throw new Error("Expected the file log destination.");
  return destination;
}

function expectValidBoundedLogs(): void {
  for (const content of files.values()) {
    expect(Buffer.byteLength(content)).toBeLessThanOrEqual(5 * 1024 * 1024);
    for (const line of content.trimEnd().split("\n")) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  files = new Map();
  fsMocks.existsSync.mockImplementation((filePath) => files.has(String(filePath)));
  fsMocks.statSync.mockImplementation((filePath) => ({
    size: Buffer.byteLength(files.get(String(filePath)) ?? ""),
  }));
  fsMocks.appendFileSync.mockImplementation((filePath, content) => {
    const key = String(filePath);
    files.set(key, `${files.get(key) ?? ""}${String(content)}`);
  });
  fsMocks.readFileSync.mockImplementation((filePath) => files.get(String(filePath)) ?? "");
  fsMocks.rmSync.mockImplementation((filePath) => {
    files.delete(String(filePath));
  });
  fsMocks.renameSync.mockImplementation((source, destination) => {
    const sourcePath = String(source);
    const destinationPath = String(destination);
    const content = files.get(sourcePath);
    if (content !== undefined) files.set(destinationPath, content);
    files.delete(sourcePath);
  });
  fsMocks.writeFileSync.mockImplementation((filePath, content) => {
    files.set(String(filePath), String(content));
  });
});

describe("createMainLogger", () => {
  it("creates a redacting packaged file logger without console transport", () => {
    vi.stubEnv("SLOPSTOP_LOG_LEVEL", "warn");

    expect(createMainLogger(logDirectory, true)).toBe(pinoMocks.logger);

    expect(fsMocks.mkdirSync).toHaveBeenCalledWith(logDirectory, { recursive: true });
    expect(pinoMocks.create.destination).not.toHaveBeenCalled();
    expect(prettyMock).not.toHaveBeenCalled();
    expect(pinoMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "warn",
        redact: expect.objectContaining({ censor: "[redacted]" }),
      }),
      expect.anything(),
    );
  });

  it("rotates a full log and adds readable development output", () => {
    const prefix = '{"msg":"';
    const suffix = '"}\n';
    const oneKiBRecord = `${prefix}${"x".repeat(1024 - prefix.length - suffix.length)}${suffix}`;
    files.set(logPath, oneKiBRecord.repeat(5 * 1024));

    createMainLogger(logDirectory, false);

    expect(fsMocks.renameSync).toHaveBeenCalledWith(logPath, `${logPath}.1`);
    expect(Buffer.byteLength(files.get(`${logPath}.1`) ?? "")).toBe(5 * 1024 * 1024);
    expect(prettyMock).toHaveBeenCalledWith({ colorize: true, singleLine: true });
    expect(pinoMocks.create.multistream.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it("keeps an existing log below the rotation limit", () => {
    files.set(logPath, "x".repeat(1024));

    createMainLogger(logDirectory, true);

    expect(fsMocks.rmSync).not.toHaveBeenCalled();
    expect(fsMocks.renameSync).not.toHaveBeenCalled();
  });

  it("rotates before runtime retention exceeds ten MiB", () => {
    createMainLogger(logDirectory, true);
    const destination = latestFileDestination();
    const record = `${JSON.stringify({ level: 30, sequence: 1, msg: "x".repeat(8_000) })}\n`;

    for (let index = 0; index < 1_400; index += 1) destination.write(record);

    const retainedLogs = [files.get(logPath), files.get(`${logPath}.1`)];
    expect(retainedLogs.every((content) => content !== undefined)).toBe(true);
    for (const content of retainedLogs) {
      expect(Buffer.byteLength(content ?? "")).toBeLessThanOrEqual(5 * 1024 * 1024);
      for (const line of (content ?? "").trimEnd().split("\n")) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    }
    expect([...files.keys()].sort()).toEqual([logPath, `${logPath}.1`].sort());
  });

  it("repairs a partial current log and oversized rotation on restart", () => {
    const validRecord = `${JSON.stringify({ level: 30, msg: "retained" })}\n`;
    files.set(logPath, `${validRecord}{"level":30`);
    files.set(`${logPath}.1`, "x".repeat(5 * 1024 * 1024 + 1));
    createMainLogger(logDirectory, true);
    latestFileDestination().write(validRecord);

    expectValidBoundedLogs();
  });

  it("replaces an oversized current log with valid bounded records on restart", () => {
    const validRecord = `${JSON.stringify({ level: 30, msg: "retained" })}\n`;
    files.set(logPath, "x".repeat(5 * 1024 * 1024 + 1));
    files.set(`${logPath}.1`, validRecord);
    createMainLogger(logDirectory, true);
    latestFileDestination().write(validRecord);

    expectValidBoundedLogs();
  });
});
