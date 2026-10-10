import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  type CanonicalProjectCommandResult,
  CommandIdSchema,
  decodeStrict,
  ProjectActivationIdSchema,
  type ProjectId,
} from "@slopstop/protocol";
import { Schema } from "effect";
import { expect } from "vitest";
import { createActiveProjectCoordinator } from "../../src/active-project-coordinator.js";
import {
  CanonicalEventInputSchema,
  createCanonicalCommandRegistry,
  defineCanonicalCommand,
} from "../../src/canonical-command-registry.js";
import {
  type CanonicalProjectWriter,
  createCanonicalProjectWriter,
} from "../../src/canonical-project-writer.js";
import {
  createCanonicalCommandRepositoryFactory,
  WriterCapabilityTokenSchema,
} from "../../src/storage/canonical-command-repository.js";
import { createNodeCanonicalWriterLeaseFactory } from "../../src/storage/canonical-writer-lease.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
} from "../../src/storage/local-libsql-worker-client.js";
import {
  parseProjectStorageManifest,
  serializeProjectStorageManifest,
} from "../../src/storage/project-storage-manifest.js";
import { historicalMigrationPath } from "./project-storage-historical-fixture.js";
import {
  generationPaths,
  migrationRequiredHealth,
  openRequest,
} from "./project-storage-open-fixture.js";
import {
  chainedUpgradeTimes,
  createRequest,
  createUpgradeStorageOwner,
  retryUpgradeIds,
  thirdUpgradeIds,
  thirdUpgradeTimes,
  upgradeIds,
} from "./project-storage-runtime-fixture.js";

type StorageOwner = ReturnType<typeof createUpgradeStorageOwner>["owner"];

const noteAggregateId = decodeStrict(
  CanonicalEventInputSchema.fields.aggregateId,
  "77777777-7777-4777-8777-777777777701",
);

/** A test-only command that writes no table: one event per applied note, empty notes refused. */
/**
 * Faults for the writer's worker client: the next statement whose SQL matches `match` throws
 * `error` instead of running, once, first in first out.
 */
export const writerClientFaults: { match: RegExp; error: unknown }[] = [];

function injectedFault(statement: unknown): unknown {
  const sql = typeof statement === "string" ? statement : Reflect.get(Object(statement), "sql");
  const index = writerClientFaults.findIndex((fault) => fault.match.test(String(sql)));
  return index < 0 ? undefined : writerClientFaults.splice(index, 1)[0]?.error;
}

/** Raw closes of the writer's worker clients, counted for the force-close proof (T1). */
export const writerClientCloses = { count: 0 };

/** Runs `operation` unless a fault named `name` is queued; the fault then skips the real call. */
function unlessFaulted(name: string, operation: () => Promise<void>): Promise<void> {
  const fault = injectedFault(name);
  return fault === undefined ? operation() : Promise.reject(fault);
}

/**
 * The writer's client and its transactions, with `writerClientFaults` applied to `execute` and
 * to the named transaction stages "commit", "rollback" and "close".
 */
function faultingClient(client: LocalLibsqlClient): LocalLibsqlClient {
  const execute =
    <Executor extends Pick<LocalLibsqlClient, "execute">>(
      executor: Executor,
    ): Executor["execute"] =>
    (statement, args) => {
      const fault = injectedFault(statement);
      return fault === undefined ? executor.execute(statement, args) : Promise.reject(fault);
    };
  return {
    execute: execute(client),
    close: () => {
      writerClientCloses.count += 1;
      return client.close();
    },
    transaction: async (mode) => {
      const tx = await client.transaction(mode);
      return {
        get closed() {
          return tx.closed;
        },
        execute: execute(tx),
        // A faulted stage never runs: a faulted commit and rollback leave the write lock held.
        commit: () => unlessFaulted("commit", () => tx.commit()),
        rollback: () => unlessFaulted("rollback", () => tx.rollback()),
        close: () => unlessFaulted("close", () => tx.close()),
      };
    },
  };
}

/**
 * Holds the next note settlements inside their transactions: each entry runs, and is awaited,
 * at the start of one handler, first in first out.
 */
export const noteSettlementHolds: (() => Promise<void>)[] = [];

const recordNoteCommand = defineCanonicalCommand({
  type: "fixture.record-note",
  version: 1,
  payloadSchema: Schema.Struct({ note: Schema.String.check(Schema.isMinLength(1)) }),
  handle: async ({ transaction, payload }) => {
    await noteSettlementHolds.shift()?.();
    const counted = await transaction.execute({
      sql: "SELECT COUNT(*) FROM canonical_events WHERE aggregate_type = ? AND aggregate_id = ?",
      args: ["fixture.note", noteAggregateId],
    });
    const previous = Number(counted.rows[0]?.[0] ?? 0);
    return {
      outcome: "applied",
      events: [
        {
          aggregateType: "fixture.note",
          aggregateId: noteAggregateId,
          aggregateVersion: previous + 1,
          eventType: "fixture.note.recorded",
          eventVersion: 1,
          payload: { note: payload.note },
        },
      ],
    };
  },
});

type SubmitNote = (note: string) => Promise<CanonicalProjectCommandResult>;

type Coordinator = ReturnType<typeof createActiveProjectCoordinator>;

/** The activation's lifecycle, for bodies that release it themselves. */
export type WriterControl = Readonly<{
  /** The writer of the latest activation (a switch replaces it). */
  currentWriter(): CanonicalProjectWriter;
  /** Switches from the first activation to the same Project: a release and a new activation. */
  switchToSelf(): ReturnType<Coordinator["switchProject"]>;
  stop(): Promise<void>;
}>;

type Activation = Awaited<
  ReturnType<ReturnType<typeof createActiveProjectCoordinator>["activate"]>
>;

/** The activation id and writer, when the activation is read-write. */
function readWriteWriter(activation: Activation, writer: CanonicalProjectWriter | undefined) {
  const readWrite = activation.status === "active" && activation.access === "read-write";
  if (!readWrite || writer === undefined)
    throw new Error(`Fixture writer activation failed: ${JSON.stringify(activation)}`);
  return { activationId: activation.activationId, writer };
}

/**
 * Activates the Project read-write with the fixture command registry, runs with a note submitter
 * and the activation's real writer, then closes.
 */
export async function withFixtureWriter(
  { storage, projectId }: Readonly<{ storage: StorageOwner; projectId: ProjectId }>,
  run: (
    submit: SubmitNote,
    writer: CanonicalProjectWriter,
    control: WriterControl,
  ) => Promise<void>,
): Promise<void> {
  const now = () => new Date().toISOString();
  let writer: CanonicalProjectWriter | undefined;
  const coordinator = createActiveProjectCoordinator({
    storage,
    createWriter: (input) => {
      writer = createCanonicalProjectWriter(input);
      return writer;
    },
    leases: createNodeCanonicalWriterLeaseFactory(),
    repositories: createCanonicalCommandRepositoryFactory({
      registry: createCanonicalCommandRegistry([recordNoteCommand]),
      createReceiptId: randomUUID,
      createEventId: randomUUID,
      now,
      openClient: (databasePath) =>
        faultingClient(createWorkerLocalLibsqlClient(databasePath, "generation")),
      sha256Text: async (text) => createHash("sha256").update(text).digest("hex"),
      createHandoffId: randomUUID,
      createRecoveryRecordId: randomUUID,
    }),
    createActivationId: () => decodeStrict(ProjectActivationIdSchema, randomUUID()),
    createWriterToken: () =>
      decodeStrict(WriterCapabilityTokenSchema, randomBytes(32).toString("hex")),
    now,
  });
  try {
    const activation = await coordinator.activate({ projectId });
    const active = readWriteWriter(activation, writer);
    await run(
      (note) =>
        coordinator.execute({
          projectId,
          activationId: active.activationId,
          command: {
            commandId: decodeStrict(CommandIdSchema, randomUUID()),
            type: recordNoteCommand.type,
            version: recordNoteCommand.version,
            payload: { note },
          },
        }),
      active.writer,
      {
        currentWriter: () => writer ?? active.writer,
        switchToSelf: () =>
          coordinator.switchProject({
            from: { projectId, activationId: active.activationId },
            to: { projectId },
          }),
        stop: () => coordinator.stop(),
      },
    );
  } finally {
    await coordinator.stop();
  }
}

function expectSettled(result: CanonicalProjectCommandResult, outcome: "applied" | "rejected") {
  expect(result).toMatchObject({ status: "settled", receipt: { outcome } });
}

export const comparableCanonicalTables = [
  "canonical_events",
  "command_idempotency",
  "command_receipts",
  "command_rejections",
  "project_state",
  "writer_fence",
  "writer_generations",
  "writer_handoffs",
  "writer_recovery_records",
] as const;

function count({ database, table }: Readonly<{ database: DatabaseSync; table: string }>): number {
  const row = database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get();
  return Number(row?.["total"]);
}

function writerIdentity(database: DatabaseSync) {
  return database.prepare("SELECT project_id, last_writer_generation FROM project_state").get() as {
    project_id: string;
    last_writer_generation: number;
  };
}

/** Fills the comparable tables the real writer leaves empty with one resolved, consistent row. */
function seedEmptyComparableRows({ canonicalPath }: Readonly<{ canonicalPath: string }>): void {
  const database = new DatabaseSync(canonicalPath);
  try {
    const { project_id: projectId } = writerIdentity(database);
    if (count({ database, table: "writer_recovery_records" }) === 0) {
      database
        .prepare(
          `INSERT INTO writer_recovery_records (project_id, recovery_record_id, writer_generation,
            reason, command_id, command_fingerprint, observed_at, resolution,
            resolved_by_writer_generation, resolved_at)
          VALUES (?, ?, 1, 'abandoned-active-fence', NULL, NULL, ?, 'generation-superseded', 2, ?)`,
        )
        .run(projectId, randomUUID(), new Date().toISOString(), new Date().toISOString());
    }
    for (const table of comparableCanonicalTables) {
      expect(count({ database, table }), table).toBeGreaterThanOrEqual(1);
    }
  } finally {
    database.close();
  }
}

function sqliteSchemaRows(database: DatabaseSync) {
  return database
    .prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name")
    .all();
}

async function referenceGenerationTwoSchema() {
  const golden = await readFile(
    path.resolve(import.meta.dirname, "../fixtures/canonical-project-writer-generation-2.sql"),
    "utf8",
  );
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(await readFile(historicalMigrationPath, "utf8"));
    database.exec(golden);
    return sqliteSchemaRows(database);
  } finally {
    database.close();
  }
}

/** The schema-4 Conversation tables, children first; a rewind drops them while still empty. */
const conversationTables = ["conversation_messages", "conversation_branches", "conversations"];

function dropConversationTables(database: DatabaseSync): void {
  for (const table of conversationTables) {
    expect(count({ database, table }), table).toBe(0);
    database.exec(`DROP TABLE ${table}`);
  }
}

type CanonicalGeneration = Readonly<{ schemaVersion: 2 | 3; lastMigrationId: string }>;

/** Re-seals the manifest's canonical entry for a rewound schema and the rewound bytes. */
type GenerationFiles = Readonly<{ manifest: string; canonical: string }>;

async function resealRewoundManifest(
  paths: GenerationFiles,
  generation: CanonicalGeneration,
): Promise<void> {
  const manifest = parseProjectStorageManifest(await readFile(paths.manifest, "utf8"));
  const bytes = await readFile(paths.canonical);
  await writeFile(
    paths.manifest,
    serializeProjectStorageManifest({
      ...manifest,
      canonical: {
        ...manifest.canonical,
        formatVersion: 1,
        ...generation,
        activationBaseline: {
          algorithm: "sha256",
          sizeBytes: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      },
    }),
  );
}

/** One generation directory of the fixture Project. */
function generationDirectory(root: string, generationId: string): string {
  return path.join(generationPaths(root).project, generationId);
}

/**
 * Rewinds one generation's canonical database to schema 3 by dropping the empty schema-4
 * tables, and re-seals its manifest. Any Project's generation directory, registered or not.
 */
export async function rewindToGenerationThree({
  generationDirectory: directory,
}: Readonly<{ generationDirectory: string }>): Promise<void> {
  const paths: GenerationFiles = {
    manifest: path.join(directory, "manifest.json"),
    canonical: path.join(directory, "slopstop.db"),
  };
  const database = new DatabaseSync(paths.canonical);
  try {
    dropConversationTables(database);
    database
      .prepare(
        `UPDATE schema_metadata SET schema_version = 3,
          last_migration_id = '0002_initial_repository_binding'
        WHERE metadata_key = 'canonical'`,
      )
      .run();
  } finally {
    database.close();
  }
  await resealRewoundManifest(paths, {
    schemaVersion: 3,
    lastMigrationId: "0002_initial_repository_binding",
  });
}

async function rewindToGenerationTwo({ root }: Readonly<{ root: string }>): Promise<void> {
  const paths = generationPaths(root);
  const database = new DatabaseSync(paths.canonical);
  try {
    dropConversationTables(database);
    expect(count({ database, table: "repository_bindings" })).toBe(0);
    expect(count({ database, table: "project_workspaces" })).toBe(0);
    database.exec("DROP TABLE project_workspaces");
    database.exec("DROP TABLE repository_bindings");
    database
      .prepare(
        `UPDATE schema_metadata SET database_kind = 'canonical', format_version = 1,
          schema_version = 2, last_migration_id = '0001_canonical_project_writer'
        WHERE metadata_key = 'canonical'`,
      )
      .run();
    expect(sqliteSchemaRows(database)).toEqual(await referenceGenerationTwoSchema());
    expect(database.prepare("SELECT last_project_sequence FROM project_state").get()).toEqual({
      last_project_sequence: 3,
    });
  } finally {
    database.close();
  }
  await resealRewoundManifest(paths, {
    schemaVersion: 2,
    lastMigrationId: "0001_canonical_project_writer",
  });
}

/** Creates the Project and writes it through three read-write activations (sequence 3, generations 1 to 3). */
async function createWrittenProject(root: string): Promise<void> {
  const fixture = createUpgradeStorageOwner(root);
  const writer = { storage: fixture.owner, projectId: createRequest.projectId };
  try {
    expect(await fixture.owner.create(createRequest)).toMatchObject({
      status: "ready",
      result: { status: "created" },
    });
    await withFixtureWriter(writer, async (submit) => {
      expectSettled(await submit("first note"), "applied");
      expectSettled(await submit(""), "rejected");
    });
    await withFixtureWriter(writer, async () => undefined);
    seedEmptyComparableRows({ canonicalPath: generationPaths(root).canonical });
    await withFixtureWriter(writer, async (submit) => {
      expectSettled(await submit("second note"), "applied");
    });
  } finally {
    await fixture.owner.stop();
  }
}

/** A rewound Project's activation answers safe mode `migration-required`. */
async function expectMigrationRequired(root: string): Promise<void> {
  const check = createUpgradeStorageOwner(root);
  try {
    const activation = await check.owner.acquireActivation(openRequest);
    expect(activation).toMatchObject({
      status: "ready",
      session: {
        mode: "safe-mode",
        result: { canonicalHealth: migrationRequiredHealth, runtimeHealth: { status: "healthy" } },
      },
    });
    if (activation.status === "ready") await activation.session.close();
  } finally {
    await check.owner.stop();
  }
}

/**
 * A generation-two Project built through the real writer, then rewound to canonical schema 2
 * by dropping the empty schema-3 and schema-4 tables.
 */
export async function createGenerationTwoProject(root: string): Promise<void> {
  await createWrittenProject(root);
  await rewindToGenerationTwo({ root });
  await expectMigrationRequired(root);
}

/**
 * A generation-three Project built through the real writer, then rewound to canonical schema 3
 * by dropping the empty schema-4 tables.
 */
export async function createGenerationThreeProject(root: string): Promise<void> {
  await createWrittenProject(root);
  await rewindToGenerationThree({ generationDirectory: generationPaths(root).generation });
  await expectMigrationRequired(root);
}

/** Every row of a table in a total order over all its columns. */
export function orderedRows({
  databasePath,
  table,
}: Readonly<{ databasePath: string; table: string }>): unknown[] {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all();
    const order = columns.map((_, index) => index + 1).join(", ");
    return database.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all();
  } finally {
    database.close();
  }
}

export function tableNames({ databasePath }: Readonly<{ databasePath: string }>): string[] {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return database
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => String(row["name"]));
  } finally {
    database.close();
  }
}

export function integrity({ databasePath }: Readonly<{ databasePath: string }>) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return {
      integrity: database.prepare("PRAGMA integrity_check").all(),
      foreignKeys: database.prepare("PRAGMA foreign_key_check").all(),
    };
  } finally {
    database.close();
  }
}

async function filesUnder({
  directory,
}: Readonly<{ directory: string }>): Promise<Record<string, string>> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const files: Record<string, string> = {};
  for (const entry of entries) {
    const entryPath = path.join(entry.parentPath, entry.name);
    const relative = path.relative(directory, entryPath).split(path.sep).join("/");
    files[relative] = entry.isFile()
      ? createHash("sha256")
          .update(await readFile(entryPath))
          .digest("hex")
      : "directory";
  }
  return files;
}

/** Every path under `projects/` with its file digest, plus every row of every registry table. */
export async function storageSnapshot(root: string) {
  const application = path.join(root, "application.db");
  return {
    files: await filesUnder({ directory: path.join(root, "projects") }),
    registry: Object.fromEntries(
      tableNames({ databasePath: application }).map((table) => [
        table,
        orderedRows({ databasePath: application, table }),
      ]),
    ),
  };
}

/** A directory whose handles are all released can be renamed away and back. */
export async function expectReleased({
  directory,
}: Readonly<{ directory: string }>): Promise<void> {
  const away = `${directory}-released`;
  await rename(directory, away);
  await rename(away, directory);
}

/**
 * A Project as C1-0 left it: a generation-two Project upgraded once, whose active generation is
 * at canonical schema 3. The upgrade now targets schema 4, so the target is rewound to 3.
 */
export async function createUpgradedOnceProject({
  root,
}: Readonly<{ root: string }>): Promise<void> {
  await createUpgradedProject({ root });
  await rewindToGenerationThree({
    generationDirectory: generationDirectory(root, upgradeIds.targetGenerationId),
  });
}

/** An upgraded-once Project upgraded again (attempt-2 ids, later instants): a chain of two. */
export async function createChainedProject({ root }: Readonly<{ root: string }>): Promise<void> {
  await createUpgradedOnceProject({ root });
  const upgrader = createUpgradeStorageOwner(root, { attempt: 2, times: chainedUpgradeTimes });
  try {
    expect(await upgrader.upgrade(openRequest)).toMatchObject({
      status: "ready",
      result: { status: "upgraded" },
    });
  } finally {
    await upgrader.owner.stop();
  }
}

/**
 * A chain of three, every link a real upgrade: the chain of two's active generation is rewound to
 * schema 3 and upgraded again (third ids, later instants). No real third migration exists, so the
 * third link re-applies `0003` to the rewound generation.
 */
export async function createThreeLinkChainProject({
  root,
}: Readonly<{ root: string }>): Promise<void> {
  await createChainedProject({ root });
  await rewindToGenerationThree({
    generationDirectory: generationDirectory(root, retryUpgradeIds.targetGenerationId),
  });
  const upgrader = createUpgradeStorageOwner(root, {
    ...thirdUpgradeIds,
    times: thirdUpgradeTimes,
  });
  try {
    expect(await upgrader.upgrade(openRequest)).toMatchObject({
      status: "ready",
      result: { status: "upgraded", generationId: thirdUpgradeIds.targetGenerationId },
    });
  } finally {
    await upgrader.owner.stop();
  }
}

/** A generation-two Project upgraded once through the real owner. */
export async function createUpgradedProject({ root }: Readonly<{ root: string }>): Promise<void> {
  await createGenerationTwoProject(root);
  const upgrader = createUpgradeStorageOwner(root);
  try {
    expect(await upgrader.upgrade(openRequest)).toMatchObject({
      status: "ready",
      result: { status: "upgraded" },
    });
  } finally {
    await upgrader.owner.stop();
  }
}
