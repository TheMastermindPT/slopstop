import type { StorageDatabaseKind } from "./generated-migrations.js";

type MigrationResourceKind = "application" | "canonical" | "runtime";

export type NamedCheckSpec = Readonly<{
  table: string;
  name: string;
  expression: string;
}>;

export type NamedIndexSpec = Readonly<{
  table: string;
  name: string;
  unique: boolean;
  partial: boolean;
  columns: readonly string[];
  predicate: string | null;
}>;

export type ForeignKeySpec = Readonly<{
  table: string;
  columns: readonly string[];
  referencedTable: string;
  referencedColumns: readonly string[];
  onUpdate: "NO ACTION" | "RESTRICT";
  onDelete: "NO ACTION" | "RESTRICT";
  match: "NONE";
}>;

export type DatabaseSpec = Readonly<{
  resourceKind: MigrationResourceKind;
  databaseKind: StorageDatabaseKind;
  metadataTable: "schema_metadata" | "slopstop_runtime_schema_metadata";
  metadataKey: "application" | "canonical" | "slopstop-runtime-adapter";
  formatVersion: number;
  schemaVersion: number;
  tables: readonly string[];
  checks: readonly NamedCheckSpec[];
  indexes: readonly NamedIndexSpec[];
  foreignKeys: readonly ForeignKeySpec[];
}>;

function column(table: string, name: string): string {
  return `"${table}"."${name}"`;
}

function namedCheck(table: string, name: string, expression: string): NamedCheckSpec {
  return { table, name, expression };
}

function identityExpression(table: string, columnName: string): string {
  const value = column(table, columnName);
  return `
    length(${value}) = 36
    and ${value} = lower(${value})
    and substr(${value}, 1, 8) not glob '*[^0-9a-f]*'
    and substr(${value}, 9, 1) = '-'
    and substr(${value}, 10, 4) not glob '*[^0-9a-f]*'
    and substr(${value}, 14, 1) = '-'
    and substr(${value}, 15, 1) glob '[1-8]'
    and substr(${value}, 16, 3) not glob '*[^0-9a-f]*'
    and substr(${value}, 19, 1) = '-'
    and substr(${value}, 20, 1) glob '[89ab]'
    and substr(${value}, 21, 3) not glob '*[^0-9a-f]*'
    and substr(${value}, 24, 1) = '-'
    and substr(${value}, 25, 12) not glob '*[^0-9a-f]*'
  `;
}

function identityCheck(table: string, name: string, columnName: string): NamedCheckSpec {
  return namedCheck(table, name, identityExpression(table, columnName));
}

const applicationChecks: readonly NamedCheckSpec[] = [
  namedCheck(
    "schema_metadata",
    "application_metadata_key",
    `${column("schema_metadata", "metadata_key")} = 'application'`,
  ),
  namedCheck(
    "schema_metadata",
    "application_metadata_kind",
    `${column("schema_metadata", "database_kind")} = 'application'`,
  ),
  namedCheck(
    "schema_metadata",
    "application_format_nonnegative",
    `${column("schema_metadata", "format_version")} >= 0`,
  ),
  namedCheck(
    "schema_metadata",
    "application_schema_nonnegative",
    `${column("schema_metadata", "schema_version")} >= 0`,
  ),
  namedCheck(
    "schema_metadata",
    "application_migration_nonempty",
    `length(trim(${column("schema_metadata", "last_migration_id")})) > 0`,
  ),
  identityCheck("storage_locations", "storage_locations_storage_id_uuid", "storage_id"),
  identityCheck("storage_locations", "storage_locations_location_id_uuid", "location_id"),
  namedCheck(
    "storage_locations",
    "storage_locations_state",
    `${column("storage_locations", "location_state")} in ('staging', 'committed')`,
  ),
  identityCheck("storage_generations", "storage_generations_storage_id_uuid", "storage_id"),
  identityCheck("storage_generations", "storage_generations_generation_id_uuid", "generation_id"),
  identityCheck("storage_generations", "storage_generations_project_id_uuid", "project_id"),
  identityCheck("storage_generations", "storage_generations_location_id_uuid", "location_id"),
  identityCheck(
    "storage_generations",
    "storage_generations_canonical_lineage_uuid",
    "canonical_lineage_id",
  ),
  identityCheck(
    "storage_generations",
    "storage_generations_runtime_lineage_uuid",
    "runtime_lineage_id",
  ),
  identityCheck(
    "storage_generations",
    "storage_generations_create_request_uuid",
    "create_request_id",
  ),
  namedCheck(
    "storage_generations",
    "storage_generations_fingerprint_sha256",
    `
      length(${column("storage_generations", "create_request_fingerprint")}) = 64
      and ${column("storage_generations", "create_request_fingerprint")} = lower(${column("storage_generations", "create_request_fingerprint")})
      and ${column("storage_generations", "create_request_fingerprint")} not glob '*[^0-9a-f]*'
    `,
  ),
  namedCheck(
    "storage_generations",
    "storage_generations_directory_identity",
    `${column("storage_generations", "generation_directory_name")} = ${column("storage_generations", "generation_id")}`,
  ),
  namedCheck(
    "storage_generations",
    "storage_generations_activation_time",
    `
      (${column("storage_generations", "creation_state")} = 'active' and ${column("storage_generations", "activated_at")} is not null)
      or (${column("storage_generations", "creation_state")} = 'staging' and ${column("storage_generations", "activated_at")} is null)
    `,
  ),
  identityCheck("storage_registrations", "storage_registrations_storage_id_uuid", "storage_id"),
  identityCheck("storage_registrations", "storage_registrations_project_id_uuid", "project_id"),
  namedCheck(
    "storage_registrations",
    "storage_registrations_active_pair",
    `
      (
        ${column("storage_registrations", "active_generation_id")} is null
        and ${column("storage_registrations", "active_location_id")} is null
        and ${column("storage_registrations", "activated_at")} is null
      )
      or (
        ${column("storage_registrations", "active_generation_id")} is not null
        and ${column("storage_registrations", "active_location_id")} is not null
        and ${column("storage_registrations", "activated_at")} is not null
      )
    `,
  ),
];

const canonicalChecks: readonly NamedCheckSpec[] = [
  namedCheck(
    "schema_metadata",
    "canonical_metadata_key",
    `${column("schema_metadata", "metadata_key")} = 'canonical'`,
  ),
  namedCheck(
    "schema_metadata",
    "canonical_metadata_kind",
    `${column("schema_metadata", "database_kind")} = 'canonical'`,
  ),
  namedCheck(
    "schema_metadata",
    "canonical_format_nonnegative",
    `${column("schema_metadata", "format_version")} >= 0`,
  ),
  namedCheck(
    "schema_metadata",
    "canonical_schema_nonnegative",
    `${column("schema_metadata", "schema_version")} >= 0`,
  ),
  namedCheck(
    "schema_metadata",
    "canonical_migration_nonempty",
    `length(trim(${column("schema_metadata", "last_migration_id")})) > 0`,
  ),
  namedCheck(
    "storage_identity",
    "canonical_identity_singleton",
    `${column("storage_identity", "identity_key")} = 'storage'`,
  ),
  identityCheck("storage_identity", "canonical_identity_project_uuid", "project_id"),
  identityCheck("storage_identity", "canonical_identity_storage_uuid", "storage_id"),
  identityCheck("storage_identity", "canonical_identity_generation_uuid", "generation_id"),
  identityCheck(
    "storage_identity",
    "canonical_identity_lineage_uuid",
    "canonical_database_lineage_id",
  ),
];

const runtimeChecks: readonly NamedCheckSpec[] = [
  namedCheck(
    "slopstop_runtime_schema_metadata",
    "runtime_metadata_key",
    `${column("slopstop_runtime_schema_metadata", "metadata_key")} = 'slopstop-runtime-adapter'`,
  ),
  namedCheck(
    "slopstop_runtime_schema_metadata",
    "runtime_metadata_kind",
    `${column("slopstop_runtime_schema_metadata", "database_kind")} = 'runtime-adapter'`,
  ),
  namedCheck(
    "slopstop_runtime_schema_metadata",
    "runtime_format_nonnegative",
    `${column("slopstop_runtime_schema_metadata", "format_version")} >= 0`,
  ),
  namedCheck(
    "slopstop_runtime_schema_metadata",
    "runtime_schema_nonnegative",
    `${column("slopstop_runtime_schema_metadata", "schema_version")} >= 0`,
  ),
  namedCheck(
    "slopstop_runtime_schema_metadata",
    "runtime_migration_nonempty",
    `length(trim(${column("slopstop_runtime_schema_metadata", "last_migration_id")})) > 0`,
  ),
  namedCheck(
    "slopstop_runtime_storage_identity",
    "runtime_identity_singleton",
    `${column("slopstop_runtime_storage_identity", "identity_key")} = 'storage'`,
  ),
  identityCheck("slopstop_runtime_storage_identity", "runtime_identity_project_uuid", "project_id"),
  identityCheck("slopstop_runtime_storage_identity", "runtime_identity_storage_uuid", "storage_id"),
  identityCheck(
    "slopstop_runtime_storage_identity",
    "runtime_identity_generation_uuid",
    "generation_id",
  ),
  identityCheck(
    "slopstop_runtime_storage_identity",
    "runtime_identity_lineage_uuid",
    "runtime_database_lineage_id",
  ),
];

export const databaseSpecs = {
  application: {
    resourceKind: "application",
    databaseKind: "application",
    metadataTable: "schema_metadata",
    metadataKey: "application",
    formatVersion: 1,
    schemaVersion: 1,
    tables: [
      "schema_metadata",
      "storage_generations",
      "storage_locations",
      "storage_registrations",
    ],
    checks: applicationChecks,
    indexes: [
      {
        table: "storage_locations",
        name: "storage_locations_normalized_path_uq",
        unique: true,
        partial: false,
        columns: ["normalized_path"],
        predicate: null,
      },
      {
        table: "storage_generations",
        name: "storage_generations_create_request_uq",
        unique: true,
        partial: false,
        columns: ["create_request_id"],
        predicate: null,
      },
      {
        table: "storage_generations",
        name: "storage_generations_directory_uq",
        unique: true,
        partial: false,
        columns: ["storage_id", "generation_directory_name"],
        predicate: null,
      },
      {
        table: "storage_generations",
        name: "storage_generations_one_active_uq",
        unique: true,
        partial: true,
        columns: ["storage_id"],
        predicate: `${column("storage_generations", "creation_state")} = 'active'`,
      },
      {
        table: "storage_generations",
        name: "storage_generations_project_idx",
        unique: false,
        partial: false,
        columns: ["project_id"],
        predicate: null,
      },
      {
        table: "storage_generations",
        name: "storage_generations_state_idx",
        unique: false,
        partial: false,
        columns: ["storage_id", "creation_state"],
        predicate: null,
      },
      {
        table: "storage_registrations",
        name: "storage_registrations_project_uq",
        unique: true,
        partial: false,
        columns: ["project_id"],
        predicate: null,
      },
    ],
    foreignKeys: [
      {
        table: "storage_generations",
        columns: ["storage_id", "location_id"],
        referencedTable: "storage_locations",
        referencedColumns: ["storage_id", "location_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "storage_registrations",
        columns: ["storage_id", "active_generation_id"],
        referencedTable: "storage_generations",
        referencedColumns: ["storage_id", "generation_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "storage_registrations",
        columns: ["storage_id", "active_location_id"],
        referencedTable: "storage_locations",
        referencedColumns: ["storage_id", "location_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
    ],
  },
  canonical: {
    resourceKind: "canonical",
    databaseKind: "canonical",
    metadataTable: "schema_metadata",
    metadataKey: "canonical",
    formatVersion: 1,
    schemaVersion: 1,
    tables: ["schema_metadata", "storage_identity"],
    checks: canonicalChecks,
    indexes: [],
    foreignKeys: [],
  },
  runtime: {
    resourceKind: "runtime",
    databaseKind: "runtime-adapter",
    metadataTable: "slopstop_runtime_schema_metadata",
    metadataKey: "slopstop-runtime-adapter",
    formatVersion: 1,
    schemaVersion: 1,
    tables: ["slopstop_runtime_schema_metadata", "slopstop_runtime_storage_identity"],
    checks: runtimeChecks,
    indexes: [],
    foreignKeys: [],
  },
} as const satisfies Record<MigrationResourceKind, DatabaseSpec>;
