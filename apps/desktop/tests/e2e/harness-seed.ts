import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { decodeStrict, ProjectIdSchema, RegisteredProjectSchema } from "@slopstop/protocol";
import { Schema } from "effect";

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

/** Registers the two seed repositories (repository-a, repository-b) through the harness. */
export async function seedTwoProjects(userData: string) {
  runHarnessSeed("project-entry-ui-seed.integration.test.ts", "PC_UI_USER_DATA", userData);
  const projects = decodeStrict(
    Schema.Array(RegisteredProjectSchema),
    JSON.parse(await readFile(path.join(userData, "fixture-projects.json"), "utf8")),
  );
  const first = projects[0];
  const second = projects[1];
  if (first === undefined || second === undefined) throw new Error("Seeded Projects missing");
  return [first, second] as const;
}

/**
 * Seeds the conversation journey: repository-a, repository-b rewound to generation three, and a
 * generation-three Project without a repository. Returns the latter's short identity.
 */
export async function seedConversationJourney(userData: string) {
  await seedTwoProjects(userData);
  runHarnessSeed(
    "conversation-journey-ui-seed.integration.test.ts",
    "SLOPSTOP_CONVERSATION_JOURNEY_SEED",
    userData,
  );
  const { storageOnlyProjectId } = decodeStrict(
    Schema.Struct({ storageOnlyProjectId: ProjectIdSchema }),
    JSON.parse(await readFile(path.join(userData, "fixture-journey-projects.json"), "utf8")),
  );
  return { storageOnlyShort: storageOnlyProjectId.slice(0, 8) };
}
