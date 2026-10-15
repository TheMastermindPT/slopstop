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
 * After a clean run, the desktop log holds one start line per launch so far, no forwarded harness
 * upgrade event and no harness log-line fault code. A successful upgrade writes no harness line,
 * so this proves only that no failed or rejected upgrade line was logged; the positive harness to
 * desktop log link is not exercised here.
 */
export async function expectDesktopLog(userData: string, launches: number) {
  const lines = await desktopLogLines(userData);
  expect(lines.filter((line) => line["msg"] === startingMessage)).toHaveLength(launches);
  expect(lines.filter((line) => line["msg"] === forwardedUpgradeMessage)).toEqual([]);
  expect(JSON.stringify(lines)).not.toContain("HARNESS_LOG_LINE_");
}
