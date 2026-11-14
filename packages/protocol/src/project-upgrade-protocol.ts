import { Schema } from "effect";
import { projectAvailabilityMessages as messages } from "./availability-messages.js";
import { ProjectIdSchema } from "./domain-identity-schema.js";
import { exactRowSchema, harnessFailureRow } from "./harness-failure-protocol.js";
import {
  ProjectStorageCreateRequestIdSchema,
  StorageGenerationIdSchema,
} from "./project-storage-protocol.js";

/**
 * Every (code, message, retryable) row a `project.upgrade` result can carry. Each producer —
 * the harness mapping of the storage outcome, the coordinator, the desktop bridge — answers
 * with one of these rows.
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
    message: messages.storageUnavailable,
    retryable: true,
  },
  coordinatorStopped: {
    code: "PROJECT_COORDINATOR_UNAVAILABLE",
    message: messages.coordinatorUnavailable,
    retryable: false,
  },
  connectionLost: {
    code: "PROJECT_COORDINATOR_UNAVAILABLE",
    message: messages.connectionLost,
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
  storageBusy: {
    code: "PROJECT_STORAGE_UNAVAILABLE",
    message: "Project Storage is busy; the upgrade can be retried.",
    retryable: true,
  },
} as const;

type UpgradeDiagnosticRow =
  (typeof projectUpgradeDiagnostics)[keyof typeof projectUpgradeDiagnostics];
export type ProjectUpgradeDiagnostic = UpgradeDiagnosticRow;

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
    diagnostic: Schema.Union([exactRowSchema(rows.unsupported), exactRowSchema(rows.notEligible)]),
  }),
  Schema.Struct({
    status: Schema.Literal("failed"),
    ...base,
    diagnostic: Schema.Union([
      exactRowSchema(rows.backupInvalid),
      exactRowSchema(rows.verificationFailed),
    ]),
  }),
  Schema.Struct({
    status: Schema.Literal("rejected"),
    ...base,
    diagnostic: exactRowSchema(rows.alreadyActive),
  }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    ...base,
    diagnostic: Schema.Union([
      exactRowSchema(rows.storageUnavailable),
      exactRowSchema(rows.storageBusy),
      exactRowSchema(rows.coordinatorStopped),
      exactRowSchema(rows.connectionLost),
    ]),
  }),
  Schema.Struct({
    status: Schema.Literal("broken"),
    ...base,
    diagnostic: Schema.Union([
      exactRowSchema(rows.storageBroken),
      exactRowSchema(rows.harnessInternalFailure),
      exactRowSchema(rows.protocolMessageInvalid),
      exactRowSchema(rows.protocolVersionUnsupported),
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
  completed: "project-storage.upgrade.completed",
  abandoned: "project-storage.upgrade.abandoned",
  discardFailed: "project-storage.upgrade.discard-failed",
} as const;

/**
 * Epoch milliseconds of years 0000 to 9999: every such instant has a four-digit-year RFC 3339
 * form, so the desktop can always write it as `harnessTime`.
 */
export const EpochMillisecondsSchema = Schema.Number.check(
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
    event: Schema.Literal(harnessUpgradeLogEvents.completed),
    sourceGenerationId: StorageGenerationIdSchema,
    targetGenerationId: StorageGenerationIdSchema,
  }),
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
