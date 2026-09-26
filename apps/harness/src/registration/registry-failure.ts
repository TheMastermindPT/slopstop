import { z } from "zod";
import { storageErrorCode } from "../storage/project-storage-node-errors.js";

export const RegistryFailureSchema = z.union([
  z.strictObject({
    status: z.literal("broken"),
    code: z.enum(["REGISTRY_SCHEMA_UNKNOWN", "REGISTRY_SCHEMA_NEWER", "REGISTRY_CORRUPT"]),
  }),
  z.strictObject({ status: z.literal("unavailable"), code: z.literal("REGISTRY_BUSY") }),
  z.strictObject({
    status: z.literal("pending-recovery"),
    code: z.enum(["REGISTRY_MISSING_WITH_WITNESS", "OBSERVER_CLEANUP_UNCONFIRMED"]),
  }),
  z.strictObject({
    status: z.literal("rejected"),
    code: z.literal("REGISTRATION_IDEMPOTENCY_CONFLICT"),
  }),
]);

export type RegistryFailure = z.infer<typeof RegistryFailureSchema>;

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
  const code = storageErrorCode({ error });
  if (code === "SQLITE_BUSY" || code === "SQLITE_LOCKED") {
    return { status: "unavailable", code: "REGISTRY_BUSY" };
  }
  return { status: "broken", code: "INTERNAL_FAILURE" };
}
