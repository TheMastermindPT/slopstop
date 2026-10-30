import {
  RegistrationIdempotencyConflictSchema,
  RegistryBrokenCodeSchema,
  RegistryPendingRecoverySchema,
} from "@slopstop/protocol";
import { Data, Schema } from "effect";
import { ApplicationDatabaseFault } from "../storage/application-database-migration.js";
import { isSqliteBusy } from "../storage/project-storage-node-errors.js";

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

export class RegistryFault extends Data.TaggedError("RegistryFault")<{
  readonly message: string;
  readonly failure: RegistryFailure;
}> {
  constructor(failure: RegistryFailure) {
    super({ message: "Project registration registry refused the operation.", failure });
  }
}

/** The one answer for stored registry data that does not decode or does not agree. */
export const registryCorruptFailure = { status: "broken", code: "REGISTRY_CORRUPT" } as const;

/** The fault a Promise registry operation throws for stored registry data it cannot trust. */
export function registryCorrupt(): RegistryFault {
  return new RegistryFault(registryCorruptFailure);
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
