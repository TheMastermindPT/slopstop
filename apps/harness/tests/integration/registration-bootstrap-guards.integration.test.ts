import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  decodeStrict,
  InitialRepositoryBindingSchema,
  ProjectStorageCreateRequestSchema,
  RegisteredProjectSchema,
} from "@slopstop/protocol";
import { Schema } from "effect";
import { afterEach, expect, it, vi } from "vitest";
import { createProjectRegistrationOwner } from "../../src/registration/project-registration-owner.js";
import { createProjectRegistrationPreparation } from "../../src/registration/project-registration-preparation.js";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import { RepositoryTrustDecisionSchema } from "../../src/registration/repository-trust.js";
import { createWindowsIdentityQueryChild } from "../../src/registration/windows-version-child.js";
import * as databaseClients from "../../src/storage/local-libsql-worker-client.js";
import { createNodeProjectStorageDependencies } from "../../src/storage/project-storage-node-adapters.js";
import { createProjectStorageOwner } from "../../src/storage/project-storage-store.js";
import {
  consentRegistryOptions,
  createControlledIdentityConsent,
} from "./registration-consent-fixture.js";

const roots: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

function gate() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function fixture(
  checkpoint: (point: string, directory: string) => Promise<void> = async () => {},
) {
  const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-bootstrap-guard-"));
  roots.push(root);
  const directory = path.join(root, "repository");
  const git = path.join(process.env["ProgramFiles"] ?? "C:/Program Files", "Git/cmd/git.exe");
  execFileSync(git, ["init", "--quiet", directory]);
  const scenario = await createControlledIdentityConsent(
    root,
    { select: async () => ({ status: "selected", directory }) },
    git,
  );
  const options = {
    ...consentRegistryOptions(root),
    applicationVersion: "0.0.0",
    storageFailures: { checkpoint: (point: string) => checkpoint(point, directory) },
  };
  const native = createWindowsIdentityQueryChild(root);
  let calls = 0;
  const child = {
    run: (...args: Parameters<typeof native.run>) => {
      calls += 1;
      return native.run(...args);
    },
  };
  const owner = createProjectRegistrationOwner(scenario.registry, options, root, child);
  const selection = await scenario.registry.selectRepository();
  if (selection.status !== "prepared") throw new Error("Selection unavailable");
  const trust = { repositorySelectionId: selection.repositorySelectionId, trustId: randomUUID() };
  expect(
    await scenario.registry.decideRepositoryTrust(
      decodeStrict(RepositoryTrustDecisionSchema, { ...trust, decision: "accepted" }),
    ),
  ).toEqual({ status: "recorded" });
  expect(
    await scenario.registry.decideIdentityQueries({ ...scenario.request, decision: "accepted" }),
  ).toEqual({ status: "recorded" });
  const preparation = {
    version: 1,
    requestId: randomUUID(),
    admission: { ...scenario.request, ...trust },
  };
  const proposal = await owner.prepare(preparation);
  if (proposal.status !== "prepared") throw new Error("Preparation unavailable");
  const request = {
    version: 1,
    requestId: randomUUID(),
    preparation,
    proposalId: proposal.proposalId,
    proposalFingerprint: proposal.proposalFingerprint,
  };
  const peers: Array<{ close(): Promise<unknown>; stopRegistry(): Promise<void> }> = [];
  return {
    owner,
    options,
    request,
    directory,
    registry: scenario.registry,
    calls: () => calls,
    rows: (sql: string) => {
      const database = new DatabaseSync(
        path.join(options.applicationStorageRoot, "application.db"),
      );
      try {
        return database.prepare(sql).all();
      } finally {
        database.close();
      }
    },
    peer: (reservationOnly = false) => {
      const registry = createRegistrationRegistry(options);
      const peer = reservationOnly
        ? createProjectRegistrationPreparation(registry, options, root, child)
        : createProjectRegistrationOwner(registry, options, root, child);
      peers.push({ close: peer.close, stopRegistry: registry.stop });
      return peer;
    },
    dispose: async () => {
      await owner.close();
      for (const peer of peers) {
        await peer.close();
        await peer.stopRegistry();
      }
      await scenario.observer.close();
      await scenario.registry.stop();
    },
  };
}

it.runIf(process.platform === "win32")(
  "close after the real publication INSERT rolls it back before commit",
  async () => {
    const f = await fixture();
    const entered = gate();
    const release = gate();
    let visibleInside = 0;
    let publicationCommitted = false;
    let publicationRolledBack = false;
    let publicationInserts = 0;
    let generationSnapshot: Array<Record<string, unknown>> = [];
    const createClient = databaseClients.createWorkerLocalLibsqlClient;
    vi.spyOn(databaseClients, "createWorkerLocalLibsqlClient").mockImplementation((...args) => {
      const client = createClient(...args);
      return {
        execute: (statement, values) => client.execute(statement, values),
        close: () => client.close(),
        transaction: async (mode) => {
          const transaction = await client.transaction(mode);
          let publication = false;
          return {
            get closed() {
              return transaction.closed;
            },
            execute: async (statement, values) => {
              const result = await transaction.execute(statement, values);
              const sql = typeof statement === "string" ? statement : statement.sql;
              if (sql.startsWith("INSERT INTO registration_publications")) {
                publication = true;
                publicationInserts += 1;
                visibleInside = Number(
                  (await transaction.execute("SELECT count(*) FROM registration_publications"))
                    .rows[0]?.[0],
                );
                const stored = await transaction.execute("SELECT * FROM storage_generations");
                generationSnapshot = stored.rows.map((row) =>
                  Object.fromEntries(stored.columns.map((name, index) => [name, row[index]])),
                );
                entered.release();
                await release.promise;
              }
              return result;
            },
            commit: async () => {
              if (publication) publicationCommitted = true;
              await transaction.commit();
            },
            rollback: async () => {
              await transaction.rollback();
              if (publication) publicationRolledBack = true;
            },
            close: () => transaction.close(),
          };
        },
      };
    });
    const work = f.owner.confirm(f.request);
    try {
      await Promise.race([
        entered.promise,
        work.then((result) => {
          throw new Error(`Confirmation settled before publication barrier: ${result.status}`);
        }),
      ]);
      expect(visibleInside).toBe(1);
      expect(publicationCommitted).toBe(false);
      const generations = generationSnapshot;
      expect(generations).toHaveLength(1);
      expect(generations[0]).toMatchObject({ creation_state: "active" });
      const closing = f.owner.close();
      release.release();
      const incomplete = {
        status: "pending-recovery",
        code: "REGISTRATION_INCOMPLETE",
        requestId: f.request.requestId,
      };
      expect(await work).toEqual(incomplete);
      expect(await closing).toEqual({ status: "closed" });
      expect(publicationRolledBack).toBe(true);
      expect(publicationCommitted).toBe(false);
      expect(f.rows("SELECT * FROM registration_publications")).toEqual([]);
      expect(f.rows("SELECT * FROM storage_generations")).toEqual(generations);
      const generation = generations[0];
      if (
        typeof generation?.["project_id"] !== "string" ||
        typeof generation["generation_id"] !== "string"
      )
        throw new Error("Generation identity missing");
      const canonical = new DatabaseSync(
        path.join(
          f.options.applicationStorageRoot,
          "projects",
          generation["project_id"],
          generation["generation_id"],
          "slopstop.db",
        ),
      );
      try {
        expect(canonical.prepare("SELECT * FROM repository_bindings").all()).toHaveLength(1);
        expect(canonical.prepare("SELECT * FROM project_workspaces").all()).toHaveLength(1);
      } finally {
        canonical.close();
      }
      expect(await f.peer().confirm(f.request)).toEqual(incomplete);
      expect(f.calls()).toBe(12);
      expect(publicationInserts).toBe(1);
      expect(f.rows("SELECT * FROM storage_generations")).toEqual(generations);
    } finally {
      release.release();
      await work;
      await f.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "preserves broken registry authority after activation without publishing or recreating",
  async () => {
    const f = await fixture(async (point, directory) => {
      if (point !== "before-created-result") return;
      const database = new DatabaseSync(
        path.join(path.dirname(directory), "installation", "application.db"),
      );
      try {
        database.exec(
          "UPDATE schema_metadata SET last_migration_id = 'unrecognized-publication-head'",
        );
      } finally {
        database.close();
      }
    });
    try {
      expect(await f.owner.confirm(f.request)).toEqual({
        status: "broken",
        code: "REGISTRY_SCHEMA_UNKNOWN",
      });
      const generations = f.rows("SELECT * FROM storage_generations");
      expect(generations).toHaveLength(1);
      expect(generations[0]).toMatchObject({ creation_state: "active" });
      expect(f.rows("SELECT * FROM registration_publications")).toEqual([]);
      expect(await f.peer().confirm(f.request)).toEqual({
        status: "broken",
        code: "REGISTRY_SCHEMA_UNKNOWN",
      });
      expect(f.calls()).toBe(12);
      expect(f.rows("SELECT * FROM storage_generations")).toEqual(generations);
    } finally {
      await f.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "close during initial bootstrap revalidation creates no generation or publication",
  async () => {
    const f = await fixture();
    const entered = gate();
    const release = gate();
    const admit = f.registry.admitRepositoryIdentityQueries.bind(f.registry);
    let admissions = 0;
    vi.spyOn(f.registry, "admitRepositoryIdentityQueries").mockImplementation(async (...args) => {
      const result = await admit(...args);
      admissions += 1;
      if (admissions === 2) {
        entered.release();
        await release.promise;
      }
      return result;
    });
    const work = f.owner.confirm(f.request);
    try {
      await entered.promise;
      let closed = false;
      const closing: Promise<Awaited<ReturnType<typeof f.owner.close>>> = f.owner
        .close()
        .then((result) => {
          closed = true;
          return result;
        });
      await Promise.resolve();
      expect(closed).toBe(false);
      release.release();
      expect(await work).toEqual({ status: "cancelled" });
      expect(await closing).toEqual({ status: "closed" });
      expect(f.rows("SELECT * FROM storage_generations")).toEqual([]);
      expect(f.rows("SELECT * FROM registration_publications")).toEqual([]);
    } finally {
      release.release();
      await work;
      await f.dispose();
    }
  },
);

it.runIf(process.platform === "win32").each(["close", "remove-target"] as const)(
  "retains active creation as incomplete after %s before publication",
  async (mode) => {
    const entered = gate();
    const release = gate();
    const f = await fixture(async (point, directory) => {
      if (point !== "before-created-result") return;
      if (mode === "remove-target") await rm(directory, { recursive: true });
      else {
        entered.release();
        await release.promise;
      }
    });
    const work = f.owner.confirm(f.request);
    try {
      if (mode === "close") {
        await entered.promise;
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        let closed = false;
        const closing = f.owner.close().then((value) => {
          closed = true;
          return value;
        });
        await vi.advanceTimersByTimeAsync(4999);
        expect(closed).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(await closing).toEqual({
          status: "pending-recovery",
          code: "REGISTRATION_INCOMPLETE",
        });
        vi.useRealTimers();
        release.release();
      }
      const incomplete = {
        status: "pending-recovery",
        code: "REGISTRATION_INCOMPLETE",
        requestId: f.request.requestId,
      };
      expect(await work).toEqual(incomplete);
      const generations = f.rows("SELECT * FROM storage_generations");
      expect(generations).toHaveLength(1);
      expect(generations[0]).toMatchObject({ creation_state: "active" });
      expect(f.rows("SELECT * FROM registration_publications")).toEqual([]);
      const generation = generations[0];
      if (
        typeof generation?.["project_id"] !== "string" ||
        typeof generation["generation_id"] !== "string"
      )
        throw new Error("Generation identity missing");
      const canonical = new DatabaseSync(
        path.join(
          f.options.applicationStorageRoot,
          "projects",
          generation["project_id"],
          generation["generation_id"],
          "slopstop.db",
        ),
      );
      try {
        expect(canonical.prepare("SELECT * FROM repository_bindings").all()).toHaveLength(1);
        expect(canonical.prepare("SELECT * FROM project_workspaces").all()).toHaveLength(1);
      } finally {
        canonical.close();
      }
      expect(await f.peer().confirm(f.request)).toEqual(incomplete);
      expect(f.calls()).toBe(12);
      expect(f.rows("SELECT * FROM storage_generations")).toEqual(generations);
    } finally {
      vi.useRealTimers();
      release.release();
      await work;
      await f.dispose();
    }
  },
);

it.runIf(process.platform === "win32")(
  "competing composed owners create one generation and publish only the winner",
  async () => {
    const entered = gate();
    const release = gate();
    let creations = 0;
    const f = await fixture(async (point) => {
      if (point === "before-created-result") {
        creations += 1;
        entered.release();
        await release.promise;
      }
    });
    const winner = f.owner.confirm(f.request);
    try {
      await entered.promise;
      const before = f.rows("SELECT * FROM storage_generations");
      expect(before).toHaveLength(1);
      const otherRequest = { ...f.request, requestId: randomUUID() };
      expect(await f.peer().confirm(otherRequest)).toEqual({
        status: "pending-recovery",
        code: "REGISTRATION_INCOMPLETE",
        requestId: otherRequest.requestId,
      });
      expect(f.rows("SELECT * FROM storage_generations")).toEqual(before);
      expect(f.rows("SELECT * FROM registration_publications")).toEqual([]);
      release.release();
      const registered = decodeStrict(RegisteredProjectSchema, await winner);
      expect(creations).toBe(1);
      expect(f.rows("SELECT * FROM storage_generations")).toEqual(before);
      expect(f.rows("SELECT * FROM registration_publications")).toHaveLength(1);
      const canonical = new DatabaseSync(
        path.join(
          f.options.applicationStorageRoot,
          "projects",
          registered.projectId,
          registered.generationId,
          "slopstop.db",
        ),
      );
      try {
        expect(
          canonical
            .prepare(
              "SELECT b.project_id, b.binding_id, w.workspace_id FROM repository_bindings b JOIN project_workspaces w ON w.project_id = b.project_id AND w.binding_id = b.binding_id",
            )
            .all(),
        ).toEqual([
          {
            project_id: registered.projectId,
            binding_id: registered.repositoryBindingId,
            workspace_id: registered.workspaceId,
          },
        ]);
      } finally {
        canonical.close();
      }
    } finally {
      release.release();
      await winner;
      await f.dispose();
    }
  },
);

it
  .runIf(process.platform === "win32")
  .each(["exact", "mismatched-digest", "foreign-witness"] as const)(
  "Storage creation honors %s reservation authority without bypassing witnesses",
  async (mode) => {
    const f = await fixture();
    try {
      expect(await f.peer(true).confirm(f.request)).toMatchObject({
        status: "pending-recovery",
        code: "REGISTRATION_INCOMPLETE",
      });
      const row = f.rows(
        "SELECT record_json, record_fingerprint FROM registration_reservations",
      )[0];
      if (typeof row?.["record_json"] !== "string" || typeof row["record_fingerprint"] !== "string")
        throw new Error("Reservation missing");
      const {
        reservationFingerprint: _fingerprint,
        registrationRequestId: _request,
        ...identityFields
      } = InitialRepositoryBindingSchema.fields;
      const identity = Schema.decodeUnknownSync(Schema.Struct(identityFields))(
        JSON.parse(row["record_json"]),
      );
      const seed = decodeStrict(InitialRepositoryBindingSchema, {
        ...identity,
        registrationRequestId: f.request.requestId,
        reservationFingerprint:
          mode === "mismatched-digest" ? "0".repeat(64) : row["record_fingerprint"],
      });
      const projectRoot = path.join(f.options.applicationStorageRoot, "projects", seed.projectId);
      const witness = path.join(projectRoot, ".slopstop-repository");
      if (mode === "foreign-witness") {
        await mkdir(projectRoot, { recursive: true });
        await writeFile(witness, "preserved unrelated bytes");
      }
      const before = await readFile(path.join(f.options.applicationStorageRoot, "application.db"));
      const owner = createProjectStorageOwner(
        createNodeProjectStorageDependencies({
          applicationStorageRoot: f.options.applicationStorageRoot,
          migrationResourcesRoot: f.options.migrationResourcesRoot,
          applicationVersion: "0.0.0",
          initialRepositoryBinding: seed,
        }),
      );
      try {
        const result = await owner.create(
          decodeStrict(ProjectStorageCreateRequestSchema, {
            projectId: seed.projectId,
            createRequestId: seed.createRequestId,
          }),
        );
        if (mode === "exact")
          expect(result).toMatchObject({ status: "ready", result: { status: "created" } });
        else
          expect(result).toMatchObject({
            status: "ready",
            result: {
              status: "blocked",
              reason: "prior-state-witness",
              diagnostic: { code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS" },
            },
          });
      } finally {
        await owner.stop();
      }
      if (mode === "exact") expect(f.rows("SELECT * FROM storage_generations")).toHaveLength(1);
      else {
        expect(f.rows("SELECT * FROM storage_generations")).toEqual([]);
        expect(
          await readFile(path.join(f.options.applicationStorageRoot, "application.db")),
        ).toEqual(before);
      }
      if (mode === "foreign-witness")
        expect(await readFile(witness, "utf8")).toBe("preserved unrelated bytes");
    } finally {
      await f.dispose();
    }
  },
);
