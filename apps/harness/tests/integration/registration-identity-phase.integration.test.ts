import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decodeStrict } from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import type { IdentityQueryChildPort } from "../../src/registration/identity-query-child.js";
import { createRepositoryIdentityQueryOwner } from "../../src/registration/repository-identity-query-owner.js";
import { RepositoryIdentityAdmissionRequestSchema } from "../../src/registration/repository-trust.js";
import { createWindowsIdentityQueryChild } from "../../src/registration/windows-version-child.js";
import {
  consentRegistryOptions,
  createControlledIdentityConsent,
} from "./registration-consent-fixture.js";
import { installedGit, trackTemporaryRoots } from "./registration-git-fixture.js";

const roots = trackTemporaryRoots({ realTimers: false });

const kinds = [
  "inside-work-tree",
  "bare-repository",
  "inside-git-dir",
  "show-toplevel",
  "absolute-git-dir",
  "git-common-dir",
];
const expectedPrefix = [
  "--no-pager",
  "--no-optional-locks",
  "-c",
  "core.fsmonitor=false",
  "-c",
  "maintenance.auto=false",
  "-c",
  "gc.auto=0",
  "-c",
  "protocol.allow=never",
  "-c",
  "safe.directory=",
  "-c",
  "safe.bareRepository=explicit",
  "rev-parse",
];
const expectedSuffixes = [
  ["--is-inside-work-tree"],
  ["--is-bare-repository"],
  ["--is-inside-git-dir"],
  ["--path-format=absolute", "--show-toplevel"],
  ["--absolute-git-dir"],
  ["--path-format=absolute", "--git-common-dir"],
];

function addLinkedWorktree(git: string, args: string[], main: string, directory: string) {
  execFileSync(git, [
    ...args,
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
  ]);
  execFileSync(git, [
    ...args,
    "-C",
    main,
    "worktree",
    "add",
    "--quiet",
    "--detach",
    directory,
    "HEAD",
  ]);
}

/** An identity owner on the real native child that records each query it launches. */
function recordingIdentityOwner(
  registry: Parameters<typeof createRepositoryIdentityQueryOwner>[0],
  root: string,
  seen: string[],
) {
  const native = createWindowsIdentityQueryChild(root);
  return createRepositoryIdentityQueryOwner(registry, consentRegistryOptions(root), root, {
    run: (input, signal) => {
      seen.push(input.query);
      return native.run(input, signal);
    },
  });
}

async function createPhaseFixture(linked: boolean) {
  const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-six-query-"));
  roots.push(root);
  const main = path.join(root, "main");
  const hooks = path.join(root, "empty-hooks");
  await mkdir(hooks);
  const git = installedGit;
  const args = ["-c", `core.hooksPath=${hooks}`, "-c", "commit.gpgSign=false"];
  execFileSync(git, [...args, "init", "--quiet", main]);
  const directory = linked ? path.join(root, "linked") : main;
  if (linked) addLinkedWorktree(git, args, main, directory);
  const scenario = await createControlledIdentityConsent(
    root,
    { select: async () => ({ status: "selected", directory }) },
    git,
  );
  const selected = await scenario.registry.selectRepository();
  if (selected.status !== "prepared") throw new Error("Selection unavailable");
  const request = decodeStrict(RepositoryIdentityAdmissionRequestSchema, {
    ...scenario.request,
    repositorySelectionId: selected.repositorySelectionId,
    trustId: "248271ec-1ed7-4fca-8664-05a64bdc4101",
  });
  return { root, main, directory, scenario, request };
}

type PhaseFixture = Awaited<ReturnType<typeof createPhaseFixture>>;

async function acceptTrust({ scenario, request }: PhaseFixture) {
  expect(
    await scenario.registry.decideRepositoryTrust({
      repositorySelectionId: request.repositorySelectionId,
      trustId: request.trustId,
      decision: "accepted",
    }),
  ).toEqual({ status: "recorded" });
}

async function acceptPhase(fixture: PhaseFixture) {
  const { scenario } = fixture;
  expect(
    await scenario.registry.decideIdentityQueries({ ...scenario.request, decision: "accepted" }),
  ).toEqual({ status: "recorded" });
  await acceptTrust(fixture);
}

async function authorizeWithRefusals(
  fixture: PhaseFixture,
  owner: ReturnType<typeof createRepositoryIdentityQueryOwner>,
  seen: readonly string[],
) {
  const { request, scenario } = fixture;
  expect(await owner.inspectIdentity(request)).toEqual({
    status: "unavailable",
    code: "GIT_CONFIRMATION_REQUIRED",
  });
  expect(seen).toEqual([]);
  expect(
    await scenario.registry.decideIdentityQueries({ ...scenario.request, decision: "accepted" }),
  ).toEqual({ status: "recorded" });
  expect(await owner.inspectIdentity(request)).toEqual({
    status: "unavailable",
    code: "REPOSITORY_TRUST_REQUIRED",
  });
  expect(seen).toEqual([]);
  await acceptTrust(fixture);
}

function expectPhaseJournal(
  root: string,
  request: typeof RepositoryIdentityAdmissionRequestSchema.Type,
  phaseId: unknown,
) {
  const database = new DatabaseSync(path.join(root, "installation/application.db"), {
    readOnly: true,
  });
  try {
    const rows = database
      .prepare(
        "SELECT query_kind, json_extract(scope_json, '$.phase.ordinal') AS ordinal, json_extract(scope_json, '$.phase.phaseId') AS phase, child_json IS NOT NULL AS owned, terminal_json IS NOT NULL AS terminal, result_json IS NOT NULL AS settled FROM registration_identity_query_attempts ORDER BY ordinal",
      )
      .all();
    expect(rows).toEqual(
      kinds.map((query_kind, ordinal) => ({
        query_kind,
        ordinal,
        phase: phaseId,
        owned: 1,
        terminal: 1,
        settled: 1,
      })),
    );
    const commands = database
      .prepare(
        "SELECT json_extract(scope_json, '$.arguments') AS argv, repository_selection_id, consent_id FROM registration_identity_query_attempts ORDER BY json_extract(scope_json, '$.phase.ordinal')",
      )
      .all();
    expect(commands).toEqual(
      expectedSuffixes.map((suffix) => ({
        argv: JSON.stringify([...expectedPrefix, ...suffix]),
        repository_selection_id: request.repositorySelectionId,
        consent_id: request.consentId,
      })),
    );
  } finally {
    database.close();
  }
}

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "stops on a real nonzero Git exit without launching later queries",
  async () => {
    const fixture = await createPhaseFixture(false);
    const { root, directory, scenario, request } = fixture;
    const seen: string[] = [];
    const owner = recordingIdentityOwner(scenario.registry, root, seen);
    try {
      await acceptPhase(fixture);
      await rm(path.join(directory, ".git"), { recursive: true });
      expect(await owner.inspectIdentity(request)).toEqual({
        status: "unavailable",
        code: "GIT_QUERY_FAILED",
        exitCode: 128,
      });
      expect(seen).toEqual(["inside-work-tree"]);
    } finally {
      await owner.close();
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  },
);

const controlledOutcomes = {
  bare: { status: "rejected", code: "BARE_REPOSITORY" },
  "phase-deadline": { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" },
  "phase-unconfirmed": {
    status: "pending-recovery",
    code: "OBSERVER_CLEANUP_UNCONFIRMED",
    trigger: "OBSERVATION_LIMIT_EXCEEDED",
  },
} as const;

function controlledChild(
  mode: keyof typeof controlledOutcomes,
  seen: string[],
  advance: () => number,
): IdentityQueryChildPort {
  return {
    run: async (input) => {
      seen.push(input.query);
      await input.onOwned({
        platform: "win32",
        processId: 1234,
        creationTime100ns: "134000000000000000",
        jobName: `Local\\SlopStop.Registration.Observer.${input.observationId}`,
      });
      const values =
        mode === "bare" ? ["false\n", "true\n", "true\n"] : ["true\n", "false\n", "false\n"];
      const now = mode === "bare" ? 0 : advance();
      if (mode === "phase-unconfirmed" && now >= 10000) {
        return { status: "cleanup-unconfirmed", trigger: "CANCELLED" };
      }
      return {
        status: "exited",
        exitCode: 0,
        stdout: new TextEncoder().encode(values[seen.length - 1] ?? "/unexpected\n"),
        stderr: new Uint8Array(),
      };
    },
  };
}

it
  .runIf(process.platform === "win32" && process.arch === "x64")
  .each(["bare", "phase-deadline", "phase-unconfirmed"] as const)(
  "classifies %s before any path query",
  async (mode) => {
    const fixture = await createPhaseFixture(false);
    const { root, scenario, request } = fixture;
    await acceptPhase(fixture);
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const seen: string[] = [];
    const owner = createRepositoryIdentityQueryOwner(
      scenario.registry,
      consentRegistryOptions(root),
      root,
      controlledChild(mode, seen, () => {
        now += 4000;
        return now;
      }),
    );
    try {
      expect(await owner.inspectIdentity(request)).toEqual(controlledOutcomes[mode]);
      expect(seen).toEqual(["inside-work-tree", "bare-repository", "inside-git-dir"]);
    } finally {
      await owner.close();
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64").each([false, true])(
  "executes six fixed queries and composes private paths for linked=%s",
  async (linked) => {
    const fixture = await createPhaseFixture(linked);
    const { root, main, directory, scenario, request } = fixture;
    const seen: string[] = [];
    const owner = recordingIdentityOwner(scenario.registry, root, seen);
    try {
      await authorizeWithRefusals(fixture, owner, seen);
      const result = await owner.inspectIdentity(request);
      expect(result).toEqual({
        status: "identity-observed",
        phaseId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        booleans: { insideWorkTree: true, bareRepository: false, insideGitDirectory: false },
        paths: {
          worktree: directory.replaceAll("\\", "/"),
          gitDirectory: path
            .join(main, linked ? ".git/worktrees/linked" : ".git")
            .replaceAll("\\", "/"),
          commonDirectory: path.join(main, ".git").replaceAll("\\", "/"),
        },
      });
      expect(seen).toEqual(kinds);
      expectPhaseJournal(root, request, Reflect.get(result, "phaseId"));
    } finally {
      await owner.close();
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  },
);
