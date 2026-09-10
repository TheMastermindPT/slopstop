import { CommandIdSchema, createProjectOpenCommand, ProjectIdSchema } from "@slopstop/protocol";
import { expect, it } from "vitest";
import {
  appliedReceipt,
  expectAppliedRows,
  settlementBarrier,
  settlementRequest,
} from "./canonical-command-fixture.js";
import {
  admissionCases,
  busyCommand,
  captureUnawaitedComposition,
  compositionMutation,
  configureCompositionDecision,
  configureCompositionFault,
  configureCompositionIssuedFailure,
  configureCompositionSettings,
  corruptCompositionResult,
  createSettlementComposition,
  failCompositionCommit,
  holdCompositionHandler,
  holdCompositionWork,
  malformedHandlerDecisions,
  retainCompositionClose,
  settledCommand,
  settlementActivation,
  settlementEvent,
  settlementNewEpoch,
  settlementSwitch,
} from "./conformance-counter-command.js";

it("persists applied counter state receipt original pointer and ordered events atomically", async () => {
  const f = await createSettlementComposition();
  try {
    expect(await f.activate()).toEqual(
      settlementEvent(1, 1, "project.activate.result", settlementActivation()),
    );
    expect(await f.execute()).toEqual(
      settlementEvent(
        2,
        2,
        "project.command.result",
        settledCommand(settlementRequest, appliedReceipt),
      ),
    );
    expectAppliedRows(await f.snapshot());
  } finally {
    await f.close();
  }
});

it.each(admissionCases)(
  "durably rejects unsupported definitions and invalid handler payloads: $code/$type/$version",
  async (entry) => {
    const f = await createSettlementComposition();
    try {
      await f.activate();
      const request = {
        ...settlementRequest,
        command: {
          ...settlementRequest.command,
          type: entry.type,
          version: entry.version,
          payload: entry.payload,
        },
      };
      const receipt = {
        ...appliedReceipt,
        commandType: entry.type,
        commandVersion: entry.version,
        outcome: "rejected",
        events: [],
        rejection: { code: entry.code, retryable: false },
      };
      expect(await f.execute(2, request)).toEqual(
        settlementEvent(2, 2, "project.command.result", settledCommand(request, receipt)),
      );
      const rows = await f.snapshot();
      expect(rows["conformance_counter"]).toEqual([
        [settlementRequest.projectId, "55555555-5555-4555-8555-555555555501", 0, 1],
      ]);
      expect(rows["command_receipts"]).toHaveLength(1);
      expect(rows["command_idempotency"]).toHaveLength(1);
      expect(rows["command_rejections"]).toHaveLength(1);
      expect(rows["canonical_events"]).toEqual([]);
      expect(f.handler).not.toHaveBeenCalled();
    } finally {
      await f.close();
    }
  },
);

it("round-trips durable settlement and replay over real MessagePorts", async () => {
  const f = await createSettlementComposition();
  try {
    expect(await f.activate()).toEqual(
      settlementEvent(1, 1, "project.activate.result", settlementActivation()),
    );
    expect(await f.execute()).toEqual(
      settlementEvent(
        2,
        2,
        "project.command.result",
        settledCommand(settlementRequest, appliedReceipt),
      ),
    );
    expectAppliedRows(await f.snapshot());
    expect(await f.switchProject()).toEqual(
      settlementEvent(3, 3, "project.switch.result", {
        status: "target-result",
        request: settlementSwitch,
        target: settlementActivation(true),
      }),
    );
    const before = await f.snapshot();
    const request = { ...settlementRequest, activationId: settlementNewEpoch };
    f.dependencies.registry.prepare.mockImplementation(() => {
      throw new Error("Replay prepared a definition.");
    });
    f.dependencies.now.mockImplementation(() => {
      throw new Error("Replay consumed clock.");
    });
    f.dependencies.createReceiptId.mockImplementation(() => {
      throw new Error("Replay consumed receipt identity.");
    });
    f.dependencies.createEventId.mockImplementation(() => {
      throw new Error("Replay consumed event identity.");
    });
    expect(await f.execute(4, request)).toEqual(
      settlementEvent(4, 4, "project.command.result", settledCommand(request, appliedReceipt)),
    );
    expect(await f.snapshot()).toEqual(before);
    expect(before["project_state"]).toEqual([
      [settlementRequest.projectId, 1, 2, "2026-09-05T12:00:00.000Z", "2026-09-05T12:00:05.000Z"],
    ]);
  } finally {
    await f.close();
  }
});

it("replays exact receipts across repository and activation replacement", async () => {
  const f = await createSettlementComposition();
  try {
    await f.activate();
    expect(await f.application.execute(settlementRequest)).toEqual(
      settledCommand(settlementRequest, appliedReceipt),
    );
    await f.application.switchProject(settlementSwitch);
    const calls = [...f.calls];
    expect(await f.application.execute(settlementRequest)).toEqual({
      status: "stale-activation",
      projectId: settlementRequest.projectId,
      activationId: settlementRequest.activationId,
      commandId: settlementRequest.command.commandId,
      diagnostic: {
        code: "PROJECT_ACTIVATION_STALE",
        message: "The command activation is stale.",
        retryable: false,
      },
    });
    expect(f.calls).toEqual(calls);
    const current = { ...settlementRequest, activationId: settlementNewEpoch };
    expect(await f.application.execute(current)).toEqual(settledCommand(current, appliedReceipt));
  } finally {
    await f.close();
  }
});

it("joins exact simultaneous commands and rejects distinct work as busy", async () => {
  const f = await createSettlementComposition();
  const held = settlementBarrier();
  try {
    await f.activate();
    f.calls.length = 0;
    holdCompositionHandler(f, held.promise);
    const first = f.execute(2);
    const join = f.execute(6, {
      ...settlementRequest,
      command: {
        ...settlementRequest.command,
        payload: { tags: ["x", "y"], meta: { a: 1, b: 2 }, value: 7 },
      },
    });
    const distinct = {
      ...settlementRequest,
      command: { ...settlementRequest.command, payload: { value: 8 } },
    };
    expect(await f.execute(7, distinct)).toEqual(
      settlementEvent(2, 7, "project.command.result", busyCommand(distinct)),
    );
    const next = {
      ...settlementRequest,
      command: {
        ...settlementRequest.command,
        commandId: CommandIdSchema.parse("44444444-4444-4444-8444-444444444502"),
      },
    };
    expect(await f.execute(8, next)).toEqual(
      settlementEvent(3, 8, "project.command.result", busyCommand(next)),
    );
    expect(f.messages).toHaveLength(3);
    expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
    expect(f.dependencies.createEventId).not.toHaveBeenCalled();
    expect(f.dependencies.now).not.toHaveBeenCalled();
    held.release();
    expect(await first).toEqual(
      settlementEvent(
        4,
        2,
        "project.command.result",
        settledCommand(settlementRequest, appliedReceipt),
      ),
    );
    expect(await join).toEqual(
      settlementEvent(
        5,
        6,
        "project.command.result",
        settledCommand(settlementRequest, appliedReceipt),
      ),
    );
    expect(f.calls.filter((call) => call === "begin:write")).toHaveLength(1);
    expect(f.handler).toHaveBeenCalledTimes(1);
    expectAppliedRows(await f.snapshot());
    await expectExplicitConflict(f, distinct);
  } finally {
    held.release();
    await f.close();
  }
});

async function expectExplicitConflict(
  f: Awaited<ReturnType<typeof createSettlementComposition>>,
  distinct: typeof settlementRequest,
) {
  f.dependencies.now.mockReturnValue("2026-09-05T12:00:02.000Z");
  const conflict = {
    ...appliedReceipt,
    receiptId: "66666666-6666-4666-8666-666666666502",
    outcome: "rejected",
    projectSequence: 2,
    settledAt: "2026-09-05T12:00:02.000Z",
    events: [],
    rejection: { code: "IDEMPOTENCY_CONFLICT", retryable: false },
  };
  expect(await f.execute(9, distinct)).toEqual(
    settlementEvent(6, 9, "project.command.result", settledCommand(distinct, conflict)),
  );
  expect(f.handler).toHaveBeenCalledTimes(1);
  const after = await f.snapshot();
  expect(after["command_receipts"]).toHaveLength(2);
  expect(after["command_idempotency"]).toHaveLength(1);
  expect(after["canonical_events"]).toHaveLength(2);
}

it("switches only after the admitted settlement and joins complete", async () => {
  const f = await createSettlementComposition();
  const held = settlementBarrier();
  try {
    await f.activate();
    f.calls.length = 0;
    holdCompositionHandler(f, held.promise);
    const first = f.application.execute(settlementRequest);
    const join = f.application.execute(settlementRequest);
    const switching = f.application.switchProject(settlementSwitch);
    expect(await f.application.execute(settlementRequest)).toEqual({
      status: "coordinator-unavailable",
      projectId: settlementRequest.projectId,
      activationId: settlementRequest.activationId,
      commandId: settlementRequest.command.commandId,
      diagnostic: {
        code: "PROJECT_COORDINATOR_UNAVAILABLE",
        message: "Canonical Project coordination is unavailable.",
        retryable: false,
      },
    });
    expect(f.releases).toEqual([]);
    expect(f.clock).toHaveBeenCalledTimes(1);
    expect(f.dependencies.now).not.toHaveBeenCalled();
    expect(f.dependencies.createReceiptId).not.toHaveBeenCalled();
    expect(f.dependencies.createEventId).not.toHaveBeenCalled();
    held.release();
    expect(await first).toEqual(settledCommand(settlementRequest, appliedReceipt));
    expect(await join).toEqual(settledCommand(settlementRequest, appliedReceipt));
    expect(await switching).toEqual({
      status: "target-result",
      request: settlementSwitch,
      target: settlementActivation(true),
    });
    expect(f.releases).toEqual(["repository", "lease", "storage"]);
    expect(f.handler).toHaveBeenCalledTimes(1);
  } finally {
    held.release();
    await f.close();
  }
});

it("durably rejects commands with the production empty registry", async () => {
  const f = await createSettlementComposition(false);
  try {
    expect(await f.activate()).toEqual(
      settlementEvent(1, 1, "project.activate.result", settlementActivation()),
    );
    const receipt = {
      ...appliedReceipt,
      outcome: "rejected",
      events: [],
      rejection: { code: "COMMAND_TYPE_UNSUPPORTED", retryable: false },
    };
    expect(await f.execute()).toEqual(
      settlementEvent(2, 2, "project.command.result", settledCommand(settlementRequest, receipt)),
    );
    const before = await f.snapshot();
    expect(before["command_receipts"]).toHaveLength(1);
    expect(before["command_idempotency"]).toHaveLength(1);
    expect(before["command_rejections"]).toHaveLength(1);
    expect(before["canonical_events"]).toEqual([]);
    expect(await f.execute(4)).toEqual(
      settlementEvent(3, 4, "project.command.result", settledCommand(settlementRequest, receipt)),
    );
    expect(await f.snapshot()).toEqual(before);
  } finally {
    await f.close();
  }
});

it("S5 G15 freezes submission meaning before asynchronous repository work: same-stack caller and parsed handler", async () => {
  const f = await createSettlementComposition();
  await f.activate();
  const pendingWork = holdCompositionWork(f, "begin");
  const mutation = compositionMutation(f);
  try {
    const submitted = {
      ...settlementRequest,
      command: {
        ...settlementRequest.command,
        payload: { value: 7, meta: { b: 2, a: 1 }, tags: ["x", "y"] },
      },
    };
    const pending = f.application.execute(submitted);
    submitted.command.payload.value = 8;
    submitted.command.payload.meta.a = 99;
    submitted.command.commandId = CommandIdSchema.parse("44444444-4444-4444-8444-444444444502");
    submitted.command.type = "conformance.counter.other";
    submitted.command.version = 2;
    await pendingWork.ready;
    pendingWork.release();
    expect(await pending).toEqual(settledCommand(settlementRequest, appliedReceipt));
    expect(mutation.parsedValue()).toBe(9);
    expectAppliedRows(await f.snapshot());
    expect(await f.application.execute(settlementRequest)).toEqual(
      settledCommand(settlementRequest, appliedReceipt),
    );
    expect(f.handler).toHaveBeenCalledTimes(1);
  } finally {
    pendingWork.release();
    await f.close();
  }
});

it("S5 G15 freezes submission meaning before asynchronous repository work: retained handler output", async () => {
  const f = await createSettlementComposition();
  await f.activate();
  const held = holdCompositionWork(f, "commit");
  const mutation = compositionMutation(f);
  try {
    const result = f.application.execute(settlementRequest);
    await held.ready;
    mutation.mutateOutput();
    held.release();
    expect(await result).toEqual(settledCommand(settlementRequest, appliedReceipt));
    expectAppliedRows(await f.snapshot());
    expect(await f.application.execute(settlementRequest)).toEqual(
      settledCommand(settlementRequest, appliedReceipt),
    );
    expectAppliedRows(await f.snapshot());
  } finally {
    held.release();
    await f.close();
  }
});

const internalFailure = {
  code: "HARNESS_INTERNAL_FAILURE",
  message: "Harness failed while handling a message.",
  retryable: false,
};
function unavailableCommand(request = settlementRequest) {
  return {
    status: "writer-unavailable",
    projectId: request.projectId,
    activationId: request.activationId,
    commandId: request.command.commandId,
    diagnostic: {
      code: "WRITER_UNAVAILABLE",
      message: "The Writer requires explicit reactivation.",
      retryable: false,
    },
  };
}

async function expectComposedBodyFailure(
  f: Awaited<ReturnType<typeof createSettlementComposition>>,
) {
  const before = await f.snapshot();
  expect(await f.execute()).toEqual(settlementEvent(2, 2, "request.failure", internalFailure));
  expect(await f.snapshot()).toEqual(before);
  const calls = [...f.calls];
  expect(await f.execute(4)).toEqual(
    settlementEvent(3, 4, "project.command.result", unavailableCommand()),
  );
  const distinct = {
    ...settlementRequest,
    command: {
      ...settlementRequest.command,
      commandId: CommandIdSchema.parse("44444444-4444-4444-8444-444444444502"),
    },
  };
  expect(await f.execute(6, distinct)).toEqual(
    settlementEvent(4, 6, "project.command.result", unavailableCommand(distinct)),
  );
  expect(f.calls).toEqual(calls);
  expect(await f.snapshot()).toEqual(before);
  expect(JSON.stringify(f.messages)).not.toMatch(/private|secret-token|system.failure/);
}

it.each([
  "BEGIN",
  "FROM writer_fence",
  "FROM project_state",
  "FROM command_idempotency",
  "SAVEPOINT",
  "UPDATE conformance_counter",
  "ROLLBACK TO",
  "RELEASE",
  "UPDATE project_state",
  "INSERT INTO command_receipts",
  "INSERT INTO command_idempotency",
  "INSERT INTO command_rejections",
  "INSERT INTO canonical_events",
  "second event",
  "handler",
  "configuration",
  "clock",
  "receipt ID",
  "event ID",
])("S5 G15 rolls back known settlement body faults at every mutation stage: %s", (stage) =>
  withComposedBodyFailure((f) => configureCompositionFault(f, stage)),
);

async function withComposedBodyFailure(
  configure: (f: Awaited<ReturnType<typeof createSettlementComposition>>) => void,
) {
  const f = await createSettlementComposition();
  try {
    await f.activate();
    configure(f);
    await expectComposedBodyFailure(f);
  } finally {
    await f.close();
  }
}

it.each(
  [
    "UPDATE conformance_counter",
    "UPDATE project_state",
    "INSERT INTO command_receipts",
    "INSERT INTO command_idempotency",
    "INSERT INTO command_rejections",
    "INSERT INTO canonical_events",
    "second event",
  ].flatMap((stage) => [0, 2].map((rowsAffected) => ({ stage, rowsAffected }))),
)(
  "S5 G15 rolls back known settlement body faults at every mutation stage: affected $stage/$rowsAffected",
  ({ stage, rowsAffected }) =>
    withComposedBodyFailure((f) => configureCompositionFault(f, stage, rowsAffected)),
);

it.each([
  "2026-09-05T12:00Z",
  "2026-09-05T12:00:00+00:00",
  "2026-09-05T12:00:00",
  "2026-02-30T12:00:00Z",
])("S5 G15 requires seconds in settlement clocks and persisted receipt instants: %s", (time) =>
  withComposedBodyFailure((f) => {
    f.dependencies.now.mockReturnValue(time);
  }),
);

it.each(
  (["createReceiptId", "createEventId"] as const).flatMap((factory) =>
    ["00000000-0000-0000-0000-000000000000", "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAA1", "invalid"].map(
      (value) => ({ factory, value }),
    ),
  ),
)(
  "S5 G15 rolls back known settlement body faults at every mutation stage: identity $factory/$value",
  ({ factory, value }) =>
    withComposedBodyFailure((f) => {
      f.dependencies[factory].mockReturnValue(value);
    }),
);

it.each(malformedHandlerDecisions)(
  "S5 G15 revokes handler capabilities and observes swallowed or unawaited SQL failure: malformed %s",
  (_name, mutate) => withComposedBodyFailure((f) => configureCompositionDecision(f, mutate)),
);

it.each(
  (["applied", "unchanged"] as const).flatMap((outcome) =>
    ["swallowed", "unawaited", "synchronous", "clone"].map((fault) => ({ outcome, fault })),
  ),
)(
  "S5 G15 revokes handler capabilities and observes swallowed or unawaited SQL failure: $outcome/$fault",
  ({ outcome, fault }) =>
    withComposedBodyFailure((f) => configureCompositionIssuedFailure(f, fault, outcome)),
);

it.each(["disabled", "duplicate", "alias"] as const)(
  "S5 G15 configures every canonical write connection and retains unfinished ownership: %s",
  (shape) => withComposedBodyFailure((f) => configureCompositionSettings(f, shape)),
);

it.each(["failure", "joined", "invalid-result"] as const)(
  "S5 G15 isolates settlement failure from unrelated pending requests: %s",
  async (kind) => {
    const f = await createSettlementComposition();
    await f.activate();
    const held = holdCompositionWork(f, "begin");
    const ordinary = settlementBarrier();
    f.controls.openBarrier = ordinary.promise;
    if (kind === "invalid-result") corruptCompositionResult(f);
    else configureCompositionFault(f, "handler");
    try {
      const request = { projectId: ProjectIdSchema.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2") };
      const opening = f.send(5, createProjectOpenCommand(f.metadata(5), request));
      await f.delivered(5);
      const first = f.execute();
      const joined = kind === "joined" ? f.execute(6) : undefined;
      await f.delivered(kind === "joined" ? 6 : 2);
      await held.ready;
      held.release();
      expect(await first).toEqual(settlementEvent(2, 2, "request.failure", internalFailure));
      const expected = [
        settlementEvent(1, 1, "project.activate.result", settlementActivation()),
        settlementEvent(2, 2, "request.failure", internalFailure),
      ];
      if (joined !== undefined) {
        const failure = settlementEvent(3, 6, "request.failure", internalFailure);
        expect(await joined).toEqual(failure);
        expected.push(failure);
      }
      expect(f.messages).toEqual(expected);
      ordinary.release();
      const sequence = kind === "joined" ? 4 : 3;
      expect(await opening).toEqual(
        settlementEvent(sequence, 5, "project.open.result", { status: "not-registered", request }),
      );
      if (kind !== "invalid-result") {
        const calls = [...f.calls];
        expect(await f.execute(4)).toEqual(
          settlementEvent(sequence + 1, 4, "project.command.result", unavailableCommand()),
        );
        expect(f.calls).toEqual(calls);
      }
      expect(JSON.stringify(f.messages)).not.toMatch(/private|secret-token|system.failure/);
    } finally {
      held.release();
      ordinary.release();
      await f.close();
    }
  },
);

it("S5 G15 revokes handler capabilities and observes swallowed or unawaited SQL failure: held successful UPDATE and switch", async () => {
  const f = await createSettlementComposition();
  await f.activate();
  f.calls.length = 0;
  const held = holdCompositionWork(f, "sql");
  const facade = captureUnawaitedComposition(f);
  try {
    const result = f.execute();
    await held.ready;
    await facade.returned;
    const calls = [...f.calls];
    expect(() => facade.execute()).toThrow("Canonical command transaction capability is revoked.");
    expect(f.calls).toEqual(calls);
    expect(
      calls.some((sql) =>
        /ROLLBACK TO|RELEASE|INSERT INTO|UPDATE project_state|commit|rollback|close/.test(sql),
      ),
    ).toBe(false);
    const switching = f.application.switchProject(settlementSwitch);
    expect(f.releases).toEqual([]);
    expect(f.clock).toHaveBeenCalledTimes(1);
    held.release();
    const receipt = { ...appliedReceipt, outcome: "unchanged", events: [] };
    expect(await result).toEqual(
      settlementEvent(2, 2, "project.command.result", settledCommand(settlementRequest, receipt)),
    );
    expect(await switching).toEqual({
      status: "target-result",
      request: settlementSwitch,
      target: settlementActivation(true),
    });
    expect(f.releases).toEqual(["repository", "lease", "storage"]);
    expect(() => facade.execute()).toThrow("Canonical command transaction capability is revoked.");
    const rows = await f.snapshot();
    expect(rows["conformance_counter"]).toEqual([
      [settlementRequest.projectId, "55555555-5555-4555-8555-555555555501", 0, 1],
    ]);
    expect(rows["canonical_events"]).toEqual([]);
    const replay = { ...settlementRequest, activationId: settlementNewEpoch };
    expect(await f.application.execute(replay)).toEqual(settledCommand(replay, receipt));
    expect(await f.snapshot()).toEqual(rows);
  } finally {
    held.release();
    await f.close();
  }
});

it.each(["before", "after", "lost", "close"] as const)(
  "S5 G15 blocks a Writer after settlement error without guessing commit outcome: %s",
  async (kind) => {
    const f = await createSettlementComposition();
    await f.activate();
    const fault = failCompositionCommit(f, kind);
    try {
      const pending = f.execute();
      if (kind === "lost") {
        await fault.ready;
        expectAppliedRows(await f.snapshot());
        expect(f.messages).toHaveLength(1);
        expect(f.releases).toEqual([]);
        fault.reject();
      }
      expect(await pending).toEqual(settlementEvent(2, 2, "request.failure", internalFailure));
      if (kind !== "before") expectAppliedRows(await f.snapshot());
      const calls = [...f.calls];
      expect(await f.execute(4)).toEqual(
        settlementEvent(3, 4, "project.command.result", unavailableCommand()),
      );
      expect(f.calls).toEqual(calls);
      expect(await f.application.switchProject(settlementSwitch)).toEqual({
        status: "target-result",
        request: settlementSwitch,
        target: settlementActivation(true),
      });
      expect(f.releases).toEqual(["repository", "lease", "storage"]);
    } finally {
      await f.close();
    }
  },
);

it.each(["held", "rejected", "false-success"] as const)(
  "S5 G15 drains settlement before retryable Writer release and retains failed transaction close: %s",
  async (mode) => {
    const f = await createSettlementComposition();
    await f.activate();
    const retained = retainCompositionClose(f, mode);
    try {
      expect(await f.execute()).toEqual(settlementEvent(2, 2, "request.failure", internalFailure));
      expectAppliedRows(await f.snapshot());
      expect(retained.driverClosed()).toBe(true);
      const beforeRelease = await f.snapshot();
      expect(await f.application.execute(settlementRequest)).toEqual(unavailableCommand());
      if (mode !== "held") await expectRetainedSwitchFailure(f, retained);
      const switching = f.application.switchProject(settlementSwitch);
      await retained.ready;
      expect(f.releases).toEqual([]);
      const calls = [...f.calls];
      expect(calls.at(-1)).toBe("close");
      expect(await f.snapshot()).toEqual(beforeRelease);
      expect(f.calls).toEqual(calls);
      retained.release();
      expect(await switching).toEqual({
        status: "target-result",
        request: settlementSwitch,
        target: settlementActivation(true),
      });
      expect(f.releases).toEqual(["repository", "lease", "storage"]);
      expect(retained.attempts()).toBe(mode === "held" ? 2 : 3);
      const request = { ...settlementRequest, activationId: settlementNewEpoch };
      expect(await f.application.execute(request)).toEqual(settledCommand(request, appliedReceipt));
    } finally {
      retained.release();
      await f.close();
    }
  },
);

async function expectRetainedSwitchFailure(
  f: Awaited<ReturnType<typeof createSettlementComposition>>,
  retained: ReturnType<typeof retainCompositionClose>,
) {
  expect(await f.application.switchProject(settlementSwitch)).toEqual({
    status: "release-failed",
    request: settlementSwitch,
    diagnostic: {
      code: "WRITER_FENCE_RELEASE_FAILED",
      message: "Project activation resources could not be released.",
      retryable: true,
    },
  });
  expect(retained.attempts()).toBe(2);
  const calls = [...f.calls];
  const stale = {
    ...settlementSwitch,
    from: { ...settlementSwitch.from, activationId: settlementNewEpoch },
  };
  expect(await f.application.switchProject(stale)).toEqual({
    status: "stale-activation",
    request: stale,
    diagnostic: {
      code: "PROJECT_ACTIVATION_STALE",
      message: "The switch source activation is stale.",
      retryable: false,
    },
  });
  expect(f.calls).toEqual(calls);
  expect(f.releases).toEqual([]);
}
