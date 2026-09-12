import { createHash } from "node:crypto";
import { ProjectActivationIdSchema } from "@slopstop/protocol";
import { expect, vi } from "vitest";
import { createActiveProjectCoordinator } from "../../src/active-project-coordinator.js";
import { createCanonicalCommandRegistry } from "../../src/canonical-command-registry.js";
import { createCanonicalProjectWriter } from "../../src/canonical-project-writer.js";
import type { ProjectStorageActivationPort } from "../../src/project-storage-application.js";
import {
  createCanonicalCommandRepositoryFactory,
  WriterCapabilityTokenSchema,
} from "../../src/storage/canonical-command-repository.js";
import { createNodeCanonicalWriterLeaseFactory } from "../../src/storage/canonical-writer-lease.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlTransaction,
} from "../../src/storage/local-libsql-worker-client.js";
import {
  alterFence,
  appliedReceipt,
  canonicalCommandProjectId,
  createCanonicalCommandDatabase,
  createSettlementFixture,
  forbidReplayWork,
  observedSettlementClient,
  registerCounter,
  type SettlementObservation,
  settlementBarrier,
  settlementRequest,
  settlementRows,
  settlementT0,
  settlementT1,
  settlementText,
  statementText,
} from "./canonical-command-fixture.js";
import { openedCanonicalStorageResult } from "./canonical-storage-selection-fixture.js";
import { createConformanceCounterCommand } from "./conformance-counter-command.js";

export type RecoveryFixture = Awaited<ReturnType<typeof createRecoveryFixture>>;

export type RecoveryChanges = Record<string, string | number | null>;

export const recoveryActivationTime = "2026-09-05T12:00:05.000Z";

export async function activateRecovery(
  f: RecoveryFixture,
  generation = 2,
  afterMutation?: (sql: string, tx: LocalLibsqlTransaction) => Promise<void>,
) {
  const observed = observedSettlementClient(f.raw, f.observation, f.calls);
  const factory = createCanonicalCommandRepositoryFactory({
    ...f.dependencies,
    openClient: () => ({
      ...observed,
      transaction: async (mode) => {
        const tx = await observed.transaction(mode);
        return {
          get closed() {
            return tx.closed;
          },
          commit: () => tx.commit(),
          rollback: () => tx.rollback(),
          close: () => tx.close(),
          execute: async (statement, args) => {
            const result = await tx.execute(statement, args);
            await afterMutation?.(statementText(statement), tx);
            return result;
          },
        };
      },
    }),
    createHandoffId: () => `88888888-8888-4888-9888-88888888860${generation}`,
  });
  return factory.activate({
    canonicalDatabasePath: f.file,
    projectId: settlementRequest.projectId,
    activationId: ProjectActivationIdSchema.parse(
      `eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${generation}`,
    ),
    writerToken: WriterCapabilityTokenSchema.parse(String(generation).repeat(64)),
    activatedAt: generation === 2 ? recoveryActivationTime : "2026-09-05T12:00:07.000Z",
  });
}

export async function prepareRecoveryActivation(landed: boolean, active = false) {
  const f = await createRecoveryFixture();
  const fault = rejectRecoveryCommit(f, landed);
  await expect(f.repository.settle(settlementText)).rejects.toBe(fault);
  await f.repository.releaseFence(recoveryReleaseTime);
  if (active) {
    await f.raw.execute("UPDATE writer_generations SET released_at=NULL");
    await f.raw.execute("UPDATE writer_fence SET state='active',released_at=NULL");
  }
  expect((await f.snapshot())["writer_recovery_records"]).toEqual([
    expectedUnresolvedRecoveryRow(),
  ]);
  forbidReplayWork(f);
  f.dependencies.createRecoveryRecordId.mockClear().mockImplementation(() => {
    throw new Error("Activation must reuse M1.");
  });
  f.calls.length = 0;
  return f;
}

export function expectRecoveryActivationRows(
  before: Awaited<ReturnType<RecoveryFixture["snapshot"]>>,
  after: Awaited<ReturnType<RecoveryFixture["snapshot"]>>,
  landed: boolean,
  active: boolean,
) {
  const a = canonicalCommandProjectId;
  const h = (s: string) => createHash("sha256").update(s).digest("hex");
  const marker = expectedUnresolvedRecoveryRow();
  marker.splice(7, 3, landed ? "receipt-found" : "receipt-absent", 2, recoveryActivationTime);
  expect(after).toEqual({
    ...before,
    project_state: [[a, landed ? 1 : 0, 2, settlementT0, recoveryActivationTime]],
    writer_generations: [
      [
        a,
        1,
        settlementRequest.activationId,
        h("1".repeat(64)),
        settlementT0,
        active ? recoveryActivationTime : recoveryReleaseTime,
      ],
      [
        a,
        2,
        "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
        h("2".repeat(64)),
        recoveryActivationTime,
        null,
      ],
    ],
    writer_fence: [[a, 2, h("2".repeat(64)), "active", recoveryActivationTime, null]],
    writer_handoffs: [
      [a, recoveryHandoffId, null, 1, "initial", settlementT0],
      [a, "88888888-8888-4888-9888-888888888602", 1, 2, "recovery", recoveryActivationTime],
    ],
    writer_recovery_records: [marker],
  });
}

export async function expectBrokenRecoveryActivation(f: RecoveryFixture) {
  const before = await f.snapshot();
  const start = f.calls.length;
  const result = await activateRecovery(f);
  expect(result).toEqual({
    status: "broken",
    error: expect.objectContaining({
      code: "WRITER_FENCE_ACTIVATION_FAILED",
      message: "Canonical Writer fence activation failed.",
    }),
  });
  expect(await f.snapshot()).toEqual(before);
  expect(f.calls.slice(start).filter((sql) => /^(UPDATE|INSERT|DELETE)/u.test(sql))).toEqual([]);
  expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
  expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
  expect(f.dependencies.createEventId).not.toHaveBeenCalled();
  expect(f.dependencies.now).not.toHaveBeenCalled();
}

export const recoveryRecordId = "88888888-8888-4888-8888-888888888601";

export const recoveryHandoffId = "88888888-8888-4888-9888-888888888601";

export const recoveryTime = "2026-09-05T12:00:04.250Z";

export const recoveryReleaseTime = "2026-09-05T12:00:04.000Z";

export async function createRecoveryFixture() {
  const f = await createSettlementFixture(recoveryHandoffId);
  expect((await f.snapshot())["writer_handoffs"]).toEqual([
    [canonicalCommandProjectId, recoveryHandoffId, null, 1, "initial", settlementT0],
  ]);
  registerCounter(f);
  f.dependencies.createRecoveryRecordId.mockReturnValue(recoveryRecordId);
  f.dependencies.now.mockReturnValueOnce(settlementT1).mockReturnValue(recoveryTime);
  f.dependencies.sha256Text.mockClear();
  return f;
}

export function rejectRecoveryCommit(
  f: { observation: SettlementObservation },
  landed: boolean,
  error = new Error("Private recovery COMMIT acknowledgement failure."),
) {
  f.observation.commit = async (tx) => {
    delete f.observation.commit;
    if (landed) await tx.commit();
    throw error;
  };
  return error;
}

export function failRecoverySettlement(
  f: Awaited<ReturnType<typeof createRecoveryFixture>>,
  phase: "begin" | "body" | "before" | "after" | "acknowledged-close",
  error: Error,
) {
  const setup = {
    begin: () => {
      f.observation.begin = () => {
        delete f.observation.begin;
        throw error;
      };
    },
    body: () => {
      f.observation.after = (sql, result) => {
        if (sql.startsWith("UPDATE conformance_counter")) {
          delete f.observation.after;
          throw error;
        }
        return result;
      };
    },
    before: () => rejectRecoveryCommit(f, false, error),
    after: () => rejectRecoveryCommit(f, true, error),
    "acknowledged-close": () => {
      f.observation.close = async () => {
        delete f.observation.close;
        throw error;
      };
    },
  };
  setup[phase]();
}

function failRecoveryMarkerPrimary(
  f: Awaited<ReturnType<typeof createRecoveryFixture>>,
  kind: string,
  error: Error,
) {
  if (kind.startsWith("body"))
    f.observation.after = (sql, result) => {
      if (sql.startsWith("INSERT INTO writer_recovery_records")) throw error;
      return result;
    };
  else
    f.observation.commit = async (tx) => {
      if (kind.startsWith("after-commit")) await tx.commit();
      throw error;
    };
}

export function failRecoveryMarker(
  f: Awaited<ReturnType<typeof createRecoveryFixture>>,
  kind: string,
  errors: { primary: Error; rollback: Error; close: Error },
) {
  failRecoveryMarkerPrimary(f, kind, errors.primary);
  if (kind === "body-rollback-close")
    f.observation.rollback = async (tx) => {
      await tx.rollback();
      throw errors.rollback;
    };
  if (kind.endsWith("close"))
    f.observation.close = async () => {
      throw errors.close;
    };
}

export function holdRecoveryOldClose(
  f: Awaited<ReturnType<typeof createRecoveryFixture>>,
  mode: string,
) {
  const entered = settlementBarrier();
  const resume = settlementBarrier();
  let attempts = 0;
  f.observation.close = async (tx) => {
    attempts++;
    if (attempts === 1) throw new Error("Old close rejected.");
    if (attempts === 2) {
      if (mode === "rejected") throw new Error("Old close rejected.");
      if (mode === "false-success") return;
    }
    entered.release();
    await resume.promise;
    await tx.close();
    delete f.observation.close;
    delete f.observation.closed;
  };
  f.observation.closed = () => false;
  return { entered, resume };
}

export async function expectBrokenRecordingAuthority(
  target: "fence" | "recovery",
  changes: Record<string, string | number | null>,
) {
  const f = await createRecoveryFixture();
  try {
    const fault = rejectRecoveryCommit(f, false);
    await expect(f.repository.settle(settlementText)).rejects.toBe(fault);
    if (target === "recovery") await seedRecoveryRecord(f);
    const before = await f.snapshot();
    const fragment = target === "fence" ? "FROM writer_fence" : "FROM writer_recovery_records";
    f.observation.after = (sql, result) =>
      sql.includes(fragment) ? alterFence(result, changes) : result;
    await expect(f.repository.releaseFence(recoveryReleaseTime)).rejects.toMatchObject({
      code: "WRITER_FENCE_RELEASE_FAILED",
    });
    expect(await f.snapshot()).toEqual(before);
  } finally {
    delete f.observation.after;
    await f.close();
  }
}

export function expectedUnresolvedRecoveryRow() {
  const literal =
    '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"meta":{"a":1,"b":2},"tags":["x","y"],"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}';
  return [
    canonicalCommandProjectId,
    recoveryRecordId,
    1,
    "commit-uncertain",
    settlementRequest.command.commandId,
    createHash("sha256").update(literal).digest("hex"),
    recoveryTime,
    null,
    null,
    null,
  ];
}

export async function seedRecoveryRecord(f: Awaited<ReturnType<typeof createRecoveryFixture>>) {
  await f.raw.execute({
    sql: "INSERT INTO writer_recovery_records (project_id,recovery_record_id,writer_generation,reason,command_id,command_fingerprint,observed_at,resolution,resolved_by_writer_generation,resolved_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    args: expectedUnresolvedRecoveryRow(),
  });
}

export async function advanceRecoveryFixture(f: Awaited<ReturnType<typeof createRecoveryFixture>>) {
  await f.repository.releaseFence(recoveryReleaseTime);
  const factory = createCanonicalCommandRepositoryFactory({
    ...f.dependencies,
    openClient: () => observedSettlementClient(f.raw, f.observation, f.calls),
    createHandoffId: () => "88888888-8888-4888-9888-888888888602",
  });
  const activated = await factory.activate({
    canonicalDatabasePath: f.file,
    projectId: settlementRequest.projectId,
    activationId: ProjectActivationIdSchema.parse("eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"),
    writerToken: WriterCapabilityTokenSchema.parse("2".repeat(64)),
    activatedAt: "2026-09-05T12:00:05.000Z",
  });
  if (activated.status !== "activated") throw activated.error;
  f.repository = activated.repository;
}

export async function createRecoveryWriter(f: Awaited<ReturnType<typeof createRecoveryFixture>>) {
  const leases = createNodeCanonicalWriterLeaseFactory();
  const leasePath = `${f.file}.writer.lock`;
  const acquired = await leases.acquire(leasePath);
  if (acquired.status !== "acquired") throw new Error("Recovery fixture lease was not acquired.");
  const release = vi.fn(() => acquired.lease.release());
  const writer = createCanonicalProjectWriter({
    projectId: settlementRequest.projectId,
    activationId: settlementRequest.activationId,
    writerGeneration: f.repository.writerGeneration,
    repository: f.repository,
    lease: { release },
  });
  return { writer, release, leases, leasePath };
}

export function recoveryStoragePort(
  file: string,
  close: () => Promise<void>,
): ProjectStorageActivationPort {
  return {
    acquireActivation: async (request) => {
      const result = openedCanonicalStorageResult(request);
      if (result.status !== "opened") throw new Error("Recovery fixture Storage selection failed.");
      return {
        status: "ready",
        session: {
          mode: "read-write",
          result,
          canonicalDatabasePath: file,
          writerLeasePath: `${file}.writer.lock`,
          close,
        },
      };
    },
  };
}

export async function createRecoveryComposition() {
  const file = await createCanonicalCommandDatabase();
  const observation: SettlementObservation = {};
  const calls: string[] = [];
  const releases: string[] = [];
  const storageClose = vi.fn(async () => {
    releases.push("storage");
  });
  const registry = createCanonicalCommandRegistry([createConformanceCounterCommand()]);
  const dependencies = {
    registry,
    createReceiptId: vi.fn(() => appliedReceipt.receiptId),
    createEventId: vi
      .fn<() => string>(() => appliedReceipt.events[0].eventId)
      .mockReturnValueOnce(appliedReceipt.events[0].eventId)
      .mockReturnValueOnce(appliedReceipt.events[1].eventId),
    createRecoveryRecordId: vi.fn(() => recoveryRecordId),
    now: vi.fn(() => recoveryTime).mockReturnValueOnce(settlementT1),
    sha256Text: async (text: string) => createHash("sha256").update(text).digest("hex"),
  };
  const repositories = createCanonicalCommandRepositoryFactory({
    ...dependencies,
    openClient: (selected) =>
      observedSettlementClient(
        createWorkerLocalLibsqlClient(selected, "generation"),
        observation,
        calls,
      ),
    createHandoffId: () => recoveryHandoffId,
  });
  observation.clientClose = () => {
    releases.push("repository");
  };
  const native = createNodeCanonicalWriterLeaseFactory();
  const coordinator = createActiveProjectCoordinator({
    repositories,
    storage: recoveryStoragePort(file, storageClose),
    leases: {
      acquire: async (leasePath) => {
        const acquired = await native.acquire(leasePath);
        if (acquired.status !== "acquired") return acquired;
        return {
          status: "acquired",
          lease: {
            release: async () => {
              await acquired.lease.release();
              releases.push("lease");
            },
          },
        };
      },
    },
    createActivationId: () => settlementRequest.activationId,
    createWriterToken: () => WriterCapabilityTokenSchema.parse("1".repeat(64)),
    now: vi.fn(() => recoveryReleaseTime).mockReturnValueOnce(settlementT0),
  });
  expect(await coordinator.activate({ projectId: settlementRequest.projectId })).toEqual({
    status: "active",
    request: { projectId: settlementRequest.projectId },
    access: "read-write",
    activationId: settlementRequest.activationId,
    writerGeneration: 1,
  });
  calls.length = 0;
  return {
    file,
    coordinator,
    observation,
    calls,
    releases,
    dependencies,
    storageClose,
    snapshot: () => settlementRows(file),
  };
}
