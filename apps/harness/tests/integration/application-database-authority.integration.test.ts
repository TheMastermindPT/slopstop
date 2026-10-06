import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import {
  decodeStrict,
  ProjectStorageCreateRequestSchema,
  ProjectStorageCreateResultSchema,
  ProjectStorageOpenResultSchema,
} from "@slopstop/protocol";
import { expect, it } from "vitest";
import { createProjectRegistrationOwner } from "../../src/registration/project-registration-owner.js";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import { createApplicationDatabaseAuthority } from "../../src/storage/application-database-authority.js";
import type { ApplicationDatabaseMigrationCheckpoint } from "../../src/storage/application-database-migration.js";
import { createNodeProjectStorageDependencies } from "../../src/storage/project-storage-node-adapters.js";
import { createProjectStorageOwner } from "../../src/storage/project-storage-store.js";
import { consentRegistryOptions } from "./registration-consent-fixture.js";

function migrationBarrier() {
  let reach: () => void = () => undefined;
  let open: () => void = () => undefined;
  const reached = new Promise<void>((resolve) => {
    reach = resolve;
  });
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  let held = false;
  return {
    reached,
    open,
    failures: {
      checkpoint: async (point: ApplicationDatabaseMigrationCheckpoint) => {
        if (point !== "before-commit" || held) return;
        held = true;
        reach();
        await opened;
      },
    },
  };
}

function readApplicationDatabase(databasePath: string) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return {
      journalMode: database.prepare("PRAGMA journal_mode").get(),
      metadata: database
        .prepare("SELECT metadata_key, last_migration_id FROM schema_metadata")
        .all(),
    };
  } finally {
    database.close();
  }
}

type ApplicationRegistryBase = ReturnType<typeof consentRegistryOptions>;
type ProjectStorageOwner = ReturnType<typeof createProjectStorageOwner>;
type ProjectId = (typeof ProjectStorageCreateRequestSchema.Type)["projectId"];
type ProjectListing = ReturnType<ReturnType<typeof createProjectRegistrationOwner>["listProjects"]>;

// Proves the create waited behind the migration and then created the Project.
async function expectWaitingCreateCompleted(
  creating: ReturnType<ProjectStorageOwner["create"]>,
  early: unknown,
) {
  const created = await creating;
  expect({
    early: early === "waiting" ? early : "settled",
    created: created.status,
    message: created.status === "ready" ? undefined : created.message,
  }).toEqual({ early: "waiting", created: "ready", message: undefined });
  if (created.status !== "ready") throw new Error("Project create did not complete.");
  expect(decodeStrict(ProjectStorageCreateResultSchema, created.result).status).toBe("created");
}

// Proves the listing completed with only the created Project.
async function expectListedOnly(listing: ProjectListing, projectId: ProjectId) {
  const listed = await listing;
  expect(listed.status).toBe("listed");
  if (listed.status !== "listed") throw new Error("Project listing did not complete.");
  for (const project of listed.projects) expect(project.projectId).toBe(projectId);
}

// Proves the created Project opens and closes cleanly.
async function expectOpensAndCloses(storage: ProjectStorageOwner, projectId: ProjectId) {
  const opened = await storage.open({ projectId });
  if (opened.status !== "ready") throw new Error("Project open did not complete.");
  expect(decodeStrict(ProjectStorageOpenResultSchema, opened.result).status).toBe("opened");
  expect((await storage.close({ projectId })).status).toBe("ready");
}

// Proves a fresh authority over the same application database still lists the Project.
async function expectReopenedListing(
  base: ApplicationRegistryBase,
  root: string,
  projectId: string,
) {
  const reopenedDatabase = createApplicationDatabaseAuthority(base);
  const reopenedOptions = {
    ...base,
    applicationVersion: "0.0.0",
    applicationDatabase: reopenedDatabase,
  };
  const reopenedRegistry = createRegistrationRegistry(reopenedOptions);
  const reopenedRegistration = createProjectRegistrationOwner(
    reopenedRegistry,
    reopenedOptions,
    root,
  );
  try {
    const relisted = await reopenedRegistration.listProjects();
    expect(relisted).toMatchObject({
      status: "listed",
      projects: [{ registration: "unbound", projectId }],
    });
  } finally {
    await reopenedRegistration.close();
    await reopenedRegistry.stop();
    await reopenedDatabase.stop();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

it("admits a fresh Project create behind the registry's initial migration on one application database", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "slopstop-application-authority-"));
  const barrier = migrationBarrier();
  const base = consentRegistryOptions(root);
  const applicationDatabase = createApplicationDatabaseAuthority({
    ...base,
    failures: barrier.failures,
  });
  const options = {
    ...base,
    applicationVersion: "0.0.0",
    failures: barrier.failures,
    applicationDatabase,
  };
  const registry = createRegistrationRegistry(options);
  const registration = createProjectRegistrationOwner(registry, options, root);
  const storage = createProjectStorageOwner(
    createNodeProjectStorageDependencies({
      ...base,
      applicationVersion: "0.0.0",
      applicationDatabase,
    }),
  );
  const request = decodeStrict(ProjectStorageCreateRequestSchema, {
    projectId: randomUUID(),
    createRequestId: randomUUID(),
  });
  try {
    const listing = registration.listProjects();
    await barrier.reached;
    const creating = storage.create(request);
    // The registry still holds its migration transaction; create must wait, not fail busy.
    const early = await Promise.race([creating, delay(250).then(() => "waiting" as const)]);
    barrier.open();

    await expectWaitingCreateCompleted(creating, early);
    await expectListedOnly(listing, request.projectId);
    await expectOpensAndCloses(storage, request.projectId);
  } finally {
    barrier.open();
    await storage.stop();
    await registration.close();
    await registry.stop();
    await applicationDatabase.stop();
  }

  // Journal mode is characterized as observed (ADR 0001 names WAL, nothing configures it):
  // the authority's single-statement read reasoning must be revisited if this changes.
  expect(readApplicationDatabase(path.join(base.applicationStorageRoot, "application.db"))).toEqual(
    {
      journalMode: { journal_mode: "delete" },
      metadata: [{ metadata_key: "application", last_migration_id: "0007_storage_upgrades" }],
    },
  );

  await expectReopenedListing(base, root, request.projectId);
});

it("refuses a schema-less application database left by an interrupted start without touching it", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "slopstop-application-authority-empty-"));
  const base = consentRegistryOptions(root);
  const databasePath = path.join(base.applicationStorageRoot, "application.db");
  await mkdir(base.applicationStorageRoot, { recursive: true });
  await writeFile(databasePath, "");
  const applicationDatabase = createApplicationDatabaseAuthority(base);
  const options = { ...base, applicationVersion: "0.0.0", applicationDatabase };
  const registry = createRegistrationRegistry(options);
  const registration = createProjectRegistrationOwner(registry, options, root);
  const storage = createProjectStorageOwner(createNodeProjectStorageDependencies(options));
  try {
    const created = await storage.create(
      decodeStrict(ProjectStorageCreateRequestSchema, {
        projectId: randomUUID(),
        createRequestId: randomUUID(),
      }),
    );
    expect(created).toEqual({
      status: "broken",
      message: "Existing database has no migration authority.",
    });
    expect(await registration.listProjects()).toEqual({
      status: "broken",
      code: "REGISTRY_CORRUPT",
    });
  } finally {
    await storage.stop();
    await registration.close();
    await registry.stop();
    await applicationDatabase.stop();
  }
  expect((await readFile(databasePath)).byteLength).toBe(0);
  await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
});
