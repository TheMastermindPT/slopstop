import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { createBoundedLogDestination } from "../../src/main/bounded-log-destination.js";
import { createMainLogger } from "../../src/main/logger.js";

const temporaryDirectories: string[] = [];

function makeTemporaryLogPath(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slopstop-log-test-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "slopstop.jsonl");
}

function expectValidBoundedJsonl(filePath: string): void {
  const content = fs.readFileSync(filePath, "utf8");
  expect(Buffer.byteLength(content)).toBeLessThanOrEqual(5 * 1024 * 1024);
  for (const line of content.trimEnd().split("\n")) {
    expect(() => JSON.parse(line)).not.toThrow();
    expect(Buffer.byteLength(`${line}\n`)).toBeLessThanOrEqual(8 * 1024);
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

it("writes an oversized multibyte Pino record as controlled JSON", () => {
  const logPath = makeTemporaryLogPath();
  const logger = createMainLogger(path.dirname(logPath), true);

  logger.info(
    { level: 999, service: "private-service", time: 777, token: "private-token" },
    "€".repeat(3_000),
  );

  const content = fs.readFileSync(logPath, "utf8");
  expect(Buffer.byteLength(content)).toBeLessThanOrEqual(8 * 1024);
  expect(JSON.parse(content)).toEqual({
    level: 30,
    time: expect.any(Number),
    service: "desktop-main",
    code: "LOG_RECORD_TRUNCATED",
    bytes: expect.any(Number),
    msg: "Log record exceeded the local limit.",
  });
  expect(content).not.toContain("private-service");
  expect(content).not.toContain("private-token");
  expect(content).not.toContain("€");
});

it("redacts top-level secrets from accepted Pino records", () => {
  const logPath = makeTemporaryLogPath();
  const logger = createMainLogger(path.dirname(logPath), true);

  logger.info(
    {
      token: "private-token",
      password: "private-password",
      secret: "private-secret",
      authorization: "private-authorization",
      apiKey: "private-api-key",
      api_key: "private-api-key",
      accessToken: "private-access-token",
      access_token: "private-access-token",
      refreshToken: "private-refresh-token",
      refresh_token: "private-refresh-token",
      privateKey: "private-key",
      private_key: "private-key",
    },
    "accepted record",
  );

  expect(JSON.parse(fs.readFileSync(logPath, "utf8"))).toMatchObject({
    token: "[redacted]",
    password: "[redacted]",
    secret: "[redacted]",
    authorization: "[redacted]",
    apiKey: "[redacted]",
    api_key: "[redacted]",
    accessToken: "[redacted]",
    access_token: "[redacted]",
    refreshToken: "[redacted]",
    refresh_token: "[redacted]",
    privateKey: "[redacted]",
    private_key: "[redacted]",
  });
});

it("normalizes crash tails and legacy oversized files on disk", () => {
  const logPath = makeTemporaryLogPath();
  const validRecord = `${JSON.stringify({ level: 30, msg: "retained" })}\n`;
  const oversizedLegacyRecord = `${JSON.stringify({
    level: 30,
    time: 1_788_404_400_000,
    service: "desktop-main",
    secret: "legacy-private-content",
    msg: "x".repeat(9_000),
  })}\n`;
  fs.writeFileSync(logPath, `${oversizedLegacyRecord}${validRecord}{"level":30`, "utf8");
  fs.writeFileSync(`${logPath}.1`, "x".repeat(5 * 1024 * 1024 + 1), "utf8");

  createBoundedLogDestination(logPath).write(validRecord);

  expect(fs.readdirSync(path.dirname(logPath))).toEqual([path.basename(logPath)]);
  expectValidBoundedJsonl(logPath);
  expect(fs.readFileSync(logPath, "utf8")).not.toContain("legacy-private-content");
});

it("reconciles an interrupted archive replacement on restart", () => {
  const validRecord = `${JSON.stringify({ level: 30, msg: "retained" })}\n`;
  const beforeReplacementPath = makeTemporaryLogPath();
  fs.writeFileSync(beforeReplacementPath, validRecord, "utf8");
  fs.writeFileSync(`${beforeReplacementPath}.1.previous`, validRecord, "utf8");

  createBoundedLogDestination(beforeReplacementPath);

  expect(fs.readdirSync(path.dirname(beforeReplacementPath)).sort()).toEqual([
    path.basename(beforeReplacementPath),
    `${path.basename(beforeReplacementPath)}.1`,
  ]);

  const afterReplacementPath = makeTemporaryLogPath();
  fs.writeFileSync(afterReplacementPath, validRecord, "utf8");
  fs.writeFileSync(`${afterReplacementPath}.1`, validRecord, "utf8");
  fs.writeFileSync(`${afterReplacementPath}.1.previous`, validRecord, "utf8");

  createBoundedLogDestination(afterReplacementPath);

  expect(fs.readdirSync(path.dirname(afterReplacementPath)).sort()).toEqual([
    path.basename(afterReplacementPath),
    `${path.basename(afterReplacementPath)}.1`,
  ]);
});

it("keeps one bounded archive across repeated real filesystem rotations", () => {
  const logPath = makeTemporaryLogPath();
  const destination = createBoundedLogDestination(logPath);
  const record = `${JSON.stringify({ level: 30, msg: "x".repeat(8_000) })}\n`;

  for (let index = 0; index < 1_400; index += 1) destination.write(record);

  expect(fs.readdirSync(path.dirname(logPath)).sort()).toEqual([
    path.basename(logPath),
    `${path.basename(logPath)}.1`,
  ]);
  expectValidBoundedJsonl(logPath);
  expectValidBoundedJsonl(`${logPath}.1`);
});
