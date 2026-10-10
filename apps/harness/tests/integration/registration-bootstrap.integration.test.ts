import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decodeStrict, RegisteredProjectSchema } from "@slopstop/protocol";
import { afterEach, expect, it, vi } from "vitest";
import { createProjectRegistrationOwner } from "../../src/registration/project-registration-owner.js";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import { RepositoryTrustDecisionSchema } from "../../src/registration/repository-trust.js";
import * as databaseClients from "../../src/storage/local-libsql-worker-client.js";
import { parseProjectStorageManifest } from "../../src/storage/project-storage-manifest.js";
import * as identityObservation from "../../src/storage/repository-identity-observer.js";
import { consentRegistryOptions } from "./registration-consent-fixture.js";
import {
  confirmationRequest,
  countingIdentityChild,
  createSelectedGitRepository,
} from "./registration-git-fixture.js";

const roots: string[] = [];
function failPublicationWrite() {
  const original = databaseClients.createWorkerLocalLibsqlClient;
  vi.spyOn(databaseClients, "createWorkerLocalLibsqlClient").mockImplementation((...args) => {
    const client = original(...args);
    return {
      execute: (statement, values) => client.execute(statement, values),
      transaction: async (mode) => {
        const transaction = await client.transaction(mode);
        return {
          get closed() {
            return transaction.closed;
          },
          execute: async (statement, values) => {
            const sql = typeof statement === "string" ? statement : statement.sql;
            if (sql.startsWith("INSERT INTO registration_publications"))
              throw new Error("Injected publication failure");
            return transaction.execute(statement, values);
          },
          commit: () => transaction.commit(),
          rollback: () => transaction.rollback(),
          close: () => transaction.close(),
        };
      },
      close: () => client.close(),
    };
  });
}
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

type Mode = "complete" | "interrupted" | "publication-failed";
type Scenario = Awaited<ReturnType<typeof createSelectedGitRepository>>["scenario"];
type Registry = Scenario["registry"];
type Options = ReturnType<typeof bootstrapOptions>;
type Owner = ReturnType<typeof createProjectRegistrationOwner>;
type Request = ReturnType<typeof confirmationRequest>;
type Result = Awaited<ReturnType<Owner["confirm"]>>;

/** The registry, owner and observer of one runtime; a restart replaces the first two. */
type Session = {
  root: string;
  options: Options;
  scenario: Scenario;
  child: ReturnType<typeof countingIdentityChild>["child"];
  registry: Registry;
  owner: Owner;
};

function bootstrapOptions(root: string, mode: Mode) {
  return {
    ...consentRegistryOptions(root),
    applicationVersion: "0.0.0",
    storageFailures: {
      checkpoint: async (point: string) => {
        if (mode === "interrupted" && point === "after-generation-rename")
          throw new Error("Injected owned creation interruption");
      },
    },
  };
}

/** Every row `sql` answers from a database file, opened and closed around the read. */
function rowsOf(databasePath: string, sql: string) {
  const database = new DatabaseSync(databasePath);
  try {
    return database.prepare(sql).all();
  } finally {
    database.close();
  }
}

function applicationDatabase(session: Session): string {
  return path.join(session.options.applicationStorageRoot, "application.db");
}

/** Selects, trusts and consents through the real registry, then prepares the confirmation. */
async function prepareConfirmation(session: Session): Promise<Request> {
  const { registry, owner, scenario } = session;
  const selected = await registry.selectRepository();
  if (selected.status !== "prepared") throw new Error("Selection unavailable");
  const trust = {
    repositorySelectionId: selected.repositorySelectionId,
    trustId: randomUUID(),
    decision: "accepted",
  };
  expect(
    await registry.decideRepositoryTrust(decodeStrict(RepositoryTrustDecisionSchema, trust)),
  ).toEqual({ status: "recorded" });
  expect(
    await registry.decideIdentityQueries({ ...scenario.request, decision: "accepted" }),
  ).toEqual({ status: "recorded" });
  const preparation = {
    version: 1,
    requestId: randomUUID(),
    admission: {
      ...scenario.request,
      repositorySelectionId: selected.repositorySelectionId,
      trustId: trust.trustId,
    },
  };
  const proposal = await owner.prepare(preparation);
  if (proposal.status !== "prepared") throw new Error("Preparation unavailable");
  return confirmationRequest(preparation, proposal);
}

async function stopSession(session: Session): Promise<void> {
  await session.owner.close();
  await session.scenario.observer.close();
  await session.registry.stop();
}

function restartSession(session: Session): void {
  session.registry = createRegistrationRegistry(session.options);
  session.owner = createProjectRegistrationOwner(
    session.registry,
    session.options,
    session.root,
    session.child,
  );
}

/** An unpublished confirmation replays as incomplete after a restart, reading nothing again. */
async function expectIncompleteReplay(
  session: Session,
  input: Readonly<{ mode: Mode; request: Request; directory: string; dispatches: () => number }>,
): Promise<void> {
  const { mode, request } = input;
  await stopSession(session);
  vi.restoreAllMocks();
  if (mode === "publication-failed") await rm(input.directory, { recursive: true });
  const generationsSql = "SELECT * FROM storage_generations";
  const beforeGenerations = rowsOf(applicationDatabase(session), generationsSql);
  const directoryReads = vi.spyOn(identityObservation, "observeRepositoryDirectory");
  const executableReads = vi.spyOn(identityObservation, "observeSelectedExecutable");
  restartSession(session);
  expect(await session.owner.confirm(request)).toEqual({
    status: "pending-recovery",
    code: "REGISTRATION_INCOMPLETE",
    requestId: request.requestId,
  });
  expect(input.dispatches()).toBe(12);
  expect(directoryReads).not.toHaveBeenCalled();
  expect(executableReads).not.toHaveBeenCalled();
  const application = applicationDatabase(session);
  expect(rowsOf(application, generationsSql)).toEqual(beforeGenerations);
  expect(rowsOf(application, "SELECT creation_state FROM storage_generations")).toEqual([
    { creation_state: mode === "interrupted" ? "staging" : "active" },
  ]);
  expect(rowsOf(application, "SELECT count(*) AS total FROM registration_publications")).toEqual([
    { total: 0 },
  ]);
}

/** The published generation is sealed at schema 4 and holds the initial binding and workspace. */
async function expectRegisteredGeneration(
  session: Session,
  input: Readonly<{ result: Result; request: Request }>,
): Promise<void> {
  const registered = decodeStrict(RegisteredProjectSchema, input.result);
  const generation = path.join(
    session.options.applicationStorageRoot,
    "projects",
    registered.projectId,
    registered.generationId,
  );
  const manifest = parseProjectStorageManifest(
    await readFile(path.join(generation, "manifest.json"), "utf8"),
  );
  expect(manifest.projectId).toBe(registered.projectId);
  expect(manifest.canonical.schemaVersion).toBe(4);
  const canonical = path.join(generation, "slopstop.db");
  expect(
    createHash("sha256")
      .update(await readFile(canonical))
      .digest("hex"),
  ).toBe(manifest.canonical.activationBaseline.sha256);
  expect(
    rowsOf(
      canonical,
      "SELECT project_id, binding_id, revision, registration_request_id FROM repository_bindings",
    ),
  ).toEqual([
    {
      project_id: registered.projectId,
      binding_id: registered.repositoryBindingId,
      revision: 0,
      registration_request_id: input.request.requestId,
    },
  ]);
  expect(
    rowsOf(canonical, "SELECT project_id, workspace_id, binding_id FROM project_workspaces"),
  ).toEqual([
    {
      project_id: registered.projectId,
      workspace_id: registered.workspaceId,
      binding_id: registered.repositoryBindingId,
    },
  ]);
}

/** After a restart with changed consent and no repository, the exact request replays. */
async function expectExactRestartReplay(
  session: Session,
  input: Readonly<{
    result: Result;
    request: Request;
    directory: string;
    dispatches: () => number;
  }>,
): Promise<void> {
  const { result, request } = input;
  await stopSession(session);
  const alter = new DatabaseSync(applicationDatabase(session));
  try {
    alter.exec("UPDATE registration_identity_consents SET decision = 'declined'");
    alter.exec(
      `INSERT INTO registration_identity_query_attempts (observation_id, repository_selection_id, consent_id, query_kind, scope_json, created_at) SELECT '${randomUUID()}', repository_selection_id, consent_id, query_kind, scope_json, created_at FROM registration_identity_query_attempts LIMIT 1`,
    );
  } finally {
    alter.close();
  }
  await rm(input.directory, { recursive: true });
  restartSession(session);
  expect(await session.owner.confirm(request)).toEqual(result);
  expect(await session.owner.confirm({ ...request, proposalFingerprint: "0".repeat(64) })).toEqual({
    status: "rejected",
    code: "REGISTRATION_IDEMPOTENCY_CONFLICT",
  });
  expect(input.dispatches()).toBe(12);
  expect(
    rowsOf(applicationDatabase(session), "SELECT count(*) AS total FROM storage_generations"),
  ).toEqual([{ total: 1 }]);
}

it
  .runIf(process.platform === "win32" && process.arch === "x64")
  .each(["complete", "interrupted", "publication-failed"] as const)(
  "uses real bound Storage bootstrap with %s publication and exact restart replay",
  async (mode) => {
    const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-bootstrap-"));
    roots.push(root);
    const { directory, scenario } = await createSelectedGitRepository(root);
    const options = bootstrapOptions(root, mode);
    const { child, calls: dispatches } = countingIdentityChild(root);
    const session: Session = {
      root,
      options,
      scenario,
      child,
      registry: scenario.registry,
      owner: createProjectRegistrationOwner(scenario.registry, options, root, child),
    };
    try {
      const request = await prepareConfirmation(session);
      if (mode === "publication-failed") failPublicationWrite();
      const result = await session.owner.confirm(request);
      if (mode !== "complete") {
        expect(result).toEqual({ status: "broken", code: "INTERNAL_FAILURE" });
        await expectIncompleteReplay(session, { mode, request, directory, dispatches });
        return;
      }
      expect(result).toMatchObject({ status: "registered", requestId: request.requestId });
      expect(dispatches()).toBe(12);
      await expectRegisteredGeneration(session, { result, request });
      expect(JSON.stringify(result)).not.toContain(root);
      await expectExactRestartReplay(session, { result, request, directory, dispatches });
    } finally {
      await stopSession(session);
    }
  },
);
