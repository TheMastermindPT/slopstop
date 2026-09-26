import { z } from "zod";
import {
  type GitVersionInspectionRequest,
  GitVersionInspectionRequestSchema,
} from "../project-registration-observer.js";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { ExecutableIdentitySchema } from "./executable-identity.js";
import { registryRows } from "./registry-database.js";

const selectionRowSchema = ExecutableIdentitySchema.extend({
  selectionId: GitVersionInspectionRequestSchema.shape.selectionId,
  executablePath: z.string().min(1),
  capturedAt: z.iso.datetime(),
}).transform(({ selectionId, executablePath, capturedAt, ...executableIdentity }) => ({
  selectionId,
  executablePath,
  capturedAt,
  executableIdentity,
}));

const consentRowSchema = z.strictObject({
  selectionId: GitVersionInspectionRequestSchema.shape.selectionId,
  decision: z.enum(["accepted", "declined"]),
});

export async function readSelection(transaction: LocalLibsqlTransaction, selectionId: string) {
  const result = await transaction.execute({
    sql: "SELECT selection_id AS selectionId, executable_path AS executablePath, platform, volume_identity AS volumeIdentity, file_identity AS fileIdentity, birth_identity AS birthIdentity, sha256, captured_at AS capturedAt FROM registration_executable_selections WHERE selection_id = ?",
    args: [selectionId],
  });
  return selectionRowSchema.array().max(1).parse(registryRows(result))[0];
}

export async function readConsent(
  transaction: LocalLibsqlTransaction,
  consentId: GitVersionInspectionRequest["consentId"],
) {
  const result = await transaction.execute({
    sql: "SELECT selection_id AS selectionId, decision FROM registration_version_consents WHERE consent_id = ?",
    args: [consentId],
  });
  return consentRowSchema.array().max(1).parse(registryRows(result))[0];
}
