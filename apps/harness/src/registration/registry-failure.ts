import { Schema } from "effect";
import { ApplicationDatabaseFault } from "../storage/application-database-migration.js";
import { storageErrorCode } from "../storage/project-storage-node-errors.js";

export const RegistryFailureSchema = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("broken"),
    code: Schema.Literals(["REGISTRY_SCHEMA_UNKNOWN", "REGISTRY_SCHEMA_NEWER", "REGISTRY_CORRUPT"]),
  }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    code: Schema.Literal("REGISTRY_BUSY"),
  }),
  Schema.Struct({
    status: Schema.Literal("pending-recovery"),
    code: Schema.Literals(["REGISTRY_MISSING_WITH_WITNESS", "OBSERVER_CLEANUP_UNCONFIRMED"]),
  }),
  Schema.Struct({
    status: Schema.Literal("rejected"),
    code: Schema.Literal("REGISTRATION_IDEMPOTENCY_CONFLICT"),
  }),
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
  const code = storageErrorCode({ error });
  if (code === "SQLITE_BUSY" || code === "SQLITE_LOCKED") {
    return { status: "unavailable", code: "REGISTRY_BUSY" };
  }
  return { status: "broken", code: "INTERNAL_FAILURE" };
}
