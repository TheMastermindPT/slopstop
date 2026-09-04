import { describe, expect, it } from "vitest";
import {
  applyGeneratedMigrations,
  type GeneratedMigration,
  type GeneratedMigrationTarget,
  type MigrationAuthority,
  type StorageDatabaseKind,
} from "./generated-migrations.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";

const expectedKind: StorageDatabaseKind = "application";
const expectedFormatVersion = 1;
const expectedSchemaVersion = 1;

function migrationFixture(...migrationIds: string[]): readonly GeneratedMigration[] {
  return migrationIds.map((migrationId) => ({
    migrationId,
    statements: [`-- ${migrationId}`],
  }));
}

function existingAuthority(
  lastMigrationId: string,
  overrides: Partial<Exclude<MigrationAuthority, { status: "fresh" }>> = {},
): MigrationAuthority {
  return {
    status: "existing",
    databaseKind: expectedKind,
    formatVersion: expectedFormatVersion,
    schemaVersion: expectedSchemaVersion,
    lastMigrationId,
    ...overrides,
  };
}

function migrationTargetFixture(authority: MigrationAuthority) {
  const batches: Parameters<GeneratedMigrationTarget["applyBatch"]>[0][] = [];
  const target: GeneratedMigrationTarget = {
    inspectAuthority: async () => authority,
    applyBatch: async (input) => {
      batches.push(input);
    },
  };
  return { target, appliedBatches: () => batches };
}

function migrationInput(
  fixture: ReturnType<typeof migrationTargetFixture>,
  migrations: readonly GeneratedMigration[],
) {
  return {
    target: fixture.target,
    expectedKind,
    expectedFormatVersion,
    expectedSchemaVersion,
    migrations,
  };
}

function expectedMigrationBatch(
  migrations: readonly GeneratedMigration[],
  lastMigrationId: string,
) {
  return {
    migrations,
    databaseKind: expectedKind,
    formatVersion: expectedFormatVersion,
    schemaVersion: expectedSchemaVersion,
    lastMigrationId,
  };
}

describe("generated migration authority", () => {
  it("applies only known pending migrations and rejects inconsistent authority", async () => {
    const migrations = migrationFixture("0000_initial", "0001_next");
    const fresh = migrationTargetFixture({ status: "fresh" });
    const current = migrationTargetFixture(existingAuthority("0001_next"));
    const pending = migrationTargetFixture(existingAuthority("0000_initial"));

    await applyGeneratedMigrations(migrationInput(fresh, migrations));
    await applyGeneratedMigrations(migrationInput(current, migrations));
    await applyGeneratedMigrations(migrationInput(pending, migrations));

    expect(fresh.appliedBatches()).toEqual([expectedMigrationBatch(migrations, "0001_next")]);
    expect(current.appliedBatches()).toEqual([]);
    expect(pending.appliedBatches()).toEqual([
      expectedMigrationBatch(migrations.slice(1), "0001_next"),
    ]);

    for (const authority of [
      existingAuthority("unknown"),
      existingAuthority("0001_next", { databaseKind: "canonical" }),
      existingAuthority("0001_next", { formatVersion: 0 }),
      existingAuthority("0001_next", { formatVersion: 2 }),
      existingAuthority("0001_next", { schemaVersion: 0 }),
      existingAuthority("0001_next", { schemaVersion: 2 }),
    ]) {
      const invalid = migrationTargetFixture(authority);
      await expect(applyGeneratedMigrations(migrationInput(invalid, migrations))).rejects.toThrow(
        ProjectStorageBrokenError,
      );
      expect(invalid.appliedBatches()).toEqual([]);
    }

    const empty = migrationTargetFixture({ status: "fresh" });
    await expect(applyGeneratedMigrations(migrationInput(empty, []))).rejects.toThrow(
      ProjectStorageBrokenError,
    );
    expect(empty.appliedBatches()).toEqual([]);
  });
});
