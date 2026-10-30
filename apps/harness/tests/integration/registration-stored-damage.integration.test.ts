import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decodeStrict } from "@slopstop/protocol";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createProjectRegistrationObserver,
  type GitVersionInspectionRequest,
  GitVersionInspectionRequestSchema,
} from "../../src/project-registration-observer.js";
import { createGitVersionInspection } from "../../src/registration/git-version-inspection.js";
import { listRegisteredProjects } from "../../src/registration/project-listing.js";
import {
  createRegistrationRegistry,
  type RegistrationRegistry,
} from "../../src/registration/registration-registry.js";
import {
  RepositoryTrustDecisionSchema,
  type RepositoryTrustRequestSchema,
} from "../../src/registration/repository-trust.js";
import { createVersionObservationExecution } from "../../src/registration/version-observation-execution.js";
import * as databaseModule from "../../src/storage/local-libsql-worker-client.js";
import { observeSelectedExecutable } from "../../src/storage/repository-identity-observer.js";
import {
  consentRegistryOptions,
  createRepositoryTrustScenario,
} from "./registration-consent-fixture.js";
import { temporaryRoot } from "./temporary-root.js";

const windowsX64 = process.platform === "win32" && process.arch === "x64";
const corrupt = { status: "broken", code: "REGISTRY_CORRUPT" };
const plantedAt = "2026-10-25T12:00:00.000Z";
const queryId = "6d1f0f6e-2b1c-4c55-9e0a-3f1d2c4b5a60";
const observationId = "9b2e4c1a-7d3f-4e8b-a5c6-1f0e2d3c4b5a";
const versionConsentId = "4c7a1e2b-9d3f-4a6c-8b5e-2f1d0c3b4a59";

/** A child identity the journal accepts for `id`, as JSON text. */
const childFor = (id: string) =>
  JSON.stringify({
    platform: "win32",
    processId: 1234,
    creationTime100ns: "134000000000000000",
    jobName: `Local\\SlopStop.Registration.Observer.${id}`,
  });

/** An unsettled identity query of the stored selection and consent, with `id` and `columns`. */
const unsettledQuery = (id: string, child: string | null, terminal: string | null) => `
  INSERT INTO registration_identity_query_attempts
    (observation_id, repository_selection_id, consent_id, query_kind, scope_json, child_json, terminal_json, created_at)
  SELECT '${id}', s.selection_id, c.consent_id, 'show-toplevel', '{}',
    ${child === null ? "NULL" : `'${child}'`}, ${terminal === null ? "NULL" : `'${terminal}'`}, '${plantedAt}'
  FROM registration_repository_selections s, registration_identity_consents c`;

/** A second version observation of the stored executable, with a child and no outcome. */
const pendingObservation = (identityJson: string) => `
  INSERT INTO registration_version_consents (consent_id, selection_id, decision, decided_at)
  SELECT '${versionConsentId}', selection_id, 'accepted', '${plantedAt}' FROM registration_executable_selections;
  INSERT INTO registration_observer_intents (observation_id, selection_id, consent_id, created_at)
  SELECT '${observationId}', selection_id, '${versionConsentId}', '${plantedAt}' FROM registration_executable_selections;
  INSERT INTO registration_observer_children (observation_id, identity_json)
  VALUES ('${observationId}', '${identityJson}')`;

const completeTerminal = (exitCode: string) => `
  INSERT INTO registration_observer_terminals
    (observation_id, exit_code, stdout_closed, stderr_closed, tree_empty, observed_at)
  VALUES ('${observationId}', ${exitCode}, 1, 1, 1, '${plantedAt}')`;

type Stored = Readonly<{
  stageOne: GitVersionInspectionRequest;
  trust: typeof RepositoryTrustRequestSchema.Type;
}>;

type DamageRow = Readonly<{
  name: string;
  plant: string;
  readBack: Readonly<{ sql: string; value: Readonly<Record<string, unknown>> }>;
  call: (
    registry: RegistrationRegistry,
    stored: Stored,
    options: ReturnType<typeof consentRegistryOptions>,
  ) => Promise<unknown>;
}>;

const absent = { inspect: async () => ({ status: "absent" as const }) };

const damageRows: readonly DamageRow[] = [
  {
    name: "a: executable selection time",
    plant: "UPDATE registration_executable_selections SET captured_at = 'not-a-time'",
    readBack: {
      sql: "SELECT captured_at FROM registration_executable_selections",
      value: { captured_at: "not-a-time" },
    },
    call: (registry, { stageOne }) => {
      const request = decodeStrict(GitVersionInspectionRequestSchema, {
        selectionId: stageOne.selectionId,
        consentId: versionConsentId,
      });
      if (request.consentId === null) throw new Error("The new version consent is missing.");
      return registry.decideVersion({
        ...request,
        consentId: request.consentId,
        decision: "accepted",
      });
    },
  },
  {
    name: "b: repository selection directory",
    plant: "UPDATE registration_repository_selections SET directory_path = X'00'",
    readBack: {
      sql: "SELECT typeof(directory_path) AS kind FROM registration_repository_selections",
      value: { kind: "blob" },
    },
    call: (registry, { trust }) =>
      registry.decideRepositoryTrust(
        decodeStrict(RepositoryTrustDecisionSchema, {
          ...trust,
          trustId: queryId,
          decision: "accepted",
        }),
      ),
  },
  {
    name: "c: identity query id",
    plant: unsettledQuery(queryId.toUpperCase(), null, null),
    readBack: {
      sql: "SELECT observation_id FROM registration_identity_query_attempts",
      value: { observation_id: queryId.toUpperCase() },
    },
    call: (registry) => registry.reconcileAtStart(undefined),
  },
  {
    name: "d: identity query child",
    plant: unsettledQuery(queryId, "{}", null),
    readBack: {
      sql: "SELECT child_json FROM registration_identity_query_attempts",
      value: { child_json: "{}" },
    },
    call: (registry) => registry.reconcileAtStart(undefined),
  },
  {
    name: "e: identity query terminal",
    plant: unsettledQuery(queryId, childFor(queryId), "{}"),
    readBack: {
      sql: "SELECT terminal_json FROM registration_identity_query_attempts",
      value: { terminal_json: "{}" },
    },
    call: (registry) => registry.reconcileAtStart(undefined),
  },
  {
    name: "f: version outcome",
    plant: "UPDATE registration_observer_outcomes SET result_json = '{}'",
    readBack: {
      sql: "SELECT result_json FROM registration_observer_outcomes",
      value: { result_json: "{}" },
    },
    call: (registry, { stageOne }) => inspectVersion(registry, stageOne),
  },
  {
    name: "g: version terminal exit code",
    plant: `${pendingObservation(childFor(observationId))}; ${completeTerminal("'x'")}`,
    readBack: {
      sql: `SELECT exit_code, typeof(exit_code) AS kind FROM registration_observer_terminals WHERE observation_id = '${observationId}'`,
      value: { exit_code: "x", kind: "text" },
    },
    call: (registry) => registry.reconcileAtStart(undefined),
  },
  {
    name: "h: version child with a terminal",
    plant: `${pendingObservation("{}")}; ${completeTerminal("0")}`,
    readBack: {
      sql: `SELECT identity_json FROM registration_observer_children WHERE observation_id = '${observationId}'`,
      value: { identity_json: "{}" },
    },
    call: (registry) => registry.reconcileAtStart(undefined),
  },
  {
    name: "i: version child without a terminal",
    plant: pendingObservation("{}"),
    readBack: {
      sql: `SELECT identity_json FROM registration_observer_children WHERE observation_id = '${observationId}'`,
      value: { identity_json: "{}" },
    },
    call: (registry) => registry.reconcileAtStart(absent),
  },
  {
    name: "j: hidden project id (listing)",
    plant: `INSERT INTO registration_list_visibility (project_id, hidden_at) VALUES (X'00', '${plantedAt}')`,
    readBack: {
      sql: "SELECT typeof(project_id) AS kind FROM registration_list_visibility",
      value: { kind: "blob" },
    },
    call: (_registry, _stored, options) => listProjects(options),
  },
];

/** The saved list of the installation at `options`. */
function listProjects(options: ReturnType<typeof consentRegistryOptions>) {
  return listRegisteredProjects(
    { ...options, applicationVersion: "0.0.0" },
    new AbortController().signal,
  );
}

/** Every client's visibility read rejects as busy; other statements run as they are. */
function busyVisibilityReads() {
  const original = databaseModule.createWorkerLocalLibsqlClient;
  const busy = () => Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
  vi.spyOn(databaseModule, "createWorkerLocalLibsqlClient").mockImplementation((...args) => {
    const client = original(...args);
    return {
      execute: (statement, values) => client.execute(statement, values),
      close: () => client.close(),
      transaction: async (mode) => {
        const transaction = await client.transaction(mode);
        const wrapped: databaseModule.LocalLibsqlTransaction = {
          get closed() {
            return transaction.closed;
          },
          execute: (statement, values) => {
            const sql = typeof statement === "string" ? statement : statement.sql;
            return sql.includes("FROM registration_list_visibility")
              ? Promise.reject(busy())
              : transaction.execute(statement, values);
          },
          commit: () => transaction.commit(),
          rollback: () => transaction.rollback(),
          close: () => transaction.close(),
        };
        return wrapped;
      },
    };
  });
}

/** The version observer over `registry`; a dispatch would mean the stored outcome was skipped. */
async function inspectVersion(
  registry: RegistrationRegistry,
  request: GitVersionInspectionRequest,
) {
  const observer = createProjectRegistrationObserver(
    createGitVersionInspection(
      registry,
      createVersionObservationExecution({
        inspectIdentity: observeSelectedExecutable,
        journal: registry,
        child: { run: () => Promise.reject(new Error("The stored outcome was not read.")) },
      }),
    ),
    registry,
  );
  try {
    return await observer.inspectGitVersion(request);
  } finally {
    await observer.close();
  }
}

/** Plants `row` with checks and foreign keys on, and proves the database still opens healthy. */
function plantDamage(database: string, row: DamageRow) {
  const db = new DatabaseSync(database);
  try {
    db.exec(row.plant);
    expect(db.prepare(row.readBack.sql).get()).toEqual(row.readBack.value);
    expect(db.prepare("PRAGMA integrity_check").all()).toEqual([{ integrity_check: "ok" }]);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  } finally {
    db.close();
  }
}

let baseRoot = "";
let stored: Stored | undefined;
const roots: string[] = [];

describe.runIf(windowsX64)("stored registration damage", () => {
  beforeAll(async () => {
    baseRoot = await temporaryRoot("p3-s2-stored-damage-base-");
    const scenario = await createRepositoryTrustScenario(baseRoot);
    await scenario.observer.close();
    await scenario.registry.stop();
    stored = { stageOne: scenario.stageOne, trust: scenario.trust };
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  });

  afterAll(async () => {
    if (baseRoot !== "") await rm(baseRoot, { recursive: true, force: true });
  });

  it.each(damageRows.map((row) => [row.name, row] as const))(
    "answers a stored registration value that does not decode as corrupt (%s)",
    async (_name, row) => {
      if (stored === undefined) throw new Error("The stored scenario is missing.");
      const root = await temporaryRoot("p3-s2-stored-damage-");
      roots.push(root);
      const options = consentRegistryOptions(root);
      await cp(
        consentRegistryOptions(baseRoot).applicationStorageRoot,
        options.applicationStorageRoot,
        {
          recursive: true,
        },
      );
      plantDamage(path.join(options.applicationStorageRoot, "application.db"), row);
      const registry = createRegistrationRegistry(options);
      try {
        expect(await row.call(registry, stored, options)).toEqual(corrupt);
      } finally {
        await registry.stop();
      }
    },
  );

  it("answers a busy hidden-row read as busy when listing", async () => {
    const root = await temporaryRoot("p3-s2-busy-visibility-");
    roots.push(root);
    const options = consentRegistryOptions(root);
    await cp(
      consentRegistryOptions(baseRoot).applicationStorageRoot,
      options.applicationStorageRoot,
      {
        recursive: true,
      },
    );
    busyVisibilityReads();
    expect(await listProjects(options)).toEqual({ status: "unavailable", code: "REGISTRY_BUSY" });
  });
});
