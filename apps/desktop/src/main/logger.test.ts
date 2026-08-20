import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
  rmSync: vi.fn(),
  statSync: vi.fn(),
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

vi.mock("node:fs", () => ({ default: fsMocks }));
vi.mock("pino", () => ({ default: pinoMocks.create }));
vi.mock("pino-pretty", () => ({ default: prettyMock }));

import { createMainLogger } from "./logger.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  fsMocks.existsSync.mockReturnValue(false);
  fsMocks.statSync.mockReturnValue({ size: 0 });
});

describe("createMainLogger", () => {
  it("creates a redacting packaged file logger without console transport", () => {
    vi.stubEnv("SLOPSTOP_LOG_LEVEL", "warn");

    expect(createMainLogger("C:/logs", true)).toBe(pinoMocks.logger);

    expect(fsMocks.mkdirSync).toHaveBeenCalledWith("C:/logs", { recursive: true });
    expect(pinoMocks.create.destination).toHaveBeenCalledWith({
      dest: "C:\\logs\\slopstop.jsonl",
      mkdir: true,
      sync: false,
    });
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
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.statSync.mockReturnValue({ size: 5 * 1024 * 1024 });

    createMainLogger("C:/logs", false);

    expect(fsMocks.rmSync).toHaveBeenCalledWith("C:\\logs\\slopstop.jsonl.1", { force: true });
    expect(fsMocks.renameSync).toHaveBeenCalledWith(
      "C:\\logs\\slopstop.jsonl",
      "C:\\logs\\slopstop.jsonl.1",
    );
    expect(prettyMock).toHaveBeenCalledWith({ colorize: true, singleLine: true });
    expect(pinoMocks.create.multistream.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it("keeps an existing log below the rotation limit", () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.statSync.mockReturnValue({ size: 1024 });

    createMainLogger("C:/logs", true);

    expect(fsMocks.rmSync).not.toHaveBeenCalled();
    expect(fsMocks.renameSync).not.toHaveBeenCalled();
  });
});
