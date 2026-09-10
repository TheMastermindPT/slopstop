import { createHash } from "node:crypto";
import path from "node:path";
import { MessageChannel } from "node:worker_threads";
import {
  type CanonicalProjectCommandRequest,
  type CanonicalProjectCommandResult,
  type CanonicalProjectSwitchRequest,
  createProjectActivateCommand,
  createProjectCommand,
  createProjectSwitchCommand,
  ProjectActivationIdSchema,
  type ProjectId,
  ProjectIdSchema,
  ProjectStorageOpenResultSchema,
  parseHarnessMessage,
} from "@slopstop/protocol";
import { expect, vi } from "vitest";
import { z } from "zod";
import { createActiveProjectCoordinator } from "../../src/active-project-coordinator.js";
import {
  type CanonicalCommandDecision,
  type CanonicalCommandTransaction,
  CanonicalEventInputSchema,
  createCanonicalCommandRegistry,
  defineCanonicalCommand,
} from "../../src/canonical-command-registry.js";
import { createCanonicalProjectApplication } from "../../src/canonical-project-application.js";
import { startHarnessRuntime } from "../../src/harness-runtime.js";
import {
  createProjectStorageApplication,
  type ProjectStorageActivationPort,
} from "../../src/project-storage-application.js";
import {
  type CanonicalCommandRepository,
  type CanonicalCommandRepositoryFactory,
  createCanonicalCommandRepositoryFactory,
  WriterCapabilityTokenSchema,
} from "../../src/storage/canonical-command-repository.js";
import type {
  LocalLibsqlResultSet,
  LocalLibsqlTransaction,
} from "../../src/storage/local-libsql-worker-client.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import { createNodeProjectStorageDependencies } from "../../src/storage/project-storage-node-adapters.js";
import { createProjectStorageOwner } from "../../src/storage/project-storage-store.js";
import { createUnavailableWorkspaceApplication } from "../../src/workspace-application.js";
import type { SettlementObservation } from "./canonical-command-database-fixture.js";
import { settlementFixtureTime } from "./canonical-command-database-fixture.js";
import {
  checkedInMigrationRoot,
  fixedCreationIds,
  switchDeferred,
  transportFor,
} from "./project-storage-runtime-fixture.js";

export const settlementNewEpoch = ProjectActivationIdSchema.parse(
  "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
);
export function settledCommand(request: CanonicalProjectCommandRequest, receipt: unknown) {
  return {
    status: "settled",
    projectId: request.projectId,
    activationId: request.activationId,
    commandId: request.command.commandId,
    receipt,
  };
}

export function busyCommand(request: CanonicalProjectCommandRequest) {
  return {
    status: "command-busy",
    projectId: request.projectId,
    activationId: request.activationId,
    commandId: request.command.commandId,
    diagnostic: {
      code: "COMMAND_IN_PROGRESS",
      message: "Another command is in progress.",
      retryable: true,
    },
  };
}
export const settlementSwitch = {
  from: {
    projectId: ProjectIdSchema.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
    activationId: ProjectActivationIdSchema.parse("eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
  },
  to: { projectId: ProjectIdSchema.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1") },
};
export function settlementEvent(
  sequence: number,
  causation: number,
  event: string,
  payload: unknown,
) {
  return {
    protocolVersion: 4,
    messageType: "event",
    messageId: `99999999-9999-4999-8999-999999999${500 + sequence}`,
    sentAt: "2026-09-05T12:00:06.000Z",
    sequence,
    causationId: `11111111-1111-4111-8111-111111111${500 + causation}`,
    event,
    payload,
  };
}
export function settlementActivation(newEpoch = false) {
  return {
    status: "active",
    request: settlementSwitch.to,
    access: "read-write",
    activationId: newEpoch ? settlementNewEpoch : settlementSwitch.from.activationId,
    writerGeneration: newEpoch ? 2 : 1,
  };
}
export async function productionSettlementRows(file: string) {
  const client = createWorkerLocalLibsqlClient(file, "generation");
  try {
    const rows: Record<string, LocalLibsqlResultSet["rows"]> = {};
    for (const table of [
      "project_state",
      "command_receipts",
      "command_idempotency",
      "command_rejections",
      "canonical_events",
      "writer_fence",
      "writer_generations",
    ])
      rows[table] = (await client.execute(`SELECT * FROM ${table} ORDER BY 1,2`)).rows;
    rows["foreign_keys"] = (await client.execute("PRAGMA foreign_key_check")).rows;
    return rows;
  } finally {
    await client.close();
  }
}

export function holdMigratedSettlement(
  real: ReturnType<typeof createMigratedSettlement>,
  outcome: "current" | "stale" | "rejected",
  stage: "begin" | "sql" = "begin",
) {
  let release = () => {};
  let entered = () => {};
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  const error = new Error("private settlement failure");
  real.observation.begin = async () => {
    entered();
    await promise;
    delete real.observation.begin;
    if (outcome === "rejected" && stage === "begin") throw error;
  };
  if (outcome === "stale")
    real.observation.after = (sql, result) => {
      if (!sql.includes("FROM writer_fence")) return result;
      delete real.observation.after;
      return { ...result, rows: [] };
    };
  if (outcome === "rejected" && stage === "sql")
    real.observation.synchronous = () => {
      delete real.observation.synchronous;
      throw error;
    };
  return { release, ready, error };
}

export function createMigratedSettlement(projectId: ProjectId) {
  let file: string | undefined;
  let repository: CanonicalCommandRepository | undefined;
  let storage: ReturnType<typeof createProjectStorageOwner> | undefined;
  let session: (() => Promise<void>) | undefined;
  let handoff = 600;
  const observation: SettlementObservation = {};
  const calls: string[] = [];
  const current = () => {
    if (repository === undefined) throw new Error("Unexpected lifecycle-only settlement.");
    return repository;
  };
  return {
    calls,
    observation,
    activate: async (input: Parameters<CanonicalCommandRepositoryFactory["activate"]>[0]) => {
      const { createCanonicalCommandDatabase, observedSettlementClient } = await import(
        "./canonical-command-database-fixture.js"
      );
      const factory = createCanonicalCommandRepositoryFactory({
        registry: createCanonicalCommandRegistry([]),
        createReceiptId: () => "66666666-6666-4666-8666-666666666501",
        createEventId: () => {
          throw new Error("Empty registry allocated event.");
        },
        now: () => settlementFixtureTime,
        openClient: (selected) =>
          observedSettlementClient(
            createWorkerLocalLibsqlClient(selected, "generation"),
            observation,
            calls,
          ),
        sha256Text: async (text) => createHash("sha256").update(text).digest("hex"),
        createHandoffId: () => `88888888-8888-4888-8888-888888888${++handoff}`,
        createRecoveryRecordId: () => `99999999-9999-4999-8999-999999999${handoff}`,
      });
      file ??= await createCanonicalCommandDatabase(false, projectId);
      storage = createProjectStorageOwner(
        createNodeProjectStorageDependencies({
          applicationStorageRoot: path.resolve(file, "../../../.."),
          migrationResourcesRoot: checkedInMigrationRoot,
          applicationVersion: "0.0.0",
        }),
      );
      const acquired = await storage.acquireActivation({ projectId });
      if (acquired.status !== "ready") throw new Error("Production Storage activation failed.");
      if (acquired.session.mode !== "read-write")
        throw new Error("Production Storage is not writable.");
      session = () => acquired.session.close();
      const result = await factory.activate({ ...input, canonicalDatabasePath: file });
      if (result.status === "activated") repository = result.repository;
      return result;
    },
    settle: async (text: string) => {
      const result = await current().settle(text);
      if (result.status === "settled") {
        if (file === undefined) throw new Error("Missing production database.");
        const rows = await productionSettlementRows(file);
        const r = result.receipt;
        const payload =
          r.commandType === "conformance.counter.set"
            ? '{"value":7}'
            : '{"private":"secret command payload"}';
        const literal = `{"commandId":"${r.commandId}","fingerprintVersion":1,"payload":${payload},"projectId":"${projectId}","type":"${r.commandType}","version":1}`;
        const h = (value: string) => createHash("sha256").update(value).digest("hex");
        const fingerprint = h(literal);
        expect(rows["command_receipts"]).toEqual([
          [
            projectId,
            r.receiptId,
            r.commandId,
            r.commandType,
            1,
            fingerprint,
            "rejected",
            1,
            r.writerGeneration,
            settlementFixtureTime,
          ],
        ]);
        expect(rows["command_idempotency"]).toEqual([
          [projectId, r.commandId, fingerprint, r.receiptId, settlementFixtureTime],
        ]);
        expect(rows["command_rejections"]).toEqual([
          [
            projectId,
            r.receiptId,
            "rejected",
            1,
            "COMMAND_TYPE_UNSUPPORTED",
            0,
            '{"version":1}',
            h('{"version":1}'),
          ],
        ]);
        expect(rows["canonical_events"]).toEqual([]);
      }
      return result;
    },
    releaseFence: (time: string) => current().releaseFence(time),
    close: async () => {
      await repository?.close();
    },
    closeStorage: async () => {
      await session?.();
      await storage?.stop();
    },
  };
}

export function migratedUnsupported(request: CanonicalProjectCommandRequest, generation = 1) {
  return {
    status: "settled",
    projectId: request.projectId,
    activationId: request.activationId,
    commandId: request.command.commandId,
    receipt: {
      receiptId: "66666666-6666-4666-8666-666666666501",
      projectId: request.projectId,
      commandId: request.command.commandId,
      commandType: request.command.type,
      commandVersion: request.command.version,
      outcome: "rejected",
      projectSequence: 1,
      writerGeneration: generation,
      settledAt: settlementFixtureTime,
      events: [],
      rejection: { code: "COMMAND_TYPE_UNSUPPORTED", retryable: false },
    },
  };
}

type CompositionControls = {
  openBarrier?: Promise<void>;
  alterResult?: (result: CanonicalProjectCommandResult) => CanonicalProjectCommandResult;
};

type CompositionFixture = Awaited<ReturnType<typeof createSettlementComposition>>;

export function holdCompositionHandler(f: CompositionFixture, promise: Promise<void>) {
  f.handler.mockImplementation(async (context) => {
    await promise;
    return applyCounter(context);
  });
}

export function holdCompositionWork(f: CompositionFixture, boundary: "begin" | "commit" | "sql") {
  const entered = switchDeferred<void>();
  const held = switchDeferred<void>();
  const block = async () => {
    entered.resolve();
    await held.promise;
  };
  if (boundary === "begin") f.observation.begin = block;
  if (boundary === "commit") f.observation.commit = block;
  if (boundary === "sql")
    f.observation.after = async (sql, result) => {
      if (sql.startsWith("UPDATE conformance_counter")) await block();
      return result;
    };
  return { ready: entered.promise, release: () => held.resolve() };
}

export function compositionMutation(f: CompositionFixture) {
  let output: CanonicalCommandDecision = { outcome: "unchanged" };
  let parsedValue = 0;
  f.handler.mockImplementation(async (context) => {
    output = await applyCounter(context);
    context.payload.value = 9;
    parsedValue = context.payload.value;
    return output;
  });
  return {
    parsedValue: () => parsedValue,
    mutateOutput: () => {
      if (output.outcome !== "applied") throw new Error("No applied handler output.");
      const event = output.events[1];
      if (event === undefined) throw new Error("No second event.");
      if (typeof event.payload !== "object" || event.payload === null)
        throw new Error("No event payload.");
      Reflect.set(event.payload, "value", 99);
    },
  };
}

export function configureCompositionFault(
  f: CompositionFixture,
  stage: string,
  rowsAffected?: number,
) {
  const error = new Error("C:\\private\\project secret-token private handler payload");
  configureCompositionSource(f, stage, error);
  const fragment = stage === "second event" ? "INSERT INTO canonical_events" : stage;
  const target = stage === "second event" ? 2 : 1;
  let occurrence = 0;
  f.observation.after = (sql, result) => {
    if (!sql.includes(fragment) || ++occurrence !== target) return result;
    if (rowsAffected === undefined) throw error;
    return { ...result, rowsAffected };
  };
}

function configureCompositionSource(f: CompositionFixture, stage: string, error: Error) {
  const fail = () => {
    throw error;
  };
  const sources: Readonly<Record<string, () => void>> = {
    BEGIN: () => {
      f.observation.begin = () => {
        delete f.observation.begin;
        throw error;
      };
    },
    handler: () => {
      f.handler.mockImplementation(async (context) => {
        await writeCounter99(context);
        throw error;
      });
    },
    configuration: () => {
      f.observation.configure = () => {
        delete f.observation.configure;
        throw error;
      };
    },
    clock: () => {
      f.dependencies.now.mockImplementation(fail);
    },
    "receipt ID": () => {
      f.dependencies.createReceiptId.mockImplementation(fail);
    },
    "event ID": () => {
      f.dependencies.createEventId.mockImplementation(fail);
    },
    "ROLLBACK TO": () => {
      f.handler.mockImplementation(writeUnchanged);
    },
    "INSERT INTO command_rejections": () => {
      f.handler.mockImplementation(async (context) => {
        await writeCounter99(context);
        return {
          outcome: "rejected",
          rejection: { code: "TEST_COUNTER_REJECTED", retryable: false },
        };
      });
    },
  };
  sources[stage]?.();
}

export function configureCompositionDecision(
  f: CompositionFixture,
  mutate: (decision: CanonicalCommandDecision) => unknown,
) {
  f.handler.mockImplementation(async (context) =>
    malformedDecision(mutate(await applyCounter(context))),
  );
}

export function configureCompositionIssuedFailure(
  f: CompositionFixture,
  fault: string,
  outcome: "applied" | "unchanged",
) {
  f.handler.mockImplementation(issuedSqlFailureHandler(outcome, fault));
  const error = new Error("private issued SQL failure");
  f.observation.synchronous = (sql) => {
    if (fault === "synchronous" && sql === "SELECT 42") throw error;
  };
  f.observation.after = (sql, result) => {
    if (sql === "SELECT 42") throw error;
    return result;
  };
}

export function captureUnawaitedComposition(f: CompositionFixture) {
  let facade: CanonicalCommandTransaction | undefined;
  const returned = switchDeferred<void>();
  f.handler.mockImplementation(async (context) => {
    facade = context.transaction;
    void writeCounter99(context);
    returned.resolve();
    return { outcome: "unchanged" };
  });
  return {
    returned: returned.promise,
    execute: () => {
      if (facade === undefined) throw new Error("Handler facade was not captured.");
      return facade.execute("SELECT 42");
    },
  };
}

export function corruptCompositionResult(f: CompositionFixture) {
  f.controls.alterResult = (result) => {
    const copy = { ...result };
    Reflect.set(copy, "payload", "C:\\private\\project secret-token private handler payload");
    return copy;
  };
}

export function failCompositionCommit(
  f: CompositionFixture,
  kind: "before" | "after" | "lost" | "close",
) {
  const entered = switchDeferred<void>();
  const acknowledgement = switchDeferred<void>();
  const error = new Error("private COMMIT acknowledgement");
  if (kind === "close")
    f.observation.close = async () => {
      delete f.observation.close;
      throw error;
    };
  else
    f.observation.commit = async (transaction) => {
      delete f.observation.commit;
      if (kind === "before") throw error;
      await transaction.commit();
      entered.resolve();
      if (kind === "lost") await acknowledgement.promise;
      throw error;
    };
  return { ready: entered.promise, reject: () => acknowledgement.reject(error) };
}

export function configureCompositionSettings(
  f: CompositionFixture,
  shape: "disabled" | "duplicate" | "alias",
) {
  f.observation.configure = (sql, result) => {
    if (sql !== "PRAGMA foreign_keys") return result;
    delete f.observation.configure;
    const shapes = {
      disabled: { ...result, rows: [[0]] },
      duplicate: { ...result, rows: [[1], [1]] },
      alias: { ...result, columns: ["foreign_keys", "foreign_keys"], rows: [[1, 1]] },
    };
    return shapes[shape];
  };
}

export function retainCompositionClose(
  f: CompositionFixture,
  mode: "held" | "rejected" | "false-success",
) {
  const entered = switchDeferred<void>();
  const acknowledgement = switchDeferred<void>();
  let retained: LocalLibsqlTransaction | undefined;
  let attempts = 0;
  f.observation.closed = (transaction) => (transaction === retained ? false : transaction.closed);
  f.observation.close = async (transaction) => {
    retained = transaction;
    attempts++;
    if (attempts === 1) throw new Error("private transaction close");
    if (attempts === 2 && mode === "rejected") throw new Error("private retry close");
    if (attempts === 2 && mode === "false-success") return;
    entered.resolve();
    await acknowledgement.promise;
    await transaction.close();
    delete f.observation.closed;
    delete f.observation.close;
  };
  return {
    ready: entered.promise,
    release: () => acknowledgement.resolve(),
    attempts: () => attempts,
    driverClosed: () => retained?.closed,
  };
}

export async function createSettlementComposition(extended = true) {
  const {
    createCanonicalCommandDatabase,
    observedSettlementClient,
    settlementRequest,
    settlementRows,
    settlementT0,
    settlementT1,
  } = await import("./canonical-command-database-fixture.js");
  const file = await createCanonicalCommandDatabase(extended);
  const root = path.resolve(file, "../../../..");
  const storage = createProjectStorageOwner(
    createNodeProjectStorageDependencies({
      applicationStorageRoot: root,
      migrationResourcesRoot: checkedInMigrationRoot,
      applicationVersion: "0.0.0",
    }),
  );
  const observation: SettlementObservation = {};
  const calls: string[] = [];
  const releases: string[] = [];
  const handler = vi.fn(applyCounter);
  const registry = createCanonicalCommandRegistry(
    extended ? [createConformanceCounterCommand(handler)] : [],
  );
  let receipt = 500;
  let event = 500;
  let handoff = 500;
  let recovery = 500;
  const dependencies = {
    registry: {
      prepare: vi.fn((command: Parameters<typeof registry.prepare>[0]) =>
        registry.prepare(command),
      ),
    },
    createReceiptId: vi.fn(() => `66666666-6666-4666-8666-666666666${++receipt}`),
    createEventId: vi.fn(() => `77777777-7777-4777-8777-777777777${++event}`),
    now: vi.fn(() => settlementT1),
  };
  const repositories = createCanonicalCommandRepositoryFactory({
    ...dependencies,
    openClient: (selected) => {
      const client = observedSettlementClient(
        createWorkerLocalLibsqlClient(selected, "generation"),
        observation,
        calls,
      );
      return {
        ...client,
        close: async () => {
          await client.close();
          releases.push("repository");
        },
      };
    },
    sha256Text: async (text) => createHash("sha256").update(text).digest("hex"),
    createHandoffId: () => `88888888-8888-4888-8888-888888888${++handoff}`,
    createRecoveryRecordId: () => `99999999-9999-4999-8999-999999999${++recovery}`,
  });
  const activationStorage: ProjectStorageActivationPort = extended
    ? {
        acquireActivation: async (request) => {
          const result = ProjectStorageOpenResultSchema.parse({
            status: "opened",
            request,
            mode: "read-write",
            identity: {
              storageId: fixedCreationIds.storageId,
              generationId: fixedCreationIds.generationId,
              canonicalDatabaseLineageId: fixedCreationIds.canonicalDatabaseLineageId,
              runtimeDatabaseLineageId: fixedCreationIds.runtimeDatabaseLineageId,
            },
            canonicalHealth: { status: "healthy" },
            runtimeHealth: { status: "healthy" },
          });
          if (result.status !== "opened") throw new Error("Expected prepared Storage identity.");
          return {
            status: "ready",
            session: {
              mode: "read-write",
              result,
              canonicalDatabasePath: file,
              writerLeasePath: `${root}/writer.lock`,
              close: async () => {
                releases.push("storage");
              },
            },
          };
        },
      }
    : storage;
  let activation = 0;
  const clock = vi.fn(() => "2026-09-05T12:00:05.000Z");
  clock.mockReturnValueOnce(settlementT0).mockReturnValueOnce("2026-09-05T12:00:04.000Z");
  const coordinator = createActiveProjectCoordinator({
    storage: activationStorage,
    repositories,
    leases: {
      acquire: async () => ({
        status: "acquired",
        lease: {
          release: async () => {
            releases.push("lease");
          },
        },
      }),
    },
    createActivationId: () =>
      ++activation === 1 ? settlementRequest.activationId : settlementNewEpoch,
    createWriterToken: () => WriterCapabilityTokenSchema.parse(String(activation).repeat(64)),
    now: clock,
  });
  const controls: CompositionControls = {};
  const application = createCanonicalProjectApplication({
    ...coordinator,
    execute: async (request) => {
      const result = await coordinator.execute(request);
      return controls.alterResult?.(result) ?? result;
    },
  });
  const ordinary = createProjectStorageApplication(storage);
  const channel = settlementChannel(
    application,
    {
      ...ordinary,
      open: async (request) => {
        await controls.openBarrier;
        return ordinary.open(request);
      },
    },
    settlementRequest,
    settlementSwitch,
  );
  return {
    file,
    root,
    storage,
    coordinator,
    application,
    observation,
    calls,
    releases,
    dependencies,
    handler,
    clock,
    controls,
    ...channel,
    snapshot: () => (extended ? settlementRows(file) : productionSettlementRows(file)),
    close: async () => {
      await channel.close();
    },
  };
}

function settlementChannel(
  application: ReturnType<typeof createCanonicalProjectApplication>,
  storage: ReturnType<typeof createProjectStorageApplication>,
  settlementRequest: CanonicalProjectCommandRequest,
  settlementSwitch: CanonicalProjectSwitchRequest,
) {
  const { port1, port2 } = new MessageChannel();
  const messages: unknown[] = [];
  const waiting = new Map<string, (message: unknown) => void>();
  const deliveries = new Map<string, ReturnType<typeof switchDeferred<void>>>();
  port2.on("message", (message: unknown) => {
    messages.push(message);
    const parsed = parseHarnessMessage(message);
    if (!parsed.ok) throw new Error("Invalid harness envelope.");
    if (parsed.value.messageType !== "event") throw new Error("Expected harness event.");
    if (!("causationId" in parsed.value)) return;
    const id = parsed.value.causationId;
    if (typeof id !== "string") return;
    waiting.get(id)?.(message);
    waiting.delete(id);
  });
  let generated = 500;
  const stop = startHarnessRuntime({
    transport: {
      ...transportFor(port1),
      subscribe: (listener) =>
        transportFor(port1).subscribe((message) => {
          listener(message);
          if (typeof message === "object" && message !== null)
            deliveries.get(Reflect.get(message, "messageId"))?.resolve();
        }),
    },
    canonicalProjectApplication: application,
    projectStorageApplication: storage,
    workspaceApplication: createUnavailableWorkspaceApplication(),
    harnessVersion: "0.0.0",
    createId: () => `99999999-9999-4999-8999-999999999${++generated}`,
    now: () => "2026-09-05T12:00:06.000Z",
  });
  const metadata = (id: number) => ({
    messageId: `11111111-1111-4111-8111-111111111${500 + id}`,
    sentAt: "2026-09-05T12:00:06.000Z",
  });
  const send = (id: number, message: unknown) => {
    deliveries.set(metadata(id).messageId, switchDeferred<void>());
    const response = new Promise<unknown>((resolve) =>
      waiting.set(metadata(id).messageId, resolve),
    );
    port2.postMessage(message);
    return response;
  };
  return {
    messages,
    send,
    metadata,
    delivered: (id: number) => {
      const delivery = deliveries.get(metadata(id).messageId);
      if (delivery === undefined) throw new Error("Request was not sent.");
      return delivery.promise;
    },
    activate: () =>
      send(
        1,
        createProjectActivateCommand(metadata(1), { projectId: settlementRequest.projectId }),
      ),
    execute: (id = 2, request = settlementRequest) =>
      send(id, createProjectCommand(metadata(id), request)),
    switchProject: () => send(3, createProjectSwitchCommand(metadata(3), settlementSwitch)),
    close: async () => {
      await stop();
      port1.close();
      port2.close();
    },
  };
}

const counterPayloadSchema = z.strictObject({
  value: z.number().int().min(0).max(10),
  meta: z.strictObject({ a: z.number(), b: z.number() }).optional(),
  tags: z.array(z.string()).optional(),
});

export const conflictCases = [
  {
    payload: { value: 8, meta: { b: 2, a: 1 }, tags: ["x", "y"] },
    type: "conformance.counter.set",
    version: 1,
    literal:
      '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"meta":{"a":1,"b":2},"tags":["x","y"],"value":8},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}',
  },
  {
    payload: { value: 7, meta: { b: 2, a: 1 }, tags: ["y", "x"] },
    type: "conformance.counter.set",
    version: 1,
    literal:
      '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"meta":{"a":1,"b":2},"tags":["y","x"],"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}',
  },
  {
    payload: { value: 7, meta: { b: 2, a: 1 }, tags: ["x", "y"] },
    type: "conformance.counter.other",
    version: 1,
    literal:
      '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"meta":{"a":1,"b":2},"tags":["x","y"],"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.other","version":1}',
  },
  {
    payload: { value: 7, meta: { b: 2, a: 1 }, tags: ["x", "y"] },
    type: "conformance.counter.set",
    version: 2,
    literal:
      '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"meta":{"a":1,"b":2},"tags":["x","y"],"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":2}',
  },
] as const;
export const admissionCases = [
  {
    type: "conformance.counter.missing",
    version: 1,
    payload: { value: 7 },
    code: "COMMAND_TYPE_UNSUPPORTED",
    literal:
      '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.missing","version":1}',
  },
  {
    type: "conformance.counter.set",
    version: 2,
    payload: { value: 7 },
    code: "COMMAND_TYPE_UNSUPPORTED",
    literal:
      '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":2}',
  },
  {
    type: "conformance.counter.set",
    version: 1,
    payload: { value: "7" },
    code: "COMMAND_PAYLOAD_INVALID",
    literal:
      '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"value":"7"},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}',
  },
] as const;
export type CounterContext = Readonly<{
  projectId: ProjectId;
  payload: z.infer<typeof counterPayloadSchema>;
  transaction: CanonicalCommandTransaction;
}>;

type CorrectionMetadata = Readonly<{
  projectId: string;
  receiptId: string;
  commandId: string;
  settledAt: string;
  events: readonly [Readonly<{ eventId: string }>, Readonly<{ eventId: string }>];
}>;

export function expectCorrectedRows(
  afterConflict: Record<string, LocalLibsqlResultSet["rows"]>,
  after: Record<string, LocalLibsqlResultSet["rows"]>,
  applied: CorrectionMetadata,
) {
  const aggregate = "55555555-5555-4555-8555-555555555501";
  const h = (value: string) => createHash("sha256").update(value).digest("hex");
  const fingerprint = h(
    '{"commandId":"44444444-4444-4444-8444-444444444502","fingerprintVersion":1,"payload":{"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}',
  );
  expect(after).toEqual({
    ...afterConflict,
    conformance_counter: [[applied.projectId, aggregate, 7, 2]],
    project_state: [[applied.projectId, 3, 1, "2026-09-05T12:00:00.000Z", applied.settledAt]],
    command_receipts: [
      ...(afterConflict["command_receipts"] ?? []),
      [
        applied.projectId,
        applied.receiptId,
        applied.commandId,
        "conformance.counter.set",
        1,
        fingerprint,
        "applied",
        3,
        1,
        applied.settledAt,
      ],
    ],
    command_idempotency: [
      ...(afterConflict["command_idempotency"] ?? []),
      [applied.projectId, applied.commandId, fingerprint, applied.receiptId, applied.settledAt],
    ],
    canonical_events: [
      [
        applied.projectId,
        applied.events[0].eventId,
        applied.receiptId,
        "applied",
        3,
        0,
        "conformance.counter",
        aggregate,
        2,
        "conformance.counter.changed",
        1,
        '{"previous":0,"value":7}',
        h('{"previous":0,"value":7}'),
        applied.settledAt,
      ],
      [
        applied.projectId,
        applied.events[1].eventId,
        applied.receiptId,
        "applied",
        3,
        1,
        "conformance.counter",
        aggregate,
        2,
        "conformance.counter.checked",
        1,
        '{"value":7}',
        h('{"value":7}'),
        applied.settledAt,
      ],
    ],
  });
}

export async function applyCounter(context: CounterContext): Promise<CanonicalCommandDecision> {
  const { transaction, projectId, payload } = context;
  const result = await transaction.execute({
    sql: "SELECT value,entity_version FROM conformance_counter WHERE project_id=? AND counter_id=?",
    args: [projectId, "55555555-5555-4555-8555-555555555501"],
  });
  const [previous, version] = z
    .tuple([z.tuple([z.number().int(), z.number().int().positive()])])
    .parse(result.rows)[0];
  if (previous === payload.value) return { outcome: "unchanged" };
  const updated = await transaction.execute({
    sql: "UPDATE conformance_counter SET value=?, entity_version=? WHERE project_id=? AND counter_id=? AND entity_version=?",
    args: [payload.value, version + 1, projectId, "55555555-5555-4555-8555-555555555501", version],
  });
  if (updated.rowsAffected !== 1) throw new Error("Conformance counter update was not singular.");
  const source = {
    aggregateType: "conformance.counter",
    aggregateId: CanonicalEventInputSchema.shape.aggregateId.parse(
      "55555555-5555-4555-8555-555555555501",
    ),
    aggregateVersion: version + 1,
    eventVersion: 1,
  };
  return {
    outcome: "applied",
    events: [
      {
        ...source,
        eventType: "conformance.counter.changed",
        payload: { previous, value: payload.value },
      },
      { ...source, eventType: "conformance.counter.checked", payload: { value: payload.value } },
    ],
  };
}

export function createConformanceCounterCommand(
  handle: (
    context: CounterContext,
  ) => CanonicalCommandDecision | Promise<CanonicalCommandDecision> = applyCounter,
  transform?: (payload: CounterContext["payload"]) => CounterContext["payload"],
) {
  const payloadSchema =
    transform === undefined ? counterPayloadSchema : counterPayloadSchema.transform(transform);
  return defineCanonicalCommand({
    type: "conformance.counter.set",
    version: 1,
    payloadSchema,
    handle,
  });
}

export function malformedDecision(value: unknown): CanonicalCommandDecision {
  const box: { decision: CanonicalCommandDecision } = {
    decision: { outcome: "applied", events: [] },
  };
  Reflect.set(box, "decision", value);
  return box.decision;
}

export function writeUnchanged(context: CounterContext): Promise<CanonicalCommandDecision> {
  return writeCounter99(context).then(() => ({ outcome: "unchanged" }));
}

export function writeCounter99(context: CounterContext) {
  return context.transaction.execute({
    sql: "UPDATE conformance_counter SET value=99, entity_version=3 WHERE project_id=? AND counter_id=?",
    args: [context.projectId, "55555555-5555-4555-8555-555555555501"],
  });
}

export async function rejectCounterNine(
  context: CounterContext,
): Promise<CanonicalCommandDecision> {
  if (context.payload.value !== 9) return applyCounter(context);
  await writeCounter99(context);
  return {
    outcome: "rejected",
    rejection: { code: "TEST_COUNTER_REJECTED", retryable: false },
  };
}

export function expectInterleavedRows(rows: Record<string, LocalLibsqlResultSet["rows"]>) {
  expect(rows["command_receipts"]?.map((row) => [row[6], row[7]])).toEqual([
    ["applied", 1],
    ["unchanged", 2],
    ["rejected", 3],
    ["rejected", 4],
  ]);
  expect(rows["project_state"]?.map((row) => row[1])).toEqual([4]);
  expect(rows["conformance_counter"]).toEqual([
    ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", "55555555-5555-4555-8555-555555555501", 7, 2],
  ]);
  expect(rows["command_idempotency"]).toHaveLength(3);
  expect(rows["command_rejections"]).toHaveLength(2);
  expect(rows["canonical_events"]?.map((row) => row[4])).toEqual([1, 1]);
  expect(rows["foreign_keys"]).toEqual([]);
}

export function issuedSqlFailureHandler(outcome: "applied" | "unchanged", fault: string) {
  return async (context: CounterContext): Promise<CanonicalCommandDecision> => {
    const applied = await applyCounter(context);
    const statement = { sql: "SELECT 42", args: [] };
    if (fault === "clone") Reflect.set(statement, "args", [() => "uncloneable"]);
    try {
      const issued = context.transaction.execute(statement);
      if (fault !== "unawaited") await issued;
    } catch {
      // The repository must retain failure even when the handler ignores it.
    }
    return outcome === "unchanged" ? { outcome } : applied;
  };
}

export const malformedHandlerDecisions: ReadonlyArray<
  readonly [string, (decision: CanonicalCommandDecision) => unknown]
> = [
  ["undefined", () => undefined],
  ["unknown outcome", () => ({ outcome: "unknown" })],
  ["missing events", () => ({ outcome: "applied" })],
  ["extra decision property", (decision) => ({ ...decision, private: "secret" })],
  ["unchanged with events", () => ({ outcome: "unchanged", events: [] })],
  [
    "rejected with events",
    () => ({
      outcome: "rejected",
      events: [],
      rejection: { code: "TEST_REJECTED", retryable: false },
    }),
  ],
  ...[
    "",
    "lowercase",
    "A".repeat(65),
    "COMMAND_TYPE_UNSUPPORTED",
    "COMMAND_PAYLOAD_INVALID",
    "IDEMPOTENCY_CONFLICT",
  ].map(
    (code) =>
      [
        `rejection code ${code}`,
        () => ({ outcome: "rejected", rejection: { code, retryable: false } }),
      ] as const,
  ),
  ...["message", "details"].map(
    (key) =>
      [
        `private rejection ${key}`,
        () => ({
          outcome: "rejected",
          rejection: { code: "TEST_REJECTED", retryable: false, [key]: "private" },
        }),
      ] as const,
  ),
  ...Object.entries({
    "nil aggregate": { aggregateId: "00000000-0000-0000-0000-000000000000" },
    "max aggregate": { aggregateId: "ffffffff-ffff-ffff-ffff-ffffffffffff" },
    "uppercase aggregate": { aggregateId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAA1" },
    "malformed aggregate": { aggregateId: "invalid" },
    "zero aggregate version": { aggregateVersion: 0 },
    "fractional aggregate version": { aggregateVersion: 1.5 },
    "unsafe aggregate version": { aggregateVersion: 9007199254740992 },
    "zero event version": { eventVersion: 0 },
    "fractional event version": { eventVersion: 1.5 },
    "unsafe event version": { eventVersion: 9007199254740992 },
    "blank aggregate type": { aggregateType: " " },
    "blank event type": { eventType: " " },
    "nonfinite payload": { payload: { value: Number.NaN } },
    "nonJSON payload": { payload: { value: undefined } },
    "extra event property": { private: "secret" },
  }).map(
    ([name, changes]) =>
      [
        name,
        (decision: CanonicalCommandDecision) => {
          if (decision.outcome !== "applied")
            throw new Error("Malformed fixture requires applied decision.");
          return { ...decision, events: [{ ...decision.events[0], ...changes }] };
        },
      ] as const,
  ),
];
