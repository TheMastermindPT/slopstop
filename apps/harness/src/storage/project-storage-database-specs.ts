import type { StorageDatabaseKind } from "./generated-migrations.js";

type MigrationResourceKind = "application" | "canonical" | "runtime";

export type ColumnSpec = Readonly<{
  table: string;
  cid: number;
  name: string;
  type: string;
  notNull: 0 | 1;
  defaultValue: string | null;
  primaryKey: number;
  hidden: number;
}>;

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
  columns: readonly ColumnSpec[];
  checks: readonly NamedCheckSpec[];
  indexes: readonly NamedIndexSpec[];
  foreignKeys: readonly ForeignKeySpec[];
}>;

type ColumnDefinition = readonly [
  name: string,
  type: "integer" | "text",
  notNull: 0 | 1,
  primaryKey: number,
  defaultValue?: string | null,
  hidden?: number,
];

type TableDefinition = Readonly<{ table: string; definitions: readonly ColumnDefinition[] }>;

function tableColumns(input: TableDefinition): readonly ColumnSpec[] {
  const { table, definitions } = input;
  return definitions.map(
    ([name, type, notNull, primaryKey, defaultValue = null, hidden = 0], cid) => ({
      table,
      cid,
      name,
      type: type.toUpperCase(),
      notNull,
      defaultValue,
      primaryKey,
      hidden,
    }),
  );
}

const schemaMetadataColumnDefinitions = [
  ["metadata_key", "text", 1, 1],
  ["database_kind", "text", 1, 0],
  ["format_version", "integer", 1, 0],
  ["schema_version", "integer", 1, 0],
  ["last_migration_id", "text", 1, 0],
] as const satisfies readonly ColumnDefinition[];

const applicationColumns: readonly ColumnSpec[] = [
  ...tableColumns({ table: "schema_metadata", definitions: schemaMetadataColumnDefinitions }),
  ...tableColumns({
    table: "storage_locations",
    definitions: [
      ["storage_id", "text", 1, 1],
      ["location_id", "text", 1, 2],
      ["normalized_path", "text", 1, 0],
      ["location_state", "text", 1, 0],
      ["observed_at", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: "storage_generations",
    definitions: [
      ["storage_id", "text", 1, 1],
      ["generation_id", "text", 1, 2],
      ["project_id", "text", 1, 0],
      ["location_id", "text", 1, 0],
      ["canonical_lineage_id", "text", 1, 0],
      ["runtime_lineage_id", "text", 1, 0],
      ["create_request_id", "text", 1, 0],
      ["create_request_fingerprint", "text", 1, 0],
      ["generation_directory_name", "text", 1, 0],
      ["creation_state", "text", 1, 0],
      ["created_at", "text", 1, 0],
      ["activated_at", "text", 0, 0],
    ],
  }),
  ...tableColumns({
    table: "storage_registrations",
    definitions: [
      ["storage_id", "text", 1, 1],
      ["project_id", "text", 1, 0],
      ["active_generation_id", "text", 0, 0],
      ["active_location_id", "text", 0, 0],
      ["created_at", "text", 1, 0],
      ["activated_at", "text", 0, 0],
    ],
  }),
];

const canonicalColumns: readonly ColumnSpec[] = [
  ...tableColumns({ table: "schema_metadata", definitions: schemaMetadataColumnDefinitions }),
  ...tableColumns({
    table: "project_state",
    definitions: [
      ["project_id", "text", 1, 1],
      ["last_project_sequence", "integer", 1, 0],
      ["last_writer_generation", "integer", 1, 0],
      ["created_at", "text", 1, 0],
      ["updated_at", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: "storage_identity",
    definitions: [
      ["identity_key", "text", 1, 2],
      ["project_id", "text", 1, 1],
      ["storage_id", "text", 1, 0],
      ["generation_id", "text", 1, 0],
      ["canonical_database_lineage_id", "text", 1, 0],
      ["created_at", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: "writer_generations",
    definitions: [
      ["project_id", "text", 1, 1],
      ["writer_generation", "integer", 1, 2],
      ["activation_id", "text", 1, 0],
      ["token_digest", "text", 1, 0],
      ["acquired_at", "text", 1, 0],
      ["released_at", "text", 0, 0],
    ],
  }),
  ...tableColumns({
    table: "writer_fence",
    definitions: [
      ["project_id", "text", 1, 1],
      ["writer_generation", "integer", 1, 0],
      ["token_digest", "text", 1, 0],
      ["state", "text", 1, 0],
      ["activated_at", "text", 1, 0],
      ["released_at", "text", 0, 0],
    ],
  }),
  ...tableColumns({
    table: "writer_handoffs",
    definitions: [
      ["project_id", "text", 1, 1],
      ["handoff_id", "text", 1, 2],
      ["from_writer_generation", "integer", 0, 0],
      ["to_writer_generation", "integer", 1, 0],
      ["kind", "text", 1, 0],
      ["recorded_at", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: "writer_recovery_records",
    definitions: [
      ["project_id", "text", 1, 1],
      ["recovery_record_id", "text", 1, 2],
      ["writer_generation", "integer", 1, 0],
      ["reason", "text", 1, 0],
      ["command_id", "text", 0, 0],
      ["command_fingerprint", "text", 0, 0],
      ["observed_at", "text", 1, 0],
      ["resolution", "text", 0, 0],
      ["resolved_by_writer_generation", "integer", 0, 0],
      ["resolved_at", "text", 0, 0],
    ],
  }),
  ...tableColumns({
    table: "command_receipts",
    definitions: [
      ["project_id", "text", 1, 1],
      ["receipt_id", "text", 1, 2],
      ["command_id", "text", 1, 0],
      ["command_type", "text", 1, 0],
      ["command_version", "integer", 1, 0],
      ["command_fingerprint", "text", 1, 0],
      ["outcome", "text", 1, 0],
      ["project_sequence", "integer", 1, 0],
      ["writer_generation", "integer", 1, 0],
      ["settled_at", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: "command_idempotency",
    definitions: [
      ["project_id", "text", 1, 1],
      ["command_id", "text", 1, 2],
      ["original_command_fingerprint", "text", 1, 0],
      ["original_receipt_id", "text", 1, 0],
      ["created_at", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: "command_rejections",
    definitions: [
      ["project_id", "text", 1, 1],
      ["receipt_id", "text", 1, 2],
      ["receipt_outcome", "text", 1, 0],
      ["project_sequence", "integer", 1, 0],
      ["rejection_code", "text", 1, 0],
      ["retryable", "integer", 1, 0],
      ["details_json", "text", 1, 0],
      ["details_hash", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: "canonical_events",
    definitions: [
      ["project_id", "text", 1, 1],
      ["event_id", "text", 1, 2],
      ["receipt_id", "text", 1, 0],
      ["receipt_outcome", "text", 1, 0],
      ["project_sequence", "integer", 1, 0],
      ["event_ordinal", "integer", 1, 0],
      ["aggregate_type", "text", 1, 0],
      ["aggregate_id", "text", 1, 0],
      ["aggregate_version", "integer", 1, 0],
      ["event_type", "text", 1, 0],
      ["event_version", "integer", 1, 0],
      ["payload_json", "text", 1, 0],
      ["payload_hash", "text", 1, 0],
      ["occurred_at", "text", 1, 0],
    ],
  }),
];

const runtimeColumns: readonly ColumnSpec[] = [
  ...tableColumns({
    table: "slopstop_runtime_schema_metadata",
    definitions: schemaMetadataColumnDefinitions,
  }),
  ...tableColumns({
    table: "slopstop_runtime_storage_identity",
    definitions: [
      ["identity_key", "text", 1, 1],
      ["project_id", "text", 1, 0],
      ["storage_id", "text", 1, 0],
      ["generation_id", "text", 1, 0],
      ["runtime_database_lineage_id", "text", 1, 0],
      ["created_at", "text", 1, 0],
    ],
  }),
];

function column(reference: Pick<ColumnSpec, "table" | "name">): string {
  return `"${reference.table}"."${reference.name}"`;
}

function namedCheck(table: string, name: string, expression: string): NamedCheckSpec {
  return { table, name, expression };
}

function identityExpression(reference: Pick<ColumnSpec, "table" | "name">): string {
  const value = column(reference);
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

function identityCheck(
  input: Readonly<{ table: string; name: string; columnName: string }>,
): NamedCheckSpec {
  const { table, name, columnName } = input;
  return namedCheck(table, name, identityExpression({ table, name: columnName }));
}

function nonemptyTextExpression(reference: Pick<ColumnSpec, "table" | "name">): string {
  return `length(trim(${column(reference)})) > 0`;
}

function sha256Expression(reference: Pick<ColumnSpec, "table" | "name">): string {
  const value = column(reference);
  return `length(${value}) = 64 and ${value} = lower(${value}) and ${value} not glob '*[^0-9a-f]*'`;
}

function nonnegativeSafeIntegerExpression(reference: Pick<ColumnSpec, "table" | "name">): string {
  const value = column(reference);
  return `typeof(${value}) = 'integer' and ${value} >= 0 and ${value} <= 9007199254740991`;
}

function positiveSafeIntegerExpression(reference: Pick<ColumnSpec, "table" | "name">): string {
  const value = column(reference);
  return `typeof(${value}) = 'integer' and ${value} > 0 and ${value} <= 9007199254740991`;
}

const applicationChecks: readonly NamedCheckSpec[] = [
  namedCheck(
    "schema_metadata",
    "application_metadata_key",
    `${column({ table: "schema_metadata", name: "metadata_key" })} = 'application'`,
  ),
  namedCheck(
    "schema_metadata",
    "application_metadata_kind",
    `${column({ table: "schema_metadata", name: "database_kind" })} = 'application'`,
  ),
  namedCheck(
    "schema_metadata",
    "application_format_nonnegative",
    `${column({ table: "schema_metadata", name: "format_version" })} >= 0`,
  ),
  namedCheck(
    "schema_metadata",
    "application_schema_nonnegative",
    `${column({ table: "schema_metadata", name: "schema_version" })} >= 0`,
  ),
  namedCheck(
    "schema_metadata",
    "application_migration_nonempty",
    `length(trim(${column({ table: "schema_metadata", name: "last_migration_id" })})) > 0`,
  ),
  identityCheck({
    table: "storage_locations",
    name: "storage_locations_storage_id_uuid",
    columnName: "storage_id",
  }),
  identityCheck({
    table: "storage_locations",
    name: "storage_locations_location_id_uuid",
    columnName: "location_id",
  }),
  namedCheck(
    "storage_locations",
    "storage_locations_state",
    `${column({ table: "storage_locations", name: "location_state" })} in ('staging', 'committed')`,
  ),
  identityCheck({
    table: "storage_generations",
    name: "storage_generations_storage_id_uuid",
    columnName: "storage_id",
  }),
  identityCheck({
    table: "storage_generations",
    name: "storage_generations_generation_id_uuid",
    columnName: "generation_id",
  }),
  identityCheck({
    table: "storage_generations",
    name: "storage_generations_project_id_uuid",
    columnName: "project_id",
  }),
  identityCheck({
    table: "storage_generations",
    name: "storage_generations_location_id_uuid",
    columnName: "location_id",
  }),
  identityCheck({
    table: "storage_generations",
    name: "storage_generations_canonical_lineage_uuid",
    columnName: "canonical_lineage_id",
  }),
  identityCheck({
    table: "storage_generations",
    name: "storage_generations_runtime_lineage_uuid",
    columnName: "runtime_lineage_id",
  }),
  identityCheck({
    table: "storage_generations",
    name: "storage_generations_create_request_uuid",
    columnName: "create_request_id",
  }),
  namedCheck(
    "storage_generations",
    "storage_generations_fingerprint_sha256",
    `
      length(${column({ table: "storage_generations", name: "create_request_fingerprint" })}) = 64
      and ${column({ table: "storage_generations", name: "create_request_fingerprint" })} = lower(${column({ table: "storage_generations", name: "create_request_fingerprint" })})
      and ${column({ table: "storage_generations", name: "create_request_fingerprint" })} not glob '*[^0-9a-f]*'
    `,
  ),
  namedCheck(
    "storage_generations",
    "storage_generations_directory_identity",
    `${column({ table: "storage_generations", name: "generation_directory_name" })} = ${column({ table: "storage_generations", name: "generation_id" })}`,
  ),
  namedCheck(
    "storage_generations",
    "storage_generations_activation_time",
    `
      (${column({ table: "storage_generations", name: "creation_state" })} = 'active' and ${column({ table: "storage_generations", name: "activated_at" })} is not null)
      or (${column({ table: "storage_generations", name: "creation_state" })} = 'staging' and ${column({ table: "storage_generations", name: "activated_at" })} is null)
    `,
  ),
  identityCheck({
    table: "storage_registrations",
    name: "storage_registrations_storage_id_uuid",
    columnName: "storage_id",
  }),
  identityCheck({
    table: "storage_registrations",
    name: "storage_registrations_project_id_uuid",
    columnName: "project_id",
  }),
  namedCheck(
    "storage_registrations",
    "storage_registrations_active_pair",
    `
      (
        ${column({ table: "storage_registrations", name: "active_generation_id" })} is null
        and ${column({ table: "storage_registrations", name: "active_location_id" })} is null
        and ${column({ table: "storage_registrations", name: "activated_at" })} is null
      )
      or (
        ${column({ table: "storage_registrations", name: "active_generation_id" })} is not null
        and ${column({ table: "storage_registrations", name: "active_location_id" })} is not null
        and ${column({ table: "storage_registrations", name: "activated_at" })} is not null
      )
    `,
  ),
];

const canonicalChecks: readonly NamedCheckSpec[] = [
  identityCheck({
    table: "project_state",
    name: "project_state_project_uuid",
    columnName: "project_id",
  }),
  namedCheck(
    "project_state",
    "project_state_sequence_nonnegative_safe",
    nonnegativeSafeIntegerExpression({ table: "project_state", name: "last_project_sequence" }),
  ),
  namedCheck(
    "project_state",
    "project_state_writer_generation_nonnegative_safe",
    nonnegativeSafeIntegerExpression({ table: "project_state", name: "last_writer_generation" }),
  ),
  namedCheck(
    "writer_generations",
    "writer_generations_generation_positive_safe",
    positiveSafeIntegerExpression({ table: "writer_generations", name: "writer_generation" }),
  ),
  identityCheck({
    table: "writer_generations",
    name: "writer_generations_activation_uuid",
    columnName: "activation_id",
  }),
  namedCheck(
    "writer_generations",
    "writer_generations_token_sha256",
    sha256Expression({ table: "writer_generations", name: "token_digest" }),
  ),
  namedCheck(
    "writer_fence",
    "writer_fence_generation_positive_safe",
    positiveSafeIntegerExpression({ table: "writer_fence", name: "writer_generation" }),
  ),
  namedCheck(
    "writer_fence",
    "writer_fence_token_sha256",
    sha256Expression({ table: "writer_fence", name: "token_digest" }),
  ),
  namedCheck(
    "writer_fence",
    "writer_fence_state",
    `${column({ table: "writer_fence", name: "state" })} in ('active', 'released')`,
  ),
  namedCheck(
    "writer_fence",
    "writer_fence_release_shape",
    `
    (${column({ table: "writer_fence", name: "state" })} = 'active' and ${column({ table: "writer_fence", name: "released_at" })} is null)
    or (${column({ table: "writer_fence", name: "state" })} = 'released' and ${column({ table: "writer_fence", name: "released_at" })} is not null)
  `,
  ),
  identityCheck({
    table: "writer_handoffs",
    name: "writer_handoffs_id_uuid",
    columnName: "handoff_id",
  }),
  namedCheck(
    "writer_handoffs",
    "writer_handoffs_from_generation_positive_safe",
    `${column({ table: "writer_handoffs", name: "from_writer_generation" })} is null or (${positiveSafeIntegerExpression({ table: "writer_handoffs", name: "from_writer_generation" })})`,
  ),
  namedCheck(
    "writer_handoffs",
    "writer_handoffs_to_generation_positive_safe",
    positiveSafeIntegerExpression({ table: "writer_handoffs", name: "to_writer_generation" }),
  ),
  namedCheck(
    "writer_handoffs",
    "writer_handoffs_kind",
    `${column({ table: "writer_handoffs", name: "kind" })} in ('initial', 'clean', 'recovery')`,
  ),
  namedCheck(
    "writer_handoffs",
    "writer_handoffs_predecessor_shape",
    `
    (${column({ table: "writer_handoffs", name: "kind" })} = 'initial' and ${column({ table: "writer_handoffs", name: "from_writer_generation" })} is null)
    or (${column({ table: "writer_handoffs", name: "kind" })} in ('clean', 'recovery') and ${column({ table: "writer_handoffs", name: "from_writer_generation" })} is not null)
  `,
  ),
  namedCheck(
    "writer_handoffs",
    "writer_handoffs_generation_order",
    `${column({ table: "writer_handoffs", name: "from_writer_generation" })} is null or ${column({ table: "writer_handoffs", name: "to_writer_generation" })} > ${column({ table: "writer_handoffs", name: "from_writer_generation" })}`,
  ),
  identityCheck({
    table: "writer_recovery_records",
    name: "writer_recovery_records_id_uuid",
    columnName: "recovery_record_id",
  }),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_generation_positive_safe",
    positiveSafeIntegerExpression({ table: "writer_recovery_records", name: "writer_generation" }),
  ),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_reason",
    `${column({ table: "writer_recovery_records", name: "reason" })} in ('commit-uncertain', 'abandoned-active-fence')`,
  ),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_command_uuid",
    `${column({ table: "writer_recovery_records", name: "command_id" })} is null or (${identityExpression({ table: "writer_recovery_records", name: "command_id" })})`,
  ),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_fingerprint_sha256",
    `${column({ table: "writer_recovery_records", name: "command_fingerprint" })} is null or (${sha256Expression({ table: "writer_recovery_records", name: "command_fingerprint" })})`,
  ),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_command_shape",
    `
    (${column({ table: "writer_recovery_records", name: "reason" })} = 'commit-uncertain'
      and ${column({ table: "writer_recovery_records", name: "command_id" })} is not null and ${column({ table: "writer_recovery_records", name: "command_fingerprint" })} is not null)
    or (${column({ table: "writer_recovery_records", name: "reason" })} = 'abandoned-active-fence'
      and ${column({ table: "writer_recovery_records", name: "command_id" })} is null and ${column({ table: "writer_recovery_records", name: "command_fingerprint" })} is null)
  `,
  ),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_resolution",
    `
    ${column({ table: "writer_recovery_records", name: "resolution" })} is null
    or (${column({ table: "writer_recovery_records", name: "reason" })} = 'commit-uncertain' and ${column({ table: "writer_recovery_records", name: "resolution" })} in ('receipt-found', 'receipt-absent'))
    or (${column({ table: "writer_recovery_records", name: "reason" })} = 'abandoned-active-fence' and ${column({ table: "writer_recovery_records", name: "resolution" })} = 'generation-superseded')
  `,
  ),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_resolution_shape",
    `
    (${column({ table: "writer_recovery_records", name: "resolution" })} is null and ${column({ table: "writer_recovery_records", name: "resolved_by_writer_generation" })} is null and ${column({ table: "writer_recovery_records", name: "resolved_at" })} is null)
    or (${column({ table: "writer_recovery_records", name: "resolution" })} is not null and ${column({ table: "writer_recovery_records", name: "resolved_by_writer_generation" })} is not null and ${column({ table: "writer_recovery_records", name: "resolved_at" })} is not null)
  `,
  ),
  namedCheck(
    "writer_recovery_records",
    "writer_recovery_records_resolver_order",
    `
    ${column({ table: "writer_recovery_records", name: "resolved_by_writer_generation" })} is null
    or (${positiveSafeIntegerExpression({ table: "writer_recovery_records", name: "resolved_by_writer_generation" })}
      and ${column({ table: "writer_recovery_records", name: "resolved_by_writer_generation" })} > ${column({ table: "writer_recovery_records", name: "writer_generation" })})
  `,
  ),
  identityCheck({
    table: "command_receipts",
    name: "command_receipts_id_uuid",
    columnName: "receipt_id",
  }),
  identityCheck({
    table: "command_receipts",
    name: "command_receipts_command_uuid",
    columnName: "command_id",
  }),
  namedCheck(
    "command_receipts",
    "command_receipts_type_nonempty",
    nonemptyTextExpression({ table: "command_receipts", name: "command_type" }),
  ),
  namedCheck(
    "command_receipts",
    "command_receipts_version_positive_safe",
    positiveSafeIntegerExpression({ table: "command_receipts", name: "command_version" }),
  ),
  namedCheck(
    "command_receipts",
    "command_receipts_fingerprint_sha256",
    sha256Expression({ table: "command_receipts", name: "command_fingerprint" }),
  ),
  namedCheck(
    "command_receipts",
    "command_receipts_outcome",
    `${column({ table: "command_receipts", name: "outcome" })} in ('applied', 'unchanged', 'rejected')`,
  ),
  namedCheck(
    "command_receipts",
    "command_receipts_sequence_positive_safe",
    positiveSafeIntegerExpression({ table: "command_receipts", name: "project_sequence" }),
  ),
  namedCheck(
    "command_receipts",
    "command_receipts_writer_generation_positive_safe",
    positiveSafeIntegerExpression({ table: "command_receipts", name: "writer_generation" }),
  ),
  identityCheck({
    table: "command_idempotency",
    name: "command_idempotency_command_uuid",
    columnName: "command_id",
  }),
  namedCheck(
    "command_idempotency",
    "command_idempotency_fingerprint_sha256",
    sha256Expression({ table: "command_idempotency", name: "original_command_fingerprint" }),
  ),
  namedCheck(
    "command_rejections",
    "command_rejections_outcome",
    `${column({ table: "command_rejections", name: "receipt_outcome" })} = 'rejected'`,
  ),
  namedCheck(
    "command_rejections",
    "command_rejections_sequence_positive_safe",
    positiveSafeIntegerExpression({ table: "command_rejections", name: "project_sequence" }),
  ),
  namedCheck(
    "command_rejections",
    "command_rejections_code_nonempty",
    nonemptyTextExpression({ table: "command_rejections", name: "rejection_code" }),
  ),
  namedCheck(
    "command_rejections",
    "command_rejections_retryable_boolean",
    `${column({ table: "command_rejections", name: "retryable" })} in (0, 1)`,
  ),
  namedCheck(
    "command_rejections",
    "command_rejections_details_nonempty",
    nonemptyTextExpression({ table: "command_rejections", name: "details_json" }),
  ),
  namedCheck(
    "command_rejections",
    "command_rejections_details_sha256",
    sha256Expression({ table: "command_rejections", name: "details_hash" }),
  ),
  identityCheck({
    table: "canonical_events",
    name: "canonical_events_id_uuid",
    columnName: "event_id",
  }),
  namedCheck(
    "canonical_events",
    "canonical_events_outcome",
    `${column({ table: "canonical_events", name: "receipt_outcome" })} = 'applied'`,
  ),
  namedCheck(
    "canonical_events",
    "canonical_events_sequence_positive_safe",
    positiveSafeIntegerExpression({ table: "canonical_events", name: "project_sequence" }),
  ),
  namedCheck(
    "canonical_events",
    "canonical_events_ordinal_nonnegative_safe",
    nonnegativeSafeIntegerExpression({ table: "canonical_events", name: "event_ordinal" }),
  ),
  namedCheck(
    "canonical_events",
    "canonical_events_aggregate_type_nonempty",
    nonemptyTextExpression({ table: "canonical_events", name: "aggregate_type" }),
  ),
  identityCheck({
    table: "canonical_events",
    name: "canonical_events_aggregate_id_uuid",
    columnName: "aggregate_id",
  }),
  namedCheck(
    "canonical_events",
    "canonical_events_aggregate_version_positive_safe",
    positiveSafeIntegerExpression({ table: "canonical_events", name: "aggregate_version" }),
  ),
  namedCheck(
    "canonical_events",
    "canonical_events_type_nonempty",
    nonemptyTextExpression({ table: "canonical_events", name: "event_type" }),
  ),
  namedCheck(
    "canonical_events",
    "canonical_events_version_positive_safe",
    positiveSafeIntegerExpression({ table: "canonical_events", name: "event_version" }),
  ),
  namedCheck(
    "canonical_events",
    "canonical_events_payload_nonempty",
    nonemptyTextExpression({ table: "canonical_events", name: "payload_json" }),
  ),
  namedCheck(
    "canonical_events",
    "canonical_events_payload_sha256",
    sha256Expression({ table: "canonical_events", name: "payload_hash" }),
  ),
  namedCheck(
    "schema_metadata",
    "canonical_metadata_key",
    `${column({ table: "schema_metadata", name: "metadata_key" })} = 'canonical'`,
  ),
  namedCheck(
    "schema_metadata",
    "canonical_metadata_kind",
    `${column({ table: "schema_metadata", name: "database_kind" })} = 'canonical'`,
  ),
  namedCheck(
    "schema_metadata",
    "canonical_format_nonnegative",
    `${column({ table: "schema_metadata", name: "format_version" })} >= 0`,
  ),
  namedCheck(
    "schema_metadata",
    "canonical_schema_nonnegative",
    `${column({ table: "schema_metadata", name: "schema_version" })} >= 0`,
  ),
  namedCheck(
    "schema_metadata",
    "canonical_migration_nonempty",
    `length(trim(${column({ table: "schema_metadata", name: "last_migration_id" })})) > 0`,
  ),
  namedCheck(
    "storage_identity",
    "canonical_identity_singleton",
    `${column({ table: "storage_identity", name: "identity_key" })} = 'storage'`,
  ),
  identityCheck({
    table: "storage_identity",
    name: "canonical_identity_project_uuid",
    columnName: "project_id",
  }),
  identityCheck({
    table: "storage_identity",
    name: "canonical_identity_storage_uuid",
    columnName: "storage_id",
  }),
  identityCheck({
    table: "storage_identity",
    name: "canonical_identity_generation_uuid",
    columnName: "generation_id",
  }),
  identityCheck({
    table: "storage_identity",
    name: "canonical_identity_lineage_uuid",
    columnName: "canonical_database_lineage_id",
  }),
];

const runtimeChecks: readonly NamedCheckSpec[] = [
  namedCheck(
    "slopstop_runtime_schema_metadata",
    "runtime_metadata_key",
    `${column({ table: "slopstop_runtime_schema_metadata", name: "metadata_key" })} = 'slopstop-runtime-adapter'`,
  ),
  namedCheck(
    "slopstop_runtime_schema_metadata",
    "runtime_metadata_kind",
    `${column({ table: "slopstop_runtime_schema_metadata", name: "database_kind" })} = 'runtime-adapter'`,
  ),
  namedCheck(
    "slopstop_runtime_schema_metadata",
    "runtime_format_nonnegative",
    `${column({ table: "slopstop_runtime_schema_metadata", name: "format_version" })} >= 0`,
  ),
  namedCheck(
    "slopstop_runtime_schema_metadata",
    "runtime_schema_nonnegative",
    `${column({ table: "slopstop_runtime_schema_metadata", name: "schema_version" })} >= 0`,
  ),
  namedCheck(
    "slopstop_runtime_schema_metadata",
    "runtime_migration_nonempty",
    `length(trim(${column({ table: "slopstop_runtime_schema_metadata", name: "last_migration_id" })})) > 0`,
  ),
  namedCheck(
    "slopstop_runtime_storage_identity",
    "runtime_identity_singleton",
    `${column({ table: "slopstop_runtime_storage_identity", name: "identity_key" })} = 'storage'`,
  ),
  identityCheck({
    table: "slopstop_runtime_storage_identity",
    name: "runtime_identity_project_uuid",
    columnName: "project_id",
  }),
  identityCheck({
    table: "slopstop_runtime_storage_identity",
    name: "runtime_identity_storage_uuid",
    columnName: "storage_id",
  }),
  identityCheck({
    table: "slopstop_runtime_storage_identity",
    name: "runtime_identity_generation_uuid",
    columnName: "generation_id",
  }),
  identityCheck({
    table: "slopstop_runtime_storage_identity",
    name: "runtime_identity_lineage_uuid",
    columnName: "runtime_database_lineage_id",
  }),
];

export const previousApplicationDatabaseSpec: DatabaseSpec = {
  resourceKind: "application",
  databaseKind: "application",
  metadataTable: "schema_metadata",
  metadataKey: "application",
  formatVersion: 1,
  schemaVersion: 1,
  tables: ["schema_metadata", "storage_generations", "storage_locations", "storage_registrations"],
  columns: applicationColumns,
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
      predicate: `${column({ table: "storage_generations", name: "creation_state" })} = 'active'`,
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
};

const executableSelectionsTable = "registration_executable_selections";
const versionConsentsTable = "registration_version_consents";
const observerIntentsTable = "registration_observer_intents";
const observerChildrenTable = "registration_observer_children";
const observerTerminalsTable = "registration_observer_terminals";
const observerOutcomesTable = "registration_observer_outcomes";

const registrationApplicationColumns: readonly ColumnSpec[] = [
  ...tableColumns({
    table: "registration_repository_selections",
    definitions: [
      ["selection_id", "text", 1, 1],
      ["directory_path", "text", 1, 0],
      ["identity_json", "text", 1, 0],
      ["captured_at", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: "registration_repository_trust",
    definitions: [
      ["trust_id", "text", 1, 1],
      ["selection_id", "text", 1, 0],
      ["decision", "text", 1, 0],
      ["decided_at", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: "registration_identity_consents",
    definitions: [
      ["consent_id", "text", 1, 1],
      ["selection_id", "text", 1, 0],
      ["observation_id", "text", 1, 0],
      ["decision", "text", 1, 0],
      ["decided_at", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: executableSelectionsTable,
    definitions: [
      ["selection_id", "text", 1, 1],
      ["executable_path", "text", 1, 0],
      ["platform", "text", 1, 0],
      ["volume_identity", "text", 1, 0],
      ["file_identity", "text", 1, 0],
      ["birth_identity", "text", 1, 0],
      ["sha256", "text", 1, 0],
      ["captured_at", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: versionConsentsTable,
    definitions: [
      ["consent_id", "text", 1, 1],
      ["selection_id", "text", 1, 0],
      ["decision", "text", 1, 0],
      ["decided_at", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: observerIntentsTable,
    definitions: [
      ["observation_id", "text", 1, 1],
      ["selection_id", "text", 1, 0],
      ["consent_id", "text", 1, 0],
      ["created_at", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: observerChildrenTable,
    definitions: [
      ["observation_id", "text", 1, 1],
      ["identity_json", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: observerTerminalsTable,
    definitions: [
      ["observation_id", "text", 1, 1],
      ["exit_code", "integer", 1, 0],
      ["stdout_closed", "integer", 1, 0],
      ["stderr_closed", "integer", 1, 0],
      ["tree_empty", "integer", 1, 0],
      ["observed_at", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: observerOutcomesTable,
    definitions: [
      ["observation_id", "text", 1, 1],
      ["result_json", "text", 1, 0],
      ["settled_at", "text", 1, 0],
    ],
  }),
];

function physicalNumberExpression(reference: Pick<ColumnSpec, "table" | "name">): string {
  const value = column(reference);
  return `substr(${value}, 1, 1) between '1' and '9' and ${value} not glob '*[^0-9]*'`;
}

const registrationApplicationChecks: readonly NamedCheckSpec[] = [
  namedCheck(
    "registration_repository_selections",
    "registration_repository_identity_json",
    'json_valid("registration_repository_selections"."identity_json")',
  ),
  namedCheck(
    "registration_repository_trust",
    "registration_repository_trust_decision",
    "\"registration_repository_trust\".\"decision\" in ('accepted', 'declined')",
  ),
  namedCheck(
    "registration_identity_consents",
    "registration_identity_consent_decision",
    "\"registration_identity_consents\".\"decision\" in ('accepted', 'declined')",
  ),
  identityCheck({
    table: observerIntentsTable,
    name: "registration_observer_observation_uuid",
    columnName: "observation_id",
  }),
  namedCheck(
    observerChildrenTable,
    "registration_observer_child_json",
    `json_valid(${column({ table: observerChildrenTable, name: "identity_json" })})`,
  ),
  namedCheck(
    observerOutcomesTable,
    "registration_observer_outcome_json",
    `json_valid(${column({ table: observerOutcomesTable, name: "result_json" })})`,
  ),
  namedCheck(
    observerTerminalsTable,
    "registration_observer_stdout_boolean",
    `${column({ table: observerTerminalsTable, name: "stdout_closed" })} in (0, 1)`,
  ),
  namedCheck(
    observerTerminalsTable,
    "registration_observer_stderr_boolean",
    `${column({ table: observerTerminalsTable, name: "stderr_closed" })} in (0, 1)`,
  ),
  namedCheck(
    observerTerminalsTable,
    "registration_observer_tree_boolean",
    `${column({ table: observerTerminalsTable, name: "tree_empty" })} in (0, 1)`,
  ),
  identityCheck({
    table: executableSelectionsTable,
    name: "registration_executable_selection_uuid",
    columnName: "selection_id",
  }),
  namedCheck(
    executableSelectionsTable,
    "registration_executable_path_nonempty",
    `length(${column({ table: executableSelectionsTable, name: "executable_path" })}) > 0`,
  ),
  namedCheck(
    executableSelectionsTable,
    "registration_executable_platform",
    `${column({ table: executableSelectionsTable, name: "platform" })} in ('win32', 'linux')`,
  ),
  namedCheck(
    executableSelectionsTable,
    "registration_executable_volume_positive",
    physicalNumberExpression({ table: executableSelectionsTable, name: "volume_identity" }),
  ),
  namedCheck(
    executableSelectionsTable,
    "registration_executable_file_positive",
    physicalNumberExpression({ table: executableSelectionsTable, name: "file_identity" }),
  ),
  namedCheck(
    executableSelectionsTable,
    "registration_executable_birth_positive",
    physicalNumberExpression({ table: executableSelectionsTable, name: "birth_identity" }),
  ),
  namedCheck(
    executableSelectionsTable,
    "registration_executable_sha256",
    sha256Expression({ table: executableSelectionsTable, name: "sha256" }),
  ),
  identityCheck({
    table: versionConsentsTable,
    name: "registration_version_consent_uuid",
    columnName: "consent_id",
  }),
  namedCheck(
    versionConsentsTable,
    "registration_version_consent_decision",
    `${column({ table: versionConsentsTable, name: "decision" })} in ('accepted', 'declined')`,
  ),
];

const registrationSpecs = {
  application: {
    ...previousApplicationDatabaseSpec,
    tables: [
      ...previousApplicationDatabaseSpec.tables,
      executableSelectionsTable,
      versionConsentsTable,
      observerIntentsTable,
      observerChildrenTable,
      observerTerminalsTable,
      observerOutcomesTable,
      "registration_identity_consents",
      "registration_repository_selections",
      "registration_repository_trust",
    ],
    columns: [...previousApplicationDatabaseSpec.columns, ...registrationApplicationColumns],
    checks: [...previousApplicationDatabaseSpec.checks, ...registrationApplicationChecks],
    indexes: [
      ...previousApplicationDatabaseSpec.indexes,
      {
        table: observerIntentsTable,
        name: "registration_observer_consent_uq",
        unique: true,
        partial: false,
        columns: ["consent_id"],
        predicate: null,
      },
    ],
    foreignKeys: [
      ...previousApplicationDatabaseSpec.foreignKeys,
      {
        table: "registration_repository_trust",
        columns: ["selection_id"],
        referencedTable: "registration_repository_selections",
        referencedColumns: ["selection_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "registration_identity_consents",
        columns: ["selection_id"],
        referencedTable: executableSelectionsTable,
        referencedColumns: ["selection_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "registration_identity_consents",
        columns: ["observation_id"],
        referencedTable: observerOutcomesTable,
        referencedColumns: ["observation_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: observerIntentsTable,
        columns: ["selection_id"],
        referencedTable: executableSelectionsTable,
        referencedColumns: ["selection_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: observerIntentsTable,
        columns: ["consent_id"],
        referencedTable: versionConsentsTable,
        referencedColumns: ["consent_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: observerChildrenTable,
        columns: ["observation_id"],
        referencedTable: observerIntentsTable,
        referencedColumns: ["observation_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: observerTerminalsTable,
        columns: ["observation_id"],
        referencedTable: observerChildrenTable,
        referencedColumns: ["observation_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: observerOutcomesTable,
        columns: ["observation_id"],
        referencedTable: observerIntentsTable,
        referencedColumns: ["observation_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: versionConsentsTable,
        columns: ["selection_id"],
        referencedTable: executableSelectionsTable,
        referencedColumns: ["selection_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
    ],
  },
} as const satisfies Record<"application", DatabaseSpec>;

export const previousRegistrationDatabaseSpec = registrationSpecs.application;

const identityQueryColumnNames = [
  "observation_id",
  "repository_selection_id",
  "consent_id",
  "query_kind",
  "scope_json",
  "child_json",
  "terminal_json",
  "result_json",
  "created_at",
  "settled_at",
];

/** Required TEXT columns in declaration order, the first one being the primary key. */
function requiredTextColumns(table: string, names: readonly string[]): ColumnSpec[] {
  return names.map((name, cid) => ({
    table,
    cid,
    name,
    type: "TEXT",
    notNull: 1,
    defaultValue: null,
    primaryKey: cid === 0 ? 1 : 0,
    hidden: 0,
  }));
}

function withIdentityQuerySpec(previous: DatabaseSpec): DatabaseSpec {
  const table = "registration_identity_query_attempts";
  return {
    ...previous,
    tables: [...previous.tables, table],
    columns: [
      ...previous.columns,
      ...identityQueryColumnNames.map(
        (name, cid): ColumnSpec => ({
          table,
          cid,
          name,
          type: "TEXT",
          notNull: [5, 6, 7, 9].includes(cid) ? 0 : 1,
          defaultValue: null,
          primaryKey: cid === 0 ? 1 : 0,
          hidden: 0,
        }),
      ),
    ],
    checks: [
      ...previous.checks,
      {
        table,
        name: "identity_query_kind",
        expression: `"${table}"."query_kind" in ('inside-work-tree', 'bare-repository', 'inside-git-dir', 'show-toplevel', 'absolute-git-dir', 'git-common-dir')`,
      },
      {
        table,
        name: "identity_query_scope_json",
        expression: `json_valid("${table}"."scope_json")`,
      },
      ...["child", "terminal", "result"].map((kind) => ({
        table,
        name: `identity_query_${kind}_json`,
        expression: `"${table}"."${kind}_json" is null or json_valid("${table}"."${kind}_json")`,
      })),
    ],
    foreignKeys: [
      ...previous.foreignKeys,
      {
        table,
        columns: ["repository_selection_id"],
        referencedTable: "registration_repository_selections",
        referencedColumns: ["selection_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table,
        columns: ["consent_id"],
        referencedTable: "registration_identity_consents",
        referencedColumns: ["consent_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
    ],
  };
}

export const previousIdentityQueryDatabaseSpec = withIdentityQuerySpec(
  previousRegistrationDatabaseSpec,
);

function withProposalSpec(previous: DatabaseSpec): DatabaseSpec {
  const table = "registration_proposals";
  return {
    ...previous,
    tables: [...previous.tables, table],
    columns: [
      ...previous.columns,
      ...requiredTextColumns(table, [
        "request_id",
        "proposal_id",
        "input_fingerprint",
        "proposal_fingerprint",
        "record_json",
      ]),
    ],
    checks: [
      ...previous.checks,
      {
        table,
        name: "registration_proposal_json",
        expression: `json_valid("${table}"."record_json")`,
      },
    ],
    indexes: [
      ...previous.indexes,
      {
        table,
        name: "registration_proposal_id_uq",
        unique: true,
        partial: false,
        columns: ["proposal_id"],
        predicate: null,
      },
    ],
  };
}

export const previousProposalDatabaseSpec = withProposalSpec(previousIdentityQueryDatabaseSpec);

function withReservationSpec(previous: DatabaseSpec): DatabaseSpec {
  const reservation = "registration_reservations";
  const request = "registration_requests";
  const columns = [
    {
      table: reservation,
      names: [
        "reservation_id",
        "common_platform",
        "common_volume_identity",
        "common_file_identity",
        "common_birth_identity",
        "record_json",
        "record_fingerprint",
      ],
    },
    {
      table: request,
      names: ["request_id", "input_fingerprint", "request_json", "reservation_id"],
    },
  ].flatMap(({ table, names }) => requiredTextColumns(table, names));
  return {
    ...previous,
    tables: [...previous.tables, reservation, request],
    columns: [...previous.columns, ...columns],
    checks: [
      ...previous.checks,
      {
        table: reservation,
        name: "registration_reservation_json",
        expression: `json_valid("${reservation}"."record_json")`,
      },
      {
        table: request,
        name: "registration_request_json",
        expression: `json_valid("${request}"."request_json")`,
      },
    ],
    indexes: [
      ...previous.indexes,
      {
        table: reservation,
        name: "registration_common_identity_uq",
        unique: true,
        partial: false,
        columns: [
          "common_platform",
          "common_volume_identity",
          "common_file_identity",
          "common_birth_identity",
        ],
        predicate: null,
      },
    ],
    foreignKeys: [
      ...previous.foreignKeys,
      {
        table: request,
        columns: ["reservation_id"],
        referencedTable: reservation,
        referencedColumns: ["reservation_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
    ],
  };
}

export const previousReservationDatabaseSpec = withReservationSpec(previousProposalDatabaseSpec);

function withPublicationSpec(previous: DatabaseSpec): DatabaseSpec {
  const table = "registration_publications";
  return {
    ...previous,
    tables: [...previous.tables, table],
    columns: [
      ...previous.columns,
      ...requiredTextColumns(table, [
        "reservation_id",
        "request_id",
        "result_json",
        "result_fingerprint",
      ]),
    ],
    checks: [
      ...previous.checks,
      {
        table,
        name: "registration_publication_json",
        expression: `json_valid("${table}"."result_json")`,
      },
    ],
    foreignKeys: [
      ...previous.foreignKeys,
      ...[
        { column: "reservation_id", parent: "registration_reservations" },
        { column: "request_id", parent: "registration_requests" },
      ].map(
        ({ column, parent }): ForeignKeySpec => ({
          table,
          columns: [column],
          referencedTable: parent,
          referencedColumns: [column],
          onUpdate: "NO ACTION",
          onDelete: "RESTRICT",
          match: "NONE",
        }),
      ),
    ],
  };
}

export const previousPublicationDatabaseSpec = withPublicationSpec(previousReservationDatabaseSpec);

function withVisibilitySpec(previous: DatabaseSpec): DatabaseSpec {
  const table = "registration_list_visibility";
  return {
    ...previous,
    tables: [...previous.tables, table],
    columns: [...previous.columns, ...requiredTextColumns(table, ["project_id", "hidden_at"])],
  };
}

export const databaseSpecs = {
  application: withVisibilitySpec(previousPublicationDatabaseSpec),
  canonical: {
    resourceKind: "canonical",
    databaseKind: "canonical",
    metadataTable: "schema_metadata",
    metadataKey: "canonical",
    formatVersion: 1,
    schemaVersion: 3,
    tables: [
      "canonical_events",
      "command_idempotency",
      "command_receipts",
      "command_rejections",
      "project_state",
      "repository_bindings",
      "project_workspaces",
      "schema_metadata",
      "storage_identity",
      "writer_fence",
      "writer_generations",
      "writer_handoffs",
      "writer_recovery_records",
    ],
    columns: [
      ...canonicalColumns,
      ...[
        {
          table: "repository_bindings",
          names: ["project_id", "binding_id", "revision", "registration_request_id", "created_at"],
        },
        {
          table: "project_workspaces",
          names: ["project_id", "workspace_id", "binding_id", "created_at"],
        },
      ].flatMap(({ table, names }) =>
        names.map(
          (name, cid): ColumnSpec => ({
            table,
            cid,
            name,
            type: name === "revision" ? "INTEGER" : "TEXT",
            notNull: 1,
            defaultValue: null,
            primaryKey: cid < 2 ? cid + 1 : 0,
            hidden: 0,
          }),
        ),
      ),
    ],
    checks: [
      ...canonicalChecks,
      {
        table: "repository_bindings",
        name: "repository_binding_revision",
        expression: nonnegativeSafeIntegerExpression({
          table: "repository_bindings",
          name: "revision",
        }),
      },
    ],
    indexes: [
      {
        table: "canonical_events",
        name: "canonical_events_sequence_ordinal_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "project_sequence", "event_ordinal"],
        predicate: null,
      },
      {
        table: "canonical_events",
        name: "canonical_events_receipt_idx",
        unique: false,
        partial: false,
        columns: ["project_id", "receipt_id"],
        predicate: null,
      },
      {
        table: "canonical_events",
        name: "canonical_events_aggregate_idx",
        unique: false,
        partial: false,
        columns: ["project_id", "aggregate_type", "aggregate_id", "aggregate_version"],
        predicate: null,
      },
      {
        table: "command_idempotency",
        name: "command_idempotency_receipt_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "original_receipt_id"],
        predicate: null,
      },
      {
        table: "command_receipts",
        name: "command_receipts_command_fingerprint_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "command_id", "command_fingerprint"],
        predicate: null,
      },
      {
        table: "command_receipts",
        name: "command_receipts_project_sequence_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "project_sequence"],
        predicate: null,
      },
      {
        table: "command_receipts",
        name: "command_receipts_idempotency_binding_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "receipt_id", "command_id", "command_fingerprint"],
        predicate: null,
      },
      {
        table: "command_receipts",
        name: "command_receipts_settlement_binding_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "receipt_id", "outcome", "project_sequence"],
        predicate: null,
      },
      {
        table: "writer_generations",
        name: "writer_generations_activation_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "activation_id"],
        predicate: null,
      },
      {
        table: "writer_generations",
        name: "writer_generations_fence_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "writer_generation", "token_digest"],
        predicate: null,
      },
      {
        table: "writer_handoffs",
        name: "writer_handoffs_to_generation_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "to_writer_generation"],
        predicate: null,
      },
      {
        table: "writer_handoffs",
        name: "writer_handoffs_from_generation_idx",
        unique: false,
        partial: false,
        columns: ["project_id", "from_writer_generation"],
        predicate: null,
      },
      {
        table: "writer_recovery_records",
        name: "writer_recovery_records_generation_uq",
        unique: true,
        partial: false,
        columns: ["project_id", "writer_generation"],
        predicate: null,
      },
      {
        table: "writer_recovery_records",
        name: "writer_recovery_records_unresolved_uq",
        unique: true,
        partial: true,
        columns: ["project_id"],
        predicate: `${column({ table: "writer_recovery_records", name: "resolution" })} is null`,
      },
      {
        table: "writer_recovery_records",
        name: "writer_recovery_records_command_idx",
        unique: false,
        partial: false,
        columns: ["project_id", "command_id"],
        predicate: null,
      },
    ],
    foreignKeys: [
      {
        table: "canonical_events",
        columns: ["project_id", "receipt_id", "receipt_outcome", "project_sequence"],
        referencedTable: "command_receipts",
        referencedColumns: ["project_id", "receipt_id", "outcome", "project_sequence"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "repository_bindings",
        columns: ["project_id"],
        referencedTable: "project_state",
        referencedColumns: ["project_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "project_workspaces",
        columns: ["project_id", "binding_id"],
        referencedTable: "repository_bindings",
        referencedColumns: ["project_id", "binding_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "command_idempotency",
        columns: [
          "project_id",
          "original_receipt_id",
          "command_id",
          "original_command_fingerprint",
        ],
        referencedTable: "command_receipts",
        referencedColumns: ["project_id", "receipt_id", "command_id", "command_fingerprint"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "command_receipts",
        columns: ["project_id", "writer_generation"],
        referencedTable: "writer_generations",
        referencedColumns: ["project_id", "writer_generation"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "command_rejections",
        columns: ["project_id", "receipt_id", "receipt_outcome", "project_sequence"],
        referencedTable: "command_receipts",
        referencedColumns: ["project_id", "receipt_id", "outcome", "project_sequence"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "storage_identity",
        columns: ["project_id"],
        referencedTable: "project_state",
        referencedColumns: ["project_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "writer_fence",
        columns: ["project_id", "writer_generation", "token_digest"],
        referencedTable: "writer_generations",
        referencedColumns: ["project_id", "writer_generation", "token_digest"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "writer_generations",
        columns: ["project_id"],
        referencedTable: "project_state",
        referencedColumns: ["project_id"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "writer_handoffs",
        columns: ["project_id", "from_writer_generation"],
        referencedTable: "writer_generations",
        referencedColumns: ["project_id", "writer_generation"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "writer_handoffs",
        columns: ["project_id", "to_writer_generation"],
        referencedTable: "writer_generations",
        referencedColumns: ["project_id", "writer_generation"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "writer_recovery_records",
        columns: ["project_id", "writer_generation"],
        referencedTable: "writer_generations",
        referencedColumns: ["project_id", "writer_generation"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
      {
        table: "writer_recovery_records",
        columns: ["project_id", "resolved_by_writer_generation"],
        referencedTable: "writer_generations",
        referencedColumns: ["project_id", "writer_generation"],
        onUpdate: "NO ACTION",
        onDelete: "RESTRICT",
        match: "NONE",
      },
    ],
  },
  runtime: {
    resourceKind: "runtime",
    databaseKind: "runtime-adapter",
    metadataTable: "slopstop_runtime_schema_metadata",
    metadataKey: "slopstop-runtime-adapter",
    formatVersion: 1,
    schemaVersion: 1,
    tables: ["slopstop_runtime_schema_metadata", "slopstop_runtime_storage_identity"],
    columns: runtimeColumns,
    checks: runtimeChecks,
    indexes: [],
    foreignKeys: [],
  },
} as const satisfies Record<MigrationResourceKind, DatabaseSpec>;
