import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import {
  alterFence,
  expectAppliedRows,
  settlementBarrier,
  settlementRequest,
  settlementText,
  unchangedText,
} from "./canonical-command-fixture.js";
import {
  advanceRecoveryFixture,
  createRecoveryComposition,
  createRecoveryFixture,
  createRecoveryWriter,
  expectBrokenRecordingAuthority,
  expectedUnresolvedRecoveryRow,
  failRecoveryMarker,
  failRecoverySettlement,
  holdRecoveryOldClose,
  recoveryRecordId,
  recoveryReleaseTime,
  recoveryTime,
  rejectRecoveryCommit,
  seedRecoveryRecord,
} from "./canonical-writer-recovery-fixture.js";

function recordingStages(calls: string[]) {
  return calls.flatMap((sql) => {
    if (sql.startsWith("INSERT INTO writer_recovery_records")) return ["marker"];
    if (sql.startsWith("UPDATE writer_fence")) return ["fence"];
    return ["commit", "rollback", "close"].includes(sql) ? [sql] : [];
  });
}

it.each(["switch", "stop"] as const)(
  "S6 B4 B6 explicit %s retains source after marker failure",
  async (operation) => {
    const f = await createRecoveryComposition();
    try {
      const fault = new Error("Settlement commit failed.");
      f.observation.commit = async () => {
        delete f.observation.commit;
        throw fault;
      };
      await expect(f.coordinator.execute(settlementRequest)).rejects.toBe(fault);
      f.observation.after = (sql, result) => {
        if (sql.startsWith("INSERT INTO writer_recovery_records"))
          throw new Error("Marker body failed.");
        return result;
      };
      const request = {
        from: {
          projectId: settlementRequest.projectId,
          activationId: settlementRequest.activationId,
        },
        to: { projectId: settlementRequest.projectId },
      };
      if (operation === "switch")
        expect(await f.coordinator.switchProject(request)).toEqual({
          status: "release-failed",
          request,
          diagnostic: {
            code: "WRITER_FENCE_RELEASE_FAILED",
            message: "Project activation resources could not be released.",
            retryable: true,
          },
        });
      else
        await expect(f.coordinator.stop()).rejects.toThrow(
          "Canonical Project activation release failed.",
        );
      expect(f.releases).toEqual([]);
      expect((await f.snapshot())["writer_recovery_records"]).toEqual([]);
      expect(f.dependencies.createRecoveryRecordId).toHaveBeenCalledTimes(1);
      delete f.observation.after;
      const start = f.calls.length;
      await f.coordinator.stop();
      expect(recordingStages(f.calls.slice(start))).toEqual([
        "marker",
        "commit",
        "close",
        "fence",
        "commit",
        "close",
      ]);
      expect(f.releases).toEqual(["repository", "lease", "storage"]);
      expect((await f.snapshot())["writer_recovery_records"]).toEqual([
        expectedUnresolvedRecoveryRow(),
      ]);
      expect(f.dependencies.createRecoveryRecordId).toHaveBeenCalledTimes(1);
      expect(f.dependencies.now).toHaveBeenCalledTimes(2);
    } finally {
      delete f.observation.after;
      await f.coordinator.stop();
    }
  },
);

it.each(
  [false, true].flatMap((landed) =>
    [
      { name: "original", text: settlementText },
      { name: "distinct", text: unchangedText },
      { name: "malformed", text: "{" },
    ].map((entry) => ({ landed, ...entry })),
  ),
)(
  "S6 B3 B15 retains uncertainty before direct preprocessing: landed $landed $name",
  async ({ landed, text }) => {
    const f = await createRecoveryFixture();
    const hashEntered = settlementBarrier();
    const hashRelease = settlementBarrier();
    try {
      const before = await f.snapshot();
      f.dependencies.sha256Text.mockImplementationOnce(async (text) => {
        hashEntered.release();
        await hashRelease.promise;
        return createHash("sha256").update(text).digest("hex");
      });
      const fault = rejectRecoveryCommit(f, landed);
      const pending = f.repository.settle(settlementText);
      const failed = expect(pending).rejects.toBe(fault);
      await hashEntered.promise;
      await expect(f.repository.settle(unchangedText)).rejects.toThrow(
        "Canonical Writer transaction is already owned.",
      );
      expect(f.dependencies.sha256Text).toHaveBeenCalledTimes(1);
      expect(f.calls).toEqual([]);
      hashRelease.release();
      await failed;
      const after = await f.snapshot();
      if (landed) expectAppliedRows(after);
      else expect(after).toEqual(before);
      expect(after["writer_recovery_records"]).toEqual([]);
      expect(f.dependencies.createRecoveryRecordId).not.toHaveBeenCalled();
      expect(f.dependencies.now).toHaveBeenCalledTimes(1);
      f.dependencies.createReceiptId.mockReturnValue("66666666-6666-4666-8666-666666666502");
      const calls = [...f.calls];
      await expect(f.repository.settle(text)).rejects.toThrow(
        "Canonical Writer requires uncertainty recovery.",
      );
      expect(f.calls).toEqual(calls);
      expect(f.dependencies.sha256Text).toHaveBeenCalledTimes(1);
      expect(await f.snapshot()).toEqual(after);
      expect(await f.repository.releaseFence(recoveryReleaseTime)).toEqual({ status: "current" });
      expect((await f.snapshot())["writer_recovery_records"]).toEqual([
        expectedUnresolvedRecoveryRow(),
      ]);
      expect(f.dependencies.createRecoveryRecordId).toHaveBeenCalledTimes(1);
      const recordedCalls = [...f.calls];
      await expect(f.repository.settle(text)).rejects.toThrow(
        "Canonical Writer requires uncertainty recovery.",
      );
      expect(f.calls).toEqual(recordedCalls);
    } finally {
      hashRelease.release();
      await f.close();
    }
  },
);

it.each(["2026-09-05T12:00:04Z", "2026-09-05T12:00:04.123456789Z"])(
  "S6 B5 preserves exact valid recording time %s",
  async (time) => {
    const f = await createRecoveryFixture();
    try {
      const fault = rejectRecoveryCommit(f, false);
      await expect(f.repository.settle(settlementText)).rejects.toBe(fault);
      f.dependencies.now.mockReturnValue(time);
      await f.repository.releaseFence(recoveryReleaseTime);
      const expected = expectedUnresolvedRecoveryRow();
      expected[6] = time;
      expect((await f.snapshot())["writer_recovery_records"]).toEqual([expected]);
    } finally {
      await f.close();
    }
  },
);

it.each(["token", "released"] as const)(
  "S6 B7 stale %s authority retains repository and native lease",
  async (kind) => {
    const f = await createRecoveryFixture();
    const w = await createRecoveryWriter(f);
    try {
      const fault = rejectRecoveryCommit(f, false);
      await expect(f.repository.settle(settlementText)).rejects.toBe(fault);
      if (kind === "token") {
        f.observation.after = (sql, result) =>
          sql.includes("FROM writer_fence")
            ? alterFence(result, { tokenDigest: "a".repeat(64), generationDigest: "a".repeat(64) })
            : result;
      } else {
        await f.raw.execute("UPDATE writer_fence SET state='released',released_at=?", [
          recoveryReleaseTime,
        ]);
        await f.raw.execute("UPDATE writer_generations SET released_at=?", [recoveryReleaseTime]);
      }
      const before = await f.snapshot();
      expect(await f.repository.releaseFence(recoveryReleaseTime)).toEqual({ status: "stale" });
      await expect(f.repository.close()).rejects.toMatchObject({
        code: "WRITER_REPOSITORY_CLOSE_FAILED",
      });
      await expect(w.writer.close(recoveryReleaseTime)).rejects.toMatchObject({
        code: "WRITER_FENCE_STALE",
      });
      expect(w.release).not.toHaveBeenCalled();
      expect(await w.leases.acquire(w.leasePath)).toEqual({ status: "contended" });
      expect(await f.snapshot()).toEqual(before);
      expect(
        f.calls.filter((sql) => sql.startsWith("INSERT INTO writer_recovery_records")),
      ).toEqual([]);
    } finally {
      delete f.observation.after;
      await f.raw.execute("UPDATE writer_fence SET state='active',released_at=NULL");
      await f.raw.execute("UPDATE writer_generations SET released_at=NULL");
      await w.writer.close(recoveryReleaseTime);
      await f.close();
    }
  },
);

it.each(["begin", "body", "before", "after", "acknowledged-close"] as const)(
  "S6 B3 joined Writer failure identity and marker exclusion: %s",
  async (phase) => {
    const f = await createRecoveryFixture();
    const w = await createRecoveryWriter(f);
    const error = new Error("Private joined failure.");
    try {
      failRecoverySettlement(f, phase, error);
      const first = w.writer.settle(settlementRequest.command);
      const duplicate = w.writer.settle({ ...settlementRequest.command });
      expect(duplicate).toEqual(first);
      if (first.status !== "pending" || duplicate.status !== "pending")
        throw new Error("Expected joined submissions.");
      expect(duplicate.result).toBe(first.result);
      await expect(first.result).rejects.toBe(error);
      expect(f.dependencies.createRecoveryRecordId).not.toHaveBeenCalled();
      const calls = [...f.calls];
      expect(w.writer.settle(settlementRequest.command)).toEqual({
        status: "completed",
        result: {
          status: "writer-unavailable",
          projectId: settlementRequest.projectId,
          activationId: settlementRequest.activationId,
          commandId: settlementRequest.command.commandId,
          diagnostic: {
            code: "WRITER_UNAVAILABLE",
            message: "The Writer requires explicit reactivation.",
            retryable: false,
          },
        },
      });
      expect(f.calls).toEqual(calls);
      await w.writer.close(recoveryReleaseTime);
      const uncertain = phase === "before" || phase === "after";
      expect((await f.snapshot())["writer_recovery_records"]).toEqual(
        uncertain ? [expectedUnresolvedRecoveryRow()] : [],
      );
      expect(f.dependencies.createRecoveryRecordId).toHaveBeenCalledTimes(uncertain ? 1 : 0);
    } finally {
      await w.writer.close(recoveryReleaseTime);
      await f.close();
    }
  },
);

it.each(["commit", "close"] as const)(
  "S6 B6 marker acknowledgement retains native lease: %s",
  async (stage) => {
    const f = await createRecoveryFixture();
    const w = await createRecoveryWriter(f);
    const entered = settlementBarrier();
    const resume = settlementBarrier();
    const fault = new Error("Marker acknowledgement lost.");
    try {
      const settlementFault = rejectRecoveryCommit(f, false);
      await expect(f.repository.settle(settlementText)).rejects.toBe(settlementFault);
      if (stage === "commit")
        f.observation.commit = async (tx) => {
          delete f.observation.commit;
          await tx.commit();
          entered.release();
          await resume.promise;
          throw fault;
        };
      else
        f.observation.close = async (tx) => {
          delete f.observation.close;
          entered.release();
          await resume.promise;
          await tx.close();
        };
      const pending = w.writer.close(recoveryReleaseTime).then(
        () => undefined,
        (error: unknown) => error,
      );
      await entered.promise;
      expect(w.release).not.toHaveBeenCalled();
      expect(await w.leases.acquire(w.leasePath)).toEqual({ status: "contended" });
      expect(f.calls.filter((sql) => sql.startsWith("UPDATE writer_fence"))).toEqual([]);
      resume.release();
      const result = await pending;
      if (stage === "commit") expect(result).toMatchObject({ code: "WRITER_FENCE_RELEASE_FAILED" });
      else expect(result).toBeUndefined();
      await w.writer.close(recoveryReleaseTime);
      expect((await f.snapshot())["writer_recovery_records"]).toEqual([
        expectedUnresolvedRecoveryRow(),
      ]);
      expect(f.dependencies.createRecoveryRecordId).toHaveBeenCalledTimes(1);
      expect(
        f.calls.filter((sql) => sql.startsWith("INSERT INTO writer_recovery_records")),
      ).toHaveLength(1);
    } finally {
      resume.release();
      await w.writer.close(recoveryReleaseTime);
      await f.close();
    }
  },
);

it.each(["repository", "lease"] as const)(
  "S6 B6 completed marker survives later %s release failure",
  async (stage) => {
    const f = await createRecoveryFixture();
    const w = await createRecoveryWriter(f);
    try {
      const fault = rejectRecoveryCommit(f, false);
      await expect(f.repository.settle(settlementText)).rejects.toBe(fault);
      if (stage === "repository")
        f.observation.clientClose = () => {
          delete f.observation.clientClose;
          throw new Error("Client close failed.");
        };
      else w.release.mockRejectedValueOnce(new Error("Lease release failed."));
      await expect(w.writer.close(recoveryReleaseTime)).rejects.toMatchObject({
        code:
          stage === "repository" ? "WRITER_REPOSITORY_CLOSE_FAILED" : "WRITER_LEASE_CLOSE_FAILED",
      });
      const calls = [...f.calls];
      expect(await w.leases.acquire(w.leasePath)).toEqual({ status: "contended" });
      await w.writer.close(recoveryReleaseTime);
      expect(f.calls).toEqual(calls);
      expect((await f.snapshot())["writer_recovery_records"]).toEqual([
        expectedUnresolvedRecoveryRow(),
      ]);
      expect(f.dependencies.createRecoveryRecordId).toHaveBeenCalledTimes(1);
    } finally {
      await w.writer.close(recoveryReleaseTime);
      await f.close();
    }
  },
);

it("S6 B4 B6 explicit coordinator stop preserves marker through Storage close retry", async () => {
  const f = await createRecoveryComposition();
  try {
    const fault = new Error("Settlement commit failed.");
    f.observation.commit = async () => {
      delete f.observation.commit;
      throw fault;
    };
    await expect(f.coordinator.execute(settlementRequest)).rejects.toBe(fault);
    expect((await f.snapshot())["writer_recovery_records"]).toEqual([]);
    f.storageClose.mockRejectedValueOnce(new Error("Storage close failed."));
    await expect(f.coordinator.stop()).rejects.toThrow(
      "Canonical Project activation release failed.",
    );
    expect((await f.snapshot())["writer_recovery_records"]).toEqual([
      expectedUnresolvedRecoveryRow(),
    ]);
    expect(f.releases).toEqual(["repository", "lease"]);
    const calls = [...f.calls];
    await f.coordinator.stop();
    expect(f.calls).toEqual(calls);
    expect(f.releases).toEqual(["repository", "lease", "storage"]);
    expect(f.dependencies.createRecoveryRecordId).toHaveBeenCalledTimes(1);
    expect(f.dependencies.now).toHaveBeenCalledTimes(2);
  } finally {
    await f.coordinator.stop();
  }
});

const invalidRecoverySources = [
  { sourceProjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
  { sourceGeneration: null },
  { sourceGeneration: 2 },
  { sourceActivationId: "invalid" },
  { sourceDigest: "a".repeat(64) },
  { sourceDigest: "invalid" },
  { sourceAcquiredAt: "2026-02-30T12:00:04Z" },
  { sourceAcquiredAt: "2026-09-05T12:00Z" },
  { sourceReleasedAt: recoveryReleaseTime },
];
it.each(invalidRecoverySources)("S6 B7 rejects broken recovery source join %j", async (changes) => {
  await expectBrokenRecordingAuthority("recovery", changes);
});

it.each(["older", "future"] as const)(
  "S6 B7 rejects %s unresolved authority instead of inserting",
  async (kind) => {
    const f = await createRecoveryFixture();
    try {
      if (kind === "older") await advanceRecoveryFixture(f);
      const fault = rejectRecoveryCommit(f, false);
      await expect(f.repository.settle(settlementText)).rejects.toBe(fault);
      await seedRecoveryRecord(f);
      if (kind === "future") {
        await f.raw.execute({
          sql: "INSERT INTO writer_generations (project_id,writer_generation,activation_id,token_digest,acquired_at,released_at) VALUES (?,2,?,?,?,NULL)",
          args: [
            settlementRequest.projectId,
            "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
            "a".repeat(64),
            "2026-09-05T12:00:05.000Z",
          ],
        });
        await f.raw.execute("UPDATE writer_recovery_records SET writer_generation=2");
      }
      const before = await f.snapshot();
      const calls = f.calls.length;
      await expect(f.repository.releaseFence(recoveryReleaseTime)).rejects.toMatchObject({
        code: "WRITER_FENCE_RELEASE_FAILED",
      });
      expect(
        f.calls.slice(calls).filter((sql) => sql.startsWith("INSERT INTO writer_recovery_records")),
      ).toEqual([]);
      expect(await f.snapshot()).toEqual(before);
    } finally {
      await f.raw.close();
    }
  },
);

it.each([
  "body",
  "before-commit",
  "after-commit",
  "after-commit-close",
  "body-rollback-close",
] as const)("S6 B6 retains prepared identity across marker failure: %s", async (kind) => {
  const f = await createRecoveryFixture();
  const primary = new Error("Marker primary.");
  const rollback = new Error("Marker rollback.");
  const close = new Error("Marker close.");
  try {
    const fault = rejectRecoveryCommit(f, false);
    await expect(f.repository.settle(settlementText)).rejects.toBe(fault);
    failRecoveryMarker(f, kind, { primary, rollback, close });
    const error = await f.repository
      .releaseFence(recoveryReleaseTime)
      .catch((error: unknown) => error);
    expectMarkerFailure(error, kind, { primary, rollback, close });
    // A lost COMMIT and failed close defer independent reads until the explicit retry below.
    if (kind !== "after-commit-close") {
      const failedRows = await f.snapshot();
      expect(failedRows["writer_recovery_records"]).toEqual(
        kind.startsWith("after-commit") ? [expectedUnresolvedRecoveryRow()] : [],
      );
    }
    const calls = [...f.calls];
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(f.calls).toEqual(calls);
    delete f.observation.after;
    delete f.observation.commit;
    delete f.observation.rollback;
    delete f.observation.close;
    f.dependencies.createRecoveryRecordId.mockReturnValue("88888888-8888-4888-8888-888888888602");
    f.dependencies.now.mockReturnValue("2026-09-05T12:00:04.750Z");
    expect(await f.repository.releaseFence(recoveryReleaseTime)).toEqual({ status: "current" });
    expect((await f.snapshot())["writer_recovery_records"]).toEqual([
      expectedUnresolvedRecoveryRow(),
    ]);
    expect(f.dependencies.createRecoveryRecordId).toHaveBeenCalledTimes(1);
    expect(f.dependencies.now).toHaveBeenCalledTimes(2);
    const inserts = f.calls.filter((sql) => sql.startsWith("INSERT INTO writer_recovery_records"));
    expect(inserts).toHaveLength(kind.startsWith("after-commit") ? 1 : 2);
    const done = [...f.calls];
    await f.repository.close();
    expect(f.calls).toEqual(done);
  } finally {
    await f.raw.close();
  }
});

function expectAggregate(value: unknown, errors: Error[], message: string) {
  expect(value).toBeInstanceOf(AggregateError);
  if (!(value instanceof AggregateError)) throw new Error("Expected ordered aggregate.");
  expect(value.message).toBe(message);
  expect(value.errors).toHaveLength(errors.length);
  for (const [index, error] of errors.entries()) expect(value.errors[index]).toBe(error);
}

function expectMarkerFailure(
  error: unknown,
  kind: string,
  errors: { primary: Error; rollback: Error; close: Error },
) {
  expect(error).toMatchObject({
    code: "WRITER_FENCE_RELEASE_FAILED",
    message: "Canonical Writer fence release failed.",
  });
  if (!(error instanceof Error)) throw new Error("Expected release error.");
  if (kind === "body-rollback-close") {
    const cause = error.cause;
    if (!(cause instanceof Error)) throw new Error("Expected rollback failure.");
    expect(cause.message).toBe("Project Storage transaction rollback failed.");
    expectAggregate(
      cause.cause,
      [errors.primary, errors.rollback, errors.close],
      "Project Storage transaction, rollback, and close all failed.",
    );
  } else if (kind === "after-commit-close") {
    expectAggregate(
      error.cause,
      [errors.primary, errors.close],
      "Project Storage transaction and close both failed.",
    );
  } else expect(error.cause).toBe(errors.primary);
}

const markerFieldConflicts = [
  { recoveryRecordId: "88888888-8888-4888-8888-888888888602" },
  { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
  { writerGeneration: 2 },
  { reason: "abandoned-active-fence" },
  { commandId: "44444444-4444-4444-8444-444444444502" },
  { fingerprint: "a".repeat(64) },
  { observedAt: "2026-09-05T12:00:04.750Z" },
  { resolution: "receipt-found" },
  { resolvedByWriterGeneration: 2 },
  { resolvedAt: "2026-09-05T12:00:05.000Z" },
  { recoveryRecordId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAA601" },
  { observedAt: "2026-02-30T12:00:04Z" },
];
it.each([
  ...markerFieldConflicts.map((changes) => ({ shape: "fields", changes })),
  ...["duplicate", "duplicate alias", "width", "extra alias"].map((shape) => ({
    shape,
    changes: {},
  })),
])(
  "S6 B6 B7 existing marker admission prerequisite $shape $changes",
  async ({ shape, changes }) => {
    const f = await createRecoveryFixture();
    try {
      const fault = rejectRecoveryCommit(f, false);
      await expect(f.repository.settle(settlementText)).rejects.toBe(fault);
      await seedRecoveryRecord(f);
      const before = await f.snapshot();
      const calls = f.calls.length;
      f.observation.after = (sql, result) => {
        if (!sql.includes("FROM writer_recovery_records")) return result;
        if (shape === "duplicate") return { ...result, rows: [...result.rows, ...result.rows] };
        if (shape === "width") return { ...result, rows: result.rows.map((row) => [...row, null]) };
        if (shape === "duplicate alias" || shape === "extra alias")
          return {
            ...result,
            columns: [
              ...result.columns,
              shape === "extra alias" ? "extra" : (result.columns[0] ?? "projectId"),
            ],
            rows: result.rows.map((row) => [...row, row[0] ?? null]),
          };
        return alterFence(result, changes);
      };
      await expect(f.repository.releaseFence(recoveryReleaseTime)).rejects.toMatchObject({
        code: "WRITER_FENCE_RELEASE_FAILED",
      });
      expect(
        f.calls.slice(calls).filter((sql) => sql.startsWith("INSERT INTO writer_recovery_records")),
      ).toEqual([]);
      expect(await f.snapshot()).toEqual(before);
    } finally {
      await f.raw.close();
    }
  },
);

const brokenRecordingFences = [
  { generationProjectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
  { generationActivationId: "invalid" },
  { generationNumber: null },
  { generationNumber: 2 },
  { generationDigest: "a".repeat(64) },
  { tokenDigest: "invalid" },
  { activatedAt: "not-a-time" },
  { generationAcquiredAt: "2026-09-05T12:00:01.000Z" },
  { releasedAt: recoveryReleaseTime },
  { generationReleasedAt: recoveryReleaseTime },
];
it.each(brokenRecordingFences)(
  "S6 B4 B7 strong recording authority prerequisite %j",
  async (changes) => {
    await expectBrokenRecordingAuthority("fence", changes);
  },
);

const invalidRecoveryMetadata = [
  { name: "ID throws", field: "id", value: "throw" },
  { name: "clock throws", field: "time", value: "throw" },
  ...[
    "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAA601",
    "bad-uuid",
    "00000000-0000-0000-0000-000000000000",
    "ffffffff-ffff-ffff-ffff-ffffffffffff",
  ].map((value) => ({ name: value, field: "id", value })),
  ...[
    "2026-09-05T12:00Z",
    "2026-09-05T12:00:04+00:00",
    "2026-09-05T12:00:04",
    "2026-02-30T12:00:04Z",
  ].map((value) => ({ name: value, field: "time", value })),
];
it.each(
  invalidRecoveryMetadata.flatMap((entry) =>
    ["release", "close"].map((method) => ({ ...entry, method })),
  ),
)("S6 B5 preparation prerequisite $method $name", async ({ field, value, method }) => {
  const f = await createRecoveryFixture();
  try {
    const fault = rejectRecoveryCommit(f, false);
    await expect(f.repository.settle(settlementText)).rejects.toBe(fault);
    const before = await f.snapshot();
    const produce = () => {
      if (value === "throw") throw new Error("Metadata failed.");
      return value;
    };
    if (field === "id") f.dependencies.createRecoveryRecordId.mockImplementation(produce);
    else f.dependencies.now.mockImplementation(produce);
    const attempt = () =>
      method === "release" ? f.repository.releaseFence(recoveryReleaseTime) : f.repository.close();
    const callCount = f.calls.length;
    await expect(attempt()).rejects.toMatchObject({
      code: method === "release" ? "WRITER_FENCE_RELEASE_FAILED" : "WRITER_REPOSITORY_CLOSE_FAILED",
      message:
        method === "release"
          ? "Canonical Writer fence release failed."
          : "Canonical Writer repository close failed.",
    });
    expect(f.calls.slice(callCount)).toEqual([]);
    expect(await f.snapshot()).toEqual(before);
    f.dependencies.createRecoveryRecordId.mockReturnValue(recoveryRecordId);
    f.dependencies.now.mockReturnValue(recoveryTime);
    await attempt();
    expect((await f.snapshot())["writer_recovery_records"]).toEqual([
      expectedUnresolvedRecoveryRow(),
    ]);
  } finally {
    f.dependencies.createRecoveryRecordId.mockReturnValue(recoveryRecordId);
    f.dependencies.now.mockReturnValue(recoveryTime);
    await f.close();
  }
});

it.each(
  [false, true].flatMap((landed) => ["release", "close"].map((method) => ({ landed, method }))),
)(
  "S6 B4 explicit $method records original uncertainty landed $landed",
  async ({ landed, method }) => {
    const f = await createRecoveryFixture();
    try {
      const error = rejectRecoveryCommit(f, landed);
      await expect(f.repository.settle(settlementText)).rejects.toBe(error);
      const before = await f.snapshot();
      const calls = f.calls.length;
      if (method === "release")
        expect(await f.repository.releaseFence(recoveryReleaseTime)).toEqual({ status: "current" });
      else await f.repository.close();
      const after = await f.snapshot();
      expect(after["writer_recovery_records"]).toEqual([expectedUnresolvedRecoveryRow()]);
      expect(after["command_receipts"]).toEqual(before["command_receipts"]);
      expect(f.dependencies.createRecoveryRecordId).toHaveBeenCalledTimes(1);
      expect(f.dependencies.now).toHaveBeenCalledTimes(2);
      expect(f.calls.slice(calls).filter((sql) => sql === "close")).toHaveLength(
        method === "release" ? 2 : 1,
      );
      const completedCalls = [...f.calls];
      for (const text of [settlementText, unchangedText, "{"])
        await expect(f.repository.settle(text)).rejects.toThrow(
          "Canonical Writer requires uncertainty recovery.",
        );
      expect(f.calls).toEqual(completedCalls);
    } finally {
      await f.close();
    }
  },
);

it.each(["held", "rejected", "false-success"] as const)(
  "S6 B4 old close acknowledgement precedes marker and native release: %s",
  async (mode) => {
    const f = await createRecoveryFixture();
    const w = await createRecoveryWriter(f);
    const { entered, resume } = holdRecoveryOldClose(f, mode);
    try {
      rejectRecoveryCommit(f, false);
      const submit = w.writer.settle(settlementRequest.command);
      if (submit.status !== "pending") throw new Error("Expected admitted command.");
      await expect(submit.result).rejects.toBeInstanceOf(AggregateError);
      if (mode !== "held")
        await expect(w.writer.close(recoveryReleaseTime)).rejects.toMatchObject({
          code: "WRITER_FENCE_RELEASE_FAILED",
        });
      const start = f.calls.length;
      const pending = w.writer.close(recoveryReleaseTime);
      await entered.promise;
      expect(f.dependencies.createRecoveryRecordId).not.toHaveBeenCalled();
      expect(f.dependencies.now).toHaveBeenCalledTimes(1);
      expect(w.release).not.toHaveBeenCalled();
      expect(await w.leases.acquire(w.leasePath)).toEqual({ status: "contended" });
      expect(f.calls.filter((sql) => sql.startsWith("UPDATE writer_fence"))).toEqual([]);
      resume.release();
      await pending;
      expect(recordingStages(f.calls.slice(start))).toEqual([
        "close",
        "marker",
        "commit",
        "close",
        "fence",
        "commit",
        "close",
      ]);
      expect((await f.snapshot())["writer_recovery_records"]).toEqual([
        expectedUnresolvedRecoveryRow(),
      ]);
      expect(w.release).toHaveBeenCalledTimes(1);
    } finally {
      resume.release();
      delete f.observation.closed;
      delete f.observation.close;
      await w.writer.close(recoveryReleaseTime);
      await f.close();
    }
  },
);
