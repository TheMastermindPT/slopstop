import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import { createRepositoryIdentityQueryOwner } from "../../src/registration/repository-identity-query-owner.js";
import { checkedInMigrationRoot } from "./project-storage-runtime-fixture.js";
import {
  consentRegistryOptions,
  createRepositoryTrustScenario,
} from "./registration-consent-fixture.js";
import { registerFolder, registrationSession } from "./registration-flow-fixture.js";
import { temporaryRoot } from "./temporary-root.js";
import { missing94 } from "./trace-94.js";

const fixedInstant = "2026-10-24T12:00:00.000Z";
const clock = { now: () => fixedInstant };
const reconciledId = randomUUID();

/** Each stored registration time, with the query that reads it. */
const storedTimes: readonly (readonly [string, string])[] = [
  ["repository selection", "SELECT captured_at FROM registration_repository_selections"],
  ["repository trust", "SELECT decided_at FROM registration_repository_trust"],
  ["identity query consent", "SELECT decided_at FROM registration_identity_consents"],
  [
    "identity query start",
    `SELECT created_at FROM registration_identity_query_attempts WHERE observation_id <> '${reconciledId}'`,
  ],
  [
    "identity query settlement",
    `SELECT settled_at FROM registration_identity_query_attempts WHERE observation_id <> '${reconciledId}'`,
  ],
  [
    "identity query restart settlement",
    `SELECT settled_at FROM registration_identity_query_attempts WHERE observation_id = '${reconciledId}'`,
  ],
  ["executable selection", "SELECT captured_at FROM registration_executable_selections"],
  ["version consent", "SELECT decided_at FROM registration_version_consents"],
  ["observer intent", "SELECT created_at FROM registration_observer_intents"],
  ["observer terminal", "SELECT observed_at FROM registration_observer_terminals"],
  ["observer outcome", "SELECT settled_at FROM registration_observer_outcomes"],
  ["preparation", "SELECT json_extract(record_json, '$.preparedAt') FROM registration_proposals"],
  ["reservation", "SELECT json_extract(record_json, '$.createdAt') FROM registration_reservations"],
  ["list removal", "SELECT hidden_at FROM registration_list_visibility"],
];

/**
 * Copies one settled identity query of the installation as an attempt a killed harness left
 * unsettled after its child's terminal record, so restart reconciliation settles it.
 */
function leaveUnsettledQuery(database: string) {
  const db = new DatabaseSync(database);
  try {
    db.prepare(
      `INSERT INTO registration_identity_query_attempts (observation_id, repository_selection_id, consent_id, query_kind, scope_json, child_json, terminal_json, created_at)
       SELECT ?, repository_selection_id, consent_id, query_kind, scope_json,
         json_set(child_json, '$.jobName', 'Local\\SlopStop.Registration.Observer.' || ?), terminal_json, created_at
       FROM registration_identity_query_attempts WHERE child_json IS NOT NULL AND terminal_json IS NOT NULL LIMIT 1`,
    ).run(reconciledId, reconciledId);
  } finally {
    db.close();
  }
}

/** Registers one folder, removes it from the list, then reconciles at a restart. */
async function stampRegistration() {
  const session = await registrationSession({ clock });
  const installation = path.join(session.root, "installation");
  try {
    const { registered } = await registerFolder(session, session.directory);
    if (registered.status !== "registered") throw missing94("Registration missing", registered);
    const removed = await session.register({
      step: "remove-from-list",
      projectId: registered.projectId,
    });
    if (removed.status !== "removed") throw missing94("Removal missing", removed);
  } finally {
    await session.dispose();
  }
  const database = path.join(installation, "application.db");
  leaveUnsettledQuery(database);
  const registry = createRegistrationRegistry({
    applicationStorageRoot: installation,
    migrationResourcesRoot: checkedInMigrationRoot,
    clock,
  });
  try {
    await registry.reconcileAtStart(undefined);
  } finally {
    await registry.stop();
  }
  return readStoredTimes(database);
}

/** Every stored time by its row name, read before the session fixture removes the root. */
function readStoredTimes(database: string) {
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    return new Map(
      storedTimes.map(([name, sql]) => [
        name,
        db
          .prepare(sql)
          .all()
          .map((row) => Object.values(row)[0]),
      ]),
    );
  } finally {
    db.close();
  }
}

// The flow runs once, on the first row; every row reads the same installation.
let stamped: ReturnType<typeof stampRegistration> | undefined;

it.runIf(process.platform === "win32").each(storedTimes.map(([name]) => name))(
  "stamps every registration time from the injected clock (%s)",
  async (name) => {
    stamped ??= stampRegistration();
    const values = (await stamped).get(name) ?? [];
    expect(values.length).toBeGreaterThan(0);
    expect(values).toEqual(values.map(() => fixedInstant));
  },
);

/** The stored identity query attempts, read before the test removes the root. */
function storedAttempts(root: string) {
  const db = new DatabaseSync(path.join(root, "installation/application.db"), { readOnly: true });
  try {
    return db
      .prepare(
        "SELECT child_json, settled_at, result_json FROM registration_identity_query_attempts",
      )
      .all();
  } finally {
    db.close();
  }
}

it.runIf(process.platform === "win32")(
  "stamps the no-dispatch settlement from the injected clock",
  async () => {
    const root = await temporaryRoot("p3-s2-no-dispatch-clock-");
    try {
      const scenario = await createRepositoryTrustScenario(root);
      const unavailable = { status: "unavailable", code: "GIT_UNAVAILABLE" } as const;
      // The child never reports an owned process, so the owner settles without a dispatch.
      const owner = createRepositoryIdentityQueryOwner(
        scenario.registry,
        { ...consentRegistryOptions(root), clock },
        root,
        { run: async () => unavailable },
      );
      try {
        expect(
          await scenario.registry.decideRepositoryTrust({
            ...scenario.trust,
            decision: "accepted",
          }),
        ).toEqual({ status: "recorded" });
        expect(await owner.inspectInsideWorkTree(scenario.admission)).toEqual(unavailable);
      } finally {
        await owner.close();
        await scenario.observer.close();
        await scenario.registry.stop();
      }
      expect(storedAttempts(root)).toEqual([
        { child_json: null, settled_at: fixedInstant, result_json: JSON.stringify(unavailable) },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
