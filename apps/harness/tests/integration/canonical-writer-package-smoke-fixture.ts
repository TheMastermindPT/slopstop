import { deepStrictEqual } from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  dateTimeTextSchema,
  decodeStrict,
  EmptyObjectSchema,
  ProjectActivationIdSchema,
  ProjectStorageCreateResultSchema,
  ProjectStorageOpenResultSchema,
  UuidTextSchema,
  type WriterProofControl,
  writerProofProjectId,
  writerProofStaleCommand,
  writerProofStaleCreateRequestId,
  writerProofStaleProjectId,
} from "@slopstop/protocol";
import { Schema } from "effect";
import {
  createCanonicalCommandRegistry,
  defineCanonicalCommand,
} from "../../src/canonical-command-registry.js";
import {
  type CanonicalProjectWriter,
  createCanonicalProjectWriter,
} from "../../src/canonical-project-writer.js";
import type {
  ProjectStorageActivationSession,
  ProjectStorageOwner,
} from "../../src/project-storage-application.js";
import {
  type CanonicalCommandRepository,
  createCanonicalCommandRepositoryFactory,
  WriterCapabilityTokenSchema,
} from "../../src/storage/canonical-command-repository.js";
import {
  type CanonicalWriterLease,
  createNodeCanonicalWriterLeaseFactory,
} from "../../src/storage/canonical-writer-lease.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
} from "../../src/storage/local-libsql-worker-client.js";
import { createNodeProjectStorageDependencies } from "../../src/storage/project-storage-node-adapters.js";
import { createProjectStorageOwner } from "../../src/storage/project-storage-store.js";

export type WriterProofRoots = Readonly<{
  applicationStorageRoot: string;
  migrationResourcesRoot: string;
}>;
export type WriterProofFixture = Readonly<{
  control(control: WriterProofControl): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}>;
export type WriterProofResourceDecorators = Readonly<{
  decorateClient?: ((client: LocalLibsqlClient) => LocalLibsqlClient) | undefined;
  decorateOwner?: (owner: ProjectStorageOwner) => ProjectStorageOwner;
  decorateLease?: (lease: CanonicalWriterLease) => CanonicalWriterLease;
}>;
type Row = Record<string, unknown>;
type Snapshot = Record<string, Row[]>;
const tables = [
  "canonical_events",
  "command_idempotency",
  "command_receipts",
  "command_rejections",
  "project_state",
  "project_workspaces",
  "repository_bindings",
  "schema_metadata",
  "storage_identity",
  "writer_fence",
  "writer_generations",
  "writer_handoffs",
  "writer_recovery_records",
] as const;
const uuid = UuidTextSchema.check(
  Schema.makeFilter(
    (s: string) =>
      s === s.toLowerCase() &&
      s !== "00000000-0000-0000-0000-000000000000" &&
      s !== "ffffffff-ffff-ffff-ffff-ffffffffffff",
  ),
);
const utc = dateTimeTextSchema({ precision: 3 });
const digest = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/));
const safeFailure = "Writer proof fixture failed.";

function requireProof(value: unknown): asserts value {
  if (!value) throw new Error(safeFailure);
}

function exact(actual: unknown, expected: unknown) {
  deepStrictEqual(actual, expected);
}

async function closeResources(releases: (() => Promise<void> | undefined)[]) {
  let failed = false;
  for (const release of releases) {
    try {
      await release();
    } catch {
      failed = true;
    }
  }
  requireProof(!failed);
}

function only(snapshot: Snapshot, table: string): Row {
  const rows = snapshot[table];
  requireProof(rows?.length === 1);
  const row = rows[0];
  requireProof(row);
  return row;
}

function rowsOf(snapshot: Snapshot, table: string, count: number): Row[] {
  const rows = snapshot[table];
  requireProof(rows?.length === count);
  return rows;
}

async function readRows(client: LocalLibsqlClient, sql: string): Promise<Row[]> {
  const result = await client.execute(sql);
  requireProof(new Set(result.columns).size === result.columns.length);
  return result.rows.map((values) => {
    requireProof(values.length === result.columns.length);
    return Object.fromEntries(result.columns.map((name, index) => [name, values[index]]));
  });
}

async function snapshot(client: LocalLibsqlClient): Promise<Snapshot> {
  exact(
    (await readRows(client, "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name")).map(
      (row) => row["name"],
    ),
    tables,
  );
  exact(await readRows(client, "PRAGMA foreign_key_check"), []);
  exact(await readRows(client, "PRAGMA integrity_check"), [{ integrity_check: "ok" }]);
  const value: Snapshot = {};
  for (const table of tables) value[table] = await readRows(client, `SELECT * FROM ${table}`);
  return value;
}

function verifyStorage(
  value: Snapshot,
  opened: Extract<typeof ProjectStorageOpenResultSchema.Type, { status: "opened" }>,
  sequence: number,
) {
  const identity = only(value, "storage_identity");
  const created = decodeStrict(utc, identity["created_at"]);
  exact(identity, {
    identity_key: "storage",
    project_id: opened.request.projectId,
    storage_id: opened.identity.storageId,
    generation_id: opened.identity.generationId,
    canonical_database_lineage_id: opened.identity.canonicalDatabaseLineageId,
    created_at: created,
  });
  exact(only(value, "schema_metadata"), {
    metadata_key: "canonical",
    database_kind: "canonical",
    format_version: 1,
    schema_version: 3,
    last_migration_id: "0002_initial_repository_binding",
  });
  const state = only(value, "project_state");
  const updated = decodeStrict(utc, state["updated_at"]);
  requireProof(created <= updated);
  exact(state, {
    project_id: opened.request.projectId,
    last_project_sequence: sequence,
    last_writer_generation: 2,
    created_at: created,
    updated_at: updated,
  });
}

function verifyAuthority(
  value: Snapshot,
  projectId: string,
  activationIds: readonly string[],
  released: boolean,
) {
  const generations = [...rowsOf(value, "writer_generations", 2)].sort(
    (a, b) => Number(a["writer_generation"]) - Number(b["writer_generation"]),
  );
  const first = generations[0];
  const second = generations[1];
  requireProof(first && second);
  const acquired = generations.map((row) => decodeStrict(utc, row["acquired_at"]));
  const tokens = generations.map((row) => decodeStrict(digest, row["token_digest"]));
  requireProof(tokens[0] !== tokens[1]);
  const terminal = released ? decodeStrict(utc, second["released_at"]) : null;
  const firstTime = acquired[0];
  const secondTime = acquired[1];
  requireProof(firstTime && secondTime && firstTime <= secondTime);
  if (terminal !== null) requireProof(secondTime <= terminal);
  generations.forEach((row, i) => {
    exact(row, {
      project_id: projectId,
      writer_generation: i + 1,
      activation_id: activationIds[i],
      token_digest: tokens[i],
      acquired_at: acquired[i],
      released_at: i === 0 ? secondTime : terminal,
    });
  });
  exact(only(value, "writer_fence"), {
    project_id: projectId,
    writer_generation: 2,
    token_digest: tokens[1],
    state: released ? "released" : "active",
    activated_at: secondTime,
    released_at: terminal,
  });
  const handoffs = [...rowsOf(value, "writer_handoffs", 2)].sort(
    (a, b) => Number(a["to_writer_generation"]) - Number(b["to_writer_generation"]),
  );
  handoffs.forEach((row, i) => {
    exact(row, {
      project_id: projectId,
      handoff_id: decodeStrict(uuid, row["handoff_id"]),
      from_writer_generation: i === 0 ? null : 1,
      to_writer_generation: i + 1,
      kind: i === 0 ? "initial" : "recovery",
      recorded_at: acquired[i],
    });
  });
  requireProof(handoffs[0]?.["handoff_id"] !== handoffs[1]?.["handoff_id"]);
  const recovery = only(value, "writer_recovery_records");
  exact(recovery, {
    project_id: projectId,
    recovery_record_id: decodeStrict(uuid, recovery["recovery_record_id"]),
    writer_generation: 1,
    reason: "abandoned-active-fence",
    command_id: null,
    command_fingerprint: null,
    observed_at: secondTime,
    resolution: "generation-superseded",
    resolved_by_writer_generation: 2,
    resolved_at: secondTime,
  });
  return { acquired, terminal };
}

function fingerprint(commandId: string) {
  // Deliberately independent of canonical-json and repository fingerprint code.
  const text = `{"commandId":"${commandId}","fingerprintVersion":1,"payload":{},"projectId":"00000000-0000-4000-8000-000000000101","type":"conformance.writer.noop","version":1}`;
  return createHash("sha256").update(text).digest("hex");
}

function verifyReceipts(
  value: Snapshot,
  control: Extract<WriterProofControl, { step: "audit.initialize" }>,
) {
  const receipts = [...rowsOf(value, "command_receipts", 2)].sort(
    (a, b) => Number(a["project_sequence"]) - Number(b["project_sequence"]),
  );
  const pointers = rowsOf(value, "command_idempotency", 2);
  const rejections = rowsOf(value, "command_rejections", 2);
  receipts.forEach((row, i) => {
    const receipt = control.expectedReceipts[i];
    requireProof(receipt);
    const hash = fingerprint(receipt.commandId);
    exact(row, {
      project_id: writerProofProjectId,
      receipt_id: receipt.receiptId,
      command_id: receipt.commandId,
      command_type: "conformance.writer.noop",
      command_version: 1,
      command_fingerprint: hash,
      outcome: "rejected",
      project_sequence: i + 1,
      writer_generation: i + 1,
      settled_at: receipt.settledAt,
    });
    exact(
      pointers.find((pointer) => pointer["command_id"] === receipt.commandId),
      {
        project_id: writerProofProjectId,
        command_id: receipt.commandId,
        original_command_fingerprint: hash,
        original_receipt_id: receipt.receiptId,
        created_at: receipt.settledAt,
      },
    );
    exact(
      rejections.find((rejection) => rejection["receipt_id"] === receipt.receiptId),
      {
        project_id: writerProofProjectId,
        receipt_id: receipt.receiptId,
        receipt_outcome: "rejected",
        project_sequence: i + 1,
        rejection_code: "COMMAND_TYPE_UNSUPPORTED",
        retryable: 0,
        details_json: '{"version":1}',
        details_hash: createHash("sha256").update('{"version":1}').digest("hex"),
      },
    );
  });
  exact(rowsOf(value, "canonical_events", 0), []);
  exact(only(value, "project_state")["updated_at"], control.expectedReceipts[1].settledAt);
}

export function createWriterProofFixture(
  roots: WriterProofRoots,
  decorators: WriterProofResourceDecorators = {},
): WriterProofFixture {
  const dependencies = createNodeProjectStorageDependencies({
    ...roots,
    applicationVersion: "0.0.0",
  });
  const originalOwner = createProjectStorageOwner(dependencies);
  const owner = decorators.decorateOwner?.(originalOwner) ?? originalOwner;
  let client: LocalLibsqlClient | undefined;
  let session: ProjectStorageActivationSession | undefined;
  let lease: CanonicalWriterLease | undefined;
  let repository: CanonicalCommandRepository | undefined;
  let writer: CanonicalProjectWriter | undefined;
  const counts = { registryCalls: 0, handlerCalls: 0, identityCalls: 0, settlementClockCalls: 0 };
  const openClient = (file: string) => {
    const original = createWorkerLocalLibsqlClient(file, "generation");
    return decorators.decorateClient?.(original) ?? original;
  };
  const close = async () => {
    await closeResources([
      () => client?.close(),
      () => repository?.close(),
      () => lease?.release(),
      () => session?.close(),
      () => owner.stop(),
    ]);
  };
  const audit = async (control: Extract<WriterProofControl, { step: "audit.initialize" }>) => {
    const result = await owner.open({ projectId: writerProofProjectId });
    requireProof(result.status === "ready");
    const opened = decodeStrict(ProjectStorageOpenResultSchema, result.result);
    requireProof(opened.status === "opened");
    const file = dependencies.paths.forCreation(writerProofProjectId, opened.identity.generationId)
      .active.canonicalDatabase;
    client = openClient(file);
    const before = await snapshot(client);
    verifyStorage(before, opened, 2);
    const authority = verifyAuthority(before, writerProofProjectId, control.activationIds, true);
    verifyReceipts(before, control);
    control.expectedReceipts.forEach((receipt, i) => {
      const acquired = authority.acquired[i];
      const end = i === 0 ? authority.acquired[1] : authority.terminal;
      requireProof(acquired && end && acquired <= receipt.settledAt && receipt.settledAt <= end);
    });
    exact(await snapshot(client), before);
    await close();
    return {
      projectId: writerProofProjectId,
      audit: "exact-ledger-and-abandoned-recovery",
      lastProjectSequence: 2,
      lastWriterGeneration: 2,
      receipts: 2,
      rejections: 2,
      idempotency: 2,
      events: 0,
      generations: 2,
      handoffs: 2,
      abandonedRecoveryRecords: 1,
      uncertainRecoveryRecords: 0,
      fence: "released",
    };
  };
  const initialize = async () => {
    const created = await owner.create({
      projectId: writerProofStaleProjectId,
      createRequestId: writerProofStaleCreateRequestId,
    });
    requireProof(created.status === "ready");
    const validated = decodeStrict(ProjectStorageCreateResultSchema, created.result);
    requireProof(validated.status === "created");
    exact(validated.request, {
      projectId: writerProofStaleProjectId,
      createRequestId: writerProofStaleCreateRequestId,
    });
    const opened = await owner.acquireActivation({ projectId: writerProofStaleProjectId });
    requireProof(opened.status === "ready");
    session = opened.session;
    requireProof(session.mode === "read-write");
    const acquired = await createNodeCanonicalWriterLeaseFactory().acquire(session.writerLeasePath);
    if (acquired.status === "broken") {
      await acquired.cleanup?.close();
      throw new Error(safeFailure);
    }
    requireProof(acquired.status === "acquired");
    lease = decorators.decorateLease?.(acquired.lease) ?? acquired.lease;
    const registry = createCanonicalCommandRegistry([
      defineCanonicalCommand({
        type: "conformance.writer.noop",
        version: 1,
        payloadSchema: EmptyObjectSchema,
        handle: () => {
          counts.handlerCalls++;
          return { outcome: "unchanged" };
        },
      }),
    ]);
    const identity = () => {
      counts.identityCalls++;
      return randomUUID();
    };
    const factory = createCanonicalCommandRepositoryFactory({
      openClient,
      registry: {
        prepare: (command) => {
          counts.registryCalls++;
          return registry.prepare(command);
        },
      },
      createReceiptId: identity,
      createEventId: identity,
      now: () => {
        counts.settlementClockCalls++;
        return new Date().toISOString();
      },
      createHandoffId: randomUUID,
      createRecoveryRecordId: randomUUID,
      sha256Text: async (text) => createHash("sha256").update(text).digest("hex"),
    });
    const activationId = decodeStrict(ProjectActivationIdSchema, randomUUID());
    const activated = await factory.activate({
      canonicalDatabasePath: session.canonicalDatabasePath,
      projectId: writerProofStaleProjectId,
      activationId,
      writerToken: decodeStrict(WriterCapabilityTokenSchema, randomBytes(32).toString("hex")),
      activatedAt: new Date().toISOString(),
    });
    if (activated.status === "broken") {
      await activated.cleanup?.close();
      throw new Error(safeFailure);
    }
    repository = activated.repository;
    requireProof(activated.writerGeneration === 1);
    writer = createCanonicalProjectWriter({
      projectId: writerProofStaleProjectId,
      activationId,
      writerGeneration: activated.writerGeneration,
      repository,
      lease,
    });
    client = openClient(session.canonicalDatabasePath);
    Object.assign(counts, {
      registryCalls: 0,
      handlerCalls: 0,
      identityCalls: 0,
      settlementClockCalls: 0,
    });
    return { projectId: writerProofStaleProjectId, activationId, writerGeneration: 1 };
  };
  const attempt = async (control: Extract<WriterProofControl, { step: "stale.attempt" }>) => {
    requireProof(writer && client && session?.mode === "read-write");
    const before = await snapshot(client);
    verifyStorage(before, session.result, 0);
    verifyAuthority(
      before,
      writerProofStaleProjectId,
      [writer.activationId, control.replacementActivationId],
      false,
    );
    for (const table of [
      "command_receipts",
      "command_rejections",
      "command_idempotency",
      "canonical_events",
    ])
      exact(rowsOf(before, table, 0), []);
    const result = await writer.settle(writerProofStaleCommand).result;
    exact(result, {
      status: "stale-writer",
      projectId: writerProofStaleProjectId,
      activationId: writer.activationId,
      commandId: writerProofStaleCommand.commandId,
      diagnostic: {
        code: "WRITER_FENCE_STALE",
        message: "The active Writer fence is stale.",
        retryable: false,
      },
    });
    let refused = false;
    try {
      await writer.close("2026-09-05T12:00:09.000Z");
    } catch (error) {
      refused = error instanceof Error && "code" in error && error.code === "WRITER_FENCE_STALE";
    }
    requireProof(refused);
    exact(await snapshot(client), before);
    exact(counts, { registryCalls: 0, handlerCalls: 0, identityCalls: 0, settlementClockCalls: 0 });
    return {
      projectId: writerProofStaleProjectId,
      activationId: writer.activationId,
      commandId: writerProofStaleCommand.commandId,
      replacementActivationId: control.replacementActivationId,
      replacementWriterGeneration: 2,
      status: "stale-writer",
      code: "WRITER_FENCE_STALE",
      retryable: false,
      allCanonicalRowsUnchanged: true,
      ...counts,
      writerClose: "stale-refused",
      operationalReleaseAuthorized: false,
    };
  };
  return {
    close,
    control: async (control) => {
      switch (control.step) {
        case "audit.initialize":
          return audit(control);
        case "stale.initialize":
          return initialize();
        case "stale.release":
          requireProof(lease && writer);
          await lease.release();
          return { testLeaseReleased: true, oldWriterRetained: true };
        case "stale.attempt":
          return attempt(control);
        case "stale.finish":
          await close();
          return { teardown: "test-resources-only" };
      }
    },
  };
}
