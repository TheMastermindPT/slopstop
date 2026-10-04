import { createHash } from "node:crypto";
import path from "node:path";
import { MessageChannel } from "node:worker_threads";
import {
  type CanonicalProjectCommandRequest,
  type DesktopMessage,
  decodeStrict,
  ProjectActivationIdSchema,
  ProjectIdSchema,
  parseHarnessMessage,
} from "@slopstop/protocol";
import { expect, vi } from "vitest";
import { createActiveProjectCoordinator } from "../../src/active-project-coordinator.js";
import { createCanonicalCommandRegistry } from "../../src/canonical-command-registry.js";
import { createCanonicalProjectApplication } from "../../src/canonical-project-application.js";
import { startHarnessRuntime } from "../../src/harness-runtime.js";
import type { ProjectStorageActivationPort } from "../../src/project-storage-application.js";
import { createProjectStorageApplication } from "../../src/project-storage-application.js";
import {
  type CanonicalCommandRepository,
  createCanonicalCommandRepositoryFactory,
  WriterCapabilityTokenSchema,
} from "../../src/storage/canonical-command-repository.js";
import { createNodeCanonicalWriterLeaseFactory } from "../../src/storage/canonical-writer-lease.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import { createNodeProjectStorageDependencies } from "../../src/storage/project-storage-node-adapters.js";
import { createProjectStorageOwner } from "../../src/storage/project-storage-store.js";
import { createUnavailableWorkspaceApplication } from "../../src/workspace-application.js";
import {
  appliedReceipt,
  canonicalCommandProjectId,
  observedSettlementClient,
  type SettlementObservation,
  settlementBarrier,
  settlementRequest,
  settlementRows,
  settlementT0,
  settlementT1,
} from "./canonical-command-fixture.js";
import {
  expectedUnresolvedRecoveryRow,
  type RecoveryFixture,
  recoveryActivationTime,
  recoveryHandoffId,
  recoveryRecordId,
  recoveryStoragePort,
  recoveryTime,
} from "./canonical-writer-recovery-fixture.js";
import {
  createConformanceCounterCommand,
  productionSettlementRows,
} from "./conformance-counter-command.js";
import { checkedInMigrationRoot, transportFor } from "./project-storage-create-fixture.js";

export const recoveryOtherProject = decodeStrict(
  ProjectIdSchema,
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
);

export const recoveryNextEpoch = decodeStrict(
  ProjectActivationIdSchema,
  "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
);

const recoveryRetryTime = "2026-09-05T12:00:06.000Z";

const recoveryRuntimeTime = "2026-09-05T12:01:00.000Z";

export const recoveryRetryReceipt = {
  ...appliedReceipt,
  receiptId: "66666666-6666-4666-8666-666666666502",
  writerGeneration: 2,
  settledAt: recoveryRetryTime,
  events: [
    { eventId: "77777777-7777-4777-8777-777777777603", eventOrdinal: 0 },
    { eventId: "77777777-7777-4777-8777-777777777604", eventOrdinal: 1 },
  ],
} as const;

export const recoveryInternalFailure = {
  code: "HARNESS_INTERNAL_FAILURE",
  message: "Harness failed while handling a message.",
  retryable: false,
};

export function recoveryEnvelope(
  sequence: number,
  causation: number,
  event: string,
  payload: unknown,
) {
  return {
    protocolVersion: 4,
    messageType: "event",
    messageId: `99999999-9999-4999-8999-999999999${600 + sequence}`,
    sentAt: recoveryRuntimeTime,
    sequence,
    causationId: `11111111-1111-4111-8111-111111111${600 + causation}`,
    event,
    payload,
  };
}

export function recoveryActive(generation = 1, projectId = settlementRequest.projectId) {
  return {
    status: "active",
    request: { projectId },
    access: "read-write",
    activationId: generation === 1 ? settlementRequest.activationId : recoveryNextEpoch,
    writerGeneration: generation,
  };
}

export function recoveryCommandFailure(
  status: "inactive" | "writer-unavailable" | "stale-activation",
  request = settlementRequest,
) {
  const diagnostics = {
    inactive: {
      code: "PROJECT_INACTIVE",
      message: "No Project is active for Typed commands.",
      retryable: false,
    },
    "writer-unavailable": {
      code: "WRITER_UNAVAILABLE",
      message: "The Writer requires explicit reactivation.",
      retryable: false,
    },
    "stale-activation": {
      code: "PROJECT_ACTIVATION_STALE",
      message: "The command activation is stale.",
      retryable: false,
    },
  };
  return {
    status,
    projectId: request.projectId,
    activationId: request.activationId,
    commandId: request.command.commandId,
    diagnostic: diagnostics[status],
  };
}

function recoveryWireClient(
  application: ReturnType<typeof createCanonicalProjectApplication>,
  storage: ReturnType<typeof createProjectStorageApplication>,
) {
  const { port1, port2 } = new MessageChannel();
  const messages: unknown[] = [];
  const pending = new Map<string, (message: unknown) => void>();
  // Subscribe before any send; correlate joined and unrelated requests independently.
  port2.on("message", (message: unknown) => {
    messages.push(message);
    const parsed = parseHarnessMessage(message);
    if (parsed.ok && parsed.value.causationId !== null) {
      pending.get(parsed.value.causationId)?.(message);
      pending.delete(parsed.value.causationId);
    }
  });
  let sequence = 600;
  const stop = startHarnessRuntime({
    transport: transportFor(port1),
    canonicalProjectApplication: application,
    projectStorageApplication: storage,
    workspaceApplication: createUnavailableWorkspaceApplication(),
    harnessVersion: "0.0.0",
    createId: () => `99999999-9999-4999-8999-999999999${++sequence}`,
    now: () => recoveryRuntimeTime,
  });
  return {
    messages,
    send: (id: number, command: DesktopMessage["command"], payload: unknown) => {
      const messageId = `11111111-1111-4111-8111-111111111${600 + id}`;
      if (pending.has(messageId)) throw new Error("Duplicate pending transport identity.");
      const response = new Promise<unknown>((resolve) => pending.set(messageId, resolve));
      port2.postMessage({
        protocolVersion: 4,
        messageType: "command",
        messageId,
        sentAt: recoveryRuntimeTime,
        command,
        payload,
      });
      return response;
    },
    stop: async () => {
      try {
        await stop();
      } finally {
        port1.close();
        port2.close();
      }
    },
  };
}

export async function createRecoveryRuntime(
  file: string,
  options: { production?: boolean; next?: boolean; otherFile?: string } = {},
) {
  const observation: SettlementObservation = {};
  const calls: string[] = [];
  const repositories: CanonicalCommandRepository[] = [];
  const registered = createCanonicalCommandRegistry(
    options.production ? [] : [createConformanceCounterCommand()],
  );
  const prepare = vi.fn(registered.prepare);
  const registry = { prepare };
  const dependencies = {
    registry,
    createReceiptId: vi.fn<() => string>(() => appliedReceipt.receiptId),
    createEventId: vi
      .fn<() => string>()
      .mockReturnValueOnce(appliedReceipt.events[0].eventId)
      .mockReturnValueOnce(appliedReceipt.events[1].eventId),
    createRecoveryRecordId: vi.fn(() => recoveryRecordId),
    now: vi.fn(() => recoveryTime).mockReturnValueOnce(settlementT1),
    sha256Text: vi.fn(async (text: string) => createHash("sha256").update(text).digest("hex")),
  };
  const factory = createCanonicalCommandRepositoryFactory({
    ...dependencies,
    openClient: (selected) =>
      observedSettlementClient(
        createWorkerLocalLibsqlClient(selected, "generation"),
        observation,
        calls,
      ),
    createHandoffId: vi
      .fn(() => "88888888-8888-4888-9888-888888888602")
      .mockReturnValueOnce(
        options.next ? "88888888-8888-4888-9888-888888888602" : recoveryHandoffId,
      ),
  });
  const realStorage = options.production
    ? createProjectStorageOwner(
        createNodeProjectStorageDependencies({
          applicationStorageRoot: path.resolve(file, "../../../.."),
          migrationResourcesRoot: checkedInMigrationRoot,
          applicationVersion: "0.0.0",
        }),
      )
    : undefined;
  const acquire = vi.fn(
    async (request: Parameters<ProjectStorageActivationPort["acquireActivation"]>[0]) => {
      if (realStorage) return realStorage.acquireActivation(request);
      const selected = request.projectId === recoveryOtherProject ? options.otherFile : file;
      if (!selected) throw new Error("Unconfigured recovery Project.");
      return recoveryStoragePort(selected, async () => {}).acquireActivation(request);
    },
  );
  const activate = vi.fn(async (input: Parameters<typeof factory.activate>[0]) => {
    const result = await factory.activate(input);
    if (result.status === "activated") repositories.push(result.repository);
    return result;
  });
  const native = createNodeCanonicalWriterLeaseFactory();
  const lease = vi.fn((selected: string) => native.acquire(selected));
  const clock = vi
    .fn(() => "2026-09-05T12:00:07.000Z")
    .mockReturnValueOnce(options.next ? recoveryActivationTime : settlementT0);
  const epoch = vi
    .fn(() => recoveryNextEpoch)
    .mockReturnValueOnce(options.next ? recoveryNextEpoch : settlementRequest.activationId);
  const token = vi
    .fn(() => decodeStrict(WriterCapabilityTokenSchema, "2".repeat(64)))
    .mockReturnValueOnce(
      decodeStrict(WriterCapabilityTokenSchema, (options.next ? "2" : "1").repeat(64)),
    );
  const coordinator = createActiveProjectCoordinator({
    storage: { acquireActivation: acquire },
    repositories: { activate },
    leases: { acquire: lease },
    now: clock,
    createActivationId: epoch,
    createWriterToken: token,
  });
  const application = createCanonicalProjectApplication(coordinator);
  const dispatched = settlementBarrier();
  const execute = vi.fn((request: CanonicalProjectCommandRequest) => {
    const result = application.execute(request);
    if (execute.mock.calls.length === 2) dispatched.release();
    return result;
  });
  const openEntered = settlementBarrier();
  const openRelease = settlementBarrier();
  const storage = realStorage
    ? createProjectStorageApplication(realStorage)
    : createProjectStorageApplication({
        open: async (request) => {
          openEntered.release();
          await openRelease.promise;
          return { status: "ready", result: { status: "not-registered", request } };
        },
        create: async () => {
          throw new Error("Unexpected create.");
        },
        close: async () => {
          throw new Error("Unexpected close.");
        },
        stop: async () => {},
      });
  return {
    ...recoveryWireClient({ ...application, execute }, storage),
    file,
    observation,
    calls,
    repositories,
    dependencies,
    prepare,
    acquire,
    activate,
    lease,
    clock,
    epoch,
    token,
    dispatched,
    openEntered,
    openRelease,
    snapshot: async () => {
      if (!options.production) return settlementRows(file);
      const rows = await productionSettlementRows(file);
      const reader = createWorkerLocalLibsqlClient(file, "generation");
      try {
        for (const table of ["writer_handoffs", "writer_recovery_records"])
          rows[table] = (await reader.execute(`SELECT * FROM ${table} ORDER BY 1,2`)).rows;
        return rows;
      } finally {
        await reader.close();
      }
    },
  };
}

export function configureRecoveryRetry(
  f: Awaited<ReturnType<typeof createRecoveryRuntime>>,
  landed: boolean,
) {
  f.dependencies.now.mockReset().mockReturnValue(recoveryRetryTime);
  f.dependencies.createReceiptId.mockReturnValue(recoveryRetryReceipt.receiptId);
  f.dependencies.createEventId
    .mockReset()
    .mockReturnValueOnce(recoveryRetryReceipt.events[0].eventId)
    .mockReturnValueOnce(recoveryRetryReceipt.events[1].eventId);
  if (landed)
    f.prepare.mockImplementation((command) => createCanonicalCommandRegistry([]).prepare(command));
}

export function expectRecoveryPrivacy(f: { messages: unknown[]; file: string }) {
  const wire = JSON.stringify(f.messages);
  for (const secret of [
    "Private recovery",
    "secret-token",
    JSON.stringify(f.file).slice(1, -1),
    "1".repeat(64),
    "2".repeat(64),
    createHash("sha256").update("1".repeat(64)).digest("hex"),
    createHash("sha256").update("2".repeat(64)).digest("hex"),
    expectedUnresolvedRecoveryRow()[5],
    "conformance.counter.changed",
    "previous",
    "meta",
    "AggregateError",
    "cause",
  ])
    expect(wire).not.toContain(secret);
}

export function expectRecoveryRuntimeRows(
  rows: Awaited<ReturnType<typeof settlementRows>>,
  receipt: typeof appliedReceipt | typeof recoveryRetryReceipt,
) {
  const h = (text: string) => createHash("sha256").update(text).digest("hex");
  const fingerprint = expectedUnresolvedRecoveryRow()[5];
  const a = canonicalCommandProjectId;
  expect(rows["conformance_counter"]).toEqual([[a, "55555555-5555-4555-8555-555555555501", 7, 2]]);
  expect(rows["command_receipts"]).toEqual([
    [
      a,
      receipt.receiptId,
      receipt.commandId,
      "conformance.counter.set",
      1,
      fingerprint,
      "applied",
      1,
      receipt.writerGeneration,
      receipt.settledAt,
    ],
  ]);
  expect(rows["command_idempotency"]).toEqual([
    [a, receipt.commandId, fingerprint, receipt.receiptId, receipt.settledAt],
  ]);
  expect(rows["command_rejections"]).toEqual([]);
  expect(rows["canonical_events"]).toEqual([
    [
      a,
      receipt.events[0]?.eventId,
      receipt.receiptId,
      "applied",
      1,
      0,
      "conformance.counter",
      "55555555-5555-4555-8555-555555555501",
      2,
      "conformance.counter.changed",
      1,
      '{"previous":0,"value":7}',
      h('{"previous":0,"value":7}'),
      receipt.settledAt,
    ],
    [
      a,
      receipt.events[1]?.eventId,
      receipt.receiptId,
      "applied",
      1,
      1,
      "conformance.counter",
      "55555555-5555-4555-8555-555555555501",
      2,
      "conformance.counter.checked",
      1,
      '{"value":7}',
      h('{"value":7}'),
      receipt.settledAt,
    ],
  ]);
  expect(rows["foreign_keys"]).toEqual([]);
}

export async function expectPublicBrokenRecoveryActivation(f: RecoveryFixture) {
  const before = await f.snapshot();
  const runtime = await createRecoveryRuntime(f.file, { next: true });
  if (f.observation.after) runtime.observation.after = f.observation.after;
  try {
    expect(
      await runtime.send(1, "project.activate", { projectId: settlementRequest.projectId }),
    ).toEqual(
      recoveryEnvelope(1, 1, "project.activate.result", {
        status: "broken",
        request: { projectId: settlementRequest.projectId },
        diagnostic: {
          code: "WRITER_FENCE_ACTIVATION_FAILED",
          message: "Writer fence could not be activated.",
          retryable: false,
        },
      }),
    );
    expect(await f.snapshot()).toEqual(before);
    expect(runtime.calls.filter((sql) => /^(INSERT|UPDATE|DELETE)/u.test(sql))).toEqual([]);
    expect(runtime.repositories).toEqual([]);
    expect(runtime.prepare).not.toHaveBeenCalled();
    expect(runtime.dependencies.createReceiptId).not.toHaveBeenCalled();
    expect(runtime.dependencies.createEventId).not.toHaveBeenCalled();
    expect(runtime.dependencies.now).not.toHaveBeenCalled();
  } finally {
    await runtime.stop();
  }
}
