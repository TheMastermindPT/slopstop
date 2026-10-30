import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { _electron as electron, expect } from "@playwright/test";

const require = createRequire(import.meta.url);

/** The Electron executable and arguments that start the built desktop with `userData` redirected. */
export async function builtDesktopCommand(proof: string, userData: string) {
  const shim = path.join(proof, "launch.cjs");
  await writeFile(
    shim,
    `const {app}=require('electron');app.setPath('userData',${JSON.stringify(userData)});require(${JSON.stringify(path.resolve(".vite/build/main.cjs"))});`,
  );
  const executablePath = path.join(
    path.dirname(require.resolve("electron/package.json")),
    "dist",
    "electron.exe",
  );
  return { executablePath, args: [shim] };
}

/**
 * Launches the built desktop main bundle with `userData` redirected through a one-line shim.
 * Extra Chromium switches, such as `--force-device-scale-factor=1`, follow the shim.
 */
export async function launchBuiltDesktop(
  proof: string,
  userData: string,
  extraArguments: readonly string[] = [],
) {
  const command = await builtDesktopCommand(proof, userData);
  return electron.launch({ ...command, args: [...command.args, ...extraArguments] });
}

const startingMessage = "SlopStop desktop starting.";
const forwardedUpgradeMessage = "Harness upgrade event.";
const requestFailureMessage = "Harness request failure.";

type LogLine = Readonly<Record<string, unknown>>;

/** The file does not exist yet; any other read failure is real. */
function isMissingFile(error: unknown): boolean {
  return error instanceof Error && Reflect.get(error, "code") === "ENOENT";
}

/** The desktop log's lines under `userData`, parsed; none before the log file exists. */
async function desktopLogLines(userData: string): Promise<LogLine[]> {
  const log = await readFile(path.join(userData, "logs", "slopstop.jsonl"), "utf8").catch(
    (error: unknown) => {
      if (isMissingFile(error)) return "";
      throw error;
    },
  );
  return log
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line): LogLine => ({ ...(JSON.parse(line) as object) }));
}

/** How many launches the desktop log under `userData` records. */
export async function startingLines(userData: string): Promise<number> {
  return (await desktopLogLines(userData)).filter((line) => line["msg"] === startingMessage).length;
}

/**
 * After a clean run, the desktop log holds one start line per launch so far, exactly the
 * `forwarded` harness upgrade events (each line matching its expected fields, in order) and no
 * harness log-line fault code. A run with a successful upgrade expects its forwarded `completed`
 * line, which proves the harness to desktop log link; a run without one expects none. Answers
 * the forwarded upgrade lines.
 */
export async function expectDesktopLog(
  userData: string,
  launches: number,
  forwarded: readonly Readonly<Record<string, unknown>>[] = [],
): Promise<LogLine[]> {
  const lines = await desktopLogLines(userData);
  expect(lines.filter((line) => line["msg"] === startingMessage)).toHaveLength(launches);
  const upgradeLines = lines.filter((line) => line["msg"] === forwardedUpgradeMessage);
  expect(upgradeLines).toEqual(forwarded.map((fields) => expect.objectContaining(fields)));
  expect(JSON.stringify(lines)).not.toContain("HARNESS_LOG_LINE_");
  await expectNoHarnessRequestFailure(userData);
  return upgradeLines;
}

/** How many lines the desktop log under `userData` holds now; 0 before the log file exists. */
export async function desktopLogLength(userData: string): Promise<number> {
  return (await desktopLogLines(userData)).length;
}

/**
 * No journey reaches a request boundary's catch: from line `fromLine` on, the desktop log under
 * `userData` holds no forwarded request-failure line and no harness log-line fault code. Each
 * journey that launches the built desktop calls it after its last close.
 */
export async function expectNoHarnessRequestFailure(userData: string, fromLine = 0) {
  const lines = (await desktopLogLines(userData)).slice(fromLine);
  expect(lines.filter((line) => line["msg"] === requestFailureMessage)).toEqual([]);
  expect(JSON.stringify(lines)).not.toContain("HARNESS_LOG_LINE_");
}
