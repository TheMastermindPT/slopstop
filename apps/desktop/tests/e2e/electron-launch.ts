import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { _electron as electron } from "@playwright/test";

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

/** Launches the built desktop main bundle with `userData` redirected through a one-line shim. */
export async function launchBuiltDesktop(proof: string, userData: string) {
  return electron.launch(await builtDesktopCommand(proof, userData));
}
