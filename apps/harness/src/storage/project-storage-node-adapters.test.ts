import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { decodeStrict, ProjectStorageCreateRequestSchema } from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import {
  createMigrationGuardFixture,
  generationOneGuardSpec,
  initialJournalEntry,
  type MigrationGuardFixture,
  validCanonicalMigrationSql,
} from "../../tests/integration/migration-guard-fixture.js";
import type { ProjectStorageOwnerPort } from "../project-storage-application.js";
import { createProjectStorageApplication } from "../project-storage-application.js";
import type { InStatement } from "./local-libsql-worker-client.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import {
  createNodeProjectStorageDependencies,
  createOpeningRelease,
  type DatabaseSpec,
  databaseSpecs,
  loadGeneratedMigrations,
  requireDeclaredSchemaObjects,
  withWriteTransaction,
} from "./project-storage-node-adapters.js";
import { initializeRetainedApplicationClient } from "./retained-application-client.js";

type MigrationGuardCase = Readonly<{
  name: string;
  expectedMessage: string;
  arrange(fixture: MigrationGuardFixture): Promise<DatabaseSpec>;
}>;

const migrationGuardCases: readonly MigrationGuardCase[] = [
  {
    name: "escaped trusted root",
    expectedMessage: "Generated migration root escaped trusted resources.",
    arrange: async () => {
      const spec = structuredClone(generationOneGuardSpec);
      Reflect.set(spec, "resourceKind", "../escaped");
      return spec;
    },
  },
  {
    name: "missing kind directory",
    expectedMessage: "Generated migration directory is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.kindRoot, { recursive: true });
      return databaseSpecs.canonical;
    },
  },
  {
    name: "non-directory kind resource",
    expectedMessage: "Generated migration directory is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.kindRoot, { recursive: true });
      await writeFile(fixture.kindRoot, "not a directory");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "symlink kind directory",
    expectedMessage: "Generated migration directory is unavailable.",
    arrange: async (fixture) => {
      const target = path.join(fixture.root, "kind-target");
      await rm(fixture.kindRoot, { recursive: true });
      await mkdir(target);
      await symlink(target, fixture.kindRoot, "junction");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "missing metadata directory",
    expectedMessage: "Generated migration metadata is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.metadataRoot, { recursive: true });
      return databaseSpecs.canonical;
    },
  },
  {
    name: "non-directory metadata resource",
    expectedMessage: "Generated migration metadata is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.metadataRoot, { recursive: true });
      await writeFile(fixture.metadataRoot, "not a directory");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "symlink metadata directory",
    expectedMessage: "Generated migration metadata is unavailable.",
    arrange: async (fixture) => {
      const target = path.join(fixture.root, "metadata-target");
      await rm(fixture.metadataRoot, { recursive: true });
      await mkdir(target);
      await symlink(target, fixture.metadataRoot, "junction");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "missing journal",
    expectedMessage: "Generated migration journal is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.journalPath);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "non-file journal resource",
    expectedMessage: "Generated migration journal is unavailable.",
    arrange: async (fixture) => {
      await rm(fixture.journalPath);
      await mkdir(fixture.journalPath);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "symlink journal resource",
    expectedMessage: "Generated migration journal is unavailable.",
    arrange: async (fixture) => {
      const target = path.join(fixture.root, "journal-target");
      await rm(fixture.journalPath);
      await mkdir(target);
      await symlink(target, fixture.journalPath, "junction");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "malformed journal",
    expectedMessage: "Generated migration journal is invalid.",
    arrange: async (fixture) => {
      await writeFile(fixture.journalPath, "{not-json");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "invalid journal shape",
    expectedMessage: "Generated migration journal is invalid.",
    arrange: async (fixture) => {
      await writeFile(
        fixture.journalPath,
        JSON.stringify({ version: "7", dialect: "postgresql", entries: [] }),
      );
      return databaseSpecs.canonical;
    },
  },
  {
    name: "non-contiguous journal index",
    expectedMessage: "Generated migration journal ordering is invalid.",
    arrange: async (fixture) => {
      await fixture.writeJournal([{ ...initialJournalEntry, idx: 1 }]);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "decreasing journal time",
    expectedMessage: "Generated migration journal ordering is invalid.",
    arrange: async (fixture) => {
      const second = { ...initialJournalEntry, idx: 1, when: 0, tag: "0001_next" };
      await fixture.writeJournal([initialJournalEntry, second]);
      await writeFile(path.join(fixture.kindRoot, "0001_next.sql"), validCanonicalMigrationSql);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "duplicate journal tag",
    expectedMessage: "Generated migration journal ordering is invalid.",
    arrange: async (fixture) => {
      await fixture.writeJournal([
        initialJournalEntry,
        { ...initialJournalEntry, idx: 1, when: 2 },
      ]);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "empty journal",
    expectedMessage: "Generated migration journal is empty.",
    arrange: async (fixture) => {
      await fixture.writeJournal([]);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "missing journal resource",
    expectedMessage: "Generated migration resources disagree with the journal.",
    arrange: async (fixture) => {
      await rm(fixture.sqlPath);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "extra journal resource",
    expectedMessage: "Generated migration resources disagree with the journal.",
    arrange: async (fixture) => {
      await writeFile(path.join(fixture.kindRoot, "extra.sql"), validCanonicalMigrationSql);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "wrong SQL resource type",
    expectedMessage: "Generated migration resource type is invalid.",
    arrange: async (fixture) => {
      await rm(fixture.sqlPath);
      await mkdir(fixture.sqlPath);
      return databaseSpecs.canonical;
    },
  },
  {
    name: "symlink SQL resource",
    expectedMessage: "Generated migration resource type is invalid.",
    arrange: async (fixture) => {
      const target = path.join(fixture.root, "sql-target");
      await rm(fixture.sqlPath);
      await mkdir(target);
      await symlink(target, fixture.sqlPath, "junction");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "empty SQL",
    expectedMessage: "Generated migration SQL is empty.",
    arrange: async (fixture) => {
      await writeFile(fixture.sqlPath, "");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "SQL without statements",
    expectedMessage: "Generated migration contains no statements.",
    arrange: async (fixture) => {
      await writeFile(fixture.sqlPath, "--> statement-breakpoint");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "implicit ledger",
    expectedMessage: "Generated migration uses a forbidden implicit ledger.",
    arrange: async (fixture) => {
      await writeFile(fixture.sqlPath, "CREATE TABLE __drizzle_migrations (id INTEGER);");
      return databaseSpecs.canonical;
    },
  },
  {
    name: "trigger",
    expectedMessage: "Generated migration creates a forbidden object.",
    arrange: async (fixture) => {
      await writeFile(
        fixture.sqlPath,
        `${validCanonicalMigrationSql}\nCREATE TRIGGER forbidden AFTER INSERT ON storage_identity BEGIN SELECT 1; END;`,
      );
      return databaseSpecs.canonical;
    },
  },
  {
    name: "view",
    expectedMessage: "Generated migration creates a forbidden object.",
    arrange: async (fixture) => {
      await writeFile(
        fixture.sqlPath,
        `${validCanonicalMigrationSql}\nCREATE VIEW forbidden AS SELECT 1;`,
      );
      return databaseSpecs.canonical;
    },
  },
  {
    name: "comment-separated trigger",
    expectedMessage: "Generated migration creates a forbidden object.",
    arrange: async (fixture) => {
      await writeFile(
        fixture.sqlPath,
        `${validCanonicalMigrationSql}\nCREATE /* authority bypass */ TRIGGER forbidden AFTER INSERT ON storage_identity BEGIN SELECT 1; END;`,
      );
      return databaseSpecs.canonical;
    },
  },
  {
    name: "comment-separated view",
    expectedMessage: "Generated migration creates a forbidden object.",
    arrange: async (fixture) => {
      await writeFile(
        fixture.sqlPath,
        `${validCanonicalMigrationSql}\nCREATE /* authority bypass */ VIEW forbidden AS SELECT 1;`,
      );
      return databaseSpecs.canonical;
    },
  },
  {
    name: "unknown table",
    expectedMessage: "Generated migration creates an unknown table.",
    arrange: async (fixture) => {
      await writeFile(
        fixture.sqlPath,
        `${validCanonicalMigrationSql}\nCREATE TABLE future_owner (id TEXT);`,
      );
      return databaseSpecs.canonical;
    },
  },
  {
    name: "incomplete table authority",
    expectedMessage: "Generated migration table authority is incomplete.",
    arrange: async (fixture) => {
      await writeFile(fixture.sqlPath, "CREATE TABLE schema_metadata (metadata_key TEXT);");
      return databaseSpecs.canonical;
    },
  },
];

async function captureMigrationGuardFailure(
  fixture: MigrationGuardFixture,
  spec: DatabaseSpec,
): Promise<unknown> {
  try {
    await loadGeneratedMigrations(fixture.root, {
      ...spec,
      schemaVersion: generationOneGuardSpec.schemaVersion,
      tables: generationOneGuardSpec.tables,
    });
    return undefined;
  } catch (error) {
    return error;
  }
}

it.each(migrationGuardCases)(
  "rejects generated migration guard: $name",
  async ({ arrange, expectedMessage }) => {
    const fixture = await createMigrationGuardFixture();
    try {
      const failure = await captureMigrationGuardFailure(fixture, await arrange(fixture));
      expect(failure).toBeInstanceOf(ProjectStorageBrokenError);
      if (!(failure instanceof ProjectStorageBrokenError)) {
        throw new Error("Expected generated migration guard to fail closed.");
      }
      expect(failure.message).toBe(expectedMessage);
      expect(String(failure)).not.toContain(fixture.root);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  },
);

type SchemaRows = readonly (readonly unknown[])[];

type SchemaExecutorFixture = Readonly<{
  tables: readonly string[];
  definitions?: SchemaRows;
  columnDefinitions?: SchemaRows;
  indexes?: SchemaRows;
  failure?: Error;
}>;

function schemaResult(columns: readonly string[], rows: SchemaRows) {
  return { columns, rows, rowsAffected: 0 };
}

function schemaDefinitions(fixture: SchemaExecutorFixture): SchemaRows {
  return (
    fixture.definitions ?? fixture.tables.map((table) => [table, `CREATE TABLE ${table} (id TEXT)`])
  );
}

function schemaQueryResult(sql: string, fixture: SchemaExecutorFixture) {
  if (sql.includes("pragma_table_xinfo")) {
    return schemaResult(
      ["cid", "name", "type", "notNull", "defaultValue", "primaryKey", "hidden"],
      fixture.columnDefinitions ?? [[0, "id", "TEXT", 0, null, 1, 0]],
    );
  }
  if (sql.includes("type IN ('trigger', 'view')")) return schemaResult(["name"], []);
  if (sql.startsWith("SELECT name FROM sqlite_schema")) {
    return schemaResult(
      ["name"],
      fixture.tables.map((table) => [table]),
    );
  }
  if (sql.startsWith("SELECT name AS tableName")) {
    return schemaResult(["tableName", "sql"], schemaDefinitions(fixture));
  }
  if (sql.includes("pragma_index_list")) {
    return schemaResult(
      ["name", "isUnique", "partial", "sequence", "columnName", "indexSql"],
      fixture.indexes ?? [],
    );
  }
  if (sql.includes("pragma_foreign_key_list")) {
    return schemaResult(
      [
        "id",
        "sequence",
        "referencedTable",
        "columnName",
        "referencedColumn",
        "onUpdate",
        "onDelete",
        "match",
      ],
      [],
    );
  }
  throw new Error("Unexpected schema authority query.");
}

function schemaExecutor(fixture: SchemaExecutorFixture) {
  return {
    execute: async (statement: InStatement | string) => {
      if (fixture.failure !== undefined) throw fixture.failure;
      const sql = typeof statement === "string" ? statement : statement.sql;
      return schemaQueryResult(sql, fixture);
    },
  };
}

function schemaSpec(input: Partial<DatabaseSpec> = {}): DatabaseSpec {
  return {
    ...databaseSpecs.canonical,
    tables: ["child"],
    columns: [
      {
        table: "child",
        cid: 0,
        name: "id",
        type: "TEXT",
        notNull: 0,
        defaultValue: null,
        primaryKey: 1,
        hidden: 0,
      },
    ],
    checks: [],
    indexes: [],
    foreignKeys: [],
    ...input,
  };
}

async function captureSchemaFailure(
  executor: ReturnType<typeof schemaExecutor>,
  spec: DatabaseSpec,
): Promise<unknown> {
  return requireDeclaredSchemaObjects(executor, spec).then(
    () => undefined,
    (error: unknown) => error,
  );
}

const columnDefinitionDrifts = [
  [1, "id", "TEXT", 1, null, 1, 0],
  [0, "other_id", "TEXT", 1, null, 1, 0],
  [0, "id", "INTEGER", 1, null, 1, 0],
  [0, "id", "TEXT", 0, null, 1, 0],
  [0, "id", "TEXT", 1, "'default'", 1, 0],
  [0, "id", "TEXT", 1, null, 0, 0],
  [0, "id", "TEXT", 1, null, 1, 1],
  [0, "id", "TEXT", 1, null, 1, 2],
  [0, "id", "TEXT", 1, null, 1, 3],
] as const;

it("rejects canonical column-definition drift", async () => {
  const spec = {
    ...schemaSpec(),
    columns: [
      {
        table: "child",
        cid: 0,
        name: "id",
        type: "TEXT",
        notNull: 1 as const,
        defaultValue: null,
        primaryKey: 1,
        hidden: 0,
      },
    ],
  };
  const unchanged = [0, "id", "TEXT", 1, null, 1, 0] as const;
  for (const drift of columnDefinitionDrifts) {
    await expect(
      requireDeclaredSchemaObjects(
        schemaExecutor({ tables: ["child"], columnDefinitions: [drift] }),
        spec,
      ),
    ).rejects.toEqual(
      new ProjectStorageBrokenError("Database required column definition is missing."),
    );
  }
  await expect(
    requireDeclaredSchemaObjects(
      schemaExecutor({
        tables: ["child"],
        columnDefinitions: [unchanged, [1, "extra", "TEXT", 0, null, 0, 0]],
      }),
      spec,
    ),
  ).rejects.toEqual(
    new ProjectStorageBrokenError("Database contains an unexpected column definition."),
  );
  await expect(
    requireDeclaredSchemaObjects(
      schemaExecutor({ tables: ["child"], columnDefinitions: [unchanged] }),
      spec,
    ),
  ).resolves.toBeUndefined();
});

it.each([
  {
    name: "partial index without a predicate",
    fixture: {
      tables: ["child"],
      indexes: [["child_idx", 0, 1, 0, "id", "CREATE INDEX child_idx ON child(id)"]],
    },
    spec: schemaSpec({
      indexes: [
        {
          table: "child",
          name: "child_idx",
          unique: false,
          partial: true,
          columns: ["id"],
          predicate: "id IS NOT NULL",
        },
      ],
    }),
    expectedMessage: "Database schema expression is invalid.",
  },
  {
    name: "CHECK without a named constraint prefix",
    fixture: { tables: ["child"], definitions: [["child", "CHECK(1)"]] },
    spec: schemaSpec(),
    expectedMessage: "Database contains an unexpected CHECK constraint.",
  },
  {
    name: "inconsistent rows for one named index",
    fixture: {
      tables: ["child"],
      indexes: [
        ["child_idx", 0, 0, 0, "left_id", "CREATE INDEX child_idx ON child(left_id)"],
        ["child_idx", 1, 0, 1, "right_id", "CREATE UNIQUE INDEX child_idx ON child(right_id)"],
      ],
    },
    spec: schemaSpec(),
    expectedMessage: "Database named index metadata is inconsistent.",
  },
  {
    name: "unexpected table set",
    fixture: { tables: ["other"] },
    spec: schemaSpec(),
    expectedMessage: "Database contains an unexpected table set.",
  },
] as const)(
  "rejects malformed schema authority: $name",
  async ({ fixture, spec, expectedMessage }) => {
    await expect(captureSchemaFailure(schemaExecutor(fixture), spec)).resolves.toMatchObject({
      name: "ProjectStorageBrokenError",
      message: expectedMessage,
    });
  },
);

it("wraps unexpected schema authority failures without losing the internal cause", async () => {
  const cause = new Error("private schema failure");

  await expect(
    captureSchemaFailure(schemaExecutor({ tables: [], failure: cause }), schemaSpec()),
  ).resolves.toMatchObject({
    name: "ProjectStorageBrokenError",
    message: "Database schema authority is invalid.",
    cause,
  });
});

type RollbackFailurePoint = "operation" | "commit";
const rollbackFailurePoints: readonly RollbackFailurePoint[] = ["operation", "commit"];
const createRequest = decodeStrict(ProjectStorageCreateRequestSchema, {
  projectId: "00000000-0000-4000-8000-000000000010",
  createRequestId: "00000000-0000-4000-8000-000000000011",
});

function rollbackFixture(failurePoint: RollbackFailurePoint) {
  const privateRoot = "C:\\private\\project-storage";
  const operationError = new Error(`${privateRoot}: primary transaction failure`);
  const rollbackError = new Error(`${privateRoot}: rollback failure`);
  const calls: string[] = [];
  let closed = false;
  const transaction = {
    get closed(): boolean {
      return closed;
    },
    commit: vi.fn(async () => {
      calls.push("commit");
      if (failurePoint === "commit") throw operationError;
      closed = true;
    }),
    rollback: vi.fn(async () => {
      calls.push("rollback");
      throw rollbackError;
    }),
    close: vi.fn(() => {
      calls.push("close");
      closed = true;
    }),
  };
  const client = {
    transaction: vi.fn(async (mode: "write") => {
      expect(mode).toBe("write");
      return transaction;
    }),
  };
  return { privateRoot, operationError, rollbackError, calls, transaction, client };
}

async function exerciseRollbackFailure(failurePoint: RollbackFailurePoint) {
  const fixture = rollbackFixture(failurePoint);
  let internalFailure: ProjectStorageBrokenError | undefined;
  const owner: ProjectStorageOwnerPort = {
    open: async () => ({ status: "unavailable", message: "Unused test operation." }),
    create: async () => {
      try {
        await withWriteTransaction(fixture.client, async () => {
          fixture.calls.push("operation");
          if (failurePoint === "operation") throw fixture.operationError;
          return "completed";
        });
        return { status: "broken", message: "Transaction unexpectedly succeeded." };
      } catch (error) {
        if (!(error instanceof ProjectStorageBrokenError)) throw error;
        internalFailure = error;
        return { status: "broken", message: error.message };
      }
    },
    close: async () => ({ status: "unavailable", message: "Unused test operation." }),
    stop: () => Promise.resolve(),
  };
  const result = await createProjectStorageApplication(owner).create(createRequest);
  if (internalFailure === undefined) {
    throw new Error("Expected a Project Storage rollback failure.");
  }
  return { fixture, internalFailure, result };
}

it.each(rollbackFailurePoints)(
  "preserves %s and rollback failures internally while exposing one generic failure",
  async (failurePoint) => {
    const { fixture, internalFailure, result } = await exerciseRollbackFailure(failurePoint);
    expect(fixture.transaction.rollback).toHaveBeenCalledOnce();
    expect(fixture.transaction.close).toHaveBeenCalledOnce();
    expect(fixture.transaction.closed).toBe(true);
    expect(fixture.calls).toEqual(
      failurePoint === "operation"
        ? ["operation", "rollback", "close"]
        : ["operation", "commit", "rollback", "close"],
    );
    expect(internalFailure.message).toBe("Project Storage transaction rollback failed.");
    expect(internalFailure.cause).toBeInstanceOf(AggregateError);
    if (!(internalFailure.cause instanceof AggregateError)) {
      throw new Error("Expected an aggregate transaction failure cause.");
    }
    expect(internalFailure.cause.message).toBe(
      "Project Storage transaction and rollback both failed.",
    );
    expect(internalFailure.cause.errors).toHaveLength(2);
    expect(internalFailure.cause.errors[0]).toBe(fixture.operationError);
    expect(internalFailure.cause.errors[1]).toBe(fixture.rollbackError);
    expect(result).toEqual({
      status: "broken",
      request: createRequest,
      diagnostic: {
        code: "PROJECT_STORAGE_OWNER_FAILED",
        message: "Project Storage transaction rollback failed.",
      },
    });
    expect(JSON.stringify(result)).not.toContain(fixture.privateRoot);
    expect(JSON.stringify(result)).not.toContain(fixture.operationError.message);
    expect(JSON.stringify(result)).not.toContain(fixture.rollbackError.message);
    expect(JSON.stringify(result)).not.toContain(
      "Project Storage transaction and rollback both failed.",
    );
  },
);

it("preserves operation, rollback, and close failures", async () => {
  const fixture = rollbackFixture("operation");
  const closeError = new Error(`${fixture.privateRoot}: close failure`);
  fixture.transaction.close.mockImplementation(async () => {
    fixture.calls.push("close");
    throw closeError;
  });

  let failure: unknown;
  try {
    await withWriteTransaction(fixture.client, async () => {
      fixture.calls.push("operation");
      throw fixture.operationError;
    });
  } catch (error) {
    failure = error;
  }

  expect(failure).toBeInstanceOf(ProjectStorageBrokenError);
  if (!(failure instanceof ProjectStorageBrokenError)) {
    throw new Error("Expected a Project Storage transaction failure.");
  }
  expect(failure.message).toBe("Project Storage transaction rollback failed.");
  expect(failure.cause).toBeInstanceOf(AggregateError);
  if (!(failure.cause instanceof AggregateError)) {
    throw new Error("Expected an aggregate transaction failure cause.");
  }
  expect(failure.cause.message).toBe(
    "Project Storage transaction, rollback, and close all failed.",
  );
  expect(failure.cause.errors).toEqual([fixture.operationError, fixture.rollbackError, closeError]);
  expect(fixture.calls).toEqual(["operation", "rollback", "close"]);
  expect(fixture.transaction.rollback).toHaveBeenCalledOnce();
  expect(fixture.transaction.close).toHaveBeenCalledOnce();
});

it("releases canonical then runtime regardless of probe completion order", async () => {
  const releaseOrder: string[] = [];
  const canonicalFailure = new Error("canonical close failed");
  const runtimeFailure = new Error("runtime close failed");
  const openedClients: {
    canonical: { close(): Promise<void> } | undefined;
    runtime: { close(): Promise<void> } | undefined;
  } = { canonical: undefined, runtime: undefined };
  const release = createOpeningRelease(openedClients);
  const runtimeClose = vi.fn(async () => {
    releaseOrder.push("runtime");
    throw runtimeFailure;
  });
  const canonicalClose = vi.fn(async () => {
    releaseOrder.push("canonical");
    throw canonicalFailure;
  });
  openedClients.runtime = { close: runtimeClose };
  openedClients.canonical = { close: canonicalClose };

  const firstRelease = release();
  const repeatedRelease = release();
  expect(repeatedRelease).toBe(firstRelease);
  let failure: unknown;
  try {
    await firstRelease;
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(AggregateError);
  if (!(failure instanceof AggregateError)) {
    throw new Error("Expected Project Storage database release to fail with AggregateError.");
  }
  expect(failure.message).toBe("Project Storage database release failed.");
  expect(failure.errors).toEqual([canonicalFailure, runtimeFailure]);
  expect(releaseOrder).toEqual(["canonical", "runtime"]);
  expect(canonicalClose).toHaveBeenCalledOnce();
  expect(runtimeClose).toHaveBeenCalledOnce();
});

it("retains before initialization and clears before closing a failed client", async () => {
  const initializationFailure = new Error("application initialization failed");
  const ownershipEvents: string[] = [];
  const client = {
    close: vi.fn(async () => {
      ownershipEvents.push("close");
    }),
  };
  let retained: typeof client | undefined;

  await expect(
    initializeRetainedApplicationClient(
      client,
      (candidate) => {
        retained = candidate;
        ownershipEvents.push(candidate === undefined ? "clear" : "retain");
      },
      async (candidate) => {
        expect(candidate).toBe(client);
        expect(retained).toBe(client);
        ownershipEvents.push("initialize");
        throw initializationFailure;
      },
    ),
  ).rejects.toBe(initializationFailure);
  expect(ownershipEvents).toEqual(["retain", "initialize", "clear", "close"]);
  expect(retained).toBeUndefined();
  expect(client.close).toHaveBeenCalledOnce();
});

it.each(["existing", "mutable"] as const)(
  "retains then closes a failing %s application client exactly once",
  async (kind) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-application-client-"));
    const migrationResourcesRoot = path.resolve(import.meta.dirname, "../../drizzle");
    try {
      if (kind === "existing") {
        const initializer = createNodeProjectStorageDependencies({
          applicationStorageRoot: root,
          migrationResourcesRoot,
          applicationVersion: "0.0.0",
        });
        try {
          await initializer.registry.prepareCreate();
        } finally {
          await initializer.registry.stop();
        }
      }
      const initializationFailure = new Error("application initialization failed");
      let closeCount: (() => number) | undefined;
      const dependencies = createNodeProjectStorageDependencies({
        applicationStorageRoot: root,
        migrationResourcesRoot,
        applicationVersion: "0.0.0",
        initializeApplicationClient: async (client) => {
          const close = vi.spyOn(client, "close");
          closeCount = () => close.mock.calls.length;
          throw initializationFailure;
        },
      });

      try {
        const operation =
          kind === "existing"
            ? dependencies.opening.inspect(createRequest.projectId)
            : dependencies.registry.prepareCreate();
        await expect(operation).rejects.toMatchObject({
          name: "ProjectStorageBrokenError",
          message:
            kind === "existing"
              ? "Project Storage application authority is invalid."
              : "Project Storage application authority cannot be created.",
        });
        const observeCloseCount = closeCount;
        if (observeCloseCount === undefined) {
          throw new Error("Application client close observation is unavailable.");
        }
        expect(observeCloseCount()).toBe(1);
      } finally {
        await dependencies.registry.stop();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

it("preserves application initialization and close failures in order", async () => {
  const initializationFailure = new Error("application initialization failed");
  const closeFailure = new Error("application close failed");
  const client = {
    close: vi.fn(async () => {
      throw closeFailure;
    }),
  };
  let retained: typeof client | undefined;

  let failure: unknown;
  try {
    await initializeRetainedApplicationClient(
      client,
      (candidate) => {
        retained = candidate;
      },
      async () => {
        throw initializationFailure;
      },
    );
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(AggregateError);
  if (!(failure instanceof AggregateError)) {
    throw new Error("Expected application client initialization to fail with AggregateError.");
  }
  expect(failure.message).toBe("Project Storage application client initialization failed.");
  expect(failure.errors).toEqual([initializationFailure, closeFailure]);
  expect(retained).toBeUndefined();
  expect(client.close).toHaveBeenCalledOnce();
});
