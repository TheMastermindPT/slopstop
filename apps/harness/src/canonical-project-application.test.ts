import {
  CanonicalProjectActivationResultSchema,
  CanonicalProjectCommandRequestSchema,
  CanonicalProjectCommandResultSchema,
} from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
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
}

it("validates canonical owner results without swallowing owner failures", async () => {
  const create = applications.createCanonicalProjectApplication;
  expect(create).toBeTypeOf("function");
  if (typeof create !== "function") throw new Error("Canonical application factory is missing.");
  const owner = {
    activate: vi.fn(async () => activation),
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
