import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  CanonicalDatabaseLineageIdSchema,
  type ProjectStorageCreateRequest,
  ProjectStorageCreateRequestSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "@slopstop/protocol";
import { expect, it } from "vitest";
import { parseProjectStorageManifest } from "../../src/storage/project-storage-manifest.js";
import {
  createNodeProjectStorageDependencies,
  type DatabaseSpec,
  databaseSpecs,
  requireDeclaredSchemaObjects,
} from "../../src/storage/project-storage-node-adapters.js";
import {
  type CreationCheckpoint,
  createProjectStorageOwner,
} from "../../src/storage/project-storage-store.js";
import {
  checkedInMigrationRoot,
  createRequest,
  createStorageRuntimeForRoot,
  createTemporaryApplicationRoot,
  expectedCreatedResult,
  fixedCreationIds,
  pathExists,
  projectStorageIntegrationTimeout,
  readRows,
  sha256File,
} from "./project-storage-create-fixture.js";
import {
  type SqlTransform,
  sameNameSchemaMutationCases,
  schemaObjectOmissionCases,
  sqliteExecutor,
} from "./project-storage-schema-cases.js";

type CreatedGenerationPaths = Readonly<{
  directory: string;
  manifest: string;
  canonical: string;
  runtime: string;
}>;

function createdGenerationPaths(input: { root: string }): CreatedGenerationPaths {
  const directory = path.join(
    input.root,
    "projects",
    createRequest.projectId,
    fixedCreationIds.generationId,
  );
  return {
    directory,
    manifest: path.join(directory, "manifest.json"),
    canonical: path.join(directory, "slopstop.db"),
    runtime: path.join(directory, "mastra.db"),
  };
}

async function readCreatedAuthority(input: { root: string; paths: CreatedGenerationPaths }) {
  const manifest = parseProjectStorageManifest(await readFile(input.paths.manifest, "utf8"));
  const [registryRows, canonicalRows, runtimeRows] = await Promise.all([
    readRows(
      path.join(input.root, "application.db"),
      `SELECT r.project_id, r.storage_id, r.active_generation_id,
      g.canonical_lineage_id, g.runtime_lineage_id
      FROM storage_registrations r
      JOIN storage_generations g
        ON g.storage_id = r.storage_id AND g.generation_id = r.active_generation_id`,
    ),
    readRows(
      input.paths.canonical,
      `SELECT project_id, storage_id, generation_id, canonical_database_lineage_id
      FROM storage_identity`,
    ),
    readRows(
      input.paths.runtime,
      `SELECT project_id, storage_id, generation_id, runtime_database_lineage_id
      FROM slopstop_runtime_storage_identity`,
    ),
  ]);
  return { manifest, registryRows, canonicalRows, runtimeRows };
}

async function expectActivationBaselines(
  paths: CreatedGenerationPaths,
  manifest: ReturnType<typeof parseProjectStorageManifest>,
): Promise<void> {
  await expect(
    Promise.all([sha256File(paths.canonical), sha256File(paths.runtime)]),
  ).resolves.toEqual([
    manifest.canonical.activationBaseline.sha256,
    manifest.runtime.activationBaseline.sha256,
  ]);
  const [canonicalSize, runtimeSize] = await Promise.all([
    readFile(paths.canonical).then((bytes) => bytes.byteLength),
    readFile(paths.runtime).then((bytes) => bytes.byteLength),
  ]);
  expect([canonicalSize, runtimeSize]).toEqual([
    manifest.canonical.activationBaseline.sizeBytes,
    manifest.runtime.activationBaseline.sizeBytes,
  ]);
}

it(
  "creates a sealed initial generation under the deterministic Project namespace",
  async () => {
    const root = await createTemporaryApplicationRoot();
    const runtime = await createStorageRuntimeForRoot(root);
    const response = await runtime.create(createRequest);
    await runtime.stop();
    const paths = createdGenerationPaths({ root });

    expect(response).toMatchObject({
      event: "project.create.result",
      payload: expectedCreatedResult,
    });
    await expect(readdir(path.join(root, "projects", createRequest.projectId))).resolves.toEqual([
      fixedCreationIds.generationId,
    ]);
    const authority = await readCreatedAuthority({ root, paths });
    expect(authority.registryRows).toEqual([
      [
        createRequest.projectId,
        fixedCreationIds.storageId,
        fixedCreationIds.generationId,
        fixedCreationIds.canonicalDatabaseLineageId,
        fixedCreationIds.runtimeDatabaseLineageId,
      ],
    ]);
    expect(authority.manifest).toMatchObject({
      projectId: createRequest.projectId,
      storageId: fixedCreationIds.storageId,
      generationId: fixedCreationIds.generationId,
      canonical: {
        databaseLineageId: fixedCreationIds.canonicalDatabaseLineageId,
      },
      runtime: { databaseLineageId: fixedCreationIds.runtimeDatabaseLineageId },
    });
    expect(authority.canonicalRows).toEqual([
      [
        createRequest.projectId,
        fixedCreationIds.storageId,
        fixedCreationIds.generationId,
        fixedCreationIds.canonicalDatabaseLineageId,
      ],
    ]);
    expect(authority.runtimeRows).toEqual([
      [
        createRequest.projectId,
        fixedCreationIds.storageId,
        fixedCreationIds.generationId,
        fixedCreationIds.runtimeDatabaseLineageId,
      ],
    ]);
    await expectActivationBaselines(paths, authority.manifest);
    expect(JSON.stringify(authority.manifest)).not.toContain(root);
    expect(JSON.stringify(response)).not.toContain(root);
  },
  projectStorageIntegrationTimeout,
);

async function readTableNames(databasePath: string): Promise<string[]> {
  const rows = await readRows(
    databasePath,
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map((row) => String(row[0]));
}

async function readDatabaseCheck(databasePath: string) {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec("PRAGMA foreign_keys = ON");
    const foreignKeys = database.prepare("PRAGMA foreign_keys").get();
    const violations = database.prepare("PRAGMA foreign_key_check").all();
    const integrity = database.prepare("PRAGMA integrity_check").all();
    return {
      foreignKeys: Number(foreignKeys?.["foreign_keys"]),
      violations,
      integrity: integrity.map((row) => String(row["integrity_check"])),
    };
  } finally {
    database.close();
  }
}

it(
  "creates exactly eight domain tables with valid SQLite integrity",
  async () => {
    const root = await createTemporaryApplicationRoot();
    const runtime = await createStorageRuntimeForRoot(root);
    await expect(runtime.create(createRequest)).resolves.toMatchObject({
      event: "project.create.result",
      payload: { status: "created", mode: "read-write" },
    });
    await runtime.stop();
    const generationDirectory = path.join(
      root,
      "projects",
      createRequest.projectId,
      fixedCreationIds.generationId,
    );
    const applicationPath = path.join(root, "application.db");
    const canonicalPath = path.join(generationDirectory, "slopstop.db");
    const runtimePath = path.join(generationDirectory, "mastra.db");

    await expect(readTableNames(applicationPath)).resolves.toEqual([
      "schema_metadata",
      "storage_generations",
      "storage_locations",
      "storage_registrations",
    ]);
    await expect(readTableNames(canonicalPath)).resolves.toEqual([
      "schema_metadata",
      "storage_identity",
    ]);
    await expect(readTableNames(runtimePath)).resolves.toEqual([
      "slopstop_runtime_schema_metadata",
      "slopstop_runtime_storage_identity",
    ]);
    await expect(
      Promise.all([
        readDatabaseCheck(applicationPath),
        readDatabaseCheck(canonicalPath),
        readDatabaseCheck(runtimePath),
      ]),
    ).resolves.toEqual([
      { foreignKeys: 1, violations: [], integrity: ["ok"] },
      { foreignKeys: 1, violations: [], integrity: ["ok"] },
      { foreignKeys: 1, violations: [], integrity: ["ok"] },
    ]);
  },
  projectStorageIntegrationTimeout,
);

it(
  "enforces exact lowercase UUID segments in the real application schema",
  async () => {
    const root = await createTemporaryApplicationRoot();
    const runtime = await createStorageRuntimeForRoot(root);
    await runtime.create(createRequest);
    await runtime.stop();
    const database = new DatabaseSync(path.join(root, "application.db"));
    const accepted = [
      "00000000-0000-1000-8000-000000000001",
      "00000000-0000-2000-9000-000000000002",
      "00000000-0000-3000-a000-000000000003",
      "00000000-0000-4000-b000-000000000004",
      "00000000-0000-5000-8000-000000000005",
      "00000000-0000-6000-9000-000000000006",
      "00000000-0000-7000-a000-000000000007",
      "00000000-0000-8000-b000-000000000008",
    ];
    const rejected = [
      "0000000--0000-1000-8000-000000000001",
      "00000000-000--1000-8000-000000000001",
      "00000000-0000-1-00-8000-000000000001",
      "00000000-0000-1000-8-00-000000000001",
      "00000000-0000-1000-8000-00000000000-",
      "00000000-0000-0000-8000-000000000001",
      "00000000-0000-1000-7000-000000000001",
      "00000000-0000-1000-8000-00000000000A",
    ];
    const locationId = "00000000-0000-4000-8000-000000000099";
    const insertLocation = database.prepare(`INSERT INTO storage_locations
    (storage_id, location_id, normalized_path, location_state, observed_at)
    VALUES (?, ?, ?, 'staging', '2026-08-31T12:00:00.000Z')`);
    const deleteLocation = database.prepare(
      "DELETE FROM storage_locations WHERE normalized_path = ?",
    );
    try {
      for (const [index, identity] of accepted.entries()) {
        const normalizedPath = `identity-accepted-${index}`;
        expect(() => insertLocation.run(identity, locationId, normalizedPath)).not.toThrow();
        deleteLocation.run(normalizedPath);
      }
      for (const [index, identity] of rejected.entries()) {
        expect(() =>
          insertLocation.run(identity, locationId, `identity-rejected-${index}`),
        ).toThrow();
      }
      expect(database.prepare("SELECT count(*) AS count FROM storage_locations").get()).toEqual({
        count: 1,
      });
    } finally {
      database.close();
    }
  },
  projectStorageIntegrationTimeout,
);

async function expectSchemaProbeFailure(input: {
  filename: string;
  statements: readonly string[];
  spec: DatabaseSpec;
  expectedMessage: string;
  redactPaths?: boolean;
}): Promise<void> {
  const root = await createTemporaryApplicationRoot();
  const databasePath = path.join(root, input.filename);
  const database = new DatabaseSync(databasePath);
  try {
    for (const statement of input.statements) database.exec(statement);
    const failure = await requireDeclaredSchemaObjects(sqliteExecutor(database), input.spec).then(
      () => "resolved",
      (error: unknown) => error,
    );
    expect(failure).toMatchObject({
      name: "ProjectStorageBrokenError",
      message: input.expectedMessage,
    });
    if (input.redactPaths === true) {
      expect(String(failure)).not.toContain(root);
      expect(String(failure)).not.toContain(databasePath);
    }
  } finally {
    database.close();
  }
}

it.each(schemaObjectOmissionCases)(
  "rejects one omitted $name through real SQLite metadata",
  async ({ spec, expectedMessage }) => {
    await expectSchemaProbeFailure({
      filename: "schema-object-probe.db",
      statements: [
        "CREATE TABLE parent (id TEXT PRIMARY KEY)",
        "CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT)",
      ],
      spec,
      expectedMessage,
      redactPaths: true,
    });
  },
);

it("ignores CHECK-like text inside SQL literals", async () => {
  const spec = {
    ...databaseSpecs.canonical,
    tables: ["parent", "child"],
    checks: [
      {
        table: "child",
        name: "child_parent_nonempty",
        expression: "length(parent_id) > 0",
      },
    ],
    indexes: [],
    foreignKeys: [],
  } satisfies DatabaseSpec;
  await expectSchemaProbeFailure({
    filename: "literal-check-probe.db",
    statements: [
      "CREATE TABLE parent (id TEXT PRIMARY KEY)",
      `CREATE TABLE child (
      id TEXT PRIMARY KEY,
      parent_id TEXT,
      note TEXT DEFAULT 'CONSTRAINT child_parent_nonempty CHECK (length(parent_id) > 0)'
    )`,
    ],
    spec,
    expectedMessage: "Database required CHECK constraint is missing.",
  });
});

it("rejects unexpected unnamed CHECK constraints", async () => {
  await expectSchemaProbeFailure({
    filename: "unnamed-check-probe.db",
    statements: [
      "CREATE TABLE parent (id TEXT PRIMARY KEY)",
      `CREATE TABLE child (
        id TEXT PRIMARY KEY,
        parent_id TEXT CHECK (length(parent_id) > 0)
      )`,
    ],
    spec: {
      ...databaseSpecs.canonical,
      tables: ["parent", "child"],
      checks: [],
      indexes: [],
      foreignKeys: [],
    },
    expectedMessage: "Database contains an unexpected CHECK constraint.",
  });
});

it("compares exact quoted index names without trimming", async () => {
  await expectSchemaProbeFailure({
    filename: "quoted-index-probe.db",
    statements: [
      "CREATE TABLE child (id TEXT PRIMARY KEY)",
      'CREATE INDEX " child_id_index " ON child (id)',
    ],
    spec: {
      ...databaseSpecs.canonical,
      tables: ["child"],
      checks: [],
      indexes: [
        {
          table: "child",
          name: "child_id_index",
          unique: false,
          partial: false,
          columns: ["id"],
          predicate: null,
        },
      ],
      foreignKeys: [],
    },
    expectedMessage: "Database required named index is missing.",
  });
});

it.each([
  {
    name: "trigger",
    ddl: "CREATE TRIGGER forbidden AFTER INSERT ON child BEGIN SELECT 1; END",
  },
  { name: "view", ddl: "CREATE VIEW forbidden AS SELECT id FROM child" },
])("rejects a live forbidden $name", async ({ ddl }) => {
  await expectSchemaProbeFailure({
    filename: "forbidden-object-probe.db",
    statements: ["CREATE TABLE child (id TEXT PRIMARY KEY)", ddl],
    spec: {
      ...databaseSpecs.canonical,
      tables: ["child"],
      checks: [],
      indexes: [],
      foreignKeys: [],
    },
    expectedMessage: "Database contains a forbidden schema object.",
  });
});

const schemaObjectUnexpectedCases = [
  {
    name: "CHECK constraint",
    expectedMessage: "Database contains an unexpected CHECK constraint.",
    statements: [
      "CREATE TABLE parent (id TEXT PRIMARY KEY)",
      `CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT,
        CONSTRAINT child_parent_nonempty CHECK (length(parent_id) > 0))`,
    ],
  },
  {
    name: "named index",
    expectedMessage: "Database contains an unexpected named index.",
    statements: [
      "CREATE TABLE parent (id TEXT PRIMARY KEY)",
      "CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT)",
      "CREATE INDEX child_parent_idx ON child(parent_id)",
    ],
  },
  {
    name: "foreign key",
    expectedMessage: "Database contains an unexpected foreign key.",
    statements: [
      "CREATE TABLE parent (id TEXT PRIMARY KEY)",
      `CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT,
        CONSTRAINT child_parent_fk FOREIGN KEY (parent_id) REFERENCES parent(id))`,
    ],
  },
];

it.each(schemaObjectUnexpectedCases)(
  "rejects one unexpected $name through real SQLite metadata",
  async ({ statements, expectedMessage }) => {
    await expectSchemaProbeFailure({
      filename: "schema-object-probe.db",
      statements,
      spec: {
        ...databaseSpecs.canonical,
        tables: ["parent", "child"],
        checks: [],
        indexes: [],
        foreignKeys: [],
      },
      expectedMessage,
      redactPaths: true,
    });
  },
);

async function readApplicationMigrationTag(migrationRoot: string): Promise<string> {
  const journal = await readFile(
    path.join(migrationRoot, "application", "meta", "_journal.json"),
    "utf8",
  );
  const tag = /"tag"\s*:\s*"([0-9]{4}_[a-z0-9_]+)"/u.exec(journal)?.[1];
  if (tag === undefined) throw new Error("Expected one generated application migration tag.");
  return tag;
}

async function createTransformedMigrationRoot(
  root: string,
  transform: SqlTransform,
): Promise<string> {
  const migrationRoot = path.join(root, "migration-resources");
  await cp(checkedInMigrationRoot, migrationRoot, { recursive: true });
  const migrationPath = path.join(
    migrationRoot,
    "application",
    `${await readApplicationMigrationTag(migrationRoot)}.sql`,
  );
  const original = await readFile(migrationPath, "utf8");
  await writeFile(migrationPath, transform(original));
  return migrationRoot;
}

async function createWithTransformedMigrations(root: string, transform: SqlTransform) {
  const migrationResourcesRoot = await createTransformedMigrationRoot(root, transform);
  let allocationCount = 0;
  const runtime = await createStorageRuntimeForRoot(root, {
    migrationResourcesRoot,
    onIdentityAllocation: () => {
      allocationCount += 1;
    },
  });
  try {
    return {
      result: await runtime.create(createRequest),
      allocationCount: () => allocationCount,
      migrationResourcesRoot,
    };
  } finally {
    await runtime.stop();
  }
}

async function expectNoProjectAllocation(root: string): Promise<void> {
  await expect(pathExists(path.join(root, "projects", createRequest.projectId))).resolves.toBe(
    false,
  );
  const applicationPath = path.join(root, "application.db");
  await expect(
    Promise.all([
      readRows(applicationPath, "SELECT * FROM storage_generations"),
      readRows(applicationPath, "SELECT * FROM storage_locations"),
      readRows(applicationPath, "SELECT * FROM storage_registrations"),
    ]),
  ).resolves.toEqual([[], [], []]);
}

it.each(sameNameSchemaMutationCases)(
  "rejects one same-name altered $name through real SQLite metadata",
  async ({ expectedMessage, formattingOnly, mutate }) => {
    if (formattingOnly !== undefined) {
      const acceptedRoot = await createTemporaryApplicationRoot();
      const accepted = await createWithTransformedMigrations(acceptedRoot, formattingOnly);
      expect(accepted.result).toMatchObject({
        event: "project.create.result",
        payload: expectedCreatedResult,
      });
    }

    const root = await createTemporaryApplicationRoot();
    const rejected = await createWithTransformedMigrations(root, mutate);

    expect(rejected.result).toMatchObject({
      event: "project.create.result",
      payload: {
        status: "broken",
        diagnostic: {
          code: "PROJECT_STORAGE_OWNER_FAILED",
          message: expectedMessage,
        },
      },
    });
    expect(rejected.allocationCount()).toBe(0);
    await expectNoProjectAllocation(root);
    expect(JSON.stringify(rejected.result)).not.toContain(root);
    expect(JSON.stringify(rejected.result)).not.toContain(rejected.migrationResourcesRoot);
  },
  30_000,
);

it.each(["canonical_lineage_id", "runtime_lineage_id"] as const)(
  "rejects activation when staged $field disagrees with the sealed generation",
  async (field) => {
    const root = await createTemporaryApplicationRoot();
    const applicationPath = path.join(root, "application.db");
    const runtime = await createStorageRuntimeForRoot(root, {
      onCheckpoint: (checkpoint) => {
        if (checkpoint !== "before-activation-transaction") return;
        const database = new DatabaseSync(applicationPath);
        try {
          database
            .prepare(`UPDATE storage_generations SET ${field} = ? WHERE generation_id = ?`)
            .run("00000000-0000-4000-8000-000000000099", fixedCreationIds.generationId);
        } finally {
          database.close();
        }
      },
    });

    const result = await runtime.create(createRequest);
    await runtime.stop();

    expect(result).toMatchObject({
      event: "project.create.result",
      payload: {
        status: "broken",
        diagnostic: {
          code: "PROJECT_STORAGE_OWNER_FAILED",
          message: "Activated Project Storage authority does not agree.",
        },
      },
    });
    await expect(
      readRows(applicationPath, "SELECT creation_state, activated_at FROM storage_generations"),
    ).resolves.toEqual([["staging", null]]);
    expect(JSON.stringify(result)).not.toContain(root);
  },
  projectStorageIntegrationTimeout,
);

const foreignConflictRequest = ProjectStorageCreateRequestSchema.parse({
  projectId: "00000000-0000-4000-8000-000000000020",
  createRequestId: createRequest.createRequestId,
});
const differentCreateRequest = ProjectStorageCreateRequestSchema.parse({
  projectId: createRequest.projectId,
  createRequestId: "00000000-0000-4000-8000-000000000099",
});

it("rechecks create authority inside the staging transaction", async () => {
  const root = await createTemporaryApplicationRoot();
  const competingRuntime = await createStorageRuntimeForRoot(root);
  let beforeStagingTransactionCount = 0;
  let competingResult: unknown;
  const runtime = await createStorageRuntimeForRoot(root, {
    onCheckpoint: async (checkpoint) => {
      if (checkpoint !== "before-staging-transaction") return;
      beforeStagingTransactionCount += 1;
      if (beforeStagingTransactionCount === 2) {
        competingResult = await competingRuntime.create(createRequest);
      }
    },
  });

  const result = await runtime.create(foreignConflictRequest);
  await Promise.all([runtime.stop(), competingRuntime.stop()]);

  expect(beforeStagingTransactionCount).toBe(2);
  expect(competingResult).toMatchObject({
    event: "project.create.result",
    payload: expectedCreatedResult,
  });
  expect(result).toMatchObject({
    event: "project.create.result",
    payload: {
      status: "blocked",
      request: foreignConflictRequest,
      reason: "idempotency-conflict",
      diagnostic: { code: "PROJECT_STORAGE_IDEMPOTENCY_CONFLICT" },
    },
  });
}, 30_000);

type AuthorityCorruptionCase = Readonly<{
  name: string;
  failAt?: CreationCheckpoint;
  initialRequest?: ProjectStorageCreateRequest;
  nextRequest?: ProjectStorageCreateRequest;
  expectedMessage: string;
  redactRoot?: boolean;
  mutate(input: {
    database: DatabaseSync;
    root: string;
    initialRequest: ProjectStorageCreateRequest;
  }): void;
}>;

async function runAuthorityCorruption(input: AuthorityCorruptionCase) {
  const root = await createTemporaryApplicationRoot();
  const initialRequest = input.initialRequest ?? createRequest;
  const runtimeOptions = input.failAt === undefined ? {} : { failAt: input.failAt };
  const firstRuntime = await createStorageRuntimeForRoot(root, runtimeOptions);
  await firstRuntime.create(initialRequest);
  await firstRuntime.stop();
  const applicationPath = path.join(root, "application.db");
  const database = new DatabaseSync(applicationPath);
  try {
    input.mutate({ database, root, initialRequest });
  } finally {
    database.close();
  }
  const restarted = await createStorageRuntimeForRoot(root);
  const result = await restarted.create(input.nextRequest ?? createRequest);
  await restarted.stop();
  return { result, root };
}

const authorityCorruptionCases: readonly AuthorityCorruptionCase[] = [
  {
    name: "rejects malformed staging authority instead of reporting an incomplete witness",
    failAt: "after-staging-transaction",
    expectedMessage: "Staging create request authority is inconsistent.",
    redactRoot: true,
    mutate: ({ database, root }) => {
      database
        .prepare("UPDATE storage_locations SET normalized_path = ?")
        .run(path.join(root, "projects", "other-project"));
    },
  },
  {
    name: "rejects a non-canonical persisted Project path",
    failAt: "after-staging-transaction",
    expectedMessage: "Staging create request authority is inconsistent.",
    mutate: ({ database, root }) => {
      database
        .prepare("UPDATE storage_locations SET normalized_path = ?")
        .run(`${path.join(root, "projects", createRequest.projectId)}${path.sep}`);
    },
  },
  {
    name: "validates malformed foreign request authority before returning an idempotency conflict",
    failAt: "after-staging-transaction",
    initialRequest: foreignConflictRequest,
    expectedMessage: "Staging create request authority is inconsistent.",
    mutate: ({ database, root, initialRequest }) => {
      database
        .prepare("UPDATE storage_locations SET normalized_path = ?")
        .run(path.join(root, "projects", initialRequest.projectId, "tampered"));
    },
  },
  {
    name: "validates a foreign request fingerprint before returning an idempotency conflict",
    failAt: "after-staging-transaction",
    initialRequest: foreignConflictRequest,
    expectedMessage: "Create request fingerprint does not agree.",
    mutate: ({ database }) => {
      database
        .prepare("UPDATE storage_generations SET create_request_fingerprint = ?")
        .run("f".repeat(64));
    },
  },
  {
    name: "rejects malformed active authority instead of reporting an existing registration",
    nextRequest: differentCreateRequest,
    expectedMessage: "Registered Project Storage authority is inconsistent.",
    redactRoot: true,
    mutate: ({ database }) => {
      database
        .prepare("UPDATE storage_generations SET creation_state = 'staging', activated_at = NULL")
        .run();
    },
  },
  {
    name: "validates a registered request fingerprint before reporting an existing registration",
    nextRequest: differentCreateRequest,
    expectedMessage: "Create request fingerprint does not agree.",
    mutate: ({ database }) => {
      database
        .prepare("UPDATE storage_generations SET create_request_fingerprint = ?")
        .run("f".repeat(64));
    },
  },
  {
    name: "rejects an orphan generation instead of reporting a prior-state witness",
    nextRequest: differentCreateRequest,
    expectedMessage: "Registered Project Storage authority is inconsistent.",
    mutate: ({ database }) => {
      database.prepare("DELETE FROM storage_registrations").run();
    },
  },
];

it.each(authorityCorruptionCases)(
  "$name",
  async (scenario) => {
    const { result, root } = await runAuthorityCorruption(scenario);
    expect(result).toMatchObject({
      event: "project.create.result",
      payload: {
        status: "broken",
        diagnostic: {
          code: "PROJECT_STORAGE_OWNER_FAILED",
          message: scenario.expectedMessage,
        },
      },
    });
    if (scenario.redactRoot === true) expect(JSON.stringify(result)).not.toContain(root);
  },
  projectStorageIntegrationTimeout,
);

it(
  "creates successfully when the storage clock advances",
  async () => {
    const root = await createTemporaryApplicationRoot();
    let clockCall = 0;
    const instants = [
      "2026-08-31T12:00:00.000Z",
      "2026-08-31T12:00:01.000Z",
      "2026-08-31T12:00:02.000Z",
    ];
    const runtime = await createStorageRuntimeForRoot(root, {
      clockNow: () => instants[clockCall++] ?? "2026-08-31T12:00:03.000Z",
    });

    const result = await runtime.create(createRequest);
    await runtime.stop();

    expect(result).toMatchObject({
      event: "project.create.result",
      payload: expectedCreatedResult,
    });
  },
  projectStorageIntegrationTimeout,
);

it(
  "treats an active replay fingerprint mismatch as broken authority",
  async () => {
    const root = await createTemporaryApplicationRoot();
    const firstRuntime = await createStorageRuntimeForRoot(root);
    await expect(firstRuntime.create(createRequest)).resolves.toMatchObject({
      payload: { status: "created" },
    });
    await firstRuntime.stop();
    const applicationPath = path.join(root, "application.db");
    const database = new DatabaseSync(applicationPath);
    try {
      database
        .prepare(
          `UPDATE storage_generations SET create_request_fingerprint = ?
          WHERE create_request_id = ?`,
        )
        .run("0".repeat(64), createRequest.createRequestId);
    } finally {
      database.close();
    }
    const generationDirectory = path.join(
      root,
      "projects",
      createRequest.projectId,
      fixedCreationIds.generationId,
    );
    const before = await Promise.all([
      sha256File(applicationPath),
      sha256File(path.join(generationDirectory, "manifest.json")),
      sha256File(path.join(generationDirectory, "slopstop.db")),
      sha256File(path.join(generationDirectory, "mastra.db")),
    ]);
    const restarted = await createStorageRuntimeForRoot(root);

    const result = await restarted.create(createRequest);
    await restarted.stop();

    expect(result).toMatchObject({
      event: "project.create.result",
      payload: {
        status: "broken",
        diagnostic: {
          code: "PROJECT_STORAGE_OWNER_FAILED",
          message: "Create request fingerprint does not agree.",
        },
      },
    });
    await expect(
      Promise.all([
        sha256File(applicationPath),
        sha256File(path.join(generationDirectory, "manifest.json")),
        sha256File(path.join(generationDirectory, "slopstop.db")),
        sha256File(path.join(generationDirectory, "mastra.db")),
      ]),
    ).resolves.toEqual(before);
    expect(JSON.stringify(result)).not.toContain(root);
  },
  projectStorageIntegrationTimeout,
);

it.each(["format_version", "schema_version"] as const)(
  "treats a lower persisted $column with the current migration as broken authority",
  async (column) => {
    const root = await createTemporaryApplicationRoot();
    const initialRuntime = await createStorageRuntimeForRoot(root);
    await expect(initialRuntime.create(createRequest)).resolves.toMatchObject({
      payload: { status: "created" },
    });
    await initialRuntime.stop();
    const applicationPath = path.join(root, "application.db");
    const database = new DatabaseSync(applicationPath);
    try {
      database.prepare(`UPDATE schema_metadata SET ${column} = 0`).run();
    } finally {
      database.close();
    }
    const before = await sha256File(applicationPath);
    const restarted = await createStorageRuntimeForRoot(root);

    const result = await restarted.create(createRequest);
    await restarted.stop();

    expect(result).toMatchObject({
      event: "project.create.result",
      payload: {
        status: "broken",
        diagnostic: {
          code: "PROJECT_STORAGE_OWNER_FAILED",
          message: "Database migration authority is incompatible.",
        },
      },
    });
    await expect(sha256File(applicationPath)).resolves.toBe(before);
    expect(JSON.stringify(result)).not.toContain(root);
  },
  projectStorageIntegrationTimeout,
);

async function seedOrphanLocation(input: { root: string }): Promise<string> {
  const initializer = await createStorageRuntimeForRoot(input.root);
  const initializerRequest = ProjectStorageCreateRequestSchema.parse({
    projectId: "00000000-0000-4000-8000-000000000050",
    createRequestId: "00000000-0000-4000-8000-000000000051",
  });
  await expect(initializer.create(initializerRequest)).resolves.toMatchObject({
    payload: { status: "created" },
  });
  await initializer.stop();
  const applicationPath = path.join(input.root, "application.db");
  const database = new DatabaseSync(applicationPath);
  try {
    database
      .prepare(
        `INSERT INTO storage_locations
        (storage_id, location_id, normalized_path, location_state, observed_at)
        VALUES (?, ?, ?, 'staging', ?)`,
      )
      .run(
        "00000000-0000-4000-8000-000000000061",
        "00000000-0000-4000-8000-000000000062",
        path.resolve(input.root, "projects", createRequest.projectId),
        "2026-08-31T12:00:00.000Z",
      );
  } finally {
    database.close();
  }
  return applicationPath;
}

function createCountingStorageOwner(input: { root: string }) {
  let allocationCount = 0;
  const allocate = <Value>(value: Value): Value => {
    allocationCount += 1;
    return value;
  };
  const owner = createProjectStorageOwner(
    createNodeProjectStorageDependencies({
      applicationStorageRoot: input.root,
      migrationResourcesRoot: checkedInMigrationRoot,
      applicationVersion: "0.0.0",
      ids: {
        storageId: () => allocate(StorageIdSchema.parse("00000000-0000-4000-8000-000000000071")),
        locationId: () => allocate("00000000-0000-4000-8000-000000000072"),
        generationId: () =>
          allocate(StorageGenerationIdSchema.parse("00000000-0000-4000-8000-000000000073")),
        canonicalLineageId: () =>
          allocate(CanonicalDatabaseLineageIdSchema.parse("00000000-0000-4000-8000-000000000074")),
        runtimeLineageId: () =>
          allocate(RuntimeDatabaseLineageIdSchema.parse("00000000-0000-4000-8000-000000000075")),
      },
    }),
  );
  return { owner, allocationCount: () => allocationCount };
}

it(
  "blocks an orphan location at the deterministic Project path before allocation",
  async () => {
    const root = await createTemporaryApplicationRoot();
    const applicationPath = await seedOrphanLocation({ root });
    const before = await sha256File(applicationPath);
    const fixture = createCountingStorageOwner({ root });

    const result = await fixture.owner.create(createRequest);
    await fixture.owner.stop();

    expect(result).toMatchObject({
      status: "ready",
      result: {
        status: "blocked",
        reason: "prior-state-witness",
        diagnostic: { code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS" },
      },
    });
    expect(fixture.allocationCount()).toBe(0);
    await expect(sha256File(applicationPath)).resolves.toBe(before);
    expect(JSON.stringify(result)).not.toContain(root);
  },
  projectStorageIntegrationTimeout,
);

it(
  "blocks a filesystem witness before initializing application.db",
  async () => {
    const root = await createTemporaryApplicationRoot();
    const projectRoot = path.join(root, "projects", createRequest.projectId);
    const witnessPath = path.join(projectRoot, "slopstop.db-wal");
    await mkdir(projectRoot, { recursive: true });
    await writeFile(witnessPath, "preserved witness");
    const before = await readFile(witnessPath, "utf8");
    const runtime = await createStorageRuntimeForRoot(root);

    const result = await runtime.create(createRequest);
    await runtime.stop();

    expect(result).toMatchObject({
      event: "project.create.result",
      payload: {
        status: "blocked",
        reason: "prior-state-witness",
        diagnostic: { code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS" },
      },
    });
    await expect(readFile(witnessPath, "utf8")).resolves.toBe(before);
    await expect(readFile(path.join(root, "application.db"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  },
  projectStorageIntegrationTimeout,
);

type MalformedApplicationAuthorityCase = Readonly<{
  name: string;
  seed(database: DatabaseSync, currentMigrationId: string): void;
}>;

function createLooseMetadataTable(database: DatabaseSync): void {
  database.exec(`CREATE TABLE schema_metadata (
    metadata_key TEXT,
    database_kind TEXT,
    format_version INTEGER,
    schema_version INTEGER,
    last_migration_id TEXT
  )`);
}

function insertLooseMetadata(
  database: DatabaseSync,
  values: readonly [string, string, number, number, string],
): void {
  database
    .prepare(
      `INSERT INTO schema_metadata
        (metadata_key, database_kind, format_version, schema_version, last_migration_id)
        VALUES (?, ?, ?, ?, ?)`,
    )
    .run(...values);
}

const malformedApplicationAuthorityCases: readonly MalformedApplicationAuthorityCase[] = [
  {
    name: "missing metadata amid domain tables",
    seed: (database) => database.exec("CREATE TABLE storage_locations (storage_id TEXT)"),
  },
  {
    name: "duplicate metadata",
    seed: (database, currentMigrationId) => {
      createLooseMetadataTable(database);
      insertLooseMetadata(database, ["application", "application", 1, 1, currentMigrationId]);
      insertLooseMetadata(database, ["application", "application", 1, 1, currentMigrationId]);
    },
  },
  {
    name: "unknown migration ID",
    seed: (database) => {
      createLooseMetadataTable(database);
      insertLooseMetadata(database, ["application", "application", 1, 1, "9999_unknown"]);
    },
  },
  {
    name: "wrong database kind",
    seed: (database, currentMigrationId) => {
      createLooseMetadataTable(database);
      insertLooseMetadata(database, ["application", "canonical", 1, 1, currentMigrationId]);
    },
  },
  {
    name: "newer format",
    seed: (database, currentMigrationId) => {
      createLooseMetadataTable(database);
      insertLooseMetadata(database, ["application", "application", 2, 1, currentMigrationId]);
    },
  },
  {
    name: "newer schema",
    seed: (database, currentMigrationId) => {
      createLooseMetadataTable(database);
      insertLooseMetadata(database, ["application", "application", 1, 2, currentMigrationId]);
    },
  },
];

it.each(malformedApplicationAuthorityCases)(
  "rejects malformed application migration authority: $name",
  async ({ seed }) => {
    const root = await createTemporaryApplicationRoot();
    const tag = await readApplicationMigrationTag(checkedInMigrationRoot);
    const applicationPath = path.join(root, "application.db");
    const database = new DatabaseSync(applicationPath);
    try {
      seed(database, tag);
    } finally {
      database.close();
    }
    const before = await sha256File(applicationPath);
    let allocationCount = 0;
    const runtime = await createStorageRuntimeForRoot(root, {
      onIdentityAllocation: () => {
        allocationCount += 1;
      },
    });

    const result = await runtime.create(createRequest);
    await runtime.stop();

    expect(result).toMatchObject({
      event: "project.create.result",
      payload: {
        status: "broken",
        diagnostic: { code: "PROJECT_STORAGE_OWNER_FAILED" },
      },
    });
    expect(allocationCount).toBe(0);
    await expect(sha256File(applicationPath)).resolves.toBe(before);
    await expect(pathExists(path.join(root, "projects"))).resolves.toBe(false);
    expect(JSON.stringify(result)).not.toContain(root);
  },
  projectStorageIntegrationTimeout,
);

type CrashRetry = "created" | "blocked";
type CrashAuthority = Readonly<{
  generations: readonly (readonly unknown[])[];
  locations: readonly (readonly unknown[])[];
  registrations: readonly (readonly unknown[])[];
}>;
type CrashState = Readonly<{
  authority: CrashAuthority | null;
  stagingEntries: readonly string[] | null;
  activeEntries: readonly string[] | null;
}>;
type CreationCrashCase = Readonly<{
  checkpoint: CreationCheckpoint;
  state: CrashState;
  retry: CrashRetry;
}>;

const emptyCrashAuthority: CrashAuthority = {
  generations: [],
  locations: [],
  registrations: [],
};
const stagingCrashAuthority: CrashAuthority = {
  generations: [
    [
      createRequest.projectId,
      fixedCreationIds.storageId,
      fixedCreationIds.generationId,
      fixedCreationIds.locationId,
      "staging",
      null,
    ],
  ],
  locations: [[fixedCreationIds.storageId, fixedCreationIds.locationId, "staging"]],
  registrations: [[createRequest.projectId, fixedCreationIds.storageId, null, null, null]],
};
const activeCrashAuthority: CrashAuthority = {
  generations: [
    [
      createRequest.projectId,
      fixedCreationIds.storageId,
      fixedCreationIds.generationId,
      fixedCreationIds.locationId,
      "active",
      "2026-08-31T12:00:00.000Z",
    ],
  ],
  locations: [[fixedCreationIds.storageId, fixedCreationIds.locationId, "committed"]],
  registrations: [
    [
      createRequest.projectId,
      fixedCreationIds.storageId,
      fixedCreationIds.generationId,
      fixedCreationIds.locationId,
      "2026-08-31T12:00:00.000Z",
    ],
  ],
};
const noProjectState = {
  stagingEntries: null,
  activeEntries: null,
} as const;
const sealedEntries = ["manifest.json", "mastra.db", "slopstop.db"] as const;
const activeCrashState: CrashState = {
  authority: activeCrashAuthority,
  stagingEntries: null,
  activeEntries: sealedEntries,
};

const databaseFileCheckpoints = [
  "after-runtime-database",
  "after-databases-closed",
  "after-baselines-computed",
] as const satisfies readonly CreationCheckpoint[];
const sealedStagingCheckpoints = [
  "after-manifest-written",
  "after-staging-verified",
  "before-generation-rename",
] as const satisfies readonly CreationCheckpoint[];
const renamedGenerationCheckpoints = [
  "after-generation-rename",
  "after-renamed-verification",
  "before-activation-transaction",
  "during-activation-transaction",
] as const satisfies readonly CreationCheckpoint[];

const creationCrashCases: readonly CreationCrashCase[] = [
  {
    checkpoint: "before-staging-transaction",
    state: { authority: null, ...noProjectState },
    retry: "created",
  },
  {
    checkpoint: "during-staging-transaction",
    state: { authority: emptyCrashAuthority, ...noProjectState },
    retry: "created",
  },
  {
    checkpoint: "after-staging-transaction",
    state: { authority: stagingCrashAuthority, ...noProjectState },
    retry: "blocked",
  },
  {
    checkpoint: "after-staging-directory",
    state: {
      authority: stagingCrashAuthority,
      stagingEntries: [],
      activeEntries: null,
    },
    retry: "blocked",
  },
  {
    checkpoint: "after-canonical-database",
    state: {
      authority: stagingCrashAuthority,
      stagingEntries: ["slopstop.db"],
      activeEntries: null,
    },
    retry: "blocked",
  },
  ...databaseFileCheckpoints.map(
    (checkpoint): CreationCrashCase => ({
      checkpoint,
      state: {
        authority: stagingCrashAuthority,
        stagingEntries: ["mastra.db", "slopstop.db"],
        activeEntries: null,
      },
      retry: "blocked",
    }),
  ),
  ...sealedStagingCheckpoints.map(
    (checkpoint): CreationCrashCase => ({
      checkpoint,
      state: {
        authority: stagingCrashAuthority,
        stagingEntries: sealedEntries,
        activeEntries: null,
      },
      retry: "blocked",
    }),
  ),
  ...renamedGenerationCheckpoints.map(
    (checkpoint): CreationCrashCase => ({
      checkpoint,
      state: {
        authority: stagingCrashAuthority,
        stagingEntries: null,
        activeEntries: sealedEntries,
      },
      retry: "blocked",
    }),
  ),
  {
    checkpoint: "after-activation-transaction",
    state: activeCrashState,
    retry: "created",
  },
  {
    checkpoint: "before-created-result",
    state: activeCrashState,
    retry: "created",
  },
];

async function directoryEntries(directoryPath: string): Promise<readonly string[] | null> {
  if (!(await pathExists(directoryPath))) return null;
  return (await readdir(directoryPath)).sort();
}

async function inspectCrashState(input: { root: string }): Promise<CrashState> {
  const applicationPath = path.join(input.root, "application.db");
  const authority = (await pathExists(applicationPath))
    ? {
        generations: await readRows(
          applicationPath,
          `SELECT project_id, storage_id, generation_id, location_id,
          creation_state, activated_at FROM storage_generations ORDER BY project_id`,
        ),
        locations: await readRows(
          applicationPath,
          `SELECT storage_id, location_id, location_state
          FROM storage_locations ORDER BY storage_id, location_id`,
        ),
        registrations: await readRows(
          applicationPath,
          `SELECT project_id, storage_id, active_generation_id, active_location_id, activated_at
          FROM storage_registrations ORDER BY project_id`,
        ),
      }
    : null;
  const projectRoot = path.join(input.root, "projects", createRequest.projectId);
  const stagingRoot = path.join(projectRoot, `.staging-${fixedCreationIds.generationId}`);
  const activeRoot = path.join(projectRoot, fixedCreationIds.generationId);
  return {
    authority,
    stagingEntries: await directoryEntries(stagingRoot),
    activeEntries: await directoryEntries(activeRoot),
  };
}

it.each(creationCrashCases)(
  "preserves witnesses and refuses cleanup after $checkpoint",
  async ({ checkpoint, state, retry }) => {
    const root = await createTemporaryApplicationRoot();
    const firstRuntime = await createStorageRuntimeForRoot(root, {
      failAt: checkpoint,
    });
    const firstResult = await firstRuntime.create(createRequest);
    await firstRuntime.stop();
    expect(firstResult).toMatchObject({
      event: "project.create.result",
      payload: {
        status: "broken",
        diagnostic: { code: "PROJECT_STORAGE_OWNER_FAILED" },
      },
    });
    await expect(inspectCrashState({ root })).resolves.toEqual(state);

    const restarted = await createStorageRuntimeForRoot(root);
    const retryResult = await restarted.create(createRequest);
    await restarted.stop();
    expect(retryResult).toMatchObject(
      retry === "created"
        ? { event: "project.create.result", payload: expectedCreatedResult }
        : {
            event: "project.create.result",
            payload: {
              status: "blocked",
              reason: "prior-state-witness",
              diagnostic: { code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS" },
            },
          },
    );
    await expect(inspectCrashState({ root })).resolves.toEqual(
      retry === "created" ? activeCrashState : state,
    );
  },
  30_000,
);
