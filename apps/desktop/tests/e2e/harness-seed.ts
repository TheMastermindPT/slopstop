import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Runs one env-gated harness seed file in a vitest subprocess, so the E2E reaches harness
 * fixtures only through their own test runner. The seed writes under `userData`.
 */
export function runHarnessSeed(testFile: string, envName: string, userData: string): void {
  const require = createRequire(import.meta.url);
  const repo = path.resolve(import.meta.dirname, "../../../..");
  const vitest = path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs");
  execFileSync(
    process.execPath,
    [vitest, "run", "--config", "apps/harness/vitest.integration.config.ts", testFile],
    {
      cwd: repo,
      env: { ...process.env, [envName]: userData },
      timeout: 120000,
      stdio: "pipe",
    },
  );
}
