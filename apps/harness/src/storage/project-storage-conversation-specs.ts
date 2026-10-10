import {
  type ColumnSpec,
  column,
  type ForeignKeySpec,
  identityCheck,
  identityExpression,
  type NamedCheckSpec,
  type NamedIndexSpec,
  namedCheck,
  positiveSafeIntegerExpression,
  sha256Expression,
  tableColumns,
} from "./project-storage-spec-builders.js";

/** The canonical schema-4 Conversation tables (migration `0003_conversation_messages`). */
export const conversationColumns: readonly ColumnSpec[] = [
  ...tableColumns({
    table: "conversations",
    definitions: [
      ["conversation_id", "text", 1, 1],
      ["project_id", "text", 1, 0],
      ["scope_kind", "text", 1, 0],
      ["waypoint_id", "text", 0, 0],
      ["created_at", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: "conversation_branches",
    definitions: [
      ["branch_id", "text", 1, 1],
      ["conversation_id", "text", 1, 0],
      ["parent_branch_id", "text", 0, 0],
      ["fork_message_id", "text", 0, 0],
      ["created_at", "text", 1, 0],
    ],
  }),
  ...tableColumns({
    table: "conversation_messages",
    definitions: [
      ["message_id", "text", 1, 1],
      ["conversation_id", "text", 1, 0],
      ["branch_id", "text", 1, 0],
      ["cursor", "integer", 1, 0],
      ["author", "text", 1, 0],
      ["body", "text", 1, 0],
      ["save_id", "text", 1, 0],
      ["save_fingerprint", "text", 1, 0],
      ["saved_at", "text", 1, 0],
    ],
  }),
];

export const conversationChecks: readonly NamedCheckSpec[] = [
  identityCheck({
    table: "conversations",
    name: "conversations_id_uuid",
    columnName: "conversation_id",
  }),
  namedCheck(
    "conversations",
    "conversations_scope_kind",
    `${column({ table: "conversations", name: "scope_kind" })} in ('project', 'waypoint')`,
  ),
  namedCheck(
    "conversations",
    "conversations_scope_shape",
    `
    (${column({ table: "conversations", name: "scope_kind" })} = 'project' and ${column({ table: "conversations", name: "waypoint_id" })} is null)
    or (${column({ table: "conversations", name: "scope_kind" })} = 'waypoint' and ${column({ table: "conversations", name: "waypoint_id" })} is not null)
  `,
  ),
  namedCheck(
    "conversations",
    "conversations_waypoint_uuid",
    `${column({ table: "conversations", name: "waypoint_id" })} is null or (${identityExpression({ table: "conversations", name: "waypoint_id" })})`,
  ),
  identityCheck({
    table: "conversation_branches",
    name: "conversation_branches_id_uuid",
    columnName: "branch_id",
  }),
  namedCheck(
    "conversation_branches",
    "conversation_branches_fork_shape",
    `
    (${column({ table: "conversation_branches", name: "parent_branch_id" })} is null and ${column({ table: "conversation_branches", name: "fork_message_id" })} is null)
    or (${column({ table: "conversation_branches", name: "parent_branch_id" })} is not null and ${column({ table: "conversation_branches", name: "fork_message_id" })} is not null)
  `,
  ),
  identityCheck({
    table: "conversation_messages",
    name: "conversation_messages_id_uuid",
    columnName: "message_id",
  }),
  namedCheck(
    "conversation_messages",
    "conversation_messages_cursor_positive_safe",
    positiveSafeIntegerExpression({ table: "conversation_messages", name: "cursor" }),
  ),
  namedCheck(
    "conversation_messages",
    "conversation_messages_author",
    `${column({ table: "conversation_messages", name: "author" })} in ('user', 'model')`,
  ),
  namedCheck(
    "conversation_messages",
    "conversation_messages_body_size",
    `typeof(${column({ table: "conversation_messages", name: "body" })}) = 'text' and length(cast(${column({ table: "conversation_messages", name: "body" })} as blob)) between 1 and 32768`,
  ),
  identityCheck({
    table: "conversation_messages",
    name: "conversation_messages_save_uuid",
    columnName: "save_id",
  }),
  namedCheck(
    "conversation_messages",
    "conversation_messages_save_fingerprint_sha256",
    sha256Expression({ table: "conversation_messages", name: "save_fingerprint" }),
  ),
];

function uniqueIndex(
  input: Readonly<{ table: string; name: string; columns: readonly string[]; predicate?: string }>,
): NamedIndexSpec {
  const { table, name, columns, predicate = null } = input;
  return { table, name, unique: true, partial: predicate !== null, columns, predicate };
}

export const conversationIndexes: readonly NamedIndexSpec[] = [
  uniqueIndex({
    table: "conversations",
    name: "conversations_project_scope_uq",
    columns: ["project_id"],
    predicate: `${column({ table: "conversations", name: "scope_kind" })} = 'project'`,
  }),
  uniqueIndex({
    table: "conversation_branches",
    name: "conversation_branches_conversation_branch_uq",
    columns: ["conversation_id", "branch_id"],
  }),
  uniqueIndex({
    table: "conversation_branches",
    name: "conversation_branches_root_uq",
    columns: ["conversation_id"],
    predicate: `${column({ table: "conversation_branches", name: "parent_branch_id" })} is null`,
  }),
  uniqueIndex({
    table: "conversation_messages",
    name: "conversation_messages_branch_cursor_uq",
    columns: ["branch_id", "cursor"],
  }),
  uniqueIndex({
    table: "conversation_messages",
    name: "conversation_messages_save_uq",
    columns: ["save_id"],
  }),
];

function restrictForeignKey(
  input: Readonly<{
    table: string;
    columns: readonly string[];
    referencedTable: string;
    referencedColumns: readonly string[];
  }>,
): ForeignKeySpec {
  return { ...input, onUpdate: "NO ACTION", onDelete: "RESTRICT", match: "NONE" };
}

export const conversationForeignKeys: readonly ForeignKeySpec[] = [
  restrictForeignKey({
    table: "conversations",
    columns: ["project_id"],
    referencedTable: "project_state",
    referencedColumns: ["project_id"],
  }),
  restrictForeignKey({
    table: "conversation_branches",
    columns: ["fork_message_id"],
    referencedTable: "conversation_messages",
    referencedColumns: ["message_id"],
  }),
  restrictForeignKey({
    table: "conversation_branches",
    columns: ["conversation_id"],
    referencedTable: "conversations",
    referencedColumns: ["conversation_id"],
  }),
  restrictForeignKey({
    table: "conversation_branches",
    columns: ["conversation_id", "parent_branch_id"],
    referencedTable: "conversation_branches",
    referencedColumns: ["conversation_id", "branch_id"],
  }),
  restrictForeignKey({
    table: "conversation_messages",
    columns: ["conversation_id", "branch_id"],
    referencedTable: "conversation_branches",
    referencedColumns: ["conversation_id", "branch_id"],
  }),
];
