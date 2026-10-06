import {
  CanonicalProjectActivationResultSchema,
  CanonicalProjectCommandRequestSchema,
  CanonicalProjectCommandResultSchema,
  decodeStrict,
} from "@slopstop/protocol";
import { vi } from "vitest";

/** An `upgrade` for fakes that never upgrade. */
export async function unusedProjectUpgrade(): Promise<never> {
  throw new Error("Project upgrade is unused by this fixture.");
}

export function unusedCanonicalApplication(switchProject: () => Promise<never>) {
  return {
    activate: async () => {
      throw new Error("Canonical activation is unused by this fixture.");
    },
    switchProject,
    execute: async () => {
      throw new Error("Canonical command is unused by this fixture.");
    },
    upgrade: unusedProjectUpgrade,
    stop: async () => undefined,
  };
}

function canonicalRuntimeInputs() {
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
  const activationResult = decodeStrict(CanonicalProjectActivationResultSchema, {
    status: "active",
    request: { projectId: request.projectId },
    access: "read-only",
    activationId: request.activationId,
    writerGeneration: null,
    diagnostic: {
      code: "WRITER_UNAVAILABLE",
      message: "Another SlopStop process holds Project write authority.",
      retryable: true,
    },
  });
  const commandResult = decodeStrict(CanonicalProjectCommandResultSchema, {
    status: "read-only",
    projectId: request.projectId,
    activationId: request.activationId,
    commandId: request.command.commandId,
    diagnostic: {
      code: "WRITER_UNAVAILABLE",
      message: "The active Project has no write authority.",
      retryable: true,
    },
  });
  return { request, activationResult, commandResult };
}

export function createCanonicalRuntimeApplicationFixture<Stop extends () => Promise<void>>(hooks: {
  switchProject: () => Promise<never>;
  stop: Stop;
  beforeActivate?: () => void;
  beforeExecute?: () => void;
}) {
  const inputs = canonicalRuntimeInputs();
  const application = {
    activate: vi.fn(async () => {
      hooks.beforeActivate?.();
      return inputs.activationResult;
    }),
    switchProject: hooks.switchProject,
    execute: vi.fn(async () => {
      hooks.beforeExecute?.();
      return inputs.commandResult;
    }),
    upgrade: unusedProjectUpgrade,
    stop: hooks.stop,
  };
  return { ...inputs, application };
}
