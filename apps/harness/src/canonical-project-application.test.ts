import type { CanonicalProjectSwitchResult } from "@slopstop/protocol";
import {
  CanonicalProjectActivationResultSchema,
  CanonicalProjectCommandRequestSchema,
  CanonicalProjectCommandResultSchema,
  CanonicalProjectSwitchRequestSchema,
  CanonicalProjectSwitchResultSchema,
} from "@slopstop/protocol";
import { describe, expect, it, vi } from "vitest";
import {
  switchApplicationFailures as switchFailures,
  switchResultBoundaries,
  switchApplicationResults as switchResults,
  switchApplicationTargets as switchTargets,
} from "../tests/integration/project-storage-create-fixture.js";
import * as applications from "./canonical-project-application.js";

const request = CanonicalProjectCommandRequestSchema.parse({
  projectId: "00000000-0000-4000-8000-000000000010",
  activationId: "00000000-0000-4000-8000-000000000011",
  command: {
    commandId: "00000000-0000-4000-8000-000000000012",
    type: "fixture.noop",
    version: 1,
    payload: {},
  },
});
const activation = CanonicalProjectActivationResultSchema.parse({
  status: "active",
  request: { projectId: request.projectId },
  access: "read-write",
  activationId: request.activationId,
  writerGeneration: 1,
});
const result = CanonicalProjectCommandResultSchema.parse({
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

const switchRequest = CanonicalProjectSwitchRequestSchema.parse({
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
    const { app, owner } = switchApplication(CanonicalProjectSwitchResultSchema.parse(value));
    expect(await app.switchProject(switchRequest)).toEqual(value);
    expect(owner.switchProject).toHaveBeenCalledExactlyOnceWith(switchRequest);
  });

  it("rejects every original switch request identity mismatch", async () => {
    const changed = CanonicalProjectSwitchResultSchema.parse(value);
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
    const changed = CanonicalProjectSwitchResultSchema.parse(value);
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
    const changed = CanonicalProjectSwitchResultSchema.parse({
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
    expect(CanonicalProjectSwitchResultSchema.parse(changed)).toEqual(changed);
    await invalidResult(() => app.switchProject(switchRequest));
  });
});

describe.each(switchFailures)("switch application retryability $name", ({ value }) => {
  it("rejects flipped switch-owned diagnostic retryability", async () => {
    const changed = CanonicalProjectSwitchResultSchema.parse(value);
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
      const changed = CanonicalProjectSwitchResultSchema.parse({
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
    CanonicalProjectSwitchResultSchema.parse({
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
