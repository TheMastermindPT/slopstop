import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createSchemaMetadataColumns } from "./schema-metadata-columns.js";
import { domainIdentityCheck } from "./storage-schema-constraints.js";

function physicalNumberCheck(column: AnySQLiteColumn) {
  return sql`substr(${column}, 1, 1) between '1' and '9' and ${column} not glob '*[^0-9]*'`;
}

export const applicationSchemaMetadata = sqliteTable(
  "schema_metadata",
  createSchemaMetadataColumns(),
  (table) => [
    check("application_metadata_key", sql`${table.metadataKey} = 'application'`),
    check("application_metadata_kind", sql`${table.databaseKind} = 'application'`),
    check("application_format_nonnegative", sql`${table.formatVersion} >= 0`),
    check("application_schema_nonnegative", sql`${table.schemaVersion} >= 0`),
    check("application_migration_nonempty", sql`length(trim(${table.lastMigrationId})) > 0`),
  ],
);

export const storageLocations = sqliteTable(
  "storage_locations",
  {
    storageId: text("storage_id").notNull(),
    locationId: text("location_id").notNull(),
    normalizedPath: text("normalized_path").notNull(),
    locationState: text("location_state", {
      enum: ["staging", "committed"],
    }).notNull(),
    observedAt: text("observed_at").notNull(),
  },
  (table) => [
    primaryKey({
      name: "storage_locations_pk",
      columns: [table.storageId, table.locationId],
    }),
    uniqueIndex("storage_locations_normalized_path_uq").on(table.normalizedPath),
    check("storage_locations_storage_id_uuid", domainIdentityCheck(table.storageId)),
    check("storage_locations_location_id_uuid", domainIdentityCheck(table.locationId)),
    check("storage_locations_state", sql`${table.locationState} in ('staging', 'committed')`),
  ],
);

export const storageGenerations = sqliteTable(
  "storage_generations",
  {
    storageId: text("storage_id").notNull(),
    generationId: text("generation_id").notNull(),
    projectId: text("project_id").notNull(),
    locationId: text("location_id").notNull(),
    canonicalLineageId: text("canonical_lineage_id").notNull(),
    runtimeLineageId: text("runtime_lineage_id").notNull(),
    createRequestId: text("create_request_id").notNull(),
    createRequestFingerprint: text("create_request_fingerprint").notNull(),
    generationDirectoryName: text("generation_directory_name").notNull(),
    creationState: text("creation_state", {
      enum: ["staging", "active"],
    }).notNull(),
    createdAt: text("created_at").notNull(),
    activatedAt: text("activated_at"),
  },
  (table) => [
    primaryKey({
      name: "storage_generations_pk",
      columns: [table.storageId, table.generationId],
    }),
    foreignKey({
      name: "storage_generations_location_fk",
      columns: [table.storageId, table.locationId],
      foreignColumns: [storageLocations.storageId, storageLocations.locationId],
    }).onDelete("restrict"),
    uniqueIndex("storage_generations_create_request_uq").on(table.createRequestId),
    uniqueIndex("storage_generations_directory_uq").on(
      table.storageId,
      table.generationDirectoryName,
    ),
    uniqueIndex("storage_generations_one_active_uq")
      .on(table.storageId)
      .where(sql`${table.creationState} = 'active'`),
    index("storage_generations_project_idx").on(table.projectId),
    index("storage_generations_state_idx").on(table.storageId, table.creationState),
    check("storage_generations_storage_id_uuid", domainIdentityCheck(table.storageId)),
    check("storage_generations_generation_id_uuid", domainIdentityCheck(table.generationId)),
    check("storage_generations_project_id_uuid", domainIdentityCheck(table.projectId)),
    check("storage_generations_location_id_uuid", domainIdentityCheck(table.locationId)),
    check(
      "storage_generations_canonical_lineage_uuid",
      domainIdentityCheck(table.canonicalLineageId),
    ),
    check("storage_generations_runtime_lineage_uuid", domainIdentityCheck(table.runtimeLineageId)),
    check("storage_generations_create_request_uuid", domainIdentityCheck(table.createRequestId)),
    check(
      "storage_generations_fingerprint_sha256",
      sql`
        length(${table.createRequestFingerprint}) = 64
        and ${table.createRequestFingerprint} = lower(${table.createRequestFingerprint})
        and ${table.createRequestFingerprint} not glob '*[^0-9a-f]*'
      `,
    ),
    check(
      "storage_generations_directory_identity",
      sql`${table.generationDirectoryName} = ${table.generationId}`,
    ),
    check(
      "storage_generations_activation_time",
      sql`
        (${table.creationState} = 'active' and ${table.activatedAt} is not null)
        or (${table.creationState} = 'staging' and ${table.activatedAt} is null)
      `,
    ),
  ],
);

export const storageRegistrations = sqliteTable(
  "storage_registrations",
  {
    storageId: text("storage_id").primaryKey(),
    projectId: text("project_id").notNull(),
    activeGenerationId: text("active_generation_id"),
    activeLocationId: text("active_location_id"),
    createdAt: text("created_at").notNull(),
    activatedAt: text("activated_at"),
  },
  (table) => [
    uniqueIndex("storage_registrations_project_uq").on(table.projectId),
    foreignKey({
      name: "storage_registrations_active_generation_fk",
      columns: [table.storageId, table.activeGenerationId],
      foreignColumns: [storageGenerations.storageId, storageGenerations.generationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "storage_registrations_active_location_fk",
      columns: [table.storageId, table.activeLocationId],
      foreignColumns: [storageLocations.storageId, storageLocations.locationId],
    }).onDelete("restrict"),
    check("storage_registrations_storage_id_uuid", domainIdentityCheck(table.storageId)),
    check("storage_registrations_project_id_uuid", domainIdentityCheck(table.projectId)),
    check(
      "storage_registrations_active_pair",
      sql`
        (
          ${table.activeGenerationId} is null
          and ${table.activeLocationId} is null
          and ${table.activatedAt} is null
        )
        or (
          ${table.activeGenerationId} is not null
          and ${table.activeLocationId} is not null
          and ${table.activatedAt} is not null
        )
      `,
    ),
  ],
);

export const registrationExecutableSelections = sqliteTable(
  "registration_executable_selections",
  {
    selectionId: text("selection_id").primaryKey().notNull(),
    executablePath: text("executable_path").notNull(),
    platform: text("platform").notNull(),
    volumeIdentity: text("volume_identity").notNull(),
    fileIdentity: text("file_identity").notNull(),
    birthIdentity: text("birth_identity").notNull(),
    sha256: text("sha256").notNull(),
    capturedAt: text("captured_at").notNull(),
  },
  (table) => [
    check("registration_executable_selection_uuid", domainIdentityCheck(table.selectionId)),
    check("registration_executable_path_nonempty", sql`length(${table.executablePath}) > 0`),
    check("registration_executable_platform", sql`${table.platform} in ('win32', 'linux')`),
    check("registration_executable_volume_positive", physicalNumberCheck(table.volumeIdentity)),
    check("registration_executable_file_positive", physicalNumberCheck(table.fileIdentity)),
    check("registration_executable_birth_positive", physicalNumberCheck(table.birthIdentity)),
    check(
      "registration_executable_sha256",
      sql`length(${table.sha256}) = 64 and ${table.sha256} = lower(${table.sha256}) and ${table.sha256} not glob '*[^0-9a-f]*'`,
    ),
  ],
);

export const registrationVersionConsents = sqliteTable(
  "registration_version_consents",
  {
    consentId: text("consent_id").primaryKey().notNull(),
    selectionId: text("selection_id").notNull(),
    decision: text("decision").notNull(),
    decidedAt: text("decided_at").notNull(),
  },
  (table) => [
    foreignKey({
      name: "registration_version_consent_selection_fk",
      columns: [table.selectionId],
      foreignColumns: [registrationExecutableSelections.selectionId],
    }).onDelete("restrict"),
    check("registration_version_consent_uuid", domainIdentityCheck(table.consentId)),
    check(
      "registration_version_consent_decision",
      sql`${table.decision} in ('accepted', 'declined')`,
    ),
  ],
);

export const registrationObserverIntents = sqliteTable(
  "registration_observer_intents",
  {
    observationId: text("observation_id").primaryKey().notNull(),
    selectionId: text("selection_id").notNull(),
    consentId: text("consent_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("registration_observer_observation_uuid", domainIdentityCheck(table.observationId)),
    uniqueIndex("registration_observer_consent_uq").on(table.consentId),
    foreignKey({
      columns: [table.selectionId],
      foreignColumns: [registrationExecutableSelections.selectionId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.consentId],
      foreignColumns: [registrationVersionConsents.consentId],
    }).onDelete("restrict"),
  ],
);

export const registrationObserverChildren = sqliteTable(
  "registration_observer_children",
  {
    observationId: text("observation_id").primaryKey().notNull(),
    identityJson: text("identity_json").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.observationId],
      foreignColumns: [registrationObserverIntents.observationId],
    }).onDelete("restrict"),
    check("registration_observer_child_json", sql`json_valid(${table.identityJson})`),
  ],
);

export const registrationObserverTerminals = sqliteTable(
  "registration_observer_terminals",
  {
    observationId: text("observation_id").primaryKey().notNull(),
    exitCode: integer("exit_code").notNull(),
    stdoutClosed: integer("stdout_closed").notNull(),
    stderrClosed: integer("stderr_closed").notNull(),
    treeEmpty: integer("tree_empty").notNull(),
    observedAt: text("observed_at").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.observationId],
      foreignColumns: [registrationObserverChildren.observationId],
    }).onDelete("restrict"),
    check("registration_observer_stdout_boolean", sql`${table.stdoutClosed} in (0, 1)`),
    check("registration_observer_stderr_boolean", sql`${table.stderrClosed} in (0, 1)`),
    check("registration_observer_tree_boolean", sql`${table.treeEmpty} in (0, 1)`),
  ],
);

export const registrationObserverOutcomes = sqliteTable(
  "registration_observer_outcomes",
  {
    observationId: text("observation_id").primaryKey().notNull(),
    resultJson: text("result_json").notNull(),
    settledAt: text("settled_at").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.observationId],
      foreignColumns: [registrationObserverIntents.observationId],
    }).onDelete("restrict"),
    check("registration_observer_outcome_json", sql`json_valid(${table.resultJson})`),
  ],
);

export const registrationIdentityConsents = sqliteTable(
  "registration_identity_consents",
  {
    consentId: text("consent_id").primaryKey().notNull(),
    selectionId: text("selection_id").notNull(),
    observationId: text("observation_id").notNull(),
    decision: text("decision").notNull(),
    decidedAt: text("decided_at").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.selectionId],
      foreignColumns: [registrationExecutableSelections.selectionId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.observationId],
      foreignColumns: [registrationObserverOutcomes.observationId],
    }).onDelete("restrict"),
    check(
      "registration_identity_consent_decision",
      sql`${table.decision} in ('accepted', 'declined')`,
    ),
  ],
);

export const registrationRepositorySelections = sqliteTable(
  "registration_repository_selections",
  {
    selectionId: text("selection_id").primaryKey().notNull(),
    directoryPath: text("directory_path").notNull(),
    identityJson: text("identity_json").notNull(),
    capturedAt: text("captured_at").notNull(),
  },
  (table) => [
    check("registration_repository_identity_json", sql`json_valid(${table.identityJson})`),
  ],
);

export const registrationRepositoryTrust = sqliteTable(
  "registration_repository_trust",
  {
    trustId: text("trust_id").primaryKey().notNull(),
    selectionId: text("selection_id").notNull(),
    decision: text("decision").notNull(),
    decidedAt: text("decided_at").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.selectionId],
      foreignColumns: [registrationRepositorySelections.selectionId],
    }).onDelete("restrict"),
    check(
      "registration_repository_trust_decision",
      sql`${table.decision} in ('accepted', 'declined')`,
    ),
  ],
);
