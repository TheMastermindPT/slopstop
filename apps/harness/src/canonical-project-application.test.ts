import type {
  CanonicalProjectCommandResult,
  CanonicalProjectSwitchResult,
} from "@slopstop/protocol";
import {
  CanonicalProjectActivationResultSchema,
  CanonicalProjectCommandRequestSchema,
  CanonicalProjectCommandResultSchema,
  CanonicalProjectSwitchRequestSchema,
  CanonicalProjectSwitchResultSchema,
  decodeStrict,
} from "@slopstop/protocol";
import { describe, expect, it, vi } from "vitest";
import {
  switchApplicationFailures as switchFailures,
  switchResultBoundaries,
  switchApplicationResults as switchResults,
  switchApplicationTargets as switchTargets,
} from "../tests/integration/project-storage-create-fixture.js";
import type { ActiveProjectCoordinator } from "./active-project-coordinator.js";
import * as applications from "./canonical-project-application.js";

const request = decodeStrict(CanonicalProjectCommandRequestSchema, {
  projectId: "00000000-0000-4000-8000-000000000010",
  activationId: "00000000-0000-4000-8000-000000000011",
  command: {
    commandId: "00000000-0000-4000-8000-000000000012",
    type: "fixture.noop",
    version: 1,
    payload: {},
  },
});
const activation = decodeStrict(CanonicalProjectActivationResultSchema, {
  status: "active",
  request: { projectId: request.projectId },
  access: "read-write",
  activationId: request.activationId,
  writerGeneration: 1,
});
const result = decodeStrict(CanonicalProjectCommandResultSchema, {
  status: "inactive",
  projectId: request.projectId,
  activationId: request.activationId,
  commandId: request.command.commandId,
  diagnostic: {
    code: "PROJECT_INACTIVE",
    message: "No Project is active for Typed commands.",
    retryable: false,
  },
});
const otherId = "00000000-0000-4000-8000-000000000021";

function settledResult(outcome: "applied" | "unchanged" | "rejected" = "applied") {
  const parsed = decodeStrict(CanonicalProjectCommandResultSchema, {
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
      outcome,
      projectSequence: 1,
      writerGeneration: 1,
      settledAt: "2026-09-05T12:00:01.000Z",
      events:
        outcome === "applied"
          ? [{ eventId: "77777777-7777-4777-8777-777777777501", eventOrdinal: 0 }]
          : [],
      ...(outcome === "rejected"
        ? { rejection: { code: "TEST_COUNTER_REJECTED", retryable: false } }
        : {}),
    },
  });
  if (parsed.status !== "settled") throw new Error("Expected a settled fixture.");
  return structuredClone(parsed);
}

function commandApplication(value: CanonicalProjectCommandResult) {
  const owner = {
    activate: async () => activation,
    switchProject: unexpectedSwitch,
    execute: vi.fn<ActiveProjectCoordinator["execute"]>(async () => value),
    stop: vi.fn(async () => undefined),
  } satisfies ActiveProjectCoordinator;
  return { owner, app: applications.createCanonicalProjectApplication(owner) };
}

it.each(["applied", "unchanged", "rejected"] as const)(
  "G13 exact %s receipt with historical generation and time is valid (regression)",
  async (outcome) => {
    const value = settledResult(outcome);
    const current = structuredClone(request);
    Reflect.set(current, "activationId", "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2");
    Reflect.set(value, "activationId", current.activationId);
    const { app } = commandApplication(value);
    expect(await app.execute(current)).toEqual(value);
  },
);

it.each(["commandType", "commandVersion"] as const)(
  "G13 rejects schema-valid receipt %s not belonging to the original request",
  async (key) => {
    const value = settledResult();
    Reflect.set(value.receipt, key, key === "commandType" ? "fixture.other" : 2);
    expect(decodeStrict(CanonicalProjectCommandResultSchema, value)).toEqual(value);
    const { app } = commandApplication(value);
    await invalidResult(() => app.execute(request));
  },
);

it.each(["projectId", "commandId", "activationId"] as const)(
  "G13 rejects coherent outer and receipt %s drift (regression)",
  async (key) => {
    const value = settledResult();
    Reflect.set(value, key, otherId);
    if (key !== "activationId") Reflect.set(value.receipt, key, otherId);
    expect(decodeStrict(CanonicalProjectCommandResultSchema, value)).toEqual(value);
    const { app } = commandApplication(value);
    await invalidResult(() => app.execute(request));
  },
);

describe.each(["result", "receipt", "event", "rejection"] as const)(
  "G13 strict %s boundary (regression)",
  (boundary) => {
    it.each([
      "payload",
      "eventPayload",
      "commandFingerprint",
      "writerToken",
      "tokenDigest",
      "path",
      "cause",
      "error",
    ])("rejects private %s instead of stripping it", async (key) => {
      const value = settledResult(boundary === "rejection" ? "rejected" : "applied");
      const targets = {
        result: value,
        receipt: value.receipt,
        event: value.receipt.events[0],
        rejection: value.receipt.outcome === "rejected" ? value.receipt.rejection : undefined,
      };
      const target = targets[boundary];
      if (target === undefined) throw new Error("Missing strict boundary fixture.");
      Reflect.set(target, key, "private command C:\\private\\slopstop.db");
      const { app } = commandApplication(value);
      await invalidResult(() => app.execute(request));
    });
  },
);

it.each([
  ["receiptId", "66666666-6666-4666-8666-66666666650A"],
  ["receiptId", "00000000-0000-0000-0000-000000000000"],
  ["receiptId", "invalid"],
  ["projectId", otherId],
  ["commandId", otherId],
  ["projectSequence", 0],
  ["projectSequence", 0.5],
  ["projectSequence", Number.MAX_SAFE_INTEGER + 1],
  ["writerGeneration", 0],
  ["settledAt", "2026-09-05T12:00:01+00:00"],
  ["settledAt", "2026-09-05T12:00Z"],
  ["commandVersion", 0],
  ["commandVersion", -1],
] as const)("G13 malformed receipt %s=%s is sanitized (regression)", async (key, replacement) => {
  const value = settledResult();
  Reflect.set(value.receipt, key, replacement);
  const { app } = commandApplication(value);
  await invalidResult(() => app.execute(request));
});

it.each([
  "duplicate event",
  "ordinal gap",
  "events on unchanged",
  "events on rejected",
  "rejection on applied",
  "rejection on unchanged",
  "missing rejection",
])("G13 invalid outcome children %s fail strictly (regression)", async (change) => {
  const value = settledResult(
    change.includes("rejected") || change === "missing rejection"
      ? "rejected"
      : change.includes("unchanged")
        ? "unchanged"
        : "applied",
  );
  const event = { eventId: "77777777-7777-4777-8777-777777777501", eventOrdinal: 0 };
  if (change === "duplicate event")
    Reflect.set(value.receipt, "events", [event, { ...event, eventOrdinal: 1 }]);
  else if (change === "ordinal gap")
    Reflect.set(value.receipt, "events", [{ ...event, eventOrdinal: 1 }]);
  else if (change.startsWith("events on")) Reflect.set(value.receipt, "events", [event]);
  else if (change === "missing rejection") Reflect.deleteProperty(value.receipt, "rejection");
  else Reflect.set(value.receipt, "rejection", { code: "TEST_COUNTER_REJECTED", retryable: false });
  const { app } = commandApplication(value);
  await invalidResult(() => app.execute(request));
});

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

describe.each(["projectId", "activationId", "commandId", "type", "version"] as const)(
  "G13 immutable request %s",
  (key) => {
    it.each(["original", "mutated"] as const)(
      "binds a held %s receipt to the pre-await meaning",
      async (returned) => {
        const current = structuredClone(request);
        const value = settledResult();
        const hold = deferred<CanonicalProjectCommandResult>();
        const { app, owner } = commandApplication(value);
        owner.execute.mockImplementation(() => hold.promise);
        const pending = app.execute(current);
        const mutations = {
          projectId: {
            target: current,
            replacement: otherId,
            results: [
              [value, "projectId"],
              [value.receipt, "projectId"],
            ],
          },
          activationId: {
            target: current,
            replacement: otherId,
            results: [[value, "activationId"]],
          },
          commandId: {
            target: current.command,
            replacement: otherId,
            results: [
              [value, "commandId"],
              [value.receipt, "commandId"],
            ],
          },
          type: {
            target: current.command,
            replacement: "fixture.other",
            results: [[value.receipt, "commandType"]],
          },
          version: {
            target: current.command,
            replacement: 2,
            results: [[value.receipt, "commandVersion"]],
          },
        } as const;
        const mutation = mutations[key];
        Reflect.set(mutation.target, key, mutation.replacement);
        if (returned === "mutated") {
          for (const [target, field] of mutation.results)
            Reflect.set(target, field, mutation.replacement);
        }
        hold.resolve(value);
        if (returned === "original") expect(await pending).toEqual(value);
        else await invalidResult(() => pending);
        expect(owner.execute).toHaveBeenCalledOnce();
        expect(owner.execute.mock.calls[0]?.[0]).toBe(current);
      },
    );
  },
);

it("G13 preserves original non-durable correlation across caller mutation", async () => {
  const current = structuredClone(request);
  const hold = deferred<CanonicalProjectCommandResult>();
  const { app, owner } = commandApplication(result);
  owner.execute.mockImplementation(() => hold.promise);
  const pending = app.execute(current);
  Reflect.set(current, "projectId", otherId);
  Reflect.set(current, "activationId", otherId);
  Reflect.set(current.command, "commandId", otherId);
  hold.resolve(result);
  expect(await pending).toEqual(result);
});

it("G13 captures metadata before a synchronous owner mutation", async () => {
  const current = structuredClone(request);
  const value = settledResult();
  const { app, owner } = commandApplication(value);
  owner.execute.mockImplementation((received) => {
    Reflect.set(received.command, "type", "fixture.other");
    return Promise.resolve(value);
  });
  expect(await app.execute(current)).toEqual(value);
});

it("G13 does not read or serialize command payload before coordinator admission (regression)", async () => {
  const current = structuredClone(request);
  const readPayload = vi.fn(() => {
    throw new Error("Payload belongs to admitted Writer capture.");
  });
  Object.defineProperty(current.command, "payload", { enumerable: true, get: readPayload });
  const { app, owner } = commandApplication(result);
  expect(await app.execute(current)).toEqual(result);
  expect(readPayload).not.toHaveBeenCalled();
  expect(owner.execute.mock.calls[0]?.[0]).toBe(current);
});

it.each(["synchronous throw", "asynchronous rejection"] as const)(
  "G13 %s preserves owner sentinel identity (regression)",
  async (mode) => {
    const { app, owner } = commandApplication(result);
    const sentinel = new Error("C:\\private\\slopstop.db private command");
    if (mode === "synchronous throw")
      owner.execute.mockImplementation(() => {
        throw sentinel;
      });
    else owner.execute.mockRejectedValue(sentinel);
    await expect(app.execute(request)).rejects.toBe(sentinel);
  },
);

it.each([
  ["command-busy", "COMMAND_IN_PROGRESS", "Another command is in progress.", true],
  ["writer-unavailable", "WRITER_UNAVAILABLE", "The Writer requires explicit reactivation.", false],
  ["sequence-exhausted", "PROJECT_SEQUENCE_EXHAUSTED", "The Project sequence is exhausted.", false],
] as const)(
  "G13 non-durable %s validates exact diagnostic without a receipt (regression)",
  async (status, code, message, retryable) => {
    const value = decodeStrict(CanonicalProjectCommandResultSchema, {
      status,
      projectId: request.projectId,
      activationId: request.activationId,
      commandId: request.command.commandId,
      diagnostic: { code, message, retryable },
    });
    const { app, owner } = commandApplication(value);
    expect(await app.execute(request)).toEqual(value);
    for (const change of [
      { ...value, diagnostic: { code, message, retryable: !retryable } },
      { ...value, diagnostic: { code: "WRONG_CODE", message, retryable } },
      { ...value, receipt: settledResult().receipt },
    ]) {
      Reflect.set(owner, "execute", async () => change);
      await invalidResult(() => app.execute(request));
    }
  },
);

async function invalidResult(operation: () => Promise<unknown>): Promise<void> {
  const error: unknown = await operation().then(
    () => undefined,
    (cause: unknown) => cause,
  );
  expect(error).toBeInstanceOf(Error);
  if (!(error instanceof Error)) throw new Error("Expected a sanitized application error.");
  expect(error.name).toBe("CanonicalProjectApplicationError");
  expect(error.message).toBe("Canonical Project application returned an invalid result.");
  expect(error.cause).toBeUndefined();
  expect(Object.keys(error)).toEqual(["name"]);
  expect(error).toBeInstanceOf(applications.CanonicalProjectApplicationError);
  expect(Object.getOwnPropertyNames(error).sort()).toEqual(["message", "name", "stack"]);
}

async function unexpectedSwitch(): Promise<never> {
  throw new Error("Unexpected canonical Project switch in this fixture.");
}

it("validates canonical owner results without swallowing owner failures", async () => {
  const create = applications.createCanonicalProjectApplication;
  expect(create).toBeTypeOf("function");
  if (typeof create !== "function") throw new Error("Canonical application factory is missing.");
  const owner = {
    activate: vi.fn(async () => activation),
    switchProject: unexpectedSwitch,
    execute: vi.fn(async () => result),
    stop: vi.fn(async () => undefined),
  };
  const app = create(owner);
  expect(await app.activate({ projectId: request.projectId })).toEqual(activation);
  expect(await app.execute(request)).toEqual(result);
  for (const value of [
    { invalid: "secret command payload" },
    { ...activation, request: { projectId: otherId } },
  ]) {
    Reflect.set(owner, "activate", async () => value);
    await invalidResult(() => app.activate({ projectId: request.projectId }));
  }
  for (const value of [
    { ...result, writerToken: "private" },
    { ...result, projectId: otherId },
    { ...result, activationId: otherId },
    { ...result, commandId: otherId },
  ]) {
    Reflect.set(owner, "execute", async () => value);
    await invalidResult(() => app.execute(request));
  }
  for (const message of ["C:\\private\\project\\slopstop.db", "secret command payload"]) {
    const error = new Error(message);
    Reflect.set(owner, "activate", async () => {
      throw error;
    });
    Reflect.set(owner, "execute", async () => {
      throw error;
    });
    await expect(app.activate({ projectId: request.projectId })).rejects.toBe(error);
    await expect(app.execute(request)).rejects.toBe(error);
  }
  await app.stop();
  expect(owner.stop).toHaveBeenCalledOnce();
});

const switchRequest = decodeStrict(CanonicalProjectSwitchRequestSchema, {
  from: {
    projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    activationId: "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  },
  to: { projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
});
const projectC = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";
const newSourceEpoch = "eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";

function switchApplication(value: CanonicalProjectSwitchResult) {
  const owner = {
    activate: async () => activation,
    switchProject: vi.fn(async () => value),
    execute: async () => result,
    stop: async () => undefined,
  };
  const app = applications.createCanonicalProjectApplication(owner);
  const method: unknown = Reflect.get(app, "switchProject");
  expect(method, "Canonical application switch capability").toBeTypeOf("function");
  if (typeof method !== "function") throw new Error("Canonical application switch is missing.");
  return { app, owner };
}

describe.each(switchResults)("switch application $name", ({ value }) => {
  it("validates complete switch correlation and preserves owner exceptions", async () => {
    const { app, owner } = switchApplication(
      decodeStrict(CanonicalProjectSwitchResultSchema, value),
    );
    expect(await app.switchProject(switchRequest)).toEqual(value);
    expect(owner.switchProject).toHaveBeenCalledExactlyOnceWith(switchRequest);
  });

  it("rejects every original switch request identity mismatch", async () => {
    const changed = decodeStrict(CanonicalProjectSwitchResultSchema, value);
    const { app } = switchApplication(changed);
    for (const [parent, key, replacement] of [
      [changed.request.from, "projectId", projectC],
      [changed.request.from, "activationId", newSourceEpoch],
      [changed.request.to, "projectId", projectC],
    ] as const) {
      const original: unknown = Reflect.get(parent, key);
      Reflect.set(parent, key, replacement);
      await invalidResult(() => app.switchProject(switchRequest));
      Reflect.set(parent, key, original);
    }
  });

  it("rejects private fields instead of stripping them from switch results", async () => {
    const changed = decodeStrict(CanonicalProjectSwitchResultSchema, value);
    const { app } = switchApplication(changed);
    for (const boundary of switchResultBoundaries(changed)) {
      for (const key of [
        "extra",
        "writerToken",
        "tokenDigest",
        "canonicalDatabasePath",
        "writerLeasePath",
        "error",
        "cause",
      ]) {
        Reflect.set(boundary, key, "C:\\private\\project\\slopstop.db secret-token secret-digest");
        await invalidResult(() => app.switchProject(switchRequest));
        Reflect.deleteProperty(boundary, key);
      }
    }
  });
});

describe.each(switchTargets)("switch application target $name", ({ target }) => {
  it("rejects nested target mismatch and schema-valid joint destination mismatch", async () => {
    const changed = decodeStrict(CanonicalProjectSwitchResultSchema, {
      status: "target-result",
      request: switchRequest,
      target,
    });
    if (changed.status !== "target-result") throw new Error("Expected a target result fixture.");
    const { app } = switchApplication(changed);
    Reflect.set(changed.target.request, "projectId", switchRequest.from.projectId);
    await invalidResult(() => app.switchProject(switchRequest));
    Reflect.set(changed.request.to, "projectId", projectC);
    Reflect.set(changed.target.request, "projectId", projectC);
    expect(decodeStrict(CanonicalProjectSwitchResultSchema, changed)).toEqual(changed);
    await invalidResult(() => app.switchProject(switchRequest));
  });
});

describe.each(switchFailures)("switch application retryability $name", ({ value }) => {
  it("rejects flipped switch-owned diagnostic retryability", async () => {
    const changed = decodeStrict(CanonicalProjectSwitchResultSchema, value);
    if (changed.status === "target-result") throw new Error("Expected a switch failure fixture.");
    const { app } = switchApplication(changed);
    Reflect.set(changed.diagnostic, "retryable", !changed.diagnostic.retryable);
    await invalidResult(() => app.switchProject(switchRequest));
  });
});

describe.each(switchTargets.filter(({ target }) => "diagnostic" in target))(
  "switch application nested retryability $name",
  ({ name, target }) => {
    it("preserves legacy nested failure booleans and the fixed read-only literal", async () => {
      const changed = decodeStrict(CanonicalProjectSwitchResultSchema, {
        status: "target-result",
        request: switchRequest,
        target,
      });
      if (changed.status !== "target-result") throw new Error("Expected a target result fixture.");
      if (!("diagnostic" in changed.target)) throw new Error("Expected a diagnostic fixture.");
      const { app } = switchApplication(changed);
      Reflect.set(changed.target.diagnostic, "retryable", !changed.target.diagnostic.retryable);
      if (name === "B_RO") await invalidResult(() => app.switchProject(switchRequest));
      else expect(await app.switchProject(switchRequest)).toEqual(changed);
    });
  },
);

it("preserves the identical unexpected switch owner exception", async () => {
  const { app, owner } = switchApplication(
    decodeStrict(CanonicalProjectSwitchResultSchema, {
      status: "target-result",
      request: switchRequest,
      target: { status: "not-registered", request: switchRequest.to },
    }),
  );
  const sentinel = new Error("C:\\private\\project\\slopstop.db secret-token secret-digest");
  owner.switchProject.mockImplementation(() => {
    throw sentinel;
  });
  await expect(app.switchProject(switchRequest)).rejects.toBe(sentinel);
  owner.switchProject.mockRejectedValue(sentinel);
  await expect(app.switchProject(switchRequest)).rejects.toBe(sentinel);
});
