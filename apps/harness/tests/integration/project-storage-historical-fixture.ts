import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect } from "vitest";
import {
  parseProjectStorageManifest,
  serializeProjectStorageManifest,
} from "../../src/storage/project-storage-manifest.js";
import {
  checkedInMigrationRoot,
  fixedCreationIds,
  sha256File,
} from "./project-storage-create-fixture.js";
import {
  type ApplicationRootPath,
  generationPaths,
  openRequest,
} from "./project-storage-open-fixture.js";
import { previousApplicationRegistryTables } from "./registration-schema-fixture.js";

export const historicalMigrationPath = path.join(
  checkedInMigrationRoot,
  "canonical",
  "0000_fat_doctor_octopus.sql",
);
const historicalMetadata = {
  metadata_key: "canonical",
  database_kind: "canonical",
  format_version: 1,
  schema_version: 1,
  last_migration_id: "0000_fat_doctor_octopus",
};

export async function seedGenerationOneCanonical(root: ApplicationRootPath): Promise<void> {
  const paths = generationPaths(root);
  const manifest = parseProjectStorageManifest(await readFile(paths.manifest, "utf8"));
  const source = await readFile(historicalMigrationPath, "utf8");
  expect(createHash("sha256").update(source).digest("hex")).toBe(
    "e21883d8c39eb5012a6df799fb8d2f5182e9050bf3546e48bde57f90abf3942c",
  );
  await rm(paths.canonical);
  const database = new DatabaseSync(paths.canonical);
  try {
    database.exec(source);
    database
      .prepare("INSERT INTO schema_metadata VALUES (?, ?, ?, ?, ?)")
      .run("canonical", "canonical", 1, 1, "0000_fat_doctor_octopus");
    database
      .prepare("INSERT INTO storage_identity VALUES (?, ?, ?, ?, ?, ?)")
      .run(
        "storage",
        openRequest.projectId,
        fixedCreationIds.storageId,
        fixedCreationIds.generationId,
        fixedCreationIds.canonicalDatabaseLineageId,
        manifest.createdAt,
      );
    expect(database.prepare("SELECT * FROM schema_metadata").all()).toEqual([historicalMetadata]);
    expect(
      database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all(),
    ).toEqual([{ name: "schema_metadata" }, { name: "storage_identity" }]);
  } finally {
    database.close();
  }
  const bytes = await readFile(paths.canonical);
  await writeFile(
    paths.manifest,
    serializeProjectStorageManifest({
      ...manifest,
      canonical: {
        ...manifest.canonical,
        formatVersion: 1,
        schemaVersion: 1,
        lastMigrationId: "0000_fat_doctor_octopus",
        activationBaseline: {
          algorithm: "sha256",
          sizeBytes: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      },
    }),
  );
}

export function restorePreviousRegistryFixture(root: ApplicationRootPath): void {
  const database = new DatabaseSync(generationPaths(root).application);
  try {
    for (const table of [
      "registration_repository_trust",
      "registration_repository_selections",
      "registration_identity_consents",
      "registration_observer_outcomes",
      "registration_observer_terminals",
      "registration_observer_children",
      "registration_observer_intents",
      "registration_version_consents",
      "registration_executable_selections",
    ])
      database.exec(`DROP TABLE ${table}`);
    database.exec("UPDATE schema_metadata SET last_migration_id = '0000_gray_eddie_brock'");
    expect(
      database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all(),
    ).toEqual(previousApplicationRegistryTables.map((name) => ({ name })));
  } finally {
    database.close();
  }
}

export async function oldProjectFileHashes(root: ApplicationRootPath) {
  const paths = generationPaths(root);
  return Promise.all([paths.canonical, paths.runtime, paths.manifest].map(sha256File));
}
