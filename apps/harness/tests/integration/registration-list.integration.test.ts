import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  decodeStrict,
  ProjectStorageCreateRequestSchema,
  ProjectStorageCreateResultSchema,
  RegisteredProjectSchema,
} from "@slopstop/protocol";
import { afterEach, expect, it } from "vitest";
import { createProjectRegistrationOwner } from "../../src/registration/project-registration-owner.js";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import { RepositoryTrustDecisionSchema } from "../../src/registration/repository-trust.js";
import {
  parseProjectStorageManifest,
  serializeProjectStorageManifest,
} from "../../src/storage/project-storage-manifest.js";
import { createNodeProjectStorageDependencies } from "../../src/storage/project-storage-node-adapters.js";
import { createProjectStorageOwner } from "../../src/storage/project-storage-store.js";
import { consentRegistryOptions } from "./registration-consent-fixture.js";
import {
  confirmationRequest,
  countingIdentityChild,
  createSelectedGitRepository,
} from "./registration-git-fixture.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function newRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-list-"));
  roots.push(root);
  return root;
}

it.runIf(process.platform === "win32").each([
  {
    registration: "registered",
    name: "lists the registered Project after restart with current Storage health and no Git",
  },
  {
    registration: "incomplete",
    name: "lists the incomplete Project after restart with current Storage health and no Git",
  },
  {
    registration: "copied-request",
    name: "rejects request JSON copied between valid rows without repairing the registry",
  },
] as const)("$name", async ({ registration }) => {
  const root = await newRoot();
  const { directory, scenario } = await createSelectedGitRepository(root);
  const options = { ...consentRegistryOptions(root), applicationVersion: "0.0.0" };
  let registry = scenario.registry;
  const { child, calls } = countingIdentityChild(root);
  let owner = createProjectRegistrationOwner(registry, options, root, child);
  try {
    const selected = await registry.selectRepository();
    if (selected.status !== "prepared") throw new Error("Selection missing");
    const trust = {
      repositorySelectionId: selected.repositorySelectionId,
      trustId: randomUUID(),
    };
    await registry.decideRepositoryTrust(
      decodeStrict(RepositoryTrustDecisionSchema, { ...trust, decision: "accepted" }),
    );
    await registry.decideIdentityQueries({ ...scenario.request, decision: "accepted" });
    const preparation = {
      version: 1,
      requestId: randomUUID(),
      admission: { ...scenario.request, ...trust },
    };
    const proposal = await owner.prepare(preparation);
    if (proposal.status !== "prepared") throw new Error("Preparation missing");
    const confirmation = confirmationRequest(preparation, proposal);
    const registered = decodeStrict(RegisteredProjectSchema, await owner.confirm(confirmation));
    const otherRequestId = randomUUID();
    if (registration !== "incomplete")
      expect(await owner.confirm({ ...confirmation, requestId: otherRequestId })).toMatchObject({
        status: "requires-project-selection",
        projectId: registered.projectId,
      });
    await owner.close();
    await scenario.observer.close();
    await registry.stop();
    if (registration === "copied-request") {
      const databasePath = path.join(options.applicationStorageRoot, "application.db");
      const database = new DatabaseSync(databasePath);
      try {
        const beforeA = database
          .prepare(
            "SELECT request_id, input_fingerprint, reservation_id FROM registration_requests WHERE request_id = ?",
          )
          .get(confirmation.requestId);
        const beforeB = database
          .prepare(
            "SELECT request_id, input_fingerprint, reservation_id FROM registration_requests WHERE request_id = ?",
          )
          .get(otherRequestId);
        expect(beforeA?.["reservation_id"]).toBe(beforeB?.["reservation_id"]);
        expect(
          database.prepare("SELECT count(*) AS total FROM registration_requests").get(),
        ).toEqual({ total: 2 });
        expect(
          database
            .prepare(
              "UPDATE registration_requests SET request_json = (SELECT request_json FROM registration_requests WHERE request_id = ?) WHERE request_id = ?",
            )
            .run(otherRequestId, confirmation.requestId).changes,
        ).toBe(1);
        expect(
          database
            .prepare(
              "SELECT request_id, input_fingerprint, reservation_id FROM registration_requests WHERE request_id = ?",
            )
            .get(confirmation.requestId),
        ).toEqual(beforeA);
      } finally {
        database.close();
      }
      const before = await readFile(databasePath);
      registry = createRegistrationRegistry(options);
      owner = createProjectRegistrationOwner(registry, options, root, child);
      expect(await owner.listProjects()).toEqual({ status: "broken", code: "REGISTRY_CORRUPT" });
      expect(calls()).toBe(18);
      expect(await readFile(databasePath)).toEqual(before);
      return;
    }
    if (registration === "incomplete") {
      // Fixture for active Storage whose registration publication did not survive.
      const database = new DatabaseSync(
        path.join(options.applicationStorageRoot, "application.db"),
      );
      try {
        database.exec("DELETE FROM registration_publications");
      } finally {
        database.close();
      }
    }
    registry = createRegistrationRegistry(options);
    owner = createProjectRegistrationOwner(registry, options, root, child);
    const expected = {
      status: "listed",
      projects: [
        {
          registration,
          ...(registration === "incomplete" ? { code: "REGISTRATION_INCOMPLETE" } : {}),
          projectId: registered.projectId,
          name: "repository",
          repositoryBindingId: registered.repositoryBindingId,
          workspaceId: registered.workspaceId,
          repositoryLocation: { status: "present" },
          storage: {
            status: "healthy",
            storageId: registered.storageId,
            generationId: registered.generationId,
          },
          access: "not-assessed",
        },
      ],
      hiddenCount: 0,
    };
    expect(await owner.listProjects()).toEqual(expected);
    expect(await owner.listProjects()).toEqual(expected);
    expect(calls()).toBe(registration === "registered" ? 18 : 12);
    expect(JSON.stringify(await owner.listProjects())).not.toContain(root);
    if (registration === "registered") {
      await rm(directory, { recursive: true });
      expect(await owner.listProjects()).toEqual({
        ...expected,
        projects: expected.projects.map((project) => ({
          ...project,
          repositoryLocation: { status: "missing", code: "REPOSITORY_NOT_FOUND" },
        })),
      });
      expect(calls()).toBe(18);
    }
  } finally {
    await owner.close();
    await scenario.observer.close();
    await registry.stop();
  }
});

it("lists an empty new installation but never replaces witnessed or malformed registry state", async () => {
  const root = await newRoot();
  const options = { ...consentRegistryOptions(root), applicationVersion: "0.0.0" };
  const registry = createRegistrationRegistry(options);
  const owner = createProjectRegistrationOwner(registry, options, root);
  try {
    expect(await owner.listProjects()).toEqual({ status: "listed", projects: [], hiddenCount: 0 });
    await expect(
      lstat(path.join(options.applicationStorageRoot, "projects")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    const database = new DatabaseSync(path.join(options.applicationStorageRoot, "application.db"));
    try {
      database.exec("UPDATE schema_metadata SET last_migration_id = 'unknown-list-head'");
    } finally {
      database.close();
    }
    const before = await readFile(path.join(options.applicationStorageRoot, "application.db"));
    expect(await owner.listProjects()).toEqual({
      status: "broken",
      code: "REGISTRY_SCHEMA_UNKNOWN",
    });
    expect(await readFile(path.join(options.applicationStorageRoot, "application.db"))).toEqual(
      before,
    );
  } finally {
    await owner.close();
    await registry.stop();
  }
  const witnessed = await newRoot();
  const otherOptions = { ...consentRegistryOptions(witnessed), applicationVersion: "0.0.0" };
  await mkdir(otherOptions.applicationStorageRoot);
  const marker = path.join(otherOptions.applicationStorageRoot, "prior-state-witness");
  await writeFile(marker, "preserved bytes");
  const otherRegistry = createRegistrationRegistry(otherOptions);
  const otherOwner = createProjectRegistrationOwner(otherRegistry, otherOptions, witnessed);
  try {
    expect(await otherOwner.listProjects()).toEqual({
      status: "pending-recovery",
      code: "REGISTRY_MISSING_WITH_WITNESS",
    });
    await expect(
      readFile(path.join(otherOptions.applicationStorageRoot, "application.db")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(marker, "utf8")).toBe("preserved bytes");
  } finally {
    await otherOwner.close();
    await otherRegistry.stop();
  }
});

it("lists older unbound Storage in migration-required safe mode without rewriting it", async () => {
  const root = await newRoot();
  const options = { ...consentRegistryOptions(root), applicationVersion: "0.0.0" };
  const request = decodeStrict(ProjectStorageCreateRequestSchema, {
    projectId: randomUUID(),
    createRequestId: randomUUID(),
  });
  const storage = createProjectStorageOwner(createNodeProjectStorageDependencies(options));
  const creation = await storage.create(request);
  await storage.stop();
  if (creation.status !== "ready") throw new Error("Storage fixture unavailable");
  const created = decodeStrict(ProjectStorageCreateResultSchema, creation.result);
  if (created.status !== "created") throw new Error("Storage fixture unavailable");
  const generation = path.join(
    options.applicationStorageRoot,
    "projects",
    request.projectId,
    created.identity.generationId,
  );
  const canonicalPath = path.join(generation, "slopstop.db");
  const manifestPath = path.join(generation, "manifest.json");
  const canonical = new DatabaseSync(canonicalPath);
  try {
    canonical.exec(
      "DROP TABLE project_workspaces; DROP TABLE repository_bindings; UPDATE schema_metadata SET schema_version = 2, last_migration_id = '0001_canonical_project_writer'",
    );
  } finally {
    canonical.close();
  }
  const beforeDatabase = await readFile(canonicalPath);
  const manifest = parseProjectStorageManifest(await readFile(manifestPath, "utf8"));
  await writeFile(
    manifestPath,
    serializeProjectStorageManifest({
      ...manifest,
      canonical: {
        ...manifest.canonical,
        schemaVersion: 2,
        lastMigrationId: "0001_canonical_project_writer",
        activationBaseline: {
          algorithm: "sha256",
          sizeBytes: beforeDatabase.length,
          sha256: createHash("sha256").update(beforeDatabase).digest("hex"),
        },
      },
    }),
  );
  const beforeManifest = await readFile(manifestPath);
  const registry = createRegistrationRegistry(options);
  const owner = createProjectRegistrationOwner(registry, options, root);
  try {
    expect(await owner.listProjects()).toEqual({
      status: "listed",
      projects: [
        {
          registration: "unbound",
          projectId: request.projectId,
          repositoryLocation: { status: "not-bound" },
          access: "not-assessed",
          storage: {
            status: "safe-mode",
            storageId: created.identity.storageId,
            generationId: created.identity.generationId,
            canonical: "migration-required",
            runtime: "healthy",
          },
        },
      ],
      hiddenCount: 0,
    });
    expect(await readFile(canonicalPath)).toEqual(beforeDatabase);
    expect(await readFile(manifestPath)).toEqual(beforeManifest);
  } finally {
    await owner.close();
    await registry.stop();
  }
});
