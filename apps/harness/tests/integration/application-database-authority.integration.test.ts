import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
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

    const created = await creating;
    expect({
      early: early === "waiting" ? early : "settled",
      created: created.status,
      message: created.status === "ready" ? undefined : created.message,
    }).toEqual({ early: "waiting", created: "ready", message: undefined });
    if (created.status !== "ready") throw new Error("Project create did not complete.");
    expect(decodeStrict(ProjectStorageCreateResultSchema, created.result).status).toBe("created");
    const listed = await listing;
    expect(listed.status).toBe("listed");
    if (listed.status !== "listed") throw new Error("Project listing did not complete.");
    for (const project of listed.projects) expect(project.projectId).toBe(request.projectId);

    const opened = await storage.open({ projectId: request.projectId });
    if (opened.status !== "ready") throw new Error("Project open did not complete.");
    expect(decodeStrict(ProjectStorageOpenResultSchema, opened.result).status).toBe("opened");
    expect((await storage.close({ projectId: request.projectId })).status).toBe("ready");
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
      metadata: [
        { metadata_key: "application", last_migration_id: "0005_registration_publications" },
      ],
    },
  );

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
      projects: [{ registration: "unbound", projectId: request.projectId }],
    });
  } finally {
    await reopenedRegistration.close();
    await reopenedRegistry.stop();
    await reopenedDatabase.stop();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});
