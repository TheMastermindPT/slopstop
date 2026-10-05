import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CanonicalProjectActivationRequestSchema, decodeStrict } from "@slopstop/protocol";
import { afterEach, expect, it, vi } from "vitest";
import { createIdentityQueryControl } from "../../src/registration/identity-query-control.js";
import { createRegisteredProjectTargetValidation } from "../../src/registration/registered-project-selection.js";
import * as physicalObservation from "../../src/registration/repository-physical-observation.js";
import { observeRepositoryDirectory } from "../../src/storage/repository-identity-observer.js";
import { checkedInMigrationRoot } from "./project-storage-runtime-fixture.js";
import { registerFolder, registrationSession } from "./registration-flow-fixture.js";
import { installedGit } from "./registration-git-fixture.js";

// B3: one case per physical pointer limit and one precedence case for the family.
const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function discover(worktree: string) {
  const observed = await observeRepositoryDirectory(worktree);
  if (observed.status !== "observed") throw new Error("Worktree identity unavailable");
  const phase = createIdentityQueryControl();
  try {
    return await physicalObservation.discoverSelectedPhysical(
      { directory: worktree, identity: observed.key },
      phase.control,
    );
  } finally {
    phase.dispose();
  }
}

async function tempRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-physical-limit-"));
  roots.push(root);
  return root;
}

it.runIf(process.platform === "win32")(
  "refuses a .git pointer file larger than the shared byte limit before reading it",
  async () => {
    const worktree = path.join(await tempRoot(), "worktree");
    await mkdir(worktree);
    await writeFile(path.join(worktree, ".git"), `gitdir: ${"a".repeat(8193)}`);

    expect(await discover(worktree)).toEqual({
      status: "unavailable",
      code: "OBSERVATION_LIMIT_EXCEEDED",
    });
  },
);

it.runIf(process.platform === "win32")(
  "classifies a pointer that is not a file as invalid before any size limit",
  async () => {
    const root = await tempRoot();
    const main = path.join(root, "main");
    const linked = path.join(root, "linked");
    const git = (...args: string[]) =>
      execFileSync(installedGit, [
        "-C",
        main,
        "-c",
        "user.name=t",
        "-c",
        "user.email=t@t",
        ...args,
      ]);
    execFileSync(installedGit, ["init", "--quiet", main]);
    git("commit", "--quiet", "--allow-empty", "-m", "initial");
    git("worktree", "add", "--quiet", linked);
    const admin = path.join(main, ".git", "worktrees", "linked");
    await rm(path.join(admin, "commondir"));
    await mkdir(path.join(admin, "commondir"));

    expect(await discover(linked)).toEqual({ status: "rejected", code: "REPOSITORY_INVALID" });
  },
);

it.runIf(process.platform === "win32")(
  "reports a cancelled physical revalidation of a registered Project as the observation limit",
  async () => {
    const session = await registrationSession();
    let projectId: string;
    try {
      const { registered } = await registerFolder(session, session.directory);
      if (registered.status !== "registered") throw new Error("Registration missing");
      projectId = registered.projectId;
    } finally {
      await session.dispose();
    }
    vi.spyOn(physicalObservation, "discoverSelectedPhysical").mockResolvedValue({
      status: "cancelled",
    });
    const validate = createRegisteredProjectTargetValidation({
      applicationStorageRoot: path.join(session.root, "installation"),
      migrationResourcesRoot: checkedInMigrationRoot,
    });
    const refused = await validate(
      decodeStrict(CanonicalProjectActivationRequestSchema, { projectId }),
    );
    expect(refused).toMatchObject({
      status: "unavailable",
      diagnostic: { code: "OBSERVATION_LIMIT_EXCEEDED" },
    });
  },
);
