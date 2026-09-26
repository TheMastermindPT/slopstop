import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { GitVersionInspectionRequestSchema } from "../../src/project-registration-observer.js";
import { createRegistrationRegistry } from "../../src/registration/registration-registry.js";
import { loadGeneratedMigrations } from "../../src/storage/generated-migration-resources.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import { databaseSpecs } from "../../src/storage/project-storage-database-specs.js";

const migrationResourcesRoot = fileURLToPath(new URL("../../drizzle", import.meta.url));

export const inconsistentActiveRegistryCases = [
  ["staging location", "UPDATE storage_locations SET location_state = 'staging'"],
  [
    "inactive generation",
    "UPDATE storage_generations SET creation_state = 'staging', activated_at = NULL",
  ],
  [
    "unselected active generation",
    "UPDATE storage_registrations SET active_generation_id = NULL, active_location_id = NULL, activated_at = NULL",
  ],
  [
    "different activation time",
    "UPDATE storage_registrations SET activated_at = '2026-09-13T00:00:02.000Z'",
  ],
];

export async function inspectRegistryAfterStatements(root: string, statements: readonly string[]) {
  await createPreviousRegistry(root);
  const edit = createWorkerLocalLibsqlClient(path.join(root, "application.db"), "application");
  try {
    for (const statement of statements) await edit.execute(statement);
  } finally {
    await edit.close();
  }
  const registry = createRegistrationRegistry({
    applicationStorageRoot: root,
    migrationResourcesRoot,
  });
  try {
    const request = GitVersionInspectionRequestSchema.parse({
      selectionId: "a728db30-50c9-4aef-a5d6-9a70536314fe",
      consentId: null,
    });
    const outcome = await registry.prepareExecutable({
      selectionId: request.selectionId,
      executablePath: path.join(root, "absent.exe"),
    });
    return { root, outcome };
  } finally {
    await registry.stop();
  }
}

export async function expectIndependentUnsettled(root: string, expected: boolean) {
  const independent = createRegistrationRegistry({
    applicationStorageRoot: root,
    migrationResourcesRoot,
  });
  try {
    expect(await independent.hasUnsettled()).toBe(expected);
  } finally {
    await independent.stop();
  }
}

export async function seedMismatchedRegistryGeneration(root: string) {
  const edit = createWorkerLocalLibsqlClient(path.join(root, "application.db"), "application");
  try {
    await edit.execute(`INSERT INTO storage_locations VALUES (
      'ac921347-174a-488a-adde-3e409633b6d8', '18a7fc22-a815-4483-a97f-f2e26bc404ac',
      'preserved-old-location', 'staging', '2026-09-13T00:00:00.000Z')`);
    await edit.execute(`INSERT INTO storage_generations VALUES (
      'ac921347-174a-488a-adde-3e409633b6d8', 'af014d19-d5b2-4178-9904-6aeb9bc58836',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '18a7fc22-a815-4483-a97f-f2e26bc404ac',
      'ce0ee557-2a03-40df-a555-56a8c06c6d95', 'b8d05c2c-f1cc-4d39-9a6e-3b9808083b4f',
      '8d83d088-6a5b-4050-84c5-bc878bbda931', '${"a".repeat(64)}',
      'af014d19-d5b2-4178-9904-6aeb9bc58836', 'staging', '2026-09-13T00:00:00.000Z', NULL)`);
    expect((await edit.execute("PRAGMA foreign_key_check")).rows).toEqual([]);
  } finally {
    await edit.close();
  }
}

export async function createPreviousRegistry(root: string): Promise<void> {
  const migrations = await loadGeneratedMigrations(
    fileURLToPath(new URL("../../drizzle", import.meta.url)),
    databaseSpecs.application,
  );
  const first = migrations.find((migration) => migration.migrationId === "0000_gray_eddie_brock");
  if (first === undefined) throw new Error("Previous registry migration is unavailable");
  const client = createWorkerLocalLibsqlClient(path.join(root, "application.db"), "application");
  try {
    for (const statement of first.statements) await client.execute(statement);
    await client.execute({
      sql: "INSERT INTO schema_metadata VALUES (?, ?, ?, ?, ?)",
      args: ["application", "application", 1, 1, "0000_gray_eddie_brock"],
    });
    await client.execute({
      sql: "INSERT INTO storage_registrations (storage_id, project_id, created_at) VALUES (?, ?, ?)",
      args: [
        "ac921347-174a-488a-adde-3e409633b6d8",
        "71938cf7-9874-4dd8-8f10-7507a8ef9a82",
        "2026-09-13T00:00:00.000Z",
      ],
    });
  } finally {
    await client.close();
  }
}

export async function expectPreservedRegistryRows(root: string, initial: "fresh" | "previous") {
  const check = createWorkerLocalLibsqlClient(path.join(root, "application.db"), "application");
  try {
    expect((await check.execute("SELECT last_migration_id FROM schema_metadata")).rows).toEqual([
      ["0001_project_registration"],
    ]);
    expect(
      (
        await check.execute(
          "SELECT storage_id, project_id, active_generation_id, active_location_id, created_at, activated_at FROM storage_registrations",
        )
      ).rows,
    ).toEqual(
      initial === "previous"
        ? [
            [
              "ac921347-174a-488a-adde-3e409633b6d8",
              "71938cf7-9874-4dd8-8f10-7507a8ef9a82",
              null,
              null,
              "2026-09-13T00:00:00.000Z",
              null,
            ],
          ]
        : [],
    );
  } finally {
    await check.close();
  }
}

export const previousApplicationRegistryTables = [
  "schema_metadata",
  "storage_generations",
  "storage_locations",
  "storage_registrations",
] as const;

export const applicationRegistrationTables = [
  "registration_executable_selections",
  "registration_identity_consents",
  "registration_observer_children",
  "registration_observer_intents",
  "registration_observer_outcomes",
  "registration_observer_terminals",
  "registration_repository_selections",
  "registration_repository_trust",
  "registration_version_consents",
  ...previousApplicationRegistryTables,
];

export async function readPreviousRegistryState(root: string) {
  const client = createWorkerLocalLibsqlClient(path.join(root, "application.db"), "application");
  try {
    const schema = await client.execute(
      "SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name",
    );
    const rows = [];
    for (const table of previousApplicationRegistryTables) {
      rows.push((await client.execute(`SELECT * FROM ${table} ORDER BY 1, 2`)).rows);
    }
    return { schema: schema.rows, rows };
  } finally {
    await client.close();
  }
}

export async function seedActiveRegistryGeneration(root: string) {
  const client = createWorkerLocalLibsqlClient(path.join(root, "application.db"), "application");
  try {
    await client.execute(`INSERT INTO storage_locations VALUES (
      'ac921347-174a-488a-adde-3e409633b6d8', '18a7fc22-a815-4483-a97f-f2e26bc404ac',
      'preserved-old-location', 'committed', '2026-09-13T00:00:00.000Z')`);
    await client.execute(`INSERT INTO storage_generations VALUES (
      'ac921347-174a-488a-adde-3e409633b6d8', 'af014d19-d5b2-4178-9904-6aeb9bc58836',
      '71938cf7-9874-4dd8-8f10-7507a8ef9a82', '18a7fc22-a815-4483-a97f-f2e26bc404ac',
      'ce0ee557-2a03-40df-a555-56a8c06c6d95', 'b8d05c2c-f1cc-4d39-9a6e-3b9808083b4f',
      '8d83d088-6a5b-4050-84c5-bc878bbda931', '${"a".repeat(64)}',
      'af014d19-d5b2-4178-9904-6aeb9bc58836', 'active',
      '2026-09-13T00:00:00.000Z', '2026-09-13T00:00:01.000Z')`);
    await client.execute(`UPDATE storage_registrations SET
      active_generation_id = 'af014d19-d5b2-4178-9904-6aeb9bc58836',
      active_location_id = '18a7fc22-a815-4483-a97f-f2e26bc404ac',
      activated_at = '2026-09-13T00:00:01.000Z'`);
  } finally {
    await client.close();
  }
}
