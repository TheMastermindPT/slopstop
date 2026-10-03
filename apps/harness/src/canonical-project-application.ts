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
  decodeStrictResult,
} from "@slopstop/protocol";
import { Result, type Schema } from "effect";
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

type CommandCorrelation = Pick<CanonicalProjectCommandRequest, "projectId" | "activationId"> & {
  command: Pick<CanonicalProjectCommandRequest["command"], "commandId" | "type" | "version">;
};

function commandMatches(
  result: CanonicalProjectCommandResult,
  request: CommandCorrelation,
): boolean {
  return [
    result.projectId === request.projectId,
    result.activationId === request.activationId,
    result.commandId === request.command.commandId,
    result.status !== "settled" ||
      [
        result.receipt.projectId === request.projectId,
        result.receipt.commandId === request.command.commandId,
        result.receipt.commandType === request.command.type,
        result.receipt.commandVersion === request.command.version,
      ].every(Boolean),
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
    execute: async (request) => {
      const expected: CommandCorrelation = {
        projectId: request.projectId,
        activationId: request.activationId,
        command: {
          commandId: request.command.commandId,
          type: request.command.type,
          version: request.command.version,
        },
      };
      return validatedResult(
        CanonicalProjectCommandResultSchema,
        await coordinator.execute(request),
        (result) => commandMatches(result, expected),
      );
    },
    stop: () => coordinator.stop(),
  };
}

function validatedResult<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  value: unknown,
  matches: (result: S["Type"]) => boolean,
): S["Type"] {
  const parsed = decodeStrictResult(schema, value);
  if (Result.isFailure(parsed)) throw new CanonicalProjectApplicationError();
  if (!matches(parsed.success)) throw new CanonicalProjectApplicationError();
  return parsed.success;
}
