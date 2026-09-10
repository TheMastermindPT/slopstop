import type {
  CanonicalProjectActivationRequest,
  CanonicalProjectActivationResult,
  CanonicalProjectCommandRequest,
  CanonicalProjectCommandResult,
  CanonicalProjectSwitchRequest,
  CanonicalProjectSwitchResult,
} from "@slopstop/protocol";
import {
  CanonicalProjectActivationResultSchema,
  CanonicalProjectCommandResultSchema,
  CanonicalProjectSwitchResultSchema,
} from "@slopstop/protocol";
import type { z } from "zod";
import type { ActiveProjectCoordinator } from "./active-project-coordinator.js";
export interface CanonicalProjectApplication {
  activate(request: CanonicalProjectActivationRequest): Promise<CanonicalProjectActivationResult>;
  switchProject(request: CanonicalProjectSwitchRequest): Promise<CanonicalProjectSwitchResult>;
  execute(request: CanonicalProjectCommandRequest): Promise<CanonicalProjectCommandResult>;
  stop(): Promise<void>;
}
export class CanonicalProjectApplicationError extends Error {
  override readonly name = "CanonicalProjectApplicationError";
  constructor() {
    super("Canonical Project application returned an invalid result.");
  }
}

function commandMatches(
  result: CanonicalProjectCommandResult,
  request: CanonicalProjectCommandRequest,
): boolean {
  return [
    result.projectId === request.projectId,
    result.activationId === request.activationId,
    result.commandId === request.command.commandId,
  ].every(Boolean);
}

export function createCanonicalProjectApplication(
  coordinator: ActiveProjectCoordinator,
): CanonicalProjectApplication {
  return {
    activate: async (request) =>
      validatedResult(
        CanonicalProjectActivationResultSchema,
        await coordinator.activate(request),
        (result) => result.request.projectId === request.projectId,
      ),
    switchProject: async (request) =>
      validatedResult(
        CanonicalProjectSwitchResultSchema,
        await coordinator.switchProject(request),
        (result) =>
          [
            result.request.from.projectId === request.from.projectId,
            result.request.from.activationId === request.from.activationId,
            result.request.to.projectId === request.to.projectId,
          ].every(Boolean),
      ),
    execute: async (request) =>
      validatedResult(
        CanonicalProjectCommandResultSchema,
        await coordinator.execute(request),
        (result) => commandMatches(result, request),
      ),
    stop: () => coordinator.stop(),
  };
}

function validatedResult<Result>(
  schema: z.ZodType<Result>,
  value: unknown,
  matches: (result: Result) => boolean,
): Result {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new CanonicalProjectApplicationError();
  if (!matches(parsed.data)) throw new CanonicalProjectApplicationError();
  return parsed.data;
}
