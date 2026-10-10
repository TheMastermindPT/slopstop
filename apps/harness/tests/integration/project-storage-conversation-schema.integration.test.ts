import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { generationPaths, openRequest } from "./project-storage-open-fixture.js";
import {
  createRequest,
  createTemporaryApplicationRoot,
  createUpgradeStorageOwner,
  projectStorageIntegrationTimeout,
  upgradeIds,
} from "./project-storage-runtime-fixture.js";
import { canonicalCurrentTables } from "./project-storage-schema-cases.js";
import {
  comparableCanonicalTables,
  createGenerationThreeProject,
  createGenerationTwoProject,
  orderedRows,
  tableNames,
} from "./project-storage-upgrade-fixture.js";
import {
  createCurrentProject,
  expectReadWriteOn,
} from "./project-storage-upgrade-recovery-fixture.js";

const schemaFourMetadata = {
  metadata_key: "canonical",
  database_kind: "canonical",
  format_version: 1,
  schema_version: 4,
  last_migration_id: "0003_conversation_messages",
} as const;

const projectId = createRequest.projectId;
const instant = "2026-10-09T12:00:00.000Z";
const fingerprint = "c".repeat(64);
const id = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const conversationId = id(901);
const rootBranchId = id(902);
const firstMessageId = id(903);

type Row = Readonly<Record<string, string | number | null>>;

function insert(database: DatabaseSync, table: string, row: Row): void {
  const columns = Object.keys(row);
  database
    .prepare(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    )
    .run(...Object.values(row));
}

const conversation = (overrides: Partial<Row> = {}): Row => ({
  conversation_id: conversationId,
  project_id: projectId,
  scope_kind: "project",
  waypoint_id: null,
  created_at: instant,
  ...overrides,
});

const branch = (overrides: Partial<Row> = {}): Row => ({
  branch_id: rootBranchId,
  conversation_id: conversationId,
  parent_branch_id: null,
  fork_message_id: null,
  created_at: instant,
  ...overrides,
});

const message = (overrides: Partial<Row> = {}): Row => ({
  message_id: id(910),
  conversation_id: conversationId,
  branch_id: rootBranchId,
  cursor: 3,
  author: "user",
  body: "hello",
  save_id: id(920),
  save_fingerprint: fingerprint,
  saved_at: instant,
  ...overrides,
});

const waypointConversationId = id(940);
const waypointRootBranchId = id(941);

/**
 * One Project conversation with its root branch and message 1, plus a waypoint conversation with
 * its own root branch: the base every rule case violates.
 */
function seedConversation(database: DatabaseSync): void {
  insert(database, "conversations", conversation());
  insert(database, "conversation_branches", branch());
  insert(
    database,
    "conversation_messages",
    message({ message_id: firstMessageId, cursor: 1, save_id: id(904) }),
  );
  insert(
    database,
    "conversations",
    conversation({
      conversation_id: waypointConversationId,
      scope_kind: "waypoint",
      waypoint_id: id(942),
    }),
  );
  insert(
    database,
    "conversation_branches",
    branch({ branch_id: waypointRootBranchId, conversation_id: waypointConversationId }),
  );
}

/** A UTF-8 body of exactly `bytes` bytes made of three-byte characters plus ASCII padding. */
function bodyOfBytes(bytes: number): string {
  const wide = "€".repeat(Math.floor(bytes / 3));
  const text = wide + "a".repeat(bytes - Buffer.byteLength(wide, "utf8"));
  expect(Buffer.byteLength(text, "utf8")).toBe(bytes);
  return text;
}

const checkFailure = (name: string) => `CHECK constraint failed: ${name}`;
const uniqueFailure = (columns: string) => `UNIQUE constraint failed: ${columns}`;
const foreignKeyFailure = "FOREIGN KEY constraint failed";

const permanentRuleCases = [
  {
    rule: "an empty body",
    write: (d: DatabaseSync) => insert(d, "conversation_messages", message({ body: "" })),
    failure: checkFailure("conversation_messages_body_size"),
  },
  {
    rule: "a body of 32769 bytes",
    write: (d: DatabaseSync) =>
      insert(d, "conversation_messages", message({ body: bodyOfBytes(32769) })),
    failure: checkFailure("conversation_messages_body_size"),
  },
  {
    rule: "a waypoint conversation without a waypoint",
    write: (d: DatabaseSync) =>
      insert(
        d,
        "conversations",
        conversation({ conversation_id: id(930), scope_kind: "waypoint" }),
      ),
    failure: checkFailure("conversations_scope_shape"),
  },
  {
    rule: "a Project conversation with a waypoint",
    write: (d: DatabaseSync) =>
      insert(d, "conversations", conversation({ conversation_id: id(931), waypoint_id: id(932) })),
    failure: checkFailure("conversations_scope_shape"),
  },
  {
    rule: "a second Project conversation for the same Project",
    write: (d: DatabaseSync) =>
      insert(d, "conversations", conversation({ conversation_id: id(933) })),
    failure: uniqueFailure("conversations.project_id"),
  },
  {
    rule: "a second root branch",
    write: (d: DatabaseSync) => insert(d, "conversation_branches", branch({ branch_id: id(934) })),
    failure: uniqueFailure("conversation_branches.conversation_id"),
  },
  {
    rule: "a parent branch without a fork message",
    write: (d: DatabaseSync) =>
      insert(
        d,
        "conversation_branches",
        branch({ branch_id: id(935), parent_branch_id: rootBranchId }),
      ),
    failure: checkFailure("conversation_branches_fork_shape"),
  },
  {
    rule: "a fork message without a parent branch",
    write: (d: DatabaseSync) =>
      insert(
        d,
        "conversation_branches",
        branch({ branch_id: id(936), fork_message_id: firstMessageId }),
      ),
    failure: checkFailure("conversation_branches_fork_shape"),
  },
  {
    rule: "cursor 0",
    write: (d: DatabaseSync) => insert(d, "conversation_messages", message({ cursor: 0 })),
    failure: checkFailure("conversation_messages_cursor_positive_safe"),
  },
  {
    rule: "a duplicate branch cursor",
    write: (d: DatabaseSync) => insert(d, "conversation_messages", message({ cursor: 1 })),
    failure: uniqueFailure("conversation_messages.branch_id, conversation_messages.cursor"),
  },
  {
    rule: "an author outside the set",
    write: (d: DatabaseSync) => insert(d, "conversation_messages", message({ author: "system" })),
    failure: checkFailure("conversation_messages_author"),
  },
  {
    rule: "a message on a conversation and branch pair that does not exist",
    write: (d: DatabaseSync) =>
      insert(d, "conversation_messages", message({ conversation_id: id(937) })),
    failure: foreignKeyFailure,
  },
  {
    rule: "a reused save id",
    write: (d: DatabaseSync) => insert(d, "conversation_messages", message({ save_id: id(904) })),
    failure: uniqueFailure("conversation_messages.save_id"),
  },
  {
    rule: "a malformed save fingerprint",
    write: (d: DatabaseSync) =>
      insert(d, "conversation_messages", message({ save_fingerprint: "ABC" })),
    failure: checkFailure("conversation_messages_save_fingerprint_sha256"),
  },
  {
    rule: "a scope kind outside the set",
    write: (d: DatabaseSync) =>
      insert(d, "conversations", conversation({ conversation_id: id(943), scope_kind: "frame" })),
    failure: checkFailure("conversations_scope_kind"),
  },
  {
    rule: "a fork message that does not exist",
    write: (d: DatabaseSync) =>
      insert(
        d,
        "conversation_branches",
        branch({ branch_id: id(944), parent_branch_id: rootBranchId, fork_message_id: id(945) }),
      ),
    failure: foreignKeyFailure,
  },
  {
    rule: "a parent branch from another conversation",
    write: (d: DatabaseSync) =>
      insert(
        d,
        "conversation_branches",
        branch({
          branch_id: id(946),
          parent_branch_id: waypointRootBranchId,
          fork_message_id: firstMessageId,
        }),
      ),
    failure: foreignKeyFailure,
  },
] as const;

function withCanonical(databasePath: string, run: (database: DatabaseSync) => void): void {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec("PRAGMA foreign_keys = ON");
    run(database);
  } finally {
    database.close();
  }
}

it(
  "creates new Projects at schema 4",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createCurrentProject({ root });
    const canonical = generationPaths(root).canonical;

    expect(orderedRows({ databasePath: canonical, table: "schema_metadata" })).toEqual([
      schemaFourMetadata,
    ]);
    expect(tableNames({ databasePath: canonical })).toEqual(canonicalCurrentTables);

    withCanonical(canonical, (database) => {
      database.exec("BEGIN");
      seedConversation(database);
      insert(
        database,
        "conversation_messages",
        message({ message_id: id(905), cursor: 2, save_id: id(906), body: bodyOfBytes(32768) }),
      );
      const failures = permanentRuleCases.map(({ rule, write }) => {
        database.exec("SAVEPOINT rule_case");
        try {
          write(database);
          return { rule, failure: "accepted" };
        } catch (error) {
          return { rule, failure: error instanceof Error ? error.message : String(error) };
        } finally {
          database.exec("ROLLBACK TO rule_case");
          database.exec("RELEASE rule_case");
        }
      });
      database.exec("ROLLBACK");
      expect(failures).toEqual(permanentRuleCases.map(({ rule, failure }) => ({ rule, failure })));
    });
  },
  projectStorageIntegrationTimeout,
);

/** Rows of every given table of a canonical database, in a total order. */
function rowsOf(databasePath: string, tables: readonly string[]) {
  return Object.fromEntries(tables.map((table) => [table, orderedRows({ databasePath, table })]));
}

/**
 * Upgrades the Project once, proves it opens read-write on the target at schema 4 with the
 * Conversation tables, and that every listed pre-existing table kept its rows.
 */
async function expectUpgradedToSchemaFour(
  root: string,
  keptTables: readonly string[],
): Promise<void> {
  const before = rowsOf(generationPaths(root).canonical, keptTables);
  const fixture = createUpgradeStorageOwner(root);
  try {
    expect(await fixture.upgrade(openRequest)).toMatchObject({
      status: "ready",
      result: { status: "upgraded", generationId: upgradeIds.targetGenerationId },
    });
    await expectReadWriteOn(fixture.owner, upgradeIds.targetGenerationId);
  } finally {
    await fixture.owner.stop();
  }
  const target = path.join(
    generationPaths(root).project,
    upgradeIds.targetGenerationId,
    "slopstop.db",
  );
  expect(orderedRows({ databasePath: target, table: "schema_metadata" })).toEqual([
    schemaFourMetadata,
  ]);
  expect(tableNames({ databasePath: target })).toEqual(canonicalCurrentTables);
  expect(rowsOf(target, keptTables)).toEqual(before);
}

it(
  "upgrades a generation-three Project to schema 4",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationThreeProject(root);
    await expectUpgradedToSchemaFour(root, [
      ...comparableCanonicalTables,
      "repository_bindings",
      "project_workspaces",
    ]);
  },
  projectStorageIntegrationTimeout * 2,
);

it(
  "upgrades a generation-two Project to schema 4 in one upgrade",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createGenerationTwoProject(root);
    await expectUpgradedToSchemaFour(root, comparableCanonicalTables);
  },
  projectStorageIntegrationTimeout * 2,
);
