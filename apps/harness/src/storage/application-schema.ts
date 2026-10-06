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

export const registrationReservations = sqliteTable(
  "registration_reservations",
  {
    reservationId: text("reservation_id").primaryKey().notNull(),
    commonPlatform: text("common_platform").notNull(),
    commonVolumeIdentity: text("common_volume_identity").notNull(),
    commonFileIdentity: text("common_file_identity").notNull(),
    commonBirthIdentity: text("common_birth_identity").notNull(),
    recordJson: text("record_json").notNull(),
    recordFingerprint: text("record_fingerprint").notNull(),
  },
  (table) => [
    uniqueIndex("registration_common_identity_uq").on(
      table.commonPlatform,
      table.commonVolumeIdentity,
      table.commonFileIdentity,
      table.commonBirthIdentity,
    ),
    check("registration_reservation_json", sql`json_valid(${table.recordJson})`),
  ],
);

export const registrationRequests = sqliteTable(
  "registration_requests",
  {
    requestId: text("request_id").primaryKey().notNull(),
    inputFingerprint: text("input_fingerprint").notNull(),
    requestJson: text("request_json").notNull(),
    reservationId: text("reservation_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.reservationId],
      foreignColumns: [registrationReservations.reservationId],
    }).onDelete("restrict"),
    check("registration_request_json", sql`json_valid(${table.requestJson})`),
  ],
);

export const registrationPublications = sqliteTable(
  "registration_publications",
  {
    reservationId: text("reservation_id").primaryKey().notNull(),
    requestId: text("request_id").notNull(),
    resultJson: text("result_json").notNull(),
    resultFingerprint: text("result_fingerprint").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.reservationId],
      foreignColumns: [registrationReservations.reservationId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.requestId],
      foreignColumns: [registrationRequests.requestId],
    }).onDelete("restrict"),
    check("registration_publication_json", sql`json_valid(${table.resultJson})`),
  ],
);

/** A row hides a registered Project from the saved list; its data stays (Remove from list). */
export const registrationListVisibility = sqliteTable("registration_list_visibility", {
  projectId: text("project_id").primaryKey().notNull(),
  hiddenAt: text("hidden_at").notNull(),
});

/** One staged upgrade of a Project's Storage; a completed row records the superseded generation. */
export const storageUpgrades = sqliteTable(
  "storage_upgrades",
  {
    upgradeId: text("upgrade_id").primaryKey().notNull(),
    storageId: text("storage_id").notNull(),
    projectId: text("project_id").notNull(),
    locationId: text("location_id").notNull(),
    sourceGenerationId: text("source_generation_id").notNull(),
    targetGenerationId: text("target_generation_id").notNull(),
    sourceCanonicalLineageId: text("source_canonical_lineage_id").notNull(),
    sourceRuntimeLineageId: text("source_runtime_lineage_id").notNull(),
    sourceCreateRequestId: text("source_create_request_id").notNull(),
    sourceCreateRequestFingerprint: text("source_create_request_fingerprint").notNull(),
    sourceCreatedAt: text("source_created_at").notNull(),
    sourceActivatedAt: text("source_activated_at").notNull(),
    state: text("state", { enum: ["in-progress", "completed"] }).notNull(),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("storage_upgrades_one_in_progress_uq")
      .on(table.storageId)
      .where(sql`${table.state} = 'in-progress'`),
    uniqueIndex("storage_upgrades_source_generation_uq").on(table.sourceGenerationId),
    uniqueIndex("storage_upgrades_source_create_request_uq").on(table.sourceCreateRequestId),
    check("storage_upgrades_state", sql`${table.state} in ('in-progress', 'completed')`),
    check(
      "storage_upgrades_completion",
      sql`(${table.state} = 'in-progress') = (${table.completedAt} is null)`,
    ),
  ],
);

export const registrationProposals = sqliteTable(
  "registration_proposals",
  {
    requestId: text("request_id").primaryKey().notNull(),
    proposalId: text("proposal_id").notNull(),
    inputFingerprint: text("input_fingerprint").notNull(),
    proposalFingerprint: text("proposal_fingerprint").notNull(),
    recordJson: text("record_json").notNull(),
  },
  (table) => [
    uniqueIndex("registration_proposal_id_uq").on(table.proposalId),
    check("registration_proposal_json", sql`json_valid(${table.recordJson})`),
  ],
);

export const registrationIdentityQueryAttempts = sqliteTable(
  "registration_identity_query_attempts",
  {
    observationId: text("observation_id").primaryKey().notNull(),
    repositorySelectionId: text("repository_selection_id").notNull(),
    consentId: text("consent_id").notNull(),
    queryKind: text("query_kind").notNull(),
    scopeJson: text("scope_json").notNull(),
    childJson: text("child_json"),
    terminalJson: text("terminal_json"),
    resultJson: text("result_json"),
    createdAt: text("created_at").notNull(),
    settledAt: text("settled_at"),
  },
  (table) => [
    foreignKey({
      columns: [table.repositorySelectionId],
      foreignColumns: [registrationRepositorySelections.selectionId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.consentId],
      foreignColumns: [registrationIdentityConsents.consentId],
    }).onDelete("restrict"),
    check(
      "identity_query_kind",
      sql`${table.queryKind} in ('inside-work-tree', 'bare-repository', 'inside-git-dir', 'show-toplevel', 'absolute-git-dir', 'git-common-dir')`,
    ),
    check("identity_query_scope_json", sql`json_valid(${table.scopeJson})`),
    check(
      "identity_query_child_json",
      sql`${table.childJson} is null or json_valid(${table.childJson})`,
    ),
    check(
      "identity_query_terminal_json",
      sql`${table.terminalJson} is null or json_valid(${table.terminalJson})`,
    ),
    check(
      "identity_query_result_json",
      sql`${table.resultJson} is null or json_valid(${table.resultJson})`,
    ),
  ],
);
