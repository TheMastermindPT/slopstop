import { type ChildProcess, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { builtDesktopCommand, launchBuiltDesktop } from "./electron-launch.js";

const startingMessage = "SlopStop desktop starting.";

/** A fresh proof directory holding its own `userData`. */
async function proofDirectory() {
  const proof = await mkdtemp(path.join(tmpdir(), "slopstop-single-instance-"));
  const userData = path.join(proof, "user-data");
  await mkdir(userData);
  return { proof, userData };
}

/** How many desktop log lines record a start under `userData`. */
async function startingLines(userData: string): Promise<number> {
  const log = await readFile(path.join(userData, "logs", "slopstop.jsonl"), "utf8").catch(() => "");
  return log
    .split("\n")
    .filter((line) => line.trim() !== "")
    .filter((line) => Reflect.get(JSON.parse(line) as object, "msg") === startingMessage).length;
}

/** Starts a second desktop process as its own child, so that only it is ever stopped. */
async function spawnDesktop(proof: string, userData: string): Promise<ChildProcess> {
  const command = await builtDesktopCommand(proof, userData);
  return spawn(command.executablePath, command.args, { stdio: "ignore", windowsHide: true });
}

/** The child's exit code, or `"running"` when it has not exited within `milliseconds`. */
function exitWithin(child: ChildProcess, milliseconds: number): Promise<number | null | "running"> {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("running"), milliseconds);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill();
  await exited;
}

test("quits a second launch and keeps the first usable", async () => {
  test.setTimeout(60_000);
  const first = await proofDirectory();
  const application = await launchBuiltDesktop(first.proof, first.userData);
  const others: ChildProcess[] = [];
  try {
    const page = await application.firstWindow();
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    const minimized = () =>
      application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMinimized());
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.minimize());
    await expect.poll(minimized).toBe(true);

    const second = await spawnDesktop(first.proof, first.userData);
    others.push(second);
    expect(await exitWithin(second, 10_000)).toBe(0);
    await expect.poll(minimized).toBe(false);
    expect(
      await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
    ).toBe(1);
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    expect(await startingLines(first.userData)).toBe(1);

    const elsewhere = await proofDirectory();
    const independent = await spawnDesktop(elsewhere.proof, elsewhere.userData);
    others.push(independent);
    expect(await exitWithin(independent, 10_000)).toBe("running");
    expect(await startingLines(elsewhere.userData)).toBe(1);
  } finally {
    for (const child of others) await stopChild(child);
    await application.close();
  }
});
