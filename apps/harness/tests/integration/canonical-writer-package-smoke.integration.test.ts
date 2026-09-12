import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MessageChannel } from "node:worker_threads";
import {
  ProjectActivationIdSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageCreateResultSchema,
  WriterProofControlSchema,
  WriterProofEventSchema,
  writerProofProjectId,
} from "@slopstop/protocol";
import { afterEach, expect, it, vi } from "vitest";
import { createCanonicalCommandRegistry } from "../../src/canonical-command-registry.js";
import { createCanonicalProjectWriter } from "../../src/canonical-project-writer.js";
import {
  createCanonicalCommandRepositoryFactory,
  WriterCapabilityTokenSchema,
} from "../../src/storage/canonical-command-repository.js";
import { createNodeCanonicalWriterLeaseFactory } from "../../src/storage/canonical-writer-lease.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
} from "../../src/storage/local-libsql-worker-client.js";
import { createNodeProjectStorageDependencies } from "../../src/storage/project-storage-node-adapters.js";
import { createProjectStorageOwner } from "../../src/storage/project-storage-store.js";
import {
  startWriterProofController,
  verifyFixtureNativeOrigin,
} from "./canonical-writer-package-smoke-entry.js";
import {
  createWriterProofFixture,
  type WriterProofResourceDecorators,
} from "./canonical-writer-package-smoke-fixture.js";
import { observeFixturePort, portAdapter } from "./canonical-writer-smoke-test-transport.js";

const project = "00000000-0000-4000-8000-000000000101";
const proofId = "00000000-0000-4000-8000-000000000162";
const epochs = [141, 142].map((n) => ProjectActivationIdSchema.parse(id(n)));
const migrations = path.resolve("apps/harness/drizzle");
const cleanup: (() => Promise<void>)[] = [];
const native = {
  packageName: "fs-native-extensions",
  packageVersion: "1.5.1",
  target: "win32-x64",
  unpackedTargetBinding: true,
  fallbackLoaded: false,
} as const;

function id(n: number) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function time(n: number) {
  return `2026-09-05T12:00:0${n}.000Z`;
}

function receipt(n: 1 | 2) {
  return {
    receiptId: id(150 + n),
    projectId: project,
    commandId: id(130 + n),
    commandType: "conformance.writer.noop",
    commandVersion: 1,
    projectSequence: n,
    writerGeneration: n,
    settledAt: time(n),
    outcome: "rejected",
    events: [],
    rejection: { code: "COMMAND_TYPE_UNSUPPORTED", retryable: false },
  };
}

function control(step = "audit.initialize", stepNumber = 1, request = 175) {
  const correlation = {
    version: 1,
    kind: "writer-proof.control",
    proofId,
    requestId: id(request),
    step,
    stepNumber,
  };
  return step === "audit.initialize"
    ? { ...correlation, activationIds: epochs, expectedReceipts: [receipt(1), receipt(2)] }
    : correlation;
}

it("characterizes real Storage Q creation after a closed independent P owner", async () => {
  const f = await seed();
  await f.client.close();
  const owner = createProjectStorageOwner(
    createNodeProjectStorageDependencies({
      applicationStorageRoot: f.root,
      migrationResourcesRoot: migrations,
      applicationVersion: "0.0.0",
    }),
  );
  cleanup.push(() => owner.stop());
  expect(
    await owner.create(
      ProjectStorageCreateRequestSchema.parse({ projectId: id(104), createRequestId: id(114) }),
    ),
  ).toMatchObject({ status: "ready", result: { status: "created" } });
});

afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function seed() {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-writer-proof-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const dependencies = createNodeProjectStorageDependencies({
    applicationStorageRoot: root,
    migrationResourcesRoot: migrations,
    applicationVersion: "0.0.0",
    clock: { now: () => time(0) },
  });
  const owner = createProjectStorageOwner(dependencies);
  cleanup.push(() => owner.stop());
  const created = await owner.create(
    ProjectStorageCreateRequestSchema.parse({ projectId: project, createRequestId: id(111) }),
  );
  expect(created.status).toBe("ready");
  const opened = await owner.acquireActivation({ projectId: writerProofProjectId });
  if (opened.status !== "ready" || opened.session.mode !== "read-write")
    throw new Error("Seed Storage unavailable");
  const database = opened.session.canonicalDatabasePath;
  await seedGenerations(database);
  const client = createWorkerLocalLibsqlClient(database, "generation");
  cleanup.push(() => client.close());
  await seedSecondReceipt(client);
  await opened.session.close();
  await owner.stop();
  return { root, client };
}

async function seedGenerations(database: string) {
  const factory = createCanonicalCommandRepositoryFactory({
    openClient: (file) => createWorkerLocalLibsqlClient(file, "generation"),
    registry: createCanonicalCommandRegistry([]),
    createReceiptId: () => id(151),
    createEventId: randomUUID,
    now: () => time(1),
    sha256Text: async (text) => createHash("sha256").update(text).digest("hex"),
    createHandoffId: randomUUID,
    createRecoveryRecordId: randomUUID,
  });
  for (const n of [1, 2] as const) {
    const activationId = epochs[n - 1];
    if (activationId === undefined) throw new Error("Missing fixed epoch");
    const result = await factory.activate({
      canonicalDatabasePath: database,
      projectId: writerProofProjectId,
      activationId,
      writerToken: WriterCapabilityTokenSchema.parse(String(n).repeat(64)),
      activatedAt: time(n - 1),
    });
    if (result.status !== "activated") throw new Error("Seed activation failed");
    cleanup.push(() => result.repository.close());
    // Seed the exact first receipt through the real empty registry. Second receipt
    // is seeded relationally below; no product registration or domain table.
    if (n === 1) {
      await result.repository.settle(
        JSON.stringify({
          commandId: id(131),
          fingerprintVersion: 1,
          payload: {},
          projectId: project,
          type: "conformance.writer.noop",
          version: 1,
        }),
      );
    }
    if (n === 2) await result.repository.releaseFence(time(3));
    await result.repository.close();
  }
}

async function seedSecondReceipt(client: LocalLibsqlClient) {
  // The second fixed settlement is seeded relationally, independently of fixture
  // checks. Constraints remain enabled; these are test data, not crash evidence.
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        commandId: id(132),
        fingerprintVersion: 1,
        payload: {},
        projectId: project,
        type: "conformance.writer.noop",
        version: 1,
      }),
    )
    .digest("hex");
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute({
    sql: "INSERT INTO command_receipts VALUES (?,?,?,?,?,?,?,?,?,?)",
    args: [
      project,
      id(152),
      id(132),
      "conformance.writer.noop",
      1,
      fingerprint,
      "rejected",
      2,
      2,
      time(2),
    ],
  });
  await client.execute({
    sql: "INSERT INTO command_idempotency VALUES (?,?,?,?,?)",
    args: [project, id(132), fingerprint, id(152), time(2)],
  });
  await client.execute({
    sql: "INSERT INTO command_rejections VALUES (?,?,?,?,?,?,?,?)",
    args: [
      project,
      id(152),
      "rejected",
      2,
      "COMMAND_TYPE_UNSUPPORTED",
      0,
      '{"version":1}',
      createHash("sha256").update('{"version":1}').digest("hex"),
    ],
  });
  await client.execute({
    sql: "UPDATE project_state SET last_project_sequence=2,updated_at=?",
    args: [time(2)],
  });
}

async function launch(
  root: string,
  decorateClient?: (client: LocalLibsqlClient) => LocalLibsqlClient,
  decorators: WriterProofResourceDecorators = {},
) {
  const { port1, port2 } = new MessageChannel();
  const transport = observeFixturePort(port2);
  const { results, exits } = transport;
  const diagnostics: string[] = [];
  const setupFailures: unknown[] = [];
  cleanup.push(async () => {
    port2.close();
    port1.close();
    await transport.terminated;
  });
  const controller = startWriterProofController({
    exit: transport.exited,
    diagnostic: (message) => {
      diagnostics.push(message);
    },
    nativePreflight: () => native,
    createFixture: (roots) => {
      const fixture = createWriterProofFixture(roots, { decorateClient, ...decorators });
      return {
        close: () => fixture.close(),
        control: async (message) => {
          try {
            return await fixture.control(message);
          } catch (error) {
            setupFailures.push(error);
            throw error;
          }
        },
      };
    },
  });
  const start = {
    version: 1,
    kind: "writer-proof.connect",
    proofId,
    bootstrap: {
      kind: "harness.connect",
      applicationStorageRootUrl: pathToFileURL(root).href,
      migrationResourcesRootUrl: pathToFileURL(migrations).href,
    },
  };
  controller.start(start, [portAdapter(port1)]);
  return { controller, start, port: port2, results, exits, diagnostics, setupFailures, transport };
}

it("audits exact seeded receipts and abandoned recovery through real Node ports (not packaged native proof)", async () => {
  const f = await seed();
  const run = await launch(f.root);
  await run.transport.send(control());
  expect(run.results).toHaveLength(1);
  const result = WriterProofEventSchema.parse(run.results[0]);
  expect(result.step).toBe("audit.initialize");
  expect(run.exits).toEqual([]);
  run.port.close();
  await run.transport.terminated;
  expect(run.exits).toEqual([0]);
  expect(run.diagnostics).toEqual([]);
});

async function replacement(root: string) {
  const projectId = ProjectStorageCreateRequestSchema.shape.projectId.parse(id(104));
  const owner = createProjectStorageOwner(
    createNodeProjectStorageDependencies({
      applicationStorageRoot: root,
      migrationResourcesRoot: migrations,
      applicationVersion: "0.0.0",
    }),
  );
  cleanup.push(() => owner.stop());
  const opened = await owner.acquireActivation({ projectId });
  if (opened.status !== "ready" || opened.session.mode !== "read-write")
    throw new Error("Replacement Storage failed");
  cleanup.push(() => opened.session.close());
  const lease = await createNodeCanonicalWriterLeaseFactory().acquire(
    opened.session.writerLeasePath,
  );
  if (lease.status !== "acquired") throw new Error("Replacement lease failed");
  cleanup.push(() => lease.lease.release());
  const activationId = ProjectActivationIdSchema.parse(randomUUID());
  const factory = createCanonicalCommandRepositoryFactory({
    registry: createCanonicalCommandRegistry([]),
    createReceiptId: randomUUID,
    createEventId: randomUUID,
    now: () => new Date().toISOString(),
    createHandoffId: randomUUID,
    createRecoveryRecordId: randomUUID,
    openClient: (file) => createWorkerLocalLibsqlClient(file, "generation"),
    sha256Text: async (text) => createHash("sha256").update(text).digest("hex"),
  });
  const activated = await factory.activate({
    projectId,
    activationId,
    canonicalDatabasePath: opened.session.canonicalDatabasePath,
    writerToken: WriterCapabilityTokenSchema.parse("9".repeat(64)),
    activatedAt: new Date().toISOString(),
  });
  if (activated.status !== "activated") throw new Error("Replacement activation failed");
  const writer = createCanonicalProjectWriter({
    projectId,
    activationId,
    writerGeneration: activated.writerGeneration,
    repository: activated.repository,
    lease: lease.lease,
  });
  cleanup.push(() => writer.close(new Date().toISOString()));
  expect(activated.writerGeneration).toBe(2);
  return { activationId, writer };
}

async function step(run: Awaited<ReturnType<typeof launch>>, message: unknown, count: number) {
  try {
    await run.transport.send(message);
  } catch (error) {
    if (run.setupFailures.length) throw run.setupFailures[0];
    throw error;
  }
  if (run.setupFailures.length) throw run.setupFailures[0];
  expect(run.results).toHaveLength(count);
  expect(run.exits).toEqual([]);
  return WriterProofEventSchema.parse(run.results[count - 1]);
}

async function initializeAndRelease(root: string, decorators: WriterProofResourceDecorators = {}) {
  const run = await launch(root, undefined, decorators);
  const initialized = await step(run, control("stale.initialize", 1, 171), 1);
  expect(initialized.step).toBe("stale.initialize");
  await step(run, control("stale.release", 2, 172), 2);
  return run;
}

it("rejects a retained live Writer with a real independently acquired native fence (source-process qualification)", async () => {
  const f = await seed();
  await f.client.close();
  const run = await initializeAndRelease(f.root);
  const next = await replacement(f.root);
  const result = await step(
    run,
    {
      ...control("stale.attempt", 3, 173),
      replacementActivationId: next.activationId,
      replacementWriterGeneration: 2,
    },
    3,
  );
  expect(result).toMatchObject({
    status: "stale-writer",
    code: "WRITER_FENCE_STALE",
    writerClose: "stale-refused",
    allCanonicalRowsUnchanged: true,
    registryCalls: 0,
    handlerCalls: 0,
    identityCalls: 0,
    settlementClockCalls: 0,
  });
  expect(await next.writer.verifyFence()).toEqual({ status: "current" });
  await step(run, control("stale.finish", 4, 174), 4);
  expect(await next.writer.verifyFence()).toEqual({ status: "current" });
  run.port.close();
  await run.transport.terminated;
  expect(run.exits).toEqual([0]);
});

it.each(["no-replacement", "wrong-epoch"])(
  "refuses incoherent replacement before stale evidence: %s",
  async (fault) => {
    const f = await seed();
    await f.client.close();
    const run = await initializeAndRelease(f.root);
    if (fault === "wrong-epoch") await replacement(f.root);
    run.port.postMessage({
      ...control("stale.attempt", 3, 173),
      replacementActivationId: id(144),
      replacementWriterGeneration: 2,
    });
    await run.transport.terminated;
    expect(run.exits).toEqual([1]);
    expect(run.results).toHaveLength(2);
  },
);

it.each(["release-failure", "storage-stop-failure"])(
  "refuses successful teardown on owned resource faults: %s",
  async (fault) => {
    const f = await seed();
    await f.client.close();
    const decorators: WriterProofResourceDecorators =
      fault === "release-failure"
        ? {
            decorateLease: (lease) => ({
              release: async () => {
                await lease.release();
                throw new Error("private lease");
              },
            }),
          }
        : {
            decorateOwner: (owner) => ({
              open: (request) => owner.open(request),
              create: (request) => owner.create(request),
              close: (request) => owner.close(request),
              acquireActivation: (request) => owner.acquireActivation(request),
              stop: async () => {
                await owner.stop();
                throw new Error("private Storage");
              },
            }),
          };
    const run = await launch(f.root, undefined, decorators);
    if (fault === "release-failure") {
      await step(run, control("stale.initialize", 1, 171), 1);
      run.port.postMessage(control("stale.release", 2, 172));
    } else run.port.postMessage(control());
    await run.transport.terminated;
    expect(run.exits).toEqual([1]);
    expect(run.results).toHaveLength(fault === "release-failure" ? 1 : 0);
    expect(run.diagnostics).toEqual(["Writer proof fixture failed.\n"]);
  },
);

it.each(["missing-port", "extra-port", "invalid-start", "overlap", "native-failure"])(
  "refuses fixture admission: %s",
  async (fault) => {
    const f = await seed();
    const createFixture = vi.fn((roots) => createWriterProofFixture(roots));
    const { port1, port2 } = new MessageChannel();
    const transport = observeFixturePort(port2);
    const { exits } = transport;
    cleanup.push(async () => {
      port1.close();
      port2.close();
      await transport.terminated;
    });
    const controller = startWriterProofController({
      exit: transport.exited,
      diagnostic: vi.fn(),
      createFixture,
      nativePreflight: () => {
        if (fault === "native-failure") throw new Error("private native");
        return native;
      },
    });
    const bootstrap = {
      kind: "harness.connect",
      applicationStorageRootUrl: pathToFileURL(f.root).href,
      migrationResourcesRootUrl: pathToFileURL(fault === "overlap" ? f.root : migrations).href,
    };
    const ports =
      fault === "missing-port"
        ? []
        : fault === "extra-port"
          ? [portAdapter(port1), portAdapter(port2)]
          : [portAdapter(port1)];
    controller.start(
      {
        version: fault === "invalid-start" ? 2 : 1,
        kind: "writer-proof.connect",
        proofId,
        bootstrap,
      },
      ports,
    );
    await transport.terminated;
    expect(exits).toEqual([1]);
    expect(createFixture).not.toHaveBeenCalled();
  },
);

it("rejects another control after successful audit, without a clean exit", async () => {
  const f = await seed();
  const run = await launch(f.root);
  await step(run, control(), 1);
  run.port.postMessage(control());
  await run.transport.terminated;
  expect(run.exits).toEqual([1]);
  expect(run.results).toHaveLength(1);
});

const legalCorruptions = [
  "UPDATE project_state SET last_project_sequence=3",
  "UPDATE project_state SET last_writer_generation=3",
  "UPDATE command_receipts SET command_type='other' WHERE project_sequence=1",
  "UPDATE command_receipts SET command_version=2 WHERE project_sequence=1",
  "UPDATE command_receipts SET settled_at='bad-time' WHERE project_sequence=1",
  "UPDATE command_idempotency SET created_at='2026-09-05T12:00:04.000Z'",
  "UPDATE command_rejections SET retryable=1",
  "UPDATE command_rejections SET rejection_code='OTHER'",
  "UPDATE command_rejections SET details_json='{}'",
  "UPDATE command_rejections SET details_hash=printf('%064d',0)",
  "UPDATE writer_generations SET activation_id='00000000-0000-4000-8000-000000000199' WHERE writer_generation=1",
  "UPDATE writer_generations SET released_at='2026-09-05T12:00:04.000Z' WHERE writer_generation=1",
  "UPDATE writer_fence SET activated_at='2026-09-05T12:00:04.000Z'",
  "UPDATE writer_fence SET released_at='2026-09-05T12:00:04.000Z'",
  "UPDATE writer_handoffs SET recorded_at='bad-time'",
  "UPDATE writer_handoffs SET kind='clean' WHERE to_writer_generation=2",
  "UPDATE writer_recovery_records SET observed_at='bad-time'",
  "UPDATE writer_recovery_records SET resolved_at='2026-09-05T12:00:04.000Z'",
  "DELETE FROM writer_recovery_records",
  "DELETE FROM command_rejections",
  "DELETE FROM command_idempotency",
  "CREATE TABLE extra_fixture_table (value TEXT)",
];

// Invalid relational values that SQLite constraints cannot store are injected
// only at the fixture's public SELECT port, after real Storage has opened.
const tableColumns = {
  project_state: "project_id last_project_sequence last_writer_generation created_at updated_at",
  storage_identity:
    "identity_key project_id storage_id generation_id canonical_database_lineage_id created_at",
  schema_metadata: "metadata_key database_kind format_version schema_version last_migration_id",
  writer_generations:
    "project_id writer_generation activation_id token_digest acquired_at released_at",
  writer_fence: "project_id writer_generation token_digest state activated_at released_at",
  writer_handoffs:
    "project_id handoff_id from_writer_generation to_writer_generation kind recorded_at",
  writer_recovery_records:
    "project_id recovery_record_id writer_generation reason command_id command_fingerprint observed_at resolution resolved_by_writer_generation resolved_at",
  command_receipts:
    "project_id receipt_id command_id command_type command_version command_fingerprint outcome project_sequence writer_generation settled_at",
  command_idempotency:
    "project_id command_id original_command_fingerprint original_receipt_id created_at",
  command_rejections:
    "project_id receipt_id receipt_outcome project_sequence rejection_code retryable details_json details_hash",
};

it.each(
  Object.entries(tableColumns).flatMap(([table, columns]) =>
    columns.split(" ").map((column) => ({ table, column })),
  ),
)(
  "rejects impossible row corruption at reached SELECT checkpoint: $table / $column",
  async ({ table, column }) => {
    const f = await seed();
    const reached = vi.fn();
    const run = await launch(f.root, (client) => ({
      close: () => client.close(),
      transaction: (mode) => client.transaction(mode),
      execute: async (statement, args) => {
        const result = await client.execute(statement, args);
        const sql = typeof statement === "string" ? statement : statement.sql;
        if (sql === `SELECT * FROM ${table}`) {
          reached();
          const index = result.columns.indexOf(column);
          expect(index).toBeGreaterThanOrEqual(0);
          return {
            ...result,
            rows: result.rows.map((row, n) =>
              n === 0
                ? row.map((value, i) =>
                    i === index ? (value === null ? "private-invalid" : null) : value,
                  )
                : row,
            ),
          };
        }
        return result;
      },
    }));
    run.port.postMessage(control());
    await run.transport.terminated;
    expect(run.exits).toEqual([1]);
    expect(reached).toHaveBeenCalled();
    expect(run.results).toEqual([]);
    expect(run.diagnostics).toEqual(["Writer proof fixture failed.\n"]);
  },
);

it.each(["sql", "client-close"])(
  "never reports audit success after public resource failure: %s",
  async (fault) => {
    const f = await seed();
    const run = await launch(f.root, (client) => ({
      transaction: (mode) => client.transaction(mode),
      execute: async (statement, args) => {
        if (fault === "sql") throw new Error("private root/token/payload");
        return client.execute(statement, args);
      },
      close: async () => {
        await client.close();
        if (fault === "client-close") throw new Error("private root/token/payload");
      },
    }));
    run.port.postMessage(control());
    await run.transport.terminated;
    expect(run.exits).toEqual([1]);
    expect(run.results).toEqual([]);
    expect(run.diagnostics).toEqual(["Writer proof fixture failed.\n"]);
  },
);

it.each(legalCorruptions)(
  "refuses real legal database corruption without audit success: %s",
  async (sql) => {
    const f = await seed();
    await f.client.execute(sql);
    const run = await launch(f.root);
    run.port.postMessage(control());
    await run.transport.terminated;
    expect(run.exits).toEqual([1]);
    expect(run.results).toEqual([]);
    expect(run.diagnostics).toEqual(["Writer proof fixture failed.\n"]);
  },
);

it.each([
  { ...control(), proofId: id(199) },
  { ...control(), requestId: "bad" },
  { ...control(), stepNumber: 2 },
  { ...control(), extra: "private" },
  control("stale.release", 2),
  control("stale.attempt", 3),
  control("stale.finish", 4),
])("rejects invalid initial control through the public controller: %j", async (message) => {
  const f = await seed();
  const run = await launch(f.root);
  run.port.postMessage(message);
  await run.transport.terminated;
  expect(run.exits).toEqual([1]);
  expect(run.results).toEqual([]);
});

it("rejects a repeated start instead of attaching another proof", async () => {
  const f = await seed();
  const run = await launch(f.root);
  const { port1, port2 } = new MessageChannel();
  const closed = vi.fn();
  port2.on("close", closed);
  cleanup.push(async () => {
    port1.close();
    port2.close();
  });
  run.controller.start(run.start, [portAdapter(port1)]);
  await run.transport.terminated;
  expect(run.exits).toEqual([1]);
  await vi.waitFor(() => expect(closed).toHaveBeenCalledTimes(1));
  expect(run.results).toEqual([]);
});

it("fails early parent close without reporting successful teardown", async () => {
  const f = await seed();
  const run = await launch(f.root);
  run.port.close();
  await run.transport.terminated;
  expect(run.exits).toEqual([1]);
  expect(run.results).toEqual([]);
});

it("rejects pipelined controls while an owned SQL read is held", async () => {
  const f = await seed();
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reached = vi.fn();
  const run = await launch(f.root, (client) => ({
    close: () => client.close(),
    transaction: (mode) => client.transaction(mode),
    execute: async (statement, args) => {
      reached();
      await held;
      return client.execute(statement, args);
    },
  }));
  run.port.postMessage(control());
  await vi.waitFor(() => expect(reached).toHaveBeenCalled());
  run.port.postMessage(WriterProofControlSchema.parse({ ...control(), requestId: id(176) }));
  release();
  await run.transport.terminated;
  expect(run.exits).toEqual([1]);
  expect(run.results).toEqual([]);
});

async function nativeCopy(fault: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-fixture-native-"));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const build = path.join(root, "app.asar", ".vite", "build");
  const target = `${process.platform}-${process.arch}`;
  const packageSuffix = path.join(".vite", "build", "node_modules", "fs-native-extensions");
  const virtual = path.join(root, "app.asar", packageSuffix);
  const binding = path.join(
    root,
    "app.asar.unpacked",
    packageSuffix,
    "prebuilds",
    target,
    "fs-native-extensions.node",
  );
  await mkdir(path.dirname(binding), { recursive: true });
  await mkdir(virtual, { recursive: true });
  const installed = path.dirname(createRequire(import.meta.url).resolve("fs-native-extensions"));
  if (fault !== "missing")
    await copyFile(path.join(installed, "prebuilds", target, "fs-native-extensions.node"), binding);
  if (fault === "empty") await writeFile(binding, "");
  if (fault === "corrupt") await writeFile(binding, "not published bytes");
  const main = fault === "alternate-js" ? "other.js" : "index.js";
  await writeFile(
    path.join(virtual, "package.json"),
    JSON.stringify({
      name: fault === "name" ? "other" : "fs-native-extensions",
      version: fault === "version" ? "1.5.2" : "1.5.1",
      main,
    }),
  );
  await writeFile(path.join(virtual, main), nativeModuleSource(fault, binding));
  return build;
}

function nativeModuleSource(fault: string, binding: string) {
  const ordinary = fault === "wrong-path" ? `${binding}.renamed` : binding;
  const selected = fault === "namespaced" ? path.toNamespacedPath(binding) : ordinary;
  const api = fault === "missing-api" ? "{}" : "{tryLock(){},unlock(){}}";
  const flags = fault === "explicit-flags" ? ",1" : "";
  const load = `process.dlopen(module,${JSON.stringify(selected)}${flags});`;
  return `${fault === "zero-load" ? "" : load}${fault === "two-loads" ? load : ""}module.exports=${api};`;
}

it.each(["valid", "namespaced", "explicit-flags"])(
  "observes exactly one independent native delegation using a disposable module and mocked dlopen (not native proof): %s",
  async (spelling) => {
    const build = await nativeCopy(spelling);
    const delegated = vi.spyOn(process, "dlopen").mockImplementation(() => {});
    expect(verifyFixtureNativeOrigin(build)).toEqual({
      ...native,
      target: `${process.platform}-${process.arch}`,
    });
    expect(delegated).toHaveBeenCalledTimes(1);
    expect(delegated.mock.calls[0]).toHaveLength(spelling === "explicit-flags" ? 3 : 2);
    if (spelling === "explicit-flags") expect(delegated.mock.calls[0]?.[2]).toBe(1);
    expect(delegated.mock.contexts).toEqual([process]);
    expect(process.dlopen).toBe(delegated);
    expect(() => verifyFixtureNativeOrigin(build)).toThrow("Packaged Writer proof failed.");
    expect(delegated).toHaveBeenCalledTimes(1);
  },
);

it.each([
  "missing",
  "empty",
  "corrupt",
  "name",
  "version",
  "alternate-js",
  "wrong-path",
  "missing-api",
  "zero-load",
  "two-loads",
  "loader-throw",
])("refuses independent native origin contradiction and restores observer: %s", async (fault) => {
  const build = await nativeCopy(fault);
  const delegated = vi.spyOn(process, "dlopen").mockImplementation(() => {
    if (fault === "loader-throw") throw new Error("private native loader");
  });
  let caught: unknown;
  try {
    verifyFixtureNativeOrigin(build);
  } catch (error) {
    caught = error;
  }
  expect(caught).toMatchObject({
    name: "WriterProofError",
    stage: "native-preflight",
    message: "Packaged Writer proof failed.",
  });
  expect(caught).not.toHaveProperty("cause");
  expect(process.dlopen).toBe(delegated);
  if (fault === "wrong-path") expect(delegated).not.toHaveBeenCalled();
});

it.each(Object.keys(tableColumns))(
  "refuses missing or extra rows at the public SELECT checkpoint: %s",
  async (table) => {
    const f = await seed();
    for (const add of [false, true]) {
      const reached = vi.fn();
      const run = await launch(f.root, (client) => ({
        close: () => client.close(),
        transaction: (mode) => client.transaction(mode),
        execute: async (statement, args) => {
          const result = await client.execute(statement, args);
          const sql = typeof statement === "string" ? statement : statement.sql;
          if (sql !== `SELECT * FROM ${table}`) return result;
          reached();
          return { ...result, rows: add ? [...result.rows, ...result.rows] : result.rows.slice(1) };
        },
      }));
      run.port.postMessage(control());
      await run.transport.terminated;
      expect(run.exits).toEqual([1]);
      expect(reached).toHaveBeenCalled();
      expect(run.results).toEqual([]);
    }
  },
);

it.each(["stale.initialize", "stale.release", "stale.attempt", "stale.finish"])(
  "fails early parent close at a held real resource stage: %s",
  async (stage) => {
    const f = await seed();
    await f.client.close();
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let holding = false;
    const reached = vi.fn();
    const hold = async () => {
      if (holding) {
        reached();
        await held;
      }
    };
    const run = await launch(
      f.root,
      (client) => ({
        transaction: (mode) => client.transaction(mode),
        execute: async (statement, args) => {
          if (stage === "stale.attempt") await hold();
          return client.execute(statement, args);
        },
        close: async () => {
          if (stage === "stale.finish") await hold();
          await client.close();
        },
      }),
      {
        decorateOwner: (owner) => ({
          open: (request) => owner.open(request),
          close: (request) => owner.close(request),
          stop: () => owner.stop(),
          acquireActivation: (request) => owner.acquireActivation(request),
          create: async (request) => {
            if (stage === "stale.initialize") await hold();
            return owner.create(request);
          },
        }),
        decorateLease: (lease) => ({
          release: async () => {
            if (stage === "stale.release") await hold();
            await lease.release();
          },
        }),
      },
    );
    const messages: unknown[] = [
      control("stale.initialize", 1, 171),
      control("stale.release", 2, 172),
    ];
    const stages = ["stale.initialize", "stale.release", "stale.attempt", "stale.finish"];
    const index = stages.indexOf(stage);
    for (let i = 0; i < index; i++) {
      if (i === 2) {
        const next = await replacement(f.root);
        messages.push({
          ...control("stale.attempt", 3, 173),
          replacementActivationId: next.activationId,
          replacementWriterGeneration: 2,
        });
      }
      await step(run, messages[i], i + 1);
    }
    if (index === 2) {
      const next = await replacement(f.root);
      messages.push({
        ...control("stale.attempt", 3, 173),
        replacementActivationId: next.activationId,
        replacementWriterGeneration: 2,
      });
    }
    messages.push(control("stale.finish", 4, 174));
    holding = true;
    run.port.postMessage(messages[index]);
    await vi.waitFor(() => expect(reached).toHaveBeenCalled());
    run.port.close();
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(run.exits).toEqual([]);
    release();
    await run.transport.terminated;
    expect(run.exits).toEqual([1]);
    expect(run.results).toHaveLength(index);
  },
);

it("rejects a valid but misbound public Storage creation result before initialization success", async () => {
  const f = await seed();
  await f.client.close();
  const reached = vi.fn();
  const run = await launch(f.root, undefined, {
    decorateOwner: (owner) => ({
      open: (request) => owner.open(request),
      close: (request) => owner.close(request),
      stop: () => owner.stop(),
      acquireActivation: (request) => owner.acquireActivation(request),
      create: async (request) => {
        const result = await owner.create(request);
        expect(result.status).toBe("ready");
        if (result.status !== "ready") throw new Error("Creation setup failed");
        reached();
        return {
          status: "ready",
          result: {
            ...ProjectStorageCreateResultSchema.parse(result.result),
            request: { projectId: id(101), createRequestId: id(111) },
          },
        };
      },
    }),
  });
  run.port.postMessage(control("stale.initialize", 1, 171));
  await vi.waitFor(() => expect(reached).toHaveBeenCalled());
  try {
    await run.transport.terminated;
    expect(run.exits).toEqual([1]);
    expect(run.results).toEqual([]);
  } finally {
    run.port.close();
    await run.transport.terminated;
    expect(run.exits).toEqual([1]);
  }
});

it.each([
  "request-reuse",
  "repeat-release",
  "wrong-mode",
  "early-finish",
  "wrong-proof",
  "wrong-number",
])("rejects contradictory controls with a valid live replacement: %s", async (fault) => {
  const f = await seed();
  await f.client.close();
  const run = await initializeAndRelease(f.root);
  const next = await replacement(f.root);
  const attempt = {
    ...control("stale.attempt", 3, 173),
    replacementActivationId: next.activationId,
    replacementWriterGeneration: 2,
  };
  const messages: Record<string, unknown> = {
    "request-reuse": { ...attempt, requestId: id(172) },
    "repeat-release": control("stale.release", 2, 176),
    "wrong-mode": control(),
    "early-finish": control("stale.finish", 4, 174),
    "wrong-proof": { ...attempt, proofId: id(199) },
    "wrong-number": { ...attempt, stepNumber: 4 },
  };
  run.port.postMessage(messages[fault]);
  await run.transport.terminated;
  expect(run.exits).toEqual([1]);
  expect(run.results).toHaveLength(2);
  expect(await next.writer.verifyFence()).toEqual({ status: "current" });
});
