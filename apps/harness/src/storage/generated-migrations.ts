import { ProjectStorageBrokenError } from "./project-storage-errors.js";

export type StorageDatabaseKind = "application" | "canonical" | "runtime-adapter";

export type GeneratedMigration = Readonly<{
  migrationId: string;
  statements: readonly string[];
}>;

export type MigrationAuthority =
  | Readonly<{ status: "fresh" }>
  | Readonly<{
      status: "existing";
      databaseKind: StorageDatabaseKind;
      formatVersion: number;
      schemaVersion: number;
      lastMigrationId: string;
    }>;

export interface GeneratedMigrationTarget {
  inspectAuthority(): Promise<MigrationAuthority>;
  applyBatch(
    input: Readonly<{
      migrations: readonly GeneratedMigration[];
      databaseKind: StorageDatabaseKind;
      formatVersion: number;
      schemaVersion: number;
      lastMigrationId: string;
    }>,
  ): Promise<void>;
}

type GeneratedMigrationPlan = Readonly<{
  target: GeneratedMigrationTarget;
  expectedKind: StorageDatabaseKind;
  expectedFormatVersion: number;
  expectedSchemaVersion: number;
  migrations: readonly GeneratedMigration[];
}>;

function requireLastMigration(input: GeneratedMigrationPlan): GeneratedMigration {
  const lastMigration = input.migrations.at(-1);
  if (lastMigration === undefined) {
    throw new ProjectStorageBrokenError("No generated migration is available.");
  }
  return lastMigration;
}

function pendingMigrations(input: {
  plan: GeneratedMigrationPlan;
  authority: Extract<MigrationAuthority, { status: "existing" }>;
}): readonly GeneratedMigration[] {
  const { authority, plan } = input;
  if (
    authority.databaseKind !== plan.expectedKind ||
    authority.formatVersion > plan.expectedFormatVersion ||
    authority.schemaVersion > plan.expectedSchemaVersion
  ) {
    throw new ProjectStorageBrokenError("Database migration authority is incompatible.");
  }
  const currentIndex = plan.migrations.findIndex(
    (migration) => migration.migrationId === authority.lastMigrationId,
  );
  if (currentIndex < 0) {
    throw new ProjectStorageBrokenError("Database migration authority is unknown.");
  }
  if (
    authority.formatVersion !== plan.expectedFormatVersion ||
    authority.schemaVersion !== plan.expectedSchemaVersion
  ) {
    throw new ProjectStorageBrokenError("Current migration authority has inconsistent versions.");
  }
  return plan.migrations.slice(currentIndex + 1);
}

async function applyMigrationBatch(
  input: GeneratedMigrationPlan,
  migrations: readonly GeneratedMigration[],
): Promise<void> {
  const lastMigration = requireLastMigration(input);
  await input.target.applyBatch({
    migrations,
    databaseKind: input.expectedKind,
    formatVersion: input.expectedFormatVersion,
    schemaVersion: input.expectedSchemaVersion,
    lastMigrationId: lastMigration.migrationId,
  });
}

export async function applyGeneratedMigrations(input: GeneratedMigrationPlan): Promise<void> {
  requireLastMigration(input);
  const authority = await input.target.inspectAuthority();
  if (authority.status === "fresh") {
    await applyMigrationBatch(input, input.migrations);
    return;
  }
  const pending = pendingMigrations({ plan: input, authority });
  if (pending.length === 0) {
    return;
  }
  await applyMigrationBatch(input, pending);
}
