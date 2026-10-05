import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { decodeStrict } from "@slopstop/protocol";
import { afterEach, expect, it } from "vitest";
import type { IdentityQueryChildPort } from "../../src/registration/identity-query-child.js";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import { createRepositoryIdentityQueryOwner } from "../../src/registration/repository-identity-query-owner.js";
import { RepositoryIdentityAdmissionRequestSchema } from "../../src/registration/repository-trust.js";
import { createWindowsObserverAbsencePort } from "../../src/registration/windows-observer-absence.js";
import { createWindowsIdentityQueryChild } from "../../src/registration/windows-version-child.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import {
  consentRegistryOptions,
  createControlledIdentityConsent,
} from "./registration-consent-fixture.js";
import { createPreviousRegistry } from "./registration-schema-fixture.js";

async function queryRows(root: string) {
  const database = createWorkerLocalLibsqlClient(
    path.join(root, "installation/application.db"),
    "application",
  );
  try {
    return (
      await database.execute(
        "SELECT query_kind, child_json IS NOT NULL, terminal_json IS NOT NULL, result_json FROM registration_identity_query_attempts",
      )
    ).rows;
  } finally {
    await database.close();
  }
}

const roots: string[] = [];

const queryOutcomes = {
  success: { status: "query-observed", insideWorkTree: true },
  cancelled: { status: "cancelled" },
  closed: { status: "cancelled" },
  "lost-terminal": {
    status: "pending-recovery",
    code: "OBSERVER_CLEANUP_UNCONFIRMED",
    trigger: "INTERNAL_FAILURE",
  },
} as const;

function interruptOwnedQuery(
  mode: keyof typeof queryOutcomes,
  controller: AbortController,
  owner: ReturnType<typeof createRepositoryIdentityQueryOwner>,
) {
  if (mode === "cancelled") controller.abort();
  if (mode === "closed") void owner.close();
}

async function expectStoredOutcome(root: string, result: { status: string }) {
  const unresolved = result.status === "pending-recovery";
  expect(await queryRows(root)).toEqual([
    ["inside-work-tree", 1, unresolved ? 0 : 1, unresolved ? null : JSON.stringify(result)],
  ]);
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

it.each(["0001_project_registration", "0003_registration_proposals"])(
  "extends the exact %s schema without replacing old rows",
  async (head) => {
    const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-query-upgrade-"));
    roots.push(root);
    const options = consentRegistryOptions(root);
    await mkdir(options.applicationStorageRoot);
    await createPreviousRegistry(options.applicationStorageRoot);
    const database = createWorkerLocalLibsqlClient(
      path.join(options.applicationStorageRoot, "application.db"),
      "application",
    );
    try {
      const migrations = [
        "0001_project_registration",
        "0002_identity_query_attempts",
        "0003_registration_proposals",
      ];
      for (const migration of migrations.slice(0, migrations.indexOf(head) + 1)) {
        const sql = await readFile(
          path.join(options.migrationResourcesRoot, `application/${migration}.sql`),
          "utf8",
        );
        for (const statement of sql.split("--> statement-breakpoint")) {
          if (statement.trim()) await database.execute(statement);
        }
      }
      await database.execute({
        sql: "UPDATE schema_metadata SET last_migration_id = ?",
        args: [head],
      });
      const before = (await database.execute("SELECT * FROM storage_registrations")).rows;
      expect(before).toHaveLength(1);
      const registry = createRegistrationRegistry(options);
      try {
        expect(await registry.hasUnsettled()).toBe(false);
        expect((await database.execute("SELECT * FROM storage_registrations")).rows).toEqual(
          before,
        );
        expect(
          (await database.execute("SELECT last_migration_id FROM schema_metadata")).rows,
        ).toEqual([["0006_registration_list_visibility"]]);
        expect(await queryRows(root)).toEqual([]);
      } finally {
        await registry.stop();
      }
    } finally {
      await database.close();
    }
  },
);

async function createNativeScenario() {
  const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-live-query-"));
  roots.push(root);
  const directory = path.join(root, "repository with spaces");
  await mkdir(directory);
  const git = path.join(process.env["ProgramFiles"] ?? "C:/Program Files", "Git/cmd/git.exe");
  execFileSync(git, ["init", "--quiet", directory]);
  const scenario = await createControlledIdentityConsent(
    root,
    { select: async () => ({ status: "selected", directory }) },
    git,
  );
  return { root, directory, scenario };
}

function createNativeOwner(
  input: {
    root: string;
    directory: string;
    registry: ReturnType<typeof createRegistrationRegistry>;
  },
  mode: keyof typeof queryOutcomes,
) {
  const { root, directory, registry } = input;
  let launches = 0;
  const controller = new AbortController();
  const native = createWindowsIdentityQueryChild(root);
  const child: IdentityQueryChildPort = {
    run: async (request, signal) => {
      launches += 1;
      expect(request.query).toBe("inside-work-tree");
      expect(request.repositoryDirectory).toBe(directory);
      expect(await queryRows(root)).toEqual([["inside-work-tree", 0, 0, null]]);
      const result = await native.run(
        {
          ...request,
          onOwned: async (owned) => {
            await request.onOwned(owned);
            interruptOwnedQuery(mode, controller, owner);
          },
        },
        signal,
      );
      if (mode === "lost-terminal") throw new Error("controlled-lost-query-terminal");
      return result;
    },
  };
  const owner = createRepositoryIdentityQueryOwner(
    registry,
    consentRegistryOptions(root),
    root,
    child,
  );
  return { owner, controller, launches: () => launches };
}

async function selectQueryRequest(
  scenario: Awaited<ReturnType<typeof createControlledIdentityConsent>>,
) {
  const selected = await scenario.registry.selectRepository();
  if (selected.status !== "prepared") throw new Error("Selection unavailable");
  return decodeStrict(RepositoryIdentityAdmissionRequestSchema, {
    ...scenario.request,
    repositorySelectionId: selected.repositorySelectionId,
    trustId: "f6e2f3db-834e-418e-b747-391ccdb4f455",
  });
}

it
  .runIf(process.platform === "win32" && process.arch === "x64")
  .each(["success", "cancelled", "closed", "lost-terminal"] as const)(
  "runs the first fixed identity query with durable ownership: %s",
  async (mode) => {
    const { root, directory, scenario } = await createNativeScenario();
    try {
      const request = await selectQueryRequest(scenario);
      const { owner, controller, launches } = createNativeOwner(
        { root, directory, registry: scenario.registry },
        mode,
      );
      expect(await owner.inspectInsideWorkTree(request)).toEqual({
        status: "unavailable",
        code: "GIT_CONFIRMATION_REQUIRED",
      });
      expect(launches()).toBe(0);
      expect(
        await scenario.registry.decideIdentityQueries({
          ...scenario.request,
          decision: "accepted",
        }),
      ).toEqual({ status: "recorded" });
      expect(await owner.inspectInsideWorkTree(request)).toEqual({
        status: "unavailable",
        code: "REPOSITORY_TRUST_REQUIRED",
      });
      expect(launches()).toBe(0);
      expect(
        await scenario.registry.decideRepositoryTrust({
          repositorySelectionId: request.repositorySelectionId,
          trustId: request.trustId,
          decision: "accepted",
        }),
      ).toEqual({ status: "recorded" });
      const expected = queryOutcomes[mode];
      expect(await owner.inspectInsideWorkTree(request, controller.signal)).toEqual(expected);
      expect(launches()).toBe(1);
      await expectStoredOutcome(root, expected);
      expect(await scenario.registry.hasUnsettled()).toBe(mode === "lost-terminal");
      if (mode === "closed") {
        expect(await owner.close()).toEqual({ status: "closed" });
        expect(await owner.inspectInsideWorkTree(request)).toEqual({ status: "cancelled" });
        expect(launches()).toBe(1);
      }
      if (mode === "lost-terminal") {
        const restarted = createRegistrationRegistry(consentRegistryOptions(root));
        try {
          expect(await restarted.hasUnsettled()).toBe(true);
          expect(await owner.inspectInsideWorkTree(request)).toEqual({
            status: "pending-recovery",
            code: "OBSERVER_CLEANUP_UNCONFIRMED",
          });
          expect(launches()).toBe(1);
          expect(await owner.close()).toEqual({
            status: "pending-recovery",
            code: "OBSERVER_CLEANUP_UNCONFIRMED",
          });
          expect(await restarted.reconcileObservers(createWindowsObserverAbsencePort())).toEqual({
            status: "settled",
          });
          expect(await restarted.hasUnsettled()).toBe(false);
          expect(await owner.close()).toEqual({ status: "closed" });
        } finally {
          await restarted.stop();
        }
      }
    } finally {
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  },
);

it.runIf(process.platform === "win32" && process.arch === "x64")(
  "reports cleanup unconfirmed when an identity query outlives the close budget (B3)",
  async () => {
    const { root, scenario } = await createNativeScenario();
    try {
      const request = await selectQueryRequest(scenario);
      await scenario.registry.decideIdentityQueries({ ...scenario.request, decision: "accepted" });
      await scenario.registry.decideRepositoryTrust({
        repositorySelectionId: request.repositorySelectionId,
        trustId: request.trustId,
        decision: "accepted",
      });
      let started = () => {};
      const running = new Promise<void>((resolve) => (started = resolve));
      let release: (value: { status: "unavailable"; code: "GIT_UNAVAILABLE" }) => void = () => {};
      const child: IdentityQueryChildPort = {
        run: () => {
          started();
          return new Promise((resolve) => (release = resolve));
        },
      };
      const owner = createRepositoryIdentityQueryOwner(
        scenario.registry,
        consentRegistryOptions(root),
        root,
        child,
      );
      const inspection = owner.inspectInsideWorkTree(request);
      await running;
      const closing = performance.now();
      expect(await owner.close()).toEqual({
        status: "pending-recovery",
        code: "OBSERVER_CLEANUP_UNCONFIRMED",
      });
      expect(performance.now() - closing).toBeGreaterThanOrEqual(4990);
      release({ status: "unavailable", code: "GIT_UNAVAILABLE" });
      await inspection;
    } finally {
      await scenario.observer.close();
      await scenario.registry.stop();
    }
  },
);
