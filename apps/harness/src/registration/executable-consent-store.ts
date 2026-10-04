import { dateTimeTextSchema, decodeStrict, NonEmptyTextSchema } from "@slopstop/protocol";
import { Schema } from "effect";
import {
  type GitVersionInspectionRequest,
  GitVersionInspectionRequestSchema,
} from "../project-registration-observer.js";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { ExecutableIdentitySchema } from "./executable-identity.js";
import { registryRows } from "./registry-database.js";

const selectionRowsSchema = Schema.Array(
  Schema.Struct({
    ...ExecutableIdentitySchema.fields,
    selectionId: GitVersionInspectionRequestSchema.fields.selectionId,
    executablePath: NonEmptyTextSchema,
    capturedAt: dateTimeTextSchema(),
  }),
).check(Schema.isMaxLength(1));

const consentRowsSchema = Schema.Array(
  Schema.Struct({
    selectionId: GitVersionInspectionRequestSchema.fields.selectionId,
    decision: Schema.Literals(["accepted", "declined"]),
  }),
).check(Schema.isMaxLength(1));

export async function readSelection(transaction: LocalLibsqlTransaction, selectionId: string) {
  const result = await transaction.execute({
    sql: "SELECT selection_id AS selectionId, executable_path AS executablePath, platform, volume_identity AS volumeIdentity, file_identity AS fileIdentity, birth_identity AS birthIdentity, sha256, captured_at AS capturedAt FROM registration_executable_selections WHERE selection_id = ?",
    args: [selectionId],
  });
  const row = decodeStrict(selectionRowsSchema, registryRows(result))[0];
  if (row === undefined) return undefined;
  const { selectionId: id, executablePath, capturedAt, ...executableIdentity } = row;
  return { selectionId: id, executablePath, capturedAt, executableIdentity };
}

export async function readConsent(
  transaction: LocalLibsqlTransaction,
  consentId: GitVersionInspectionRequest["consentId"],
) {
  const result = await transaction.execute({
    sql: "SELECT selection_id AS selectionId, decision FROM registration_version_consents WHERE consent_id = ?",
    args: [consentId],
  });
  return decodeStrict(consentRowsSchema, registryRows(result))[0];
}
