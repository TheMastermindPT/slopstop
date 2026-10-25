import {
  RegistrationIdempotencyConflictSchema,
  RegistryBrokenCodeSchema,
  RegistryPendingRecoverySchema,
} from "@slopstop/protocol";
import { Schema } from "effect";
import { ApplicationDatabaseFault } from "../storage/application-database-migration.js";
import { isSqliteBusy } from "../storage/sqlite-busy.js";

export const RegistryFailureSchema = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("broken"),
    code: RegistryBrokenCodeSchema,
  }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    code: Schema.Literal("REGISTRY_BUSY"),
  }),
  RegistryPendingRecoverySchema,
  RegistrationIdempotencyConflictSchema,
]);

export type RegistryFailure = typeof RegistryFailureSchema.Type;

export class RegistryFault extends Error {
  constructor(readonly failure: RegistryFailure) {
    super("Project registration registry refused the operation.");
    this.name = "RegistryFault";
  }
}

export function registryFailure(
  error: unknown,
): RegistryFailure | { status: "broken"; code: "INTERNAL_FAILURE" } {
  if (error instanceof RegistryFault) return error.failure;
  if (error instanceof ApplicationDatabaseFault) return error.failure;
  if (isSqliteBusy(error)) {
    return { status: "unavailable", code: "REGISTRY_BUSY" };
  }
  return { status: "broken", code: "INTERNAL_FAILURE" };
}
