import { expect, it, vi } from "vitest";
import { createRequest } from "../../tests/integration/project-storage-create-request.js";
import type { ProjectStorageOwnerPort } from "../project-storage-application.js";
import { createProjectStorageApplication } from "../project-storage-application.js";
import type { InStatement } from "./local-libsql-worker-client.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import {
  createOpeningRelease,
  type DatabaseSpec,
  databaseSpecs,
  requireDeclaredSchemaObjects,
  withWriteTransaction,
} from "./project-storage-node-adapters.js";
import { initializeRetainedApplicationClient } from "./retained-application-client.js";

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
