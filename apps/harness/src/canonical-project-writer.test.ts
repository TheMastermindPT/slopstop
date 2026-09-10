import {
  CanonicalCommandReceiptSchema,
  CanonicalProjectCommandRequestSchema,
  ProjectActivationIdSchema,
  ProjectIdSchema,
  WriterGenerationSchema,
} from "@slopstop/protocol";
import { describe, expect, it, vi } from "vitest";
import * as writers from "./canonical-project-writer.js";
import type { CanonicalCommandRepository } from "./storage/canonical-command-repository.js";
import type { CanonicalCommandSettlementResult } from "./storage/canonical-command-settlement.js";
import { CanonicalWriterLeaseError } from "./storage/canonical-writer-lease.js";

function submission() {
  return CanonicalProjectCommandRequestSchema.parse({
    projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    command: {
      commandId: "44444444-4444-4444-8444-444444444501",
      type: "conformance.counter.set",
      version: 1,
      payload: { value: 7, meta: { b: 2, a: 1 }, tags: ["x", "y"] },
    },
  });
}
const commandText =
  '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"meta":{"a":1,"b":2},"tags":["x","y"],"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}';
const receipt = CanonicalCommandReceiptSchema.parse({
  receiptId: "66666666-6666-4666-8666-666666666501",
  projectId: submission().projectId,
  commandId: submission().command.commandId,
  commandType: "conformance.counter.set",
  commandVersion: 1,
  outcome: "applied",
  projectSequence: 1,
  writerGeneration: 1,
  settledAt: "2026-09-05T12:00:01.000Z",
  events: [
    { eventId: "77777777-7777-4777-8777-777777777501", eventOrdinal: 0 },
    { eventId: "77777777-7777-4777-8777-777777777502", eventOrdinal: 1 },
  ],
});
function writerFixture(settle: CanonicalCommandRepository["settle"]) {
  const request = submission();
  const repository = {
    projectId: request.projectId,
    writerGeneration: WriterGenerationSchema.parse(2),
    settle: vi.fn(settle),
    verifyFence: vi.fn<CanonicalCommandRepository["verifyFence"]>(async () => ({
      status: "current",
    })),
    releaseFence: vi.fn(async (_time: string) => ({ status: "current" as const })),
    close: vi.fn(async () => undefined),
  };
  const lease = { release: vi.fn(async () => undefined) };
  const writer = writers.createCanonicalProjectWriter({
    ...request,
    ...repository,
    repository,
    lease,
  });
  return { request, repository, lease, writer };
}
function pendingResult(value: writers.CanonicalProjectWriterSubmission) {
  expect(value.status).toBe("pending");
  if (value.status !== "pending") throw new Error("Expected an admitted submission.");
  return value.result;
}
function expectedResult(status: "settled" | "stale-writer" | "sequence-exhausted") {
  const request = submission();
  const correlation = {
    projectId: request.projectId,
    activationId: request.activationId,
    commandId: request.command.commandId,
  };
  if (status === "settled") return { status, ...correlation, receipt };
  const diagnostic =
    status === "stale-writer"
      ? {
          code: "WRITER_FENCE_STALE",
          message: "The active Writer fence is stale.",
          retryable: false,
        }
      : {
          code: "PROJECT_SEQUENCE_EXHAUSTED",
          message: "The Project sequence is exhausted.",
          retryable: false,
        };
  return { status, ...correlation, diagnostic };
}

it.each(["settled", "stale-writer", "sequence-exhausted"] as const)(
  "G12 forwarding %s preserves exact repository outcome and synchronous snapshot",
  async (status) => {
    const outcome = status === "settled" ? { status, receipt } : { status };
    const { writer, request, repository } = writerFixture(async () => outcome);
    const pending = pendingResult(writer.settle(request.command));
    Reflect.set(request.command, "commandId", "44444444-4444-4444-8444-444444444502");
    Reflect.set(request.command, "type", "conformance.counter.other");
    Reflect.set(request.command, "version", 2);
    Reflect.set(request.command, "payload", { value: 8 });
    await expect(pending).resolves.toEqual(expectedResult(status));
    expect(repository.settle).toHaveBeenCalledExactlyOnceWith(commandText);
    expect(repository.verifyFence).not.toHaveBeenCalled();
    await writer.close("2026-09-05T12:00:04.000Z");
  },
);

function blockedResult(commandId: string, status: "command-busy" | "writer-unavailable") {
  const diagnostic =
    status === "command-busy"
      ? { code: "COMMAND_IN_PROGRESS", message: "Another command is in progress.", retryable: true }
      : {
          code: "WRITER_UNAVAILABLE",
          message: "The Writer requires explicit reactivation.",
          retryable: false,
        };
  return {
    status: "completed",
    result: {
      status,
      projectId: submission().projectId,
      activationId: submission().activationId,
      commandId,
      diagnostic,
    },
  };
}
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

it("G12 joins reordered exact canonical content with the identical result promise", async () => {
  const hold = deferred<CanonicalCommandSettlementResult>();
  const { writer, repository } = writerFixture(() => hold.promise);
  const first = pendingResult(writer.settle(submission().command));
  const reordered = submission().command;
  Reflect.set(reordered, "payload", { tags: ["x", "y"], meta: { a: 1, b: 2 }, value: 7 });
  const joined = pendingResult(writer.settle(reordered));
  hold.resolve({ status: "settled", receipt });
  expect(joined).toBe(first);
  await expect(first).resolves.toEqual(expectedResult("settled"));
  await expect(joined).resolves.toEqual(expectedResult("settled"));
  expect(repository.settle).toHaveBeenCalledExactlyOnceWith(commandText);
});

it.each(["payload", "commandId", "type", "version", "array"] as const)(
  "G12 busy %s refuses distinct work immediately with no backlog",
  async (change) => {
    const hold = deferred<CanonicalCommandSettlementResult>();
    const { writer, repository } = writerFixture(() => hold.promise);
    const first = pendingResult(writer.settle(submission().command));
    const other = submission().command;
    const changes = {
      payload: { value: 8, meta: { a: 1, b: 2 }, tags: ["x", "y"] },
      commandId: "44444444-4444-4444-8444-444444444502",
      type: "conformance.counter.other",
      version: 2,
      array: { value: 7, meta: { a: 1, b: 2 }, tags: ["y", "x"] },
    };
    Reflect.set(other, change === "array" ? "payload" : change, changes[change]);
    const refused = writer.settle(other);
    hold.resolve({ status: "settled", receipt });
    expect(refused).toEqual(blockedResult(other.commandId, "command-busy"));
    await first;
    expect(repository.settle).toHaveBeenCalledExactlyOnceWith(commandText);
    repository.settle.mockResolvedValue({ status: "stale-writer" });
    await pendingResult(writer.settle(other));
    expect(repository.settle).toHaveBeenCalledTimes(2);
  },
);

describe.each(["synchronous throw", "asynchronous rejection"] as const)(
  "G12 failure %s",
  (mode) => {
    function failedWriter() {
      const sentinel = new Error("private settlement failure");
      const callback: CanonicalCommandRepository["settle"] =
        mode === "synchronous throw"
          ? () => {
              throw sentinel;
            }
          : () => Promise.reject(sentinel);
      return { ...writerFixture(callback), sentinel };
    }
    it("preserves the original error for every exact joiner (regression)", async () => {
      const { writer, sentinel, repository } = failedWriter();
      const first = pendingResult(writer.settle(submission().command));
      const joined = pendingResult(writer.settle(submission().command));
      expect(joined).toBe(first);
      await expect(first).rejects.toBe(sentinel);
      await expect(joined).rejects.toBe(sentinel);
      expect(repository.settle).toHaveBeenCalledExactlyOnceWith(commandText);
    });
    it.each(["exact", "distinct", "unreadable payload"])(
      "blocks subsequent %s before repository or snapshot work",
      async (change) => {
        const { writer, sentinel, repository, lease } = failedWriter();
        await expect(pendingResult(writer.settle(submission().command))).rejects.toBe(sentinel);
        const next = submission().command;
        if (change === "distinct")
          Reflect.set(next, "commandId", "44444444-4444-4444-8444-444444444502");
        const readPayload = vi.fn(() => {
          throw new Error("Payload must not be read after failure.");
        });
        if (change === "unreadable payload")
          Object.defineProperty(next, "payload", { enumerable: true, get: readPayload });
        const actual = writer.settle(next);
        if (actual.status === "pending") void actual.result.catch(() => undefined);
        expect(actual).toEqual(blockedResult(next.commandId, "writer-unavailable"));
        expect(readPayload).not.toHaveBeenCalled();
        expect(repository.settle).toHaveBeenCalledOnce();
        expect(repository.verifyFence).not.toHaveBeenCalled();
        expect(repository.releaseFence).not.toHaveBeenCalled();
        expect(repository.close).not.toHaveBeenCalled();
        expect(lease.release).not.toHaveBeenCalled();
      },
    );
  },
);

it("G12 snapshot failure blocks the Writer without repository access", () => {
  const { writer, repository } = writerFixture(unexpectedSettlement);
  const invalid = submission().command;
  Reflect.set(invalid, "payload", { value: Number.NaN });
  expect(() => writer.settle(invalid)).toThrow();
  const actual = writer.settle(submission().command);
  if (actual.status === "pending") void actual.result.catch(() => undefined);
  expect(actual).toEqual(blockedResult(submission().command.commandId, "writer-unavailable"));
  expect(repository.settle).not.toHaveBeenCalled();
});

it.each(["exact", "distinct", "unreadable payload"])(
  "G12 close shuts %s admission in the calling stack",
  async (change) => {
    const hold = deferred<CanonicalCommandSettlementResult>();
    const { writer, repository } = writerFixture(() => hold.promise);
    const first = pendingResult(writer.settle(submission().command));
    const closing = writer.close("2026-09-05T12:00:04.000Z");
    expect(writer.close("2026-09-05T12:00:04.000Z")).toBe(closing);
    const next = submission().command;
    if (change === "distinct")
      Reflect.set(next, "commandId", "44444444-4444-4444-8444-444444444502");
    const readPayload = vi.fn(() => {
      throw new Error("Closed admission must not read payload.");
    });
    if (change === "unreadable payload")
      Object.defineProperty(next, "payload", { enumerable: true, get: readPayload });
    try {
      expect(writer.settle(next)).toEqual(blockedResult(next.commandId, "writer-unavailable"));
      expect(readPayload).not.toHaveBeenCalled();
    } finally {
      hold.resolve({ status: "settled", receipt });
      await first;
      await closing;
    }
    expect(repository.settle).toHaveBeenCalledOnce();
    expect(writer.settle(submission().command)).toEqual(
      blockedResult(submission().command.commandId, "writer-unavailable"),
    );
  },
);

it.each(["success", "failure"] as const)(
  "G12 close drains accepted %s and joiners before any release stage",
  async (outcome) => {
    const hold = deferred<CanonicalCommandSettlementResult>();
    const started = deferred<void>();
    const { writer, repository, lease } = writerFixture(() => {
      started.resolve();
      return hold.promise;
    });
    const log: string[] = [];
    repository.releaseFence.mockImplementation(async (time) => {
      expect(time).toBe("2026-09-05T12:00:04.000Z");
      log.push("fence");
      return { status: "current" };
    });
    repository.close.mockImplementation(async () => {
      log.push("repository");
    });
    lease.release.mockImplementation(async () => {
      log.push("lease");
    });
    const first = pendingResult(writer.settle(submission().command));
    const joined = pendingResult(writer.settle(submission().command));
    const sentinel = new Error("private cleanup failure");
    const observed = Promise.allSettled([first, joined]);
    const closing = writer.close("2026-09-05T12:00:04.000Z");
    expect(writer.close("2026-09-05T12:00:04.000Z")).toBe(closing);
    await started.promise;
    const before = [...log];
    if (outcome === "success") hold.resolve({ status: "settled", receipt });
    else hold.reject(sentinel);
    const results = await observed;
    await closing;
    expect(before).toEqual([]);
    expect(log).toEqual(["fence", "repository", "lease"]);
    const expected =
      outcome === "success"
        ? { status: "fulfilled", value: expectedResult("settled") }
        : { status: "rejected", reason: sentinel };
    expect(results).toEqual([expected, expected]);
    if (outcome === "failure") {
      await expect(first).rejects.toBe(sentinel);
      await expect(joined).rejects.toBe(sentinel);
    }
    expect(writer.close("2026-09-05T12:00:06.000Z")).toBe(closing);
  },
);

it.each(["current", "stale", "broken"] as const)(
  "G12 legacy direct verification %s remains unchanged",
  async (status) => {
    const { writer, repository } = writerFixture(unexpectedSettlement);
    repository.verifyFence.mockImplementation(async () => {
      if (status === "broken") throw new Error("private fence failure");
      return { status };
    });
    expect(await writer.verifyFence()).toEqual(
      status === "broken" ? { status, code: "WRITER_FENCE_CHECK_FAILED" } : { status },
    );
    expect(repository.settle).not.toHaveBeenCalled();
  },
);

async function unexpectedSettlement(): Promise<never> {
  throw new Error("Unexpected lifecycle settlement.");
}

it("refuses stale fences and preserves native close failure", async () => {
  const create = writers.createCanonicalProjectWriter;
  expect(create).toBeTypeOf("function");
  if (typeof create !== "function") throw new Error("Writer factory is missing.");
  for (const scenario of [
    {
      status: "stale",
      code: "WRITER_FENCE_STALE",
      fenceCount: 2,
      repositoryCount: 0,
      leaseCount: 0,
    },
    {
      status: "current",
      code: "WRITER_LEASE_CLOSE_FAILED",
      fenceCount: 1,
      repositoryCount: 1,
      leaseCount: 2,
    },
  ] as const) {
    const { status, code } = scenario;
    const projectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000010");
    const writerGeneration = WriterGenerationSchema.parse(1);
    const repository = {
      projectId,
      writerGeneration,
      settle: unexpectedSettlement,
      verifyFence: async () => ({ status }),
      releaseFence: vi.fn(async () => ({ status })),
      close: vi.fn(async () => undefined),
    };
    const lease = {
      release: vi.fn(async () => {
        throw new CanonicalWriterLeaseError("WRITER_LEASE_CLOSE_FAILED");
      }),
    };
    const writer = create({
      projectId,
      writerGeneration,
      activationId: ProjectActivationIdSchema.parse("00000000-0000-4000-8000-000000000011"),
      repository,
      lease,
    });
    await expect(writer.close("2026-09-04T12:01:00.000Z")).rejects.toMatchObject({ code });
    await expect(writer.close("2026-09-04T12:01:00.000Z")).rejects.toMatchObject({ code });
    expect(repository.releaseFence).toHaveBeenCalledTimes(scenario.fenceCount);
    expect(repository.close).toHaveBeenCalledTimes(scenario.repositoryCount);
    expect(lease.release).toHaveBeenCalledTimes(scenario.leaseCount);
  }
});

it("retains failed release ownership and resumes cleanup on stop retry", async () => {
  const create = writers.createCanonicalProjectWriter;
  expect(create).toBeTypeOf("function");
  if (typeof create !== "function") throw new Error("Writer factory is missing.");
  for (const stage of ["fence", "repository", "lease"] as const) {
    const calls: string[] = [];
    let fail = true;
    const touch = (current: string) => {
      calls.push(current);
      if (fail && stage === current) {
        fail = false;
        throw new Error("failure");
      }
    };
    const projectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000010");
    const writerGeneration = WriterGenerationSchema.parse(1);
    const repository = {
      projectId,
      writerGeneration,
      settle: unexpectedSettlement,
      verifyFence: vi.fn(async () => ({ status: "current" as const })),
      releaseFence: vi.fn(async () => {
        touch("fence");
        return { status: "current" as const };
      }),
      close: vi.fn(async () => {
        touch("repository");
      }),
    };
    const lease = {
      release: vi.fn(async () => {
        try {
          touch("lease");
        } catch {
          throw new CanonicalWriterLeaseError("WRITER_LEASE_UNLOCK_FAILED");
        }
      }),
    };
    const writer = create({
      projectId,
      writerGeneration,
      activationId: ProjectActivationIdSchema.parse("00000000-0000-4000-8000-000000000011"),
      repository,
      lease,
    });
    const first = writer.close("2026-09-04T12:01:00.000Z");
    expect(writer.close("2026-09-04T12:01:00.000Z")).toBe(first);
    const codes = {
      fence: "WRITER_FENCE_RELEASE_FAILED",
      repository: "WRITER_REPOSITORY_CLOSE_FAILED",
      lease: "WRITER_LEASE_UNLOCK_FAILED",
    };
    await expect(first).rejects.toMatchObject({ code: codes[stage] });
    await writer.close("2026-09-04T12:01:00.000Z");
    await writer.close("2026-09-04T12:01:00.000Z");
    const expected = {
      fence: ["fence", "fence", "repository", "lease"],
      repository: ["fence", "repository", "repository", "lease"],
      lease: ["fence", "repository", "lease", "lease"],
    };
    expect(calls).toEqual(expected[stage]);
  }
});
