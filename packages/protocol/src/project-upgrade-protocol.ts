import { Schema } from "effect";
import { ProjectIdSchema } from "./domain-identity-schema.js";
import { type HarnessFailureCode, harnessFailureMessages } from "./harness-failure-protocol.js";
import {
  ProjectStorageCreateRequestIdSchema,
  StorageGenerationIdSchema,
} from "./project-storage-protocol.js";

/** A harness failure passed on inside an upgrade result: its own code and message, final. */
function harnessFailureRow<const Code extends HarnessFailureCode>(code: Code) {
  return { code, message: harnessFailureMessages[code], retryable: false } as const;
}

/**
 * Every (code, message, retryable) row a `project.upgrade` result can carry. Each producer —
 * the storage pipeline, the coordinator, the desktop bridge — answers with one of these rows.
 * `retryable` says whether the same request can succeed unchanged.
 */
export const projectUpgradeDiagnostics = {
  unsupported: {
    code: "PROJECT_UPGRADE_UNSUPPORTED",
    message: "This Project needs a database change that cannot run automatically.",
    retryable: false,
  },
  notEligible: {
    code: "PROJECT_UPGRADE_NOT_ELIGIBLE",
    message: "This Project's storage cannot be upgraded in its current state.",
    retryable: false,
  },
  backupInvalid: {
    code: "PROJECT_UPGRADE_BACKUP_INVALID",
    message: "The pre-upgrade backup failed its integrity check.",
    retryable: true,
  },
  verificationFailed: {
    code: "PROJECT_UPGRADE_VERIFICATION_FAILED",
    message: "The upgraded copy did not match the original data.",
    retryable: true,
  },
  alreadyActive: {
    code: "PROJECT_ALREADY_ACTIVE",
    message: "Close the active Project before upgrading.",
    retryable: false,
  },
  storageUnavailable: {
    code: "PROJECT_STORAGE_UNAVAILABLE",
    message: "Project Storage is unavailable.",
    retryable: true,
  },
  coordinatorStopped: {
    code: "PROJECT_COORDINATOR_UNAVAILABLE",
    message: "Canonical Project coordination is unavailable.",
    retryable: false,
  },
  connectionLost: {
    code: "PROJECT_COORDINATOR_UNAVAILABLE",
    message: "The Project connection is unavailable.",
    retryable: true,
  },
  storageBroken: {
    code: "PROJECT_STORAGE_BROKEN",
    message: "Project Storage upgrade failed.",
    retryable: false,
  },
  harnessInternalFailure: harnessFailureRow("HARNESS_INTERNAL_FAILURE"),
  protocolMessageInvalid: harnessFailureRow("PROTOCOL_MESSAGE_INVALID"),
  protocolVersionUnsupported: harnessFailureRow("PROTOCOL_VERSION_UNSUPPORTED"),
} as const;

type UpgradeDiagnosticRow =
  (typeof projectUpgradeDiagnostics)[keyof typeof projectUpgradeDiagnostics];
export type ProjectUpgradeDiagnostic = UpgradeDiagnosticRow;

/** One exact row: its code, message and retryability, nothing else. */
function rowSchema<const Row extends UpgradeDiagnosticRow>(row: Row) {
  return Schema.Struct({
    code: Schema.Literal(row.code),
    message: Schema.Literal(row.message),
    retryable: Schema.Literal(row.retryable),
  });
}

export const ProjectUpgradeRequestSchema = Schema.Struct({ projectId: ProjectIdSchema });
export type ProjectUpgradeRequest = typeof ProjectUpgradeRequestSchema.Type;

const base = { request: ProjectUpgradeRequestSchema };
const rows = projectUpgradeDiagnostics;

export const ProjectUpgradeResultSchema = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("upgraded"),
    ...base,
    sourceGenerationId: StorageGenerationIdSchema,
    generationId: StorageGenerationIdSchema,
    upgradeId: ProjectStorageCreateRequestIdSchema,
  }),
  Schema.Struct({ status: Schema.Literal("not-required"), ...base }),
  Schema.Struct({ status: Schema.Literal("not-registered"), ...base }),
  Schema.Struct({
    status: Schema.Literal("refused"),
    ...base,
    diagnostic: Schema.Union([rowSchema(rows.unsupported), rowSchema(rows.notEligible)]),
  }),
  Schema.Struct({
    status: Schema.Literal("failed"),
    ...base,
    diagnostic: Schema.Union([rowSchema(rows.backupInvalid), rowSchema(rows.verificationFailed)]),
  }),
  Schema.Struct({
    status: Schema.Literal("rejected"),
    ...base,
    diagnostic: rowSchema(rows.alreadyActive),
  }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    ...base,
    diagnostic: Schema.Union([
      rowSchema(rows.storageUnavailable),
      rowSchema(rows.coordinatorStopped),
      rowSchema(rows.connectionLost),
    ]),
  }),
  Schema.Struct({
    status: Schema.Literal("broken"),
    ...base,
    diagnostic: Schema.Union([
      rowSchema(rows.storageBroken),
      rowSchema(rows.harnessInternalFailure),
      rowSchema(rows.protocolMessageInvalid),
      rowSchema(rows.protocolVersionUnsupported),
    ]),
  }),
]);
export type ProjectUpgradeResult = typeof ProjectUpgradeResultSchema.Type;

/** Why an unfinished upgrade was discarded. */
export const ProjectUpgradeAbandonReasonSchema = Schema.Literals(["failed", "interrupted"]);
export type ProjectUpgradeAbandonReason = typeof ProjectUpgradeAbandonReasonSchema.Type;
/** Why an unfinished upgrade could not be discarded. */
export const ProjectUpgradeDiscardCauseSchema = Schema.Literals(["busy", "broken", "unproven"]);
export type ProjectUpgradeDiscardCause = typeof ProjectUpgradeDiscardCauseSchema.Type;

/** The `event` of each harness upgrade log line. */
export const harnessUpgradeLogEvents = {
  abandoned: "project-storage.upgrade.abandoned",
  discardFailed: "project-storage.upgrade.discard-failed",
} as const;

/**
 * Epoch milliseconds of years 0000 to 9999: every such instant has a four-digit-year RFC 3339
 * form, so the desktop can always write it as `harnessTime`.
 */
const EpochMillisecondsSchema = Schema.Number.check(
  Schema.isInt(),
  // 0000-01-01T00:00:00.000Z and 9999-12-31T23:59:59.999Z.
  Schema.isGreaterThanOrEqualTo(-62_167_219_200_000),
  Schema.isLessThanOrEqualTo(253_402_300_799_999),
);

const upgradeLogLineBase = {
  time: EpochMillisecondsSchema,
  service: Schema.Literal("harness"),
  projectId: ProjectIdSchema,
  upgradeId: ProjectStorageCreateRequestIdSchema,
};

/** Exactly what the harness logger serializes for one upgrade diagnostic, one JSON line each. */
export const HarnessUpgradeLogLineSchema = Schema.Union([
  Schema.Struct({
    ...upgradeLogLineBase,
    level: Schema.Literal(30),
    event: Schema.Literal(harnessUpgradeLogEvents.abandoned),
    reason: ProjectUpgradeAbandonReasonSchema,
  }),
  Schema.Struct({
    ...upgradeLogLineBase,
    level: Schema.Literal(40),
    event: Schema.Literal(harnessUpgradeLogEvents.discardFailed),
    cause: ProjectUpgradeDiscardCauseSchema,
  }),
]);
export type HarnessUpgradeLogLine = typeof HarnessUpgradeLogLineSchema.Type;
