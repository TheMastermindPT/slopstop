import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { decodeStrict } from "@slopstop/protocol";
import { afterEach, expect, it, vi } from "vitest";
import type {
  IdentityQueryChildPort,
  IdentityQueryKind,
} from "../../src/registration/identity-query-child.js";
import { createRepositoryIdentityQueryOwner } from "../../src/registration/repository-identity-query-owner.js";
import * as physicalObservation from "../../src/registration/repository-physical-observation.js";
import { RepositoryIdentityAdmissionRequestSchema } from "../../src/registration/repository-trust.js";
import { createWindowsIdentityQueryChild } from "../../src/registration/windows-version-child.js";
import * as directories from "../../src/storage/repository-identity-observer.js";
import {
  consentRegistryOptions,
  createControlledIdentityConsent,
} from "./registration-consent-fixture.js";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function physicalFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-physical-"));
  roots.push(root);
  const hooks = path.join(root, "hooks");
  await mkdir(hooks);
  const git = path.join(process.env["ProgramFiles"] ?? "C:/Program Files", "Git/cmd/git.exe");
  const run = (...args: string[]) =>
    execFileSync(git, ["-c", `core.hooksPath=${hooks}`, "-c", "commit.gpgSign=false", ...args]);
  const main = path.join(root, "main");
  run("init", "--quiet", main);
  run(
    "-C",
    main,
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    "fixture",
  );
  const linked = path.join(root, "linked");
  run("-C", main, "worktree", "add", "--quiet", "--detach", linked, "HEAD");
  const clone = path.join(root, "clone");
  run("clone", "--quiet", "--local", "--no-hardlinks", main, clone);
  const alias = path.join(root, "alias");
  await symlink(main, alias, "junction");
  return { root, git, main, linked, clone, alias };
}

async function observePhysical(
  selection: { installationParent: string; git: string; directory: string },
  child?: IdentityQueryChildPort,
) {
  const { installationParent, git, directory } = selection;
  const installation = path.join(installationParent, path.basename(directory));
  await mkdir(installation);
  const scenario = await createControlledIdentityConsent(
    installation,
    {
      select: async () => ({ status: "selected", directory }),
    },
    git,
  );
  const owner = createRepositoryIdentityQueryOwner(
    scenario.registry,
    consentRegistryOptions(installation),
    installation,
    child,
  );
  try {
    const selected = await scenario.registry.selectRepository();
    if (selected.status !== "prepared") throw new Error("Missing selected directory");
    const request = decodeStrict(RepositoryIdentityAdmissionRequestSchema, {
      ...scenario.request,
      repositorySelectionId: selected.repositorySelectionId,
      trustId: "d41c9b7a-d7c6-4f28-9677-6389413440a9",
    });
    expect(
      await scenario.registry.decideIdentityQueries({ ...scenario.request, decision: "accepted" }),
    ).toEqual({ status: "recorded" });
    expect(
      await scenario.registry.decideRepositoryTrust({
        repositorySelectionId: request.repositorySelectionId,
        trustId: request.trustId,
        decision: "accepted",
      }),
    ).toEqual({ status: "recorded" });
    return await owner.inspectPhysicalIdentity(request);
  } finally {
    await owner.close();
    await scenario.observer.close();
    await scenario.registry.stop();
  }
}

it
  .runIf(process.platform === "win32" && process.arch === "x64")
  .each(["linked", "clone", "alias"] as const)(
  "observes physical relationships for %s",
  async (kind) => {
    const fixture = await physicalFixture();
    const installations = path.join(fixture.root, "installations");
    await mkdir(installations);
    const selection = { installationParent: installations, git: fixture.git };
    const main = await observePhysical({ ...selection, directory: fixture.main });
    const other = await observePhysical({ ...selection, directory: fixture[kind] });
    expect(main.status).toBe("physically-observed");
    expect(other.status).toBe("physically-observed");
    if (main.status !== "physically-observed" || other.status !== "physically-observed")
      throw new Error("Physical observation missing");
    expect(main.physical.commonDirectory).toEqual(main.physical.gitDirectory);
    if (kind === "linked") {
      expect(other.physical.commonDirectory).toEqual(main.physical.commonDirectory);
      expect(other.physical.worktree).not.toEqual(main.physical.worktree);
      expect(other.physical.gitDirectory).not.toEqual(main.physical.gitDirectory);
    }
    if (kind === "clone")
      expect(other.physical.commonDirectory).not.toEqual(main.physical.commonDirectory);
    if (kind === "alias") expect(other.physical).toEqual(main.physical);
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "refuses an admitted alias redirected at final physical composition",
  async () => {
    const fixture = await physicalFixture();
    const installations = path.join(fixture.root, "installations");
    await mkdir(installations);
    const native = createWindowsIdentityQueryChild(installations);
    const original = physicalObservation.completePhysicalObservation;
    vi.spyOn(physicalObservation, "completePhysicalObservation").mockImplementation(
      async (...args) => {
        await rm(fixture.alias, { recursive: true });
        await symlink(fixture.clone, fixture.alias, "junction");
        return original(...args);
      },
    );
    const child: IdentityQueryChildPort = {
      run: async (input, signal) => {
        const result = await native.run(input, signal);
        if (result.status !== "exited") return result;
        const canonical =
          input.query === "show-toplevel"
            ? fixture.main
            : ["absolute-git-dir", "git-common-dir"].includes(input.query)
              ? path.join(fixture.main, ".git")
              : undefined;
        if (canonical === undefined) return result;
        return {
          ...result,
          stdout: new TextEncoder().encode(`${canonical.replaceAll("\\", "/")}\n`),
        };
      },
    };
    expect(
      await observePhysical(
        { installationParent: installations, git: fixture.git, directory: fixture.alias },
        child,
      ),
    ).toEqual({
      status: "rejected",
      code: "REPOSITORY_IDENTITY_CHANGED",
    });
    expect((await directories.observeRepositoryDirectory(fixture.main)).status).toBe("observed");
  },
);

function physicalFaultChild(
  fixture: Awaited<ReturnType<typeof physicalFixture>>,
  fault: "replaced" | "missing" | "mismatch",
  seen: string[],
): IdentityQueryChildPort {
  const native = createWindowsIdentityQueryChild(path.join(fixture.root, "installations"));
  return {
    run: async (input, signal) => {
      seen.push(input.query);
      const result = await native.run(input, signal);
      if (fault === "mismatch") return mismatchedAdmin(result, input.query, fixture.clone);
      if (input.query !== "inside-work-tree") return result;
      await rename(path.join(fixture.main, ".git"), path.join(fixture.root, "old-admin"));
      if (fault === "replaced") await mkdir(path.join(fixture.main, ".git"));
      return result;
    },
  };
}

function mismatchedAdmin(
  result: Awaited<ReturnType<IdentityQueryChildPort["run"]>>,
  query: IdentityQueryKind,
  clone: string,
) {
  if (query !== "absolute-git-dir") return result;
  if (result.status !== "exited") return result;
  return {
    ...result,
    stdout: new TextEncoder().encode(`${path.join(clone, ".git").replaceAll("\\", "/")}\n`),
  };
}

it
  .runIf(process.platform === "win32" && process.arch === "x64")
  .each(["replaced", "missing", "mismatch"] as const)(
  "refuses a %s physical association",
  async (fault) => {
    const fixture = await physicalFixture();
    const installations = path.join(fixture.root, "installations");
    await mkdir(installations);
    const seen: string[] = [];
    const child = physicalFaultChild(fixture, fault, seen);
    const directory = fault === "missing" ? fixture.linked : fixture.main;
    expect(
      await observePhysical(
        { installationParent: installations, git: fixture.git, directory },
        child,
      ),
    ).toEqual({
      status: "rejected",
      code: fault === "missing" ? "REPOSITORY_NOT_FOUND" : "REPOSITORY_IDENTITY_CHANGED",
    });
    expect(seen).toHaveLength(fault === "mismatch" ? 6 : 1);
  },
);

const preconditionFailures = {
  subdirectory: { status: "rejected", code: "OBSERVATION_INVALID" },
  corrupt: { status: "rejected", code: "REPOSITORY_INVALID" },
  capability: { status: "unavailable", code: "IDENTITY_CAPABILITY_UNAVAILABLE" },
  deadline: { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" },
} as const;

it
  .runIf(process.platform === "win32" && process.arch === "x64")
  .each(["non-git", "bare", "bare-admin"] as const)(
  "classifies a trusted %s directory through the closed boolean queries",
  async (kind) => {
    const fixture = await physicalFixture();
    const installations = path.join(fixture.root, "installations");
    await mkdir(installations);
    const directory = path.join(fixture.root, kind, ...(kind === "bare-admin" ? [".git"] : []));
    if (kind !== "non-git") execFileSync(fixture.git, ["init", "--bare", "--quiet", directory]);
    else await mkdir(directory);
    const native = createWindowsIdentityQueryChild(installations);
    const seen: string[] = [];
    const child: IdentityQueryChildPort = {
      run: (input, signal) => {
        seen.push(input.query);
        return native.run(input, signal);
      },
    };
    const result = await observePhysical(
      { installationParent: installations, git: fixture.git, directory },
      child,
    );
    expect(result).toEqual(
      kind === "bare-admin"
        ? { status: "rejected", code: "BARE_REPOSITORY" }
        : { status: "unavailable", code: "GIT_QUERY_FAILED", exitCode: 128 },
    );
    expect(seen).toEqual(
      kind === "bare-admin"
        ? ["inside-work-tree", "bare-repository", "inside-git-dir"]
        : ["inside-work-tree"],
    );
  },
);

function injectPreconditionFault(main: string, fault: keyof typeof preconditionFailures) {
  let now = 0;
  if (fault === "deadline") vi.spyOn(performance, "now").mockImplementation(() => now);
  const original = directories.observeRepositoryDirectory;
  vi.spyOn(directories, "observeRepositoryDirectory").mockImplementation(async (location) => {
    if (location === path.join(main, ".git")) {
      if (fault === "capability")
        return { status: "unavailable", code: "IDENTITY_CAPABILITY_UNAVAILABLE" };
      if (fault === "deadline") now = 10000;
    }
    return original(location);
  });
}

it
  .runIf(process.platform === "win32" && process.arch === "x64")
  .each(["subdirectory", "corrupt", "capability", "deadline"] as const)(
  "refuses %s without dispatching path queries",
  async (fault) => {
    const fixture = await physicalFixture();
    const installations = path.join(fixture.root, "installations");
    await mkdir(installations);
    injectPreconditionFault(fixture.main, fault);
    if (fault === "corrupt") {
      await rename(path.join(fixture.main, ".git"), path.join(fixture.root, "saved-admin"));
      await writeFile(path.join(fixture.main, ".git"), "not a gitfile\n");
    }
    const directory =
      fault === "subdirectory" ? path.join(fixture.main, "subdirectory") : fixture.main;
    if (fault === "subdirectory") await mkdir(directory);
    let launches = 0;
    const native = createWindowsIdentityQueryChild(installations);
    const result = await observePhysical(
      { installationParent: installations, git: fixture.git, directory },
      {
        run: async (input, signal) => {
          launches += 1;
          return native.run(input, signal);
        },
      },
    );
    expect(result).toEqual(preconditionFailures[fault]);
    expect(launches).toBe(fault === "subdirectory" ? 3 : 0);
  },
);
