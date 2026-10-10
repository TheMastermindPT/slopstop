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

function nonemptyTextCheck(column: AnySQLiteColumn) {
  return sql`length(trim(${column})) > 0`;
}

function sha256Check(column: AnySQLiteColumn) {
  return sql`
    length(${column}) = 64
    and ${column} = lower(${column})
    and ${column} not glob '*[^0-9a-f]*'
  `;
}

function nonnegativeSafeIntegerCheck(column: AnySQLiteColumn) {
  return sql`
    typeof(${column}) = 'integer'
    and ${column} >= 0
    and ${column} <= 9007199254740991
  `;
}

function positiveSafeIntegerCheck(column: AnySQLiteColumn) {
  return sql`
    typeof(${column}) = 'integer'
    and ${column} > 0
    and ${column} <= 9007199254740991
  `;
}

export const canonicalSchemaMetadata = sqliteTable(
  "schema_metadata",
  createSchemaMetadataColumns(),
  (table) => [
    check("canonical_metadata_key", sql`${table.metadataKey} = 'canonical'`),
    check("canonical_metadata_kind", sql`${table.databaseKind} = 'canonical'`),
    check("canonical_format_nonnegative", sql`${table.formatVersion} >= 0`),
    check("canonical_schema_nonnegative", sql`${table.schemaVersion} >= 0`),
    check("canonical_migration_nonempty", sql`length(trim(${table.lastMigrationId})) > 0`),
  ],
);

export const canonicalProjectState = sqliteTable(
  "project_state",
  {
    projectId: text("project_id").primaryKey(),
    lastProjectSequence: integer("last_project_sequence").notNull(),
    lastWriterGeneration: integer("last_writer_generation").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check("project_state_project_uuid", domainIdentityCheck(table.projectId)),
    check(
      "project_state_sequence_nonnegative_safe",
      nonnegativeSafeIntegerCheck(table.lastProjectSequence),
    ),
    check(
      "project_state_writer_generation_nonnegative_safe",
      nonnegativeSafeIntegerCheck(table.lastWriterGeneration),
    ),
  ],
);

export const repositoryBindings = sqliteTable(
  "repository_bindings",
  {
    projectId: text("project_id").notNull(),
    bindingId: text("binding_id").notNull(),
    revision: integer("revision").notNull(),
    registrationRequestId: text("registration_request_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.bindingId] }),
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [canonicalProjectState.projectId],
    }).onDelete("restrict"),
    check("repository_binding_revision", nonnegativeSafeIntegerCheck(table.revision)),
  ],
);

export const projectWorkspaces = sqliteTable(
  "project_workspaces",
  {
    projectId: text("project_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    bindingId: text("binding_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.workspaceId] }),
    foreignKey({
      columns: [table.projectId, table.bindingId],
      foreignColumns: [repositoryBindings.projectId, repositoryBindings.bindingId],
    }).onDelete("restrict"),
  ],
);

export const canonicalStorageIdentity = sqliteTable(
  "storage_identity",
  {
    identityKey: text("identity_key").notNull(),
    projectId: text("project_id").notNull(),
    storageId: text("storage_id").notNull(),
    generationId: text("generation_id").notNull(),
    canonicalDatabaseLineageId: text("canonical_database_lineage_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({
      name: "canonical_storage_identity_pk",
      columns: [table.projectId, table.identityKey],
    }),
    foreignKey({
      name: "canonical_storage_identity_project_fk",
      columns: [table.projectId],
      foreignColumns: [canonicalProjectState.projectId],
    }).onDelete("restrict"),
    check("canonical_identity_singleton", sql`${table.identityKey} = 'storage'`),
    check("canonical_identity_project_uuid", domainIdentityCheck(table.projectId)),
    check("canonical_identity_storage_uuid", domainIdentityCheck(table.storageId)),
    check("canonical_identity_generation_uuid", domainIdentityCheck(table.generationId)),
    check("canonical_identity_lineage_uuid", domainIdentityCheck(table.canonicalDatabaseLineageId)),
  ],
);

export const writerGenerations = sqliteTable(
  "writer_generations",
  {
    projectId: text("project_id").notNull(),
    writerGeneration: integer("writer_generation").notNull(),
    activationId: text("activation_id").notNull(),
    tokenDigest: text("token_digest").notNull(),
    acquiredAt: text("acquired_at").notNull(),
    releasedAt: text("released_at"),
  },
  (table) => [
    primaryKey({
      name: "writer_generations_pk",
      columns: [table.projectId, table.writerGeneration],
    }),
    foreignKey({
      name: "writer_generations_project_fk",
      columns: [table.projectId],
      foreignColumns: [canonicalProjectState.projectId],
    }).onDelete("restrict"),
    uniqueIndex("writer_generations_activation_uq").on(table.projectId, table.activationId),
    uniqueIndex("writer_generations_fence_uq").on(
      table.projectId,
      table.writerGeneration,
      table.tokenDigest,
    ),
    check(
      "writer_generations_generation_positive_safe",
      positiveSafeIntegerCheck(table.writerGeneration),
    ),
    check("writer_generations_activation_uuid", domainIdentityCheck(table.activationId)),
    check("writer_generations_token_sha256", sha256Check(table.tokenDigest)),
  ],
);

export const writerFence = sqliteTable(
  "writer_fence",
  {
    projectId: text("project_id").primaryKey(),
    writerGeneration: integer("writer_generation").notNull(),
    tokenDigest: text("token_digest").notNull(),
    state: text("state", { enum: ["active", "released"] }).notNull(),
    activatedAt: text("activated_at").notNull(),
    releasedAt: text("released_at"),
  },
  (table) => [
    foreignKey({
      name: "writer_fence_generation_fk",
      columns: [table.projectId, table.writerGeneration, table.tokenDigest],
      foreignColumns: [
        writerGenerations.projectId,
        writerGenerations.writerGeneration,
        writerGenerations.tokenDigest,
      ],
    }).onDelete("restrict"),
    check(
      "writer_fence_generation_positive_safe",
      positiveSafeIntegerCheck(table.writerGeneration),
    ),
    check("writer_fence_token_sha256", sha256Check(table.tokenDigest)),
    check("writer_fence_state", sql`${table.state} in ('active', 'released')`),
    check(
      "writer_fence_release_shape",
      sql`
        (${table.state} = 'active' and ${table.releasedAt} is null)
        or (${table.state} = 'released' and ${table.releasedAt} is not null)
      `,
    ),
  ],
);

export const writerHandoffs = sqliteTable(
  "writer_handoffs",
  {
    projectId: text("project_id").notNull(),
    handoffId: text("handoff_id").notNull(),
    fromWriterGeneration: integer("from_writer_generation"),
    toWriterGeneration: integer("to_writer_generation").notNull(),
    kind: text("kind", { enum: ["initial", "clean", "recovery"] }).notNull(),
    recordedAt: text("recorded_at").notNull(),
  },
  (table) => [
    primaryKey({ name: "writer_handoffs_pk", columns: [table.projectId, table.handoffId] }),
    foreignKey({
      name: "writer_handoffs_from_generation_fk",
      columns: [table.projectId, table.fromWriterGeneration],
      foreignColumns: [writerGenerations.projectId, writerGenerations.writerGeneration],
    }).onDelete("restrict"),
    foreignKey({
      name: "writer_handoffs_to_generation_fk",
      columns: [table.projectId, table.toWriterGeneration],
      foreignColumns: [writerGenerations.projectId, writerGenerations.writerGeneration],
    }).onDelete("restrict"),
    uniqueIndex("writer_handoffs_to_generation_uq").on(table.projectId, table.toWriterGeneration),
    index("writer_handoffs_from_generation_idx").on(table.projectId, table.fromWriterGeneration),
    check("writer_handoffs_id_uuid", domainIdentityCheck(table.handoffId)),
    check(
      "writer_handoffs_from_generation_positive_safe",
      sql`${table.fromWriterGeneration} is null or (${positiveSafeIntegerCheck(table.fromWriterGeneration)})`,
    ),
    check(
      "writer_handoffs_to_generation_positive_safe",
      positiveSafeIntegerCheck(table.toWriterGeneration),
    ),
    check("writer_handoffs_kind", sql`${table.kind} in ('initial', 'clean', 'recovery')`),
    check(
      "writer_handoffs_predecessor_shape",
      sql`
        (${table.kind} = 'initial' and ${table.fromWriterGeneration} is null)
        or (${table.kind} in ('clean', 'recovery') and ${table.fromWriterGeneration} is not null)
      `,
    ),
    check(
      "writer_handoffs_generation_order",
      sql`${table.fromWriterGeneration} is null or ${table.toWriterGeneration} > ${table.fromWriterGeneration}`,
    ),
  ],
);

export const writerRecoveryRecords = sqliteTable(
  "writer_recovery_records",
  {
    projectId: text("project_id").notNull(),
    recoveryRecordId: text("recovery_record_id").notNull(),
    writerGeneration: integer("writer_generation").notNull(),
    reason: text("reason", { enum: ["commit-uncertain", "abandoned-active-fence"] }).notNull(),
    commandId: text("command_id"),
    commandFingerprint: text("command_fingerprint"),
    observedAt: text("observed_at").notNull(),
    resolution: text("resolution", {
      enum: ["receipt-found", "receipt-absent", "generation-superseded"],
    }),
    resolvedByWriterGeneration: integer("resolved_by_writer_generation"),
    resolvedAt: text("resolved_at"),
  },
  (table) => [
    primaryKey({
      name: "writer_recovery_records_pk",
      columns: [table.projectId, table.recoveryRecordId],
    }),
    foreignKey({
      name: "writer_recovery_records_generation_fk",
      columns: [table.projectId, table.writerGeneration],
      foreignColumns: [writerGenerations.projectId, writerGenerations.writerGeneration],
    }).onDelete("restrict"),
    foreignKey({
      name: "writer_recovery_records_resolver_fk",
      columns: [table.projectId, table.resolvedByWriterGeneration],
      foreignColumns: [writerGenerations.projectId, writerGenerations.writerGeneration],
    }).onDelete("restrict"),
    uniqueIndex("writer_recovery_records_generation_uq").on(
      table.projectId,
      table.writerGeneration,
    ),
    uniqueIndex("writer_recovery_records_unresolved_uq")
      .on(table.projectId)
      .where(sql`${table.resolution} is null`),
    index("writer_recovery_records_command_idx").on(table.projectId, table.commandId),
    check("writer_recovery_records_id_uuid", domainIdentityCheck(table.recoveryRecordId)),
    check(
      "writer_recovery_records_generation_positive_safe",
      positiveSafeIntegerCheck(table.writerGeneration),
    ),
    check(
      "writer_recovery_records_reason",
      sql`${table.reason} in ('commit-uncertain', 'abandoned-active-fence')`,
    ),
    check(
      "writer_recovery_records_command_uuid",
      sql`${table.commandId} is null or (${domainIdentityCheck(table.commandId)})`,
    ),
    check(
      "writer_recovery_records_fingerprint_sha256",
      sql`${table.commandFingerprint} is null or (${sha256Check(table.commandFingerprint)})`,
    ),
    check(
      "writer_recovery_records_command_shape",
      sql`
        (
          ${table.reason} = 'commit-uncertain'
          and ${table.commandId} is not null
          and ${table.commandFingerprint} is not null
        )
        or (
          ${table.reason} = 'abandoned-active-fence'
          and ${table.commandId} is null
          and ${table.commandFingerprint} is null
        )
      `,
    ),
    check(
      "writer_recovery_records_resolution",
      sql`
        ${table.resolution} is null
        or (
          ${table.reason} = 'commit-uncertain'
          and ${table.resolution} in ('receipt-found', 'receipt-absent')
        )
        or (
          ${table.reason} = 'abandoned-active-fence'
          and ${table.resolution} = 'generation-superseded'
        )
      `,
    ),
    check(
      "writer_recovery_records_resolution_shape",
      sql`
        (
          ${table.resolution} is null
          and ${table.resolvedByWriterGeneration} is null
          and ${table.resolvedAt} is null
        )
        or (
          ${table.resolution} is not null
          and ${table.resolvedByWriterGeneration} is not null
          and ${table.resolvedAt} is not null
        )
      `,
    ),
    check(
      "writer_recovery_records_resolver_order",
      sql`
        ${table.resolvedByWriterGeneration} is null
        or (
          ${positiveSafeIntegerCheck(table.resolvedByWriterGeneration)}
          and ${table.resolvedByWriterGeneration} > ${table.writerGeneration}
        )
      `,
    ),
  ],
);

export const commandReceipts = sqliteTable(
  "command_receipts",
  {
    projectId: text("project_id").notNull(),
    receiptId: text("receipt_id").notNull(),
    commandId: text("command_id").notNull(),
    commandType: text("command_type").notNull(),
    commandVersion: integer("command_version").notNull(),
    commandFingerprint: text("command_fingerprint").notNull(),
    outcome: text("outcome", { enum: ["applied", "unchanged", "rejected"] }).notNull(),
    projectSequence: integer("project_sequence").notNull(),
    writerGeneration: integer("writer_generation").notNull(),
    settledAt: text("settled_at").notNull(),
  },
  (table) => [
    primaryKey({ name: "command_receipts_pk", columns: [table.projectId, table.receiptId] }),
    foreignKey({
      name: "command_receipts_writer_generation_fk",
      columns: [table.projectId, table.writerGeneration],
      foreignColumns: [writerGenerations.projectId, writerGenerations.writerGeneration],
    }).onDelete("restrict"),
    uniqueIndex("command_receipts_command_fingerprint_uq").on(
      table.projectId,
      table.commandId,
      table.commandFingerprint,
    ),
    uniqueIndex("command_receipts_project_sequence_uq").on(table.projectId, table.projectSequence),
    uniqueIndex("command_receipts_idempotency_binding_uq").on(
      table.projectId,
      table.receiptId,
      table.commandId,
      table.commandFingerprint,
    ),
    uniqueIndex("command_receipts_settlement_binding_uq").on(
      table.projectId,
      table.receiptId,
      table.outcome,
      table.projectSequence,
    ),
    check("command_receipts_id_uuid", domainIdentityCheck(table.receiptId)),
    check("command_receipts_command_uuid", domainIdentityCheck(table.commandId)),
    check("command_receipts_type_nonempty", nonemptyTextCheck(table.commandType)),
    check("command_receipts_version_positive_safe", positiveSafeIntegerCheck(table.commandVersion)),
    check("command_receipts_fingerprint_sha256", sha256Check(table.commandFingerprint)),
    check(
      "command_receipts_outcome",
      sql`${table.outcome} in ('applied', 'unchanged', 'rejected')`,
    ),
    check(
      "command_receipts_sequence_positive_safe",
      positiveSafeIntegerCheck(table.projectSequence),
    ),
    check(
      "command_receipts_writer_generation_positive_safe",
      positiveSafeIntegerCheck(table.writerGeneration),
    ),
  ],
);

export const commandIdempotency = sqliteTable(
  "command_idempotency",
  {
    projectId: text("project_id").notNull(),
    commandId: text("command_id").notNull(),
    originalCommandFingerprint: text("original_command_fingerprint").notNull(),
    originalReceiptId: text("original_receipt_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    primaryKey({ name: "command_idempotency_pk", columns: [table.projectId, table.commandId] }),
    foreignKey({
      name: "command_idempotency_receipt_fk",
      columns: [
        table.projectId,
        table.originalReceiptId,
        table.commandId,
        table.originalCommandFingerprint,
      ],
      foreignColumns: [
        commandReceipts.projectId,
        commandReceipts.receiptId,
        commandReceipts.commandId,
        commandReceipts.commandFingerprint,
      ],
    }).onDelete("restrict"),
    uniqueIndex("command_idempotency_receipt_uq").on(table.projectId, table.originalReceiptId),
    check("command_idempotency_command_uuid", domainIdentityCheck(table.commandId)),
    check("command_idempotency_fingerprint_sha256", sha256Check(table.originalCommandFingerprint)),
  ],
);

export const commandRejections = sqliteTable(
  "command_rejections",
  {
    projectId: text("project_id").notNull(),
    receiptId: text("receipt_id").notNull(),
    receiptOutcome: text("receipt_outcome", { enum: ["rejected"] }).notNull(),
    projectSequence: integer("project_sequence").notNull(),
    rejectionCode: text("rejection_code").notNull(),
    retryable: integer("retryable", { mode: "boolean" }).notNull(),
    detailsJson: text("details_json").notNull(),
    detailsHash: text("details_hash").notNull(),
  },
  (table) => [
    primaryKey({ name: "command_rejections_pk", columns: [table.projectId, table.receiptId] }),
    foreignKey({
      name: "command_rejections_receipt_fk",
      columns: [table.projectId, table.receiptId, table.receiptOutcome, table.projectSequence],
      foreignColumns: [
        commandReceipts.projectId,
        commandReceipts.receiptId,
        commandReceipts.outcome,
        commandReceipts.projectSequence,
      ],
    }).onDelete("restrict"),
    check("command_rejections_outcome", sql`${table.receiptOutcome} = 'rejected'`),
    check(
      "command_rejections_sequence_positive_safe",
      positiveSafeIntegerCheck(table.projectSequence),
    ),
    check("command_rejections_code_nonempty", nonemptyTextCheck(table.rejectionCode)),
    check("command_rejections_retryable_boolean", sql`${table.retryable} in (0, 1)`),
    check("command_rejections_details_nonempty", nonemptyTextCheck(table.detailsJson)),
    check("command_rejections_details_sha256", sha256Check(table.detailsHash)),
  ],
);

export const canonicalEvents = sqliteTable(
  "canonical_events",
  {
    projectId: text("project_id").notNull(),
    eventId: text("event_id").notNull(),
    receiptId: text("receipt_id").notNull(),
    receiptOutcome: text("receipt_outcome", { enum: ["applied"] }).notNull(),
    projectSequence: integer("project_sequence").notNull(),
    eventOrdinal: integer("event_ordinal").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    aggregateVersion: integer("aggregate_version").notNull(),
    eventType: text("event_type").notNull(),
    eventVersion: integer("event_version").notNull(),
    payloadJson: text("payload_json").notNull(),
    payloadHash: text("payload_hash").notNull(),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => [
    primaryKey({ name: "canonical_events_pk", columns: [table.projectId, table.eventId] }),
    foreignKey({
      name: "canonical_events_receipt_fk",
      columns: [table.projectId, table.receiptId, table.receiptOutcome, table.projectSequence],
      foreignColumns: [
        commandReceipts.projectId,
        commandReceipts.receiptId,
        commandReceipts.outcome,
        commandReceipts.projectSequence,
      ],
    }).onDelete("restrict"),
    uniqueIndex("canonical_events_sequence_ordinal_uq").on(
      table.projectId,
      table.projectSequence,
      table.eventOrdinal,
    ),
    index("canonical_events_receipt_idx").on(table.projectId, table.receiptId),
    index("canonical_events_aggregate_idx").on(
      table.projectId,
      table.aggregateType,
      table.aggregateId,
      table.aggregateVersion,
    ),
    check("canonical_events_id_uuid", domainIdentityCheck(table.eventId)),
    check("canonical_events_outcome", sql`${table.receiptOutcome} = 'applied'`),
    check(
      "canonical_events_sequence_positive_safe",
      positiveSafeIntegerCheck(table.projectSequence),
    ),
    check(
      "canonical_events_ordinal_nonnegative_safe",
      nonnegativeSafeIntegerCheck(table.eventOrdinal),
    ),
    check("canonical_events_aggregate_type_nonempty", nonemptyTextCheck(table.aggregateType)),
    check("canonical_events_aggregate_id_uuid", domainIdentityCheck(table.aggregateId)),
    check(
      "canonical_events_aggregate_version_positive_safe",
      positiveSafeIntegerCheck(table.aggregateVersion),
    ),
    check("canonical_events_type_nonempty", nonemptyTextCheck(table.eventType)),
    check("canonical_events_version_positive_safe", positiveSafeIntegerCheck(table.eventVersion)),
    check("canonical_events_payload_nonempty", nonemptyTextCheck(table.payloadJson)),
    check("canonical_events_payload_sha256", sha256Check(table.payloadHash)),
  ],
);

export const conversations = sqliteTable(
  "conversations",
  {
    conversationId: text("conversation_id").primaryKey(),
    projectId: text("project_id").notNull(),
    scopeKind: text("scope_kind", { enum: ["project", "waypoint"] }).notNull(),
    waypointId: text("waypoint_id"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    foreignKey({
      name: "conversations_project_fk",
      columns: [table.projectId],
      foreignColumns: [canonicalProjectState.projectId],
    }).onDelete("restrict"),
    uniqueIndex("conversations_project_scope_uq")
      .on(table.projectId)
      .where(sql`${table.scopeKind} = 'project'`),
    check("conversations_id_uuid", domainIdentityCheck(table.conversationId)),
    check("conversations_scope_kind", sql`${table.scopeKind} in ('project', 'waypoint')`),
    check(
      "conversations_scope_shape",
      sql`
        (${table.scopeKind} = 'project' and ${table.waypointId} is null)
        or (${table.scopeKind} = 'waypoint' and ${table.waypointId} is not null)
      `,
    ),
    check(
      "conversations_waypoint_uuid",
      sql`${table.waypointId} is null or (${domainIdentityCheck(table.waypointId)})`,
    ),
  ],
);

export const conversationBranches = sqliteTable(
  "conversation_branches",
  {
    branchId: text("branch_id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    parentBranchId: text("parent_branch_id"),
    forkMessageId: text("fork_message_id").references(
      (): AnySQLiteColumn => conversationMessages.messageId,
      { onDelete: "restrict" },
    ),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    foreignKey({
      name: "conversation_branches_conversation_fk",
      columns: [table.conversationId],
      foreignColumns: [conversations.conversationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "conversation_branches_parent_fk",
      columns: [table.conversationId, table.parentBranchId],
      foreignColumns: [table.conversationId, table.branchId],
    }).onDelete("restrict"),
    uniqueIndex("conversation_branches_conversation_branch_uq").on(
      table.conversationId,
      table.branchId,
    ),
    uniqueIndex("conversation_branches_root_uq")
      .on(table.conversationId)
      .where(sql`${table.parentBranchId} is null`),
    check("conversation_branches_id_uuid", domainIdentityCheck(table.branchId)),
    check(
      "conversation_branches_fork_shape",
      sql`
        (${table.parentBranchId} is null and ${table.forkMessageId} is null)
        or (${table.parentBranchId} is not null and ${table.forkMessageId} is not null)
      `,
    ),
  ],
);

export const conversationMessages = sqliteTable(
  "conversation_messages",
  {
    messageId: text("message_id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    branchId: text("branch_id").notNull(),
    cursor: integer("cursor").notNull(),
    author: text("author", { enum: ["user", "model"] }).notNull(),
    body: text("body").notNull(),
    saveId: text("save_id").notNull(),
    saveFingerprint: text("save_fingerprint").notNull(),
    savedAt: text("saved_at").notNull(),
  },
  (table) => [
    foreignKey({
      name: "conversation_messages_branch_fk",
      columns: [table.conversationId, table.branchId],
      foreignColumns: [conversationBranches.conversationId, conversationBranches.branchId],
    }).onDelete("restrict"),
    uniqueIndex("conversation_messages_branch_cursor_uq").on(table.branchId, table.cursor),
    uniqueIndex("conversation_messages_save_uq").on(table.saveId),
    check("conversation_messages_id_uuid", domainIdentityCheck(table.messageId)),
    check("conversation_messages_cursor_positive_safe", positiveSafeIntegerCheck(table.cursor)),
    check("conversation_messages_author", sql`${table.author} in ('user', 'model')`),
    check(
      "conversation_messages_body_size",
      sql`typeof(${table.body}) = 'text' and length(cast(${table.body} as blob)) between 1 and 32768`,
    ),
    check("conversation_messages_save_uuid", domainIdentityCheck(table.saveId)),
    check("conversation_messages_save_fingerprint_sha256", sha256Check(table.saveFingerprint)),
  ],
);
