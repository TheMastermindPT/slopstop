import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { RegisteredProjectSchema } from "@slopstop/protocol";
import { afterEach, expect, it, vi } from "vitest";
import { createProjectRegistrationOwner } from "../../src/registration/project-registration-owner.js";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import { RepositoryTrustDecisionSchema } from "../../src/registration/repository-trust.js";
import { createWindowsIdentityQueryChild } from "../../src/registration/windows-version-child.js";
import * as databaseClients from "../../src/storage/local-libsql-worker-client.js";
import { parseProjectStorageManifest } from "../../src/storage/project-storage-manifest.js";
import * as identityObservation from "../../src/storage/repository-identity-observer.js";
import {
  consentRegistryOptions,
  createControlledIdentityConsent,
} from "./registration-consent-fixture.js";

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

it
  .runIf(process.platform === "win32" && process.arch === "x64")
  .each(["complete", "interrupted", "publication-failed"] as const)(
  "uses real bound Storage bootstrap with %s publication and exact restart replay",
  async (mode) => {
    const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-bootstrap-"));
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
      storageFailures: {
        checkpoint: async (point: string) => {
          if (mode === "interrupted" && point === "after-generation-rename")
            throw new Error("Injected owned creation interruption");
        },
      },
    };
    let registry = scenario.registry;
    const native = createWindowsIdentityQueryChild(root);
    let dispatches = 0;
    const child = {
      run: (...args: Parameters<typeof native.run>) => {
        dispatches += 1;
        return native.run(...args);
      },
    };
    let owner = createProjectRegistrationOwner(registry, options, root, child);
    try {
      const selected = await registry.selectRepository();
      if (selected.status !== "prepared") throw new Error("Selection unavailable");
      const trust = {
        repositorySelectionId: selected.repositorySelectionId,
        trustId: randomUUID(),
        decision: "accepted",
      };
      expect(
        await registry.decideRepositoryTrust(RepositoryTrustDecisionSchema.parse(trust)),
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
      const request = {
        version: 1,
        requestId: randomUUID(),
        preparation,
        proposalId: proposal.proposalId,
        proposalFingerprint: proposal.proposalFingerprint,
      };
      if (mode === "publication-failed") failPublicationWrite();
      const result = await owner.confirm(request);
      if (mode !== "complete") {
        expect(result).toEqual({ status: "broken", code: "INTERNAL_FAILURE" });
        await owner.close();
        await scenario.observer.close();
        await registry.stop();
        vi.restoreAllMocks();
        if (mode === "publication-failed") await rm(directory, { recursive: true });
        const inspect = new DatabaseSync(
          path.join(options.applicationStorageRoot, "application.db"),
        );
        let beforeGenerations: ReturnType<ReturnType<DatabaseSync["prepare"]>["all"]>;
        try {
          beforeGenerations = inspect.prepare("SELECT * FROM storage_generations").all();
        } finally {
          inspect.close();
        }
        const directoryReads = vi.spyOn(identityObservation, "observeRepositoryDirectory");
        const executableReads = vi.spyOn(identityObservation, "observeSelectedExecutable");
        registry = createRegistrationRegistry(options);
        owner = createProjectRegistrationOwner(registry, options, root, child);
        expect(await owner.confirm(request)).toEqual({
          status: "pending-recovery",
          code: "REGISTRATION_INCOMPLETE",
          requestId: request.requestId,
        });
        expect(dispatches).toBe(12);
        expect(directoryReads).not.toHaveBeenCalled();
        expect(executableReads).not.toHaveBeenCalled();
        const database = new DatabaseSync(
          path.join(options.applicationStorageRoot, "application.db"),
        );
        try {
          expect(database.prepare("SELECT * FROM storage_generations").all()).toEqual(
            beforeGenerations,
          );
          expect(database.prepare("SELECT creation_state FROM storage_generations").all()).toEqual([
            { creation_state: mode === "interrupted" ? "staging" : "active" },
          ]);
          expect(
            database.prepare("SELECT count(*) AS total FROM registration_publications").get(),
          ).toEqual({ total: 0 });
        } finally {
          database.close();
        }
        return;
      }
      expect(result).toMatchObject({ status: "registered", requestId: request.requestId });
      expect(dispatches).toBe(12);
      const registered = RegisteredProjectSchema.parse(result);
      const generation = path.join(
        options.applicationStorageRoot,
        "projects",
        registered.projectId,
        registered.generationId,
      );
      const manifest = parseProjectStorageManifest(
        await readFile(path.join(generation, "manifest.json"), "utf8"),
      );
      expect(manifest.projectId).toBe(registered.projectId);
      expect(manifest.canonical.schemaVersion).toBe(3);
      expect(
        createHash("sha256")
          .update(await readFile(path.join(generation, "slopstop.db")))
          .digest("hex"),
      ).toBe(manifest.canonical.activationBaseline.sha256);
      const canonical = new DatabaseSync(path.join(generation, "slopstop.db"));
      try {
        expect(
          canonical
            .prepare(
              "SELECT project_id, binding_id, revision, registration_request_id FROM repository_bindings",
            )
            .all(),
        ).toEqual([
          {
            project_id: registered.projectId,
            binding_id: registered.repositoryBindingId,
            revision: 0,
            registration_request_id: request.requestId,
          },
        ]);
        expect(
          canonical
            .prepare("SELECT project_id, workspace_id, binding_id FROM project_workspaces")
            .all(),
        ).toEqual([
          {
            project_id: registered.projectId,
            workspace_id: registered.workspaceId,
            binding_id: registered.repositoryBindingId,
          },
        ]);
      } finally {
        canonical.close();
      }
      expect(JSON.stringify(result)).not.toContain(root);
      await owner.close();
      await scenario.observer.close();
      await registry.stop();
      const alter = new DatabaseSync(path.join(options.applicationStorageRoot, "application.db"));
      try {
        alter.exec("UPDATE registration_identity_consents SET decision = 'declined'");
        alter.exec(
          `INSERT INTO registration_identity_query_attempts (observation_id, repository_selection_id, consent_id, query_kind, scope_json, created_at) SELECT '${randomUUID()}', repository_selection_id, consent_id, query_kind, scope_json, created_at FROM registration_identity_query_attempts LIMIT 1`,
        );
      } finally {
        alter.close();
      }
      await rm(directory, { recursive: true });
      registry = createRegistrationRegistry(options);
      owner = createProjectRegistrationOwner(registry, options, root, child);
      expect(await owner.confirm(request)).toEqual(result);
      expect(await owner.confirm({ ...request, proposalFingerprint: "0".repeat(64) })).toEqual({
        status: "rejected",
        code: "REGISTRATION_IDEMPOTENCY_CONFLICT",
      });
      expect(dispatches).toBe(12);
      const application = new DatabaseSync(
        path.join(options.applicationStorageRoot, "application.db"),
      );
      try {
        expect(
          application.prepare("SELECT count(*) AS total FROM storage_generations").get(),
        ).toEqual({ total: 1 });
      } finally {
        application.close();
      }
    } finally {
      await owner.close();
      await scenario.observer.close();
      await registry.stop();
    }
  },
);
