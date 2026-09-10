import { createHash } from "node:crypto";
import { ProjectActivationIdSchema } from "@slopstop/protocol";
import { expect, it } from "vitest";
import { createCanonicalCommandRegistry } from "../../src/canonical-command-registry.js";
import {
  appliedReceipt,
  createCanonicalCommandDatabase,
  forbidReplayWork,
  settlementBarrier,
  settlementRequest,
  settlementRows,
  settlementText,
  unchangedText,
} from "./canonical-command-fixture.js";
import {
  expectOtherProjectRecoveryIsolation,
  expectRecoveryFenceCase,
  expectRecoveryHistory,
  expectRecoveryLedgerCase,
  expectRecoveryMarkerCase,
  expectRecoveryReceiptFamily,
  recoveryFenceCases,
  recoveryLedgerCases,
  recoveryMarkerCases,
} from "./canonical-writer-reconciliation-fixture.js";
import {
  activateRecovery,
  advanceRecoveryFixture,
  createRecoveryFixture,
  expectedUnresolvedRecoveryRow,
  expectRecoveryActivationRows,
  prepareRecoveryActivation,
  recoveryActivationTime,
  recoveryRecordId,
  recoveryReleaseTime,
  rejectRecoveryCommit,
  seedRecoveryRecord,
} from "./canonical-writer-recovery-fixture.js";
import {
  configureRecoveryRetry,
  createRecoveryRuntime,
  expectPublicBrokenRecoveryActivation,
  expectRecoveryPrivacy,
  expectRecoveryRuntimeRows,
  recoveryActive,
  recoveryCommandFailure,
  recoveryEnvelope,
  recoveryInternalFailure,
  recoveryNextEpoch,
  recoveryOtherProject,
  recoveryRetryReceipt,
} from "./canonical-writer-recovery-runtime-fixture.js";
import { settledCommand, settlementSwitch } from "./conformance-counter-command.js";

type RecoveryRuntime = Awaited<ReturnType<typeof createRecoveryRuntime>>;

it.each([7, 8])(
  "S6-R1 B9 direct retry rejects original conflict authority value %s",
  async (value) => {
    const f = await createRecoveryFixture();
    try {
      const empty = createCanonicalCommandRegistry([]);
      f.dependencies.registry.prepare.mockImplementation((command) => empty.prepare(command));
      expect(await f.repository.settle(settlementText)).toEqual({
        status: "settled",
        receipt: unsupportedRecoveryReceipt,
      });
      await f.raw.execute("UPDATE command_rejections SET rejection_code='IDEMPOTENCY_CONFLICT'");
      const before = await f.snapshot();
      forbidReplayWork(f);
      const start = f.calls.length;
      await expect(
        f.repository.settle(settlementText.replace('"value":7', `"value":${value}`)),
      ).rejects.toThrow("Canonical original receipt authority is inconsistent.");
      expect(await f.snapshot()).toEqual(before);
      expect(f.calls.slice(start).filter((sql) => /^(INSERT|UPDATE|DELETE)/u.test(sql))).toEqual(
        [],
      );
      expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
      expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
      expect(f.dependencies.createEventId).not.toHaveBeenCalled();
      expect(f.dependencies.now).not.toHaveBeenCalled();
    } finally {
      await f.raw.close();
    }
  },
);

it("S6-R1 B11 public activation rejects a conflict code on the original receipt", async () => {
  const prepared = await createRecoveryFixture();
  try {
    const empty = createCanonicalCommandRegistry([]);
    prepared.dependencies.registry.prepare.mockImplementation((command) => empty.prepare(command));
    const fault = rejectRecoveryCommit(prepared, true);
    await expect(prepared.repository.settle(settlementText)).rejects.toBe(fault);
    await prepared.repository.releaseFence(recoveryReleaseTime);
    expect((await prepared.snapshot())["writer_recovery_records"]).toEqual([
      expectedUnresolvedRecoveryRow(),
    ]);
    await prepared.raw.execute(
      "UPDATE command_rejections SET rejection_code='IDEMPOTENCY_CONFLICT'",
    );
    await expectPublicBrokenRecoveryActivation(prepared);
  } finally {
    await prepared.raw.close();
  }
});

async function expectB13ExplicitRetries(f: RecoveryRuntime, landed: boolean) {
  const resolved = await f.snapshot();
  configureRecoveryRetry(f, landed);
  const request = { ...settlementRequest, activationId: recoveryNextEpoch };
  const receipt = landed ? appliedReceipt : recoveryRetryReceipt;
  expect(await f.send(6, "project.command", request)).toEqual(
    recoveryEnvelope(6, 6, "project.command.result", settledCommand(request, receipt)),
  );
  const retried = await f.snapshot();
  expectRecoveryRuntimeRows(retried, receipt);
  expect(retried["project_state"]).toEqual([
    [
      settlementRequest.projectId,
      1,
      2,
      "2026-09-05T12:00:00.000Z",
      landed ? recoveryActivationTime : receipt.settledAt,
    ],
  ]);
  expect(retried["writer_recovery_records"]).toEqual(resolved["writer_recovery_records"]);
  const start = f.calls.length;
  expect(await f.send(7, "project.command", request)).toEqual(
    recoveryEnvelope(7, 7, "project.command.result", settledCommand(request, receipt)),
  );
  expect(await f.snapshot()).toEqual(retried);
  expect(f.calls.slice(start).filter((sql) => /^(INSERT|UPDATE|DELETE)/u.test(sql))).toEqual([]);
}

it.each([false, true])("S6 G5 B13 exact seven real-port envelopes landed %s", async (landed) => {
  const f = await createRecoveryRuntime(await createCanonicalCommandDatabase());
  try {
    expect(await f.send(1, "project.activate", { projectId: settlementRequest.projectId })).toEqual(
      recoveryEnvelope(1, 1, "project.activate.result", recoveryActive()),
    );
    const initial = await f.snapshot();
    const opened = f.send(5, "project.open", { projectId: recoveryOtherProject });
    await f.openEntered.promise;
    rejectRecoveryCommit(f, landed);
    expect(await f.send(2, "project.command", settlementRequest)).toEqual(
      recoveryEnvelope(2, 2, "request.failure", recoveryInternalFailure),
    );
    const failed = await f.snapshot();
    if (landed) expectRecoveryRuntimeRows(failed, appliedReceipt);
    else expect(failed).toEqual(initial);
    expect(failed["writer_recovery_records"]).toEqual([]);
    expect(f.dependencies.createRecoveryRecordId).not.toHaveBeenCalled();
    expect(f.dependencies.now).toHaveBeenCalledTimes(1);
    const calls = [...f.calls];
    expect(await f.send(3, "project.command", settlementRequest)).toEqual(
      recoveryEnvelope(
        3,
        3,
        "project.command.result",
        recoveryCommandFailure("writer-unavailable"),
      ),
    );
    expect(f.calls).toEqual(calls);
    f.clock.mockReturnValueOnce(recoveryReleaseTime).mockReturnValueOnce(recoveryActivationTime);
    expect(await f.send(4, "project.switch", settlementSwitch)).toEqual(
      recoveryEnvelope(4, 4, "project.switch.result", {
        status: "target-result",
        request: settlementSwitch,
        target: recoveryActive(2),
      }),
    );
    const resolved = await f.snapshot();
    expectRecoveryActivationRows(failed, resolved, landed, false);
    expect(f.prepare).toHaveBeenCalledTimes(1);
    expect(f.dependencies.createReceiptId).toHaveBeenCalledTimes(1);
    expect(f.dependencies.createEventId).toHaveBeenCalledTimes(2);
    expect(f.dependencies.createRecoveryRecordId).toHaveBeenCalledTimes(1);
    expect(f.dependencies.now).toHaveBeenCalledTimes(2);
    expect(f.messages).toHaveLength(4);
    f.openRelease.release();
    expect(await opened).toEqual(
      recoveryEnvelope(5, 5, "project.open.result", {
        status: "not-registered",
        request: { projectId: recoveryOtherProject },
      }),
    );
    await expectB13ExplicitRetries(f, landed);
    expectRecoveryPrivacy(f);
  } finally {
    f.openRelease.release();
    await f.stop();
  }
});

it.each([false, true])(
  "S6 G5 B13 joined requests retain one real settlement landed %s",
  async (landed) => {
    const f = await createRecoveryRuntime(await createCanonicalCommandDatabase());
    const entered = settlementBarrier();
    const release = settlementBarrier();
    try {
      await f.send(1, "project.activate", { projectId: settlementRequest.projectId });
      f.calls.length = 0;
      f.observation.begin = async () => {
        entered.release();
        await release.promise;
        delete f.observation.begin;
      };
      rejectRecoveryCommit(f, landed);
      const first = f.send(2, "project.command", settlementRequest);
      await entered.promise;
      const second = f.send(3, "project.command", settlementRequest);
      await f.dispatched.promise;
      expect(f.calls).toEqual(["begin:write"]);
      release.release();
      expect(await first).toEqual(
        recoveryEnvelope(2, 2, "request.failure", recoveryInternalFailure),
      );
      expect(await second).toEqual(
        recoveryEnvelope(3, 3, "request.failure", recoveryInternalFailure),
      );
      expect(f.calls.filter((sql) => sql === "begin:write")).toHaveLength(1);
      expect(f.prepare).toHaveBeenCalledTimes(1);
      expect((await f.snapshot())["writer_recovery_records"]).toEqual([]);
      expect(f.dependencies.createRecoveryRecordId).not.toHaveBeenCalled();
      f.clock.mockReturnValueOnce(recoveryReleaseTime).mockReturnValueOnce(recoveryActivationTime);
      expect(await f.send(4, "project.switch", settlementSwitch)).toEqual(
        recoveryEnvelope(4, 4, "project.switch.result", {
          status: "target-result",
          request: settlementSwitch,
          target: recoveryActive(2),
        }),
      );
      const marker = expectedUnresolvedRecoveryRow();
      marker.splice(7, 3, landed ? "receipt-found" : "receipt-absent", 2, recoveryActivationTime);
      expect((await f.snapshot())["writer_recovery_records"]).toEqual([marker]);
      expect(f.dependencies.createRecoveryRecordId).toHaveBeenCalledTimes(1);
      expect(
        f.calls.filter((sql) => sql.startsWith("INSERT INTO writer_recovery_records")),
      ).toHaveLength(1);
      expect((await f.snapshot())["conformance_counter"]).toEqual([
        [
          settlementRequest.projectId,
          "55555555-5555-4555-8555-555555555501",
          landed ? 7 : 0,
          landed ? 2 : 1,
        ],
      ]);
      expectRecoveryPrivacy(f);
    } finally {
      release.release();
      await f.stop();
    }
  },
);

it.each([false, true])(
  "S6 G5 B15 two-phase repository ownership composes with real runtime landed %s",
  async (landed) => {
    const f = await createRecoveryRuntime(await createCanonicalCommandDatabase());
    const entered = settlementBarrier();
    const release = settlementBarrier();
    try {
      await f.send(1, "project.activate", { projectId: settlementRequest.projectId });
      const initial = await f.snapshot();
      const repository = f.repositories[0];
      if (!repository) throw new Error("No activated public repository.");
      f.calls.length = 0;
      f.dependencies.sha256Text.mockClear().mockImplementationOnce(async (text) => {
        entered.release();
        await release.promise;
        return createHash("sha256").update(text).digest("hex");
      });
      rejectRecoveryCommit(f, landed);
      const first = f.send(2, "project.command", settlementRequest);
      await entered.promise;
      await expect(repository.settle(unchangedText)).rejects.toEqual(
        new Error("Canonical Writer transaction is already owned."),
      );
      expect(f.dependencies.sha256Text).toHaveBeenCalledTimes(1);
      expect(f.calls).toEqual([]);
      expect(f.prepare).not.toHaveBeenCalled();
      release.release();
      expect(await first).toEqual(
        recoveryEnvelope(2, 2, "request.failure", recoveryInternalFailure),
      );
      const failed = await f.snapshot();
      if (landed) expectRecoveryRuntimeRows(failed, appliedReceipt);
      else expect(failed).toEqual(initial);
      expect(failed["writer_recovery_records"]).toEqual([]);
      expect(f.dependencies.createRecoveryRecordId).not.toHaveBeenCalled();
      expect(f.dependencies.now).toHaveBeenCalledTimes(1);
      for (const text of [settlementText, unchangedText, "{"]) {
        const calls = [...f.calls];
        await expect(repository.settle(text)).rejects.toEqual(
          new Error("Canonical Writer requires uncertainty recovery."),
        );
        expect(f.calls).toEqual(calls);
        expect(f.dependencies.sha256Text).toHaveBeenCalledTimes(1);
      }
      expect(await f.snapshot()).toEqual(failed);
      f.clock.mockReturnValueOnce(recoveryReleaseTime);
      await f.stop();
      expect((await f.snapshot())["writer_recovery_records"]).toEqual([
        expectedUnresolvedRecoveryRow(),
      ]);
      expect(f.dependencies.createRecoveryRecordId).toHaveBeenCalledTimes(1);
      const calls = [...f.calls];
      const hashes = f.dependencies.sha256Text.mock.calls.length;
      for (const text of [settlementText, unchangedText, "{"])
        await expect(repository.settle(text)).rejects.toEqual(
          new Error("Canonical Writer requires uncertainty recovery."),
        );
      expect(f.calls).toEqual(calls);
      expect(f.dependencies.sha256Text).toHaveBeenCalledTimes(hashes);
      expectRecoveryPrivacy(f);
    } finally {
      release.release();
      await f.stop();
    }
  },
);

it.each([false, true])(
  "S6 G5 B10 fresh runtime is inactive and preserves recovery history landed %s",
  async (landed) => {
    const file = await createCanonicalCommandDatabase();
    const old = await createRecoveryRuntime(file);
    try {
      await old.send(1, "project.activate", { projectId: settlementRequest.projectId });
      rejectRecoveryCommit(old, landed);
      expect(await old.send(2, "project.command", settlementRequest)).toEqual(
        recoveryEnvelope(2, 2, "request.failure", recoveryInternalFailure),
      );
      old.clock.mockReturnValueOnce(recoveryReleaseTime);
    } finally {
      await old.stop();
    }
    const before = await old.snapshot();
    const f = await createRecoveryRuntime(file, { next: true });
    try {
      expect(await f.send(1, "project.command", settlementRequest)).toEqual(
        recoveryEnvelope(1, 1, "project.command.result", recoveryCommandFailure("inactive")),
      );
      for (const dependency of [
        f.acquire,
        f.activate,
        f.lease,
        f.epoch,
        f.token,
        f.clock,
        f.dependencies.sha256Text,
        f.prepare,
      ])
        expect(dependency).not.toHaveBeenCalled();
      expect(await f.snapshot()).toEqual(before);
      expect(
        await f.send(2, "project.activate", { projectId: settlementRequest.projectId }),
      ).toEqual(recoveryEnvelope(2, 2, "project.activate.result", recoveryActive(2)));
      const resolved = await f.snapshot();
      expectRecoveryActivationRows(before, resolved, landed, false);
      expect(f.prepare).not.toHaveBeenCalled();
      expect(f.dependencies.now).not.toHaveBeenCalled();
      expect(f.dependencies.createRecoveryRecordId).not.toHaveBeenCalled();
      expect(await f.send(3, "project.command", settlementRequest)).toEqual(
        recoveryEnvelope(
          3,
          3,
          "project.command.result",
          recoveryCommandFailure("stale-activation"),
        ),
      );
      expect(await f.snapshot()).toEqual(resolved);
      configureRecoveryRetry(f, landed);
      const request = { ...settlementRequest, activationId: recoveryNextEpoch };
      const receipt = landed ? appliedReceipt : recoveryRetryReceipt;
      for (const id of [4, 5])
        expect(await f.send(id, "project.command", request)).toEqual(
          recoveryEnvelope(id, id, "project.command.result", settledCommand(request, receipt)),
        );
      const final = await f.snapshot();
      expectRecoveryRuntimeRows(final, receipt);
      expect(final["writer_recovery_records"]).toEqual(resolved["writer_recovery_records"]);
      expectRecoveryPrivacy(f);
    } finally {
      await f.stop();
    }
  },
);

it.each([false, true])(
  "S6 G5 B10 public A B A switch resolves only returning A landed %s",
  async (landed) => {
    const file = await createCanonicalCommandDatabase();
    const otherFile = await createCanonicalCommandDatabase(true, recoveryOtherProject);
    const f = await createRecoveryRuntime(file, { otherFile });
    const bEpoch = ProjectActivationIdSchema.parse("ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1");
    try {
      await f.send(1, "project.activate", { projectId: settlementRequest.projectId });
      rejectRecoveryCommit(f, landed);
      expect(await f.send(2, "project.command", settlementRequest)).toEqual(
        recoveryEnvelope(2, 2, "request.failure", recoveryInternalFailure),
      );
      f.epoch.mockReturnValueOnce(bEpoch);
      f.clock.mockReturnValueOnce(recoveryReleaseTime).mockReturnValueOnce(recoveryActivationTime);
      const ab = { ...settlementSwitch, to: { projectId: recoveryOtherProject } };
      expect(await f.send(3, "project.switch", ab)).toEqual(
        recoveryEnvelope(3, 3, "project.switch.result", {
          status: "target-result",
          request: ab,
          target: { ...recoveryActive(1, recoveryOtherProject), activationId: bEpoch },
        }),
      );
      const away = await f.snapshot();
      expect(away["writer_recovery_records"]).toEqual([expectedUnresolvedRecoveryRow()]);
      expect((await settlementRows(otherFile))["writer_recovery_records"]).toEqual([]);
      f.clock
        .mockReturnValueOnce("2026-09-05T12:00:06.000Z")
        .mockReturnValueOnce(recoveryActivationTime);
      const ba = {
        from: { projectId: recoveryOtherProject, activationId: bEpoch },
        to: settlementSwitch.to,
      };
      expect(await f.send(4, "project.switch", ba)).toEqual(
        recoveryEnvelope(4, 4, "project.switch.result", {
          status: "target-result",
          request: ba,
          target: recoveryActive(2),
        }),
      );
      const returned = await f.snapshot();
      expectRecoveryActivationRows(away, returned, landed, false);
      expect(f.dependencies.createRecoveryRecordId).toHaveBeenCalledTimes(1);
      expect(f.prepare).toHaveBeenCalledTimes(1);
      const calls = [...f.calls];
      expect(await f.send(5, "project.command", settlementRequest)).toEqual(
        recoveryEnvelope(
          5,
          5,
          "project.command.result",
          recoveryCommandFailure("stale-activation"),
        ),
      );
      expect(f.calls).toEqual(calls);
      expect(await f.snapshot()).toEqual(returned);
      expectRecoveryPrivacy(f);
    } finally {
      await f.stop();
    }
  },
);

const unsupportedRecoveryReceipt = {
  ...appliedReceipt,
  outcome: "rejected",
  events: [],
  rejection: { code: "COMMAND_TYPE_UNSUPPORTED", retryable: false },
};
type RecoveryCommitMode = "acknowledged" | "before" | "after";

async function stopProductionRecovery(file: string, mode: RecoveryCommitMode) {
  const old = await createRecoveryRuntime(file, { production: true });
  try {
    expect(
      await old.send(1, "project.activate", { projectId: settlementRequest.projectId }),
    ).toEqual(recoveryEnvelope(1, 1, "project.activate.result", recoveryActive()));
    if (mode !== "acknowledged") rejectRecoveryCommit(old, mode === "after");
    expect(await old.send(2, "project.command", settlementRequest)).toEqual(
      recoveryEnvelope(
        2,
        2,
        mode === "acknowledged" ? "project.command.result" : "request.failure",
        mode === "acknowledged"
          ? settledCommand(settlementRequest, unsupportedRecoveryReceipt)
          : recoveryInternalFailure,
      ),
    );
    expect((await old.snapshot())["writer_recovery_records"]).toEqual([]);
    expect(old.dependencies.createRecoveryRecordId).not.toHaveBeenCalled();
    old.clock.mockReturnValueOnce(recoveryReleaseTime);
  } finally {
    await old.stop();
  }
  return old.snapshot();
}

function expectUnsupportedRecoveryRows(
  retried: Awaited<ReturnType<RecoveryRuntime["snapshot"]>>,
  receipt: Omit<
    typeof unsupportedRecoveryReceipt,
    "receiptId" | "writerGeneration" | "settledAt"
  > & { receiptId: string; writerGeneration: number; settledAt: string },
) {
  const fingerprint = expectedUnresolvedRecoveryRow()[5];
  const a = settlementRequest.projectId;
  expect(retried["command_receipts"]).toEqual([
    [
      a,
      receipt.receiptId,
      receipt.commandId,
      receipt.commandType,
      1,
      fingerprint,
      "rejected",
      1,
      receipt.writerGeneration,
      receipt.settledAt,
    ],
  ]);
  expect(retried["command_idempotency"]).toEqual([
    [a, receipt.commandId, fingerprint, receipt.receiptId, receipt.settledAt],
  ]);
  expect(retried["command_rejections"]).toEqual([
    [
      a,
      receipt.receiptId,
      "rejected",
      1,
      "COMMAND_TYPE_UNSUPPORTED",
      0,
      '{"version":1}',
      createHash("sha256").update('{"version":1}').digest("hex"),
    ],
  ]);
  expect(retried["canonical_events"]).toEqual([]);
  expect(retried["foreign_keys"]).toEqual([]);
}

it.each(["acknowledged", "before", "after"] as const)(
  "S6 G5 B10 unextended production empty registry survives runtime restart %s",
  async (mode) => {
    const file = await createCanonicalCommandDatabase(false);
    const original = unsupportedRecoveryReceipt;
    const before = await stopProductionRecovery(file, mode);
    const f = await createRecoveryRuntime(file, { production: true, next: true });
    try {
      expect(await f.send(1, "project.command", settlementRequest)).toEqual(
        recoveryEnvelope(1, 1, "project.command.result", recoveryCommandFailure("inactive")),
      );
      for (const dependency of [
        f.acquire,
        f.activate,
        f.lease,
        f.epoch,
        f.token,
        f.clock,
        f.dependencies.sha256Text,
        f.prepare,
      ])
        expect(dependency).not.toHaveBeenCalled();
      expect(await f.snapshot()).toEqual(before);
      expect(
        await f.send(2, "project.activate", { projectId: settlementRequest.projectId }),
      ).toEqual(recoveryEnvelope(2, 2, "project.activate.result", recoveryActive(2)));
      const resolved = await f.snapshot();
      const marker = expectedUnresolvedRecoveryRow();
      marker.splice(
        7,
        3,
        mode === "after" ? "receipt-found" : "receipt-absent",
        2,
        recoveryActivationTime,
      );
      expect(resolved["writer_recovery_records"]).toEqual(mode === "acknowledged" ? [] : [marker]);
      expect(f.prepare).not.toHaveBeenCalled();
      expect(f.dependencies.now).not.toHaveBeenCalled();
      configureRecoveryRetry(f, mode !== "before");
      const request = { ...settlementRequest, activationId: recoveryNextEpoch };
      const receipt =
        mode === "before"
          ? {
              ...original,
              receiptId: recoveryRetryReceipt.receiptId,
              writerGeneration: 2,
              settledAt: recoveryRetryReceipt.settledAt,
            }
          : original;
      expect(await f.send(3, "project.command", request)).toEqual(
        recoveryEnvelope(3, 3, "project.command.result", settledCommand(request, receipt)),
      );
      const retried = await f.snapshot();
      expectUnsupportedRecoveryRows(retried, receipt);
      expect(retried["writer_recovery_records"]).toEqual(resolved["writer_recovery_records"]);
      expect(await f.send(4, "project.command", request)).toEqual(
        recoveryEnvelope(4, 4, "project.command.result", settledCommand(request, receipt)),
      );
      expect(await f.snapshot()).toEqual(retried);
      expect(f.prepare).toHaveBeenCalledTimes(mode === "before" ? 1 : 0);
      expect(f.dependencies.createEventId).not.toHaveBeenCalled();
      expect(f.dependencies.createRecoveryRecordId).not.toHaveBeenCalled();
      expectRecoveryPrivacy(f);
    } finally {
      await f.stop();
    }
  },
);

it.each([false, true])(
  "S6 G5 B10 simulated pre-marker death never attributes a lost command landed %s",
  async (landed) => {
    const prepared = await prepareRecoveryActivation(landed, true);
    // Durable-state simulation only: no process is killed and no native crash is claimed.
    try {
      await prepared.raw.execute("DELETE FROM writer_recovery_records");
    } finally {
      await prepared.raw.close();
    }
    const f = await createRecoveryRuntime(prepared.file, { next: true });
    try {
      expect(await f.send(1, "project.command", settlementRequest)).toEqual(
        recoveryEnvelope(1, 1, "project.command.result", recoveryCommandFailure("inactive")),
      );
      expect(f.acquire).not.toHaveBeenCalled();
      expect(
        await f.send(2, "project.activate", { projectId: settlementRequest.projectId }),
      ).toEqual(recoveryEnvelope(2, 2, "project.activate.result", recoveryActive(2)));
      const resolved = await f.snapshot();
      expect(resolved["writer_recovery_records"]).toEqual([
        [
          settlementRequest.projectId,
          recoveryRecordId,
          1,
          "abandoned-active-fence",
          null,
          null,
          recoveryActivationTime,
          "generation-superseded",
          2,
          recoveryActivationTime,
        ],
      ]);
      expect(f.prepare).not.toHaveBeenCalled();
      expect(f.dependencies.now).not.toHaveBeenCalled();
      configureRecoveryRetry(f, landed);
      const request = { ...settlementRequest, activationId: recoveryNextEpoch };
      const receipt = landed ? appliedReceipt : recoveryRetryReceipt;
      expect(await f.send(3, "project.command", request)).toEqual(
        recoveryEnvelope(3, 3, "project.command.result", settledCommand(request, receipt)),
      );
      const retried = await f.snapshot();
      expectRecoveryRuntimeRows(retried, receipt);
      expect(retried["writer_recovery_records"]).toEqual(resolved["writer_recovery_records"]);
      expectRecoveryPrivacy(f);
    } finally {
      await f.stop();
    }
  },
);

it.each([false, true].flatMap((active) => [false, true].map((landed) => ({ active, landed }))))(
  "S6 G4 B8 preserves unmarked history active $active landed $landed",
  async ({ active, landed }) => {
    const f = await prepareRecoveryActivation(landed, active);
    try {
      await f.raw.execute("DELETE FROM writer_recovery_records");
      f.dependencies.createRecoveryRecordId.mockReturnValue(recoveryRecordId);
      const result = await activateRecovery(f);
      expect(result.status).toBe("activated");
      const rows = await f.snapshot();
      expect(rows["writer_recovery_records"]).toEqual(
        active
          ? [
              [
                settlementRequest.projectId,
                recoveryRecordId,
                1,
                "abandoned-active-fence",
                null,
                null,
                recoveryActivationTime,
                "generation-superseded",
                2,
                recoveryActivationTime,
              ],
            ]
          : [],
      );
      expect(rows["writer_handoffs"]?.[1]).toEqual([
        settlementRequest.projectId,
        "88888888-8888-4888-9888-888888888602",
        1,
        2,
        active ? "recovery" : "clean",
        recoveryActivationTime,
      ]);
    } finally {
      await f.raw.close();
    }
  },
);

it("S6 G4 B11 rejects any recovery row at initial generation", async () => {
  const f = await prepareRecoveryActivation(false);
  try {
    for (const table of [
      "writer_recovery_records",
      "writer_handoffs",
      "writer_fence",
      "writer_generations",
    ])
      await f.raw.execute(`DELETE FROM ${table}`);
    await f.raw.execute("UPDATE project_state SET last_writer_generation=0");
    const before = await f.snapshot();
    f.observation.after = (sql, result) =>
      sql.includes("FROM writer_recovery_records")
        ? { ...result, rows: [result.columns.map(() => null)] }
        : result;
    expect((await activateRecovery(f)).status).toBe("broken");
    expect(await f.snapshot()).toEqual(before);
  } finally {
    await f.raw.close();
  }
});

it("S6 G4 B11 rejects older unresolved generation without hiding it behind G2", async () => {
  const f = await createRecoveryFixture();
  try {
    await advanceRecoveryFixture(f);
    await seedRecoveryRecord(f);
    await f.repository.releaseFence("2026-09-05T12:00:06.000Z");
    forbidReplayWork(f);
    const before = await f.snapshot();
    expect((await activateRecovery(f, 3)).status).toBe("broken");
    expect(await f.snapshot()).toEqual(before);
  } finally {
    await f.raw.close();
  }
});

it.each(
  ["unchanged", "unsupported", "conflict", "older"].flatMap((family) =>
    [false, true].map((landed) => ({ family, landed })),
  ),
)(
  "S6 G4 B9 reconciles every durable receipt family $family landed $landed",
  expectRecoveryReceiptFamily,
);
it.each([{ landed: false }, { landed: true }])(
  "S6 G4 B10 keeps recovery history stable across explicit retry landed %s",
  expectRecoveryHistory,
);
it(
  "S6 G4 B10 keeps A unresolved while B is active and resolves only on explicit return",
  expectOtherProjectRecoveryIsolation,
);

it.each([false, true].flatMap((landed) => [false, true].map((active) => ({ landed, active }))))(
  "S6 G4 B8 resolves found and absent uncertainty landed $landed active $active",
  async ({ landed, active }) => {
    const f = await prepareRecoveryActivation(landed, active);
    try {
      const before = await f.snapshot();
      const result = await activateRecovery(f);
      expect(result.status).toBe("activated");
      expectRecoveryActivationRows(before, await f.snapshot(), landed, active);
      expect(f.dependencies.registry.prepare).not.toHaveBeenCalled();
      expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
      expect(f.dependencies.createEventId).not.toHaveBeenCalled();
      expect(f.dependencies.now).not.toHaveBeenCalled();
      expect(f.dependencies.createRecoveryRecordId).not.toHaveBeenCalled();
    } finally {
      await f.raw.close();
    }
  },
);

it.each(
  recoveryFenceCases.flatMap((entry) =>
    [false, true].flatMap((active) =>
      [false, true].map((marked) => ({ ...entry, active, marked })),
    ),
  ),
)(
  "S6 G4 B14 rejects invalid predecessor activation timestamps $name active $active marked $marked",
  async ({ active, marked, ...entry }) => expectRecoveryFenceCase(entry, active, marked),
);
it.each(recoveryMarkerCases)(
  "S6 G4 B11 rejects corrupt uncertainty evidence marker $name",
  expectRecoveryMarkerCase,
);
it.each(recoveryLedgerCases)(
  "S6 G4 B11 rejects corrupt uncertainty evidence ledger $target $family $shape $changes",
  async (entry) => expectRecoveryLedgerCase(entry),
);
it.each(recoveryLedgerCases)(
  "S6 G4 lookup baseline ledger $target $family $shape $changes",
  async (entry) => expectRecoveryLedgerCase(entry, true),
);

it.each(
  [false, true].flatMap((active) =>
    [
      "UPDATE project_state SET last_writer_generation",
      "INSERT INTO writer_generations",
      ...(active ? ["UPDATE writer_generations SET released_at"] : []),
      "UPDATE writer_recovery_records",
      "INSERT INTO writer_handoffs",
      "UPDATE writer_fence",
    ].flatMap((checkpoint) =>
      (["throw", 0, 2] as const).map((mode) => ({ active, checkpoint, mode })),
    ),
  ),
)(
  "S6 G4 B12 rolls back recovery activation $checkpoint active $active mode $mode",
  async ({ active, checkpoint, mode }) => {
    const f = await prepareRecoveryActivation(false, active);
    try {
      const before = await f.snapshot();
      let reached = false;
      f.observation.after = (sql, result) => {
        if (!sql.startsWith(checkpoint)) return result;
        reached = true;
        if (mode === "throw") throw new Error("Known activation body fault.");
        return { ...result, rowsAffected: mode };
      };
      const result = await activateRecovery(f);
      expect(reached).toBe(true);
      expect(result.status).toBe("broken");
      expect(f.calls.slice(-2)).toEqual(["rollback", "close"]);
      expect(await f.snapshot()).toEqual(before);
    } finally {
      await f.raw.close();
    }
  },
);

it.each(
  ["marker", "fence"].flatMap((target) =>
    ["changed", "deleted"].map((drift) => ({ target, drift })),
  ),
)("S6 G4 B12 refuses conditional recovery drift $target $drift", async ({ target, drift }) => {
  const f = await prepareRecoveryActivation(false);
  try {
    const before = await f.snapshot();
    const result = await activateRecovery(f, 2, async (sql, tx) => {
      if (!sql.startsWith("INSERT INTO writer_generations")) return;
      const table = target === "marker" ? "writer_recovery_records" : "writer_fence";
      const change =
        target === "marker"
          ? "observed_at='2026-09-05T12:00:04.750Z'"
          : "released_at='2026-09-05T12:00:04.750Z'";
      await tx.execute(
        drift === "deleted" ? `DELETE FROM ${table}` : `UPDATE ${table} SET ${change}`,
      );
    });
    expect(result.status).toBe("broken");
    expect(await f.snapshot()).toEqual(before);
  } finally {
    await f.raw.close();
  }
});
