import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import { consentRegistryOptions } from "./registration-consent-fixture.js";
import { createPreviousRegistry } from "./registration-schema-fixture.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

const throughPublications = [
  "0001_project_registration",
  "0002_identity_query_attempts",
  "0003_registration_proposals",
  "0004_registration_reservations",
  "0005_registration_publications",
];

it("extends the exact 0005 registry with list visibility without replacing old rows", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-visibility-upgrade-"));
  roots.push(root);
  const options = consentRegistryOptions(root);
  await mkdir(options.applicationStorageRoot);
  await createPreviousRegistry(options.applicationStorageRoot);
  const database = createWorkerLocalLibsqlClient(
    path.join(options.applicationStorageRoot, "application.db"),
    "application",
  );
  try {
    for (const migration of throughPublications) {
      const sql = await readFile(
        path.join(options.migrationResourcesRoot, `application/${migration}.sql`),
        "utf8",
      );
      for (const statement of sql.split("--> statement-breakpoint"))
        if (statement.trim()) await database.execute(statement);
    }
    await database.execute({
      sql: "UPDATE schema_metadata SET last_migration_id = ?",
      args: ["0005_registration_publications"],
    });
    const before = (await database.execute("SELECT * FROM storage_registrations")).rows;
    const registry = createRegistrationRegistry(options);
    try {
      expect(await registry.hasUnsettled()).toBe(false);
      expect((await database.execute("SELECT * FROM storage_registrations")).rows).toEqual(before);
      expect(
        (await database.execute("SELECT last_migration_id FROM schema_metadata")).rows,
      ).toEqual([["0006_registration_list_visibility"]]);
      expect(
        (await database.execute("SELECT count(*) FROM registration_list_visibility")).rows,
      ).toEqual([[0]]);
    } finally {
      await registry.stop();
    }
  } finally {
    await database.close();
  }
});
