import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, vi } from "vitest";
import { createWindowsIdentityQueryChild } from "../../src/registration/windows-version-child.js";
import { createControlledIdentityConsent } from "./registration-consent-fixture.js";

/** The installed Git the native registration suites admit. */
export const installedGit = path.join(
  process.env["ProgramFiles"] ?? "C:/Program Files",
  "Git/cmd/git.exe",
);

/** A fresh Git repository under the root, selected through a controlled identity consent. */
export async function createSelectedGitRepository(root: string) {
  const directory = path.join(root, "repository");
  execFileSync(installedGit, ["init", "--quiet", directory]);
  const scenario = await createControlledIdentityConsent(
    root,
    { select: async () => ({ status: "selected", directory }) },
    installedGit,
  );
  return { directory, scenario };
}

/** The real Windows identity child, counting every dispatch. */
export function countingIdentityChild(root: string) {
  const native = createWindowsIdentityQueryChild(root);
  let calls = 0;
  const child = {
    run: (...args: Parameters<typeof native.run>) => {
      calls += 1;
      return native.run(...args);
    },
  };
  return { child, calls: () => calls };
}

/** A confirmation request for a prepared proposal. */
export function confirmationRequest<
  Preparation,
  Proposal extends Readonly<{ proposalId: unknown; proposalFingerprint: unknown }>,
>(preparation: Preparation, proposal: Proposal) {
  return {
    version: 1,
    requestId: randomUUID(),
    preparation,
    proposalId: proposal.proposalId,
    proposalFingerprint: proposal.proposalFingerprint,
  };
}

/** A promise the test releases explicitly. */
export function gate() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/** Temporary roots removed after each test, with mocks (and optionally fake timers) restored. */
export function trackTemporaryRoots(options: Readonly<{ realTimers: boolean }>) {
  const roots: string[] = [];
  afterEach(async () => {
    if (options.realTimers) vi.useRealTimers();
    vi.restoreAllMocks();
    for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  });
  return roots;
}
