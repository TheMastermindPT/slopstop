import { Schema } from "effect";
import {
  type CommandId,
  CommandReceiptMetadataSchema,
  ProjectActivationIdSchema,
  ProjectSequenceSchema,
  TypedCommandSchema,
  WriterGenerationSchema,
} from "./canonical-project-protocol.js";
import { ProjectIdSchema } from "./domain-identity-schema.js";
import { ProjectStorageCreateRequestIdSchema } from "./project-storage-protocol.js";
import { HarnessBootstrapSchema, MessageIdSchema } from "./protocol.js";
import { decodeStrict, frozenOutput } from "./schema-codec.js";

export const writerProofProjectId = decodeStrict(
  ProjectIdSchema,
  "00000000-0000-4000-8000-000000000101",
);
export const writerProofStaleProjectId = decodeStrict(
  ProjectIdSchema,
  "00000000-0000-4000-8000-000000000104",
);
export const writerProofStaleCreateRequestId = decodeStrict(
  ProjectStorageCreateRequestIdSchema,
  "00000000-0000-4000-8000-000000000114",
);
export const writerProofInactiveActivationId = decodeStrict(
  ProjectActivationIdSchema,
  "00000000-0000-4000-8000-000000000121",
);
export const writerProofFirstCommand = Object.freeze(
  decodeStrict(TypedCommandSchema, {
    commandId: "00000000-0000-4000-8000-000000000131",
    type: "conformance.writer.noop",
    version: 1,
    payload: Object.freeze({}),
  }),
);
export const writerProofNextCommand = Object.freeze(
  decodeStrict(TypedCommandSchema, {
    ...writerProofFirstCommand,
    commandId: "00000000-0000-4000-8000-000000000132",
  }),
);
export const writerProofStaleCommand = Object.freeze(
  decodeStrict(TypedCommandSchema, {
    ...writerProofFirstCommand,
    commandId: "00000000-0000-4000-8000-000000000133",
  }),
);

const smokeMessageIdSchema = MessageIdSchema.check(
  Schema.makeFilter(
    (value: string) =>
      (value !== "00000000-0000-0000-0000-000000000000" &&
        value !== "ffffffff-ffff-ffff-ffff-ffffffffffff") ||
      "Writer proof correlation must use a non-NIL, non-MAX message identity.",
  ),
);

export const WriterProofStartSchema = Schema.Struct({
  version: Schema.Literal(1),
  kind: Schema.Literal("writer-proof.connect"),
  proofId: smokeMessageIdSchema,
  bootstrap: HarnessBootstrapSchema,
});
export type WriterProofStart = typeof WriterProofStartSchema.Type;

const correlation = {
  version: Schema.Literal(1),
  proofId: smokeMessageIdSchema,
  requestId: smokeMessageIdSchema,
};

function expectedReceipt(commandId: CommandId, sequence: 1 | 2) {
  return frozenOutput(
    Schema.Struct({
      ...CommandReceiptMetadataSchema.fields,
      projectId: Schema.Literal(writerProofProjectId),
      commandId: Schema.Literal(commandId),
      commandType: Schema.Literal("conformance.writer.noop"),
      commandVersion: Schema.Literal(1),
      projectSequence: ProjectSequenceSchema.check(
        Schema.makeFilter((value: number) => value === sequence),
      ),
      writerGeneration: WriterGenerationSchema.check(
        Schema.makeFilter((value: number) => value === sequence),
      ),
      outcome: Schema.Literal("rejected"),
      events: frozenOutput(Schema.Tuple([])),
      rejection: frozenOutput(
        Schema.Struct({
          code: Schema.Literal("COMMAND_TYPE_UNSUPPORTED"),
          retryable: Schema.Literal(false),
        }),
      ),
    }),
  );
}

const firstExpectedReceiptSchema = expectedReceipt(writerProofFirstCommand.commandId, 1);
const nextExpectedReceiptSchema = expectedReceipt(writerProofNextCommand.commandId, 2);

export const WriterProofControlSchema = Schema.Union([
  Schema.Struct({
    ...correlation,
    kind: Schema.Literal("writer-proof.control"),
    step: Schema.Literal("stale.initialize"),
    stepNumber: Schema.Literal(1),
  }),
  Schema.Struct({
    ...correlation,
    kind: Schema.Literal("writer-proof.control"),
    step: Schema.Literal("stale.release"),
    stepNumber: Schema.Literal(2),
  }),
  Schema.Struct({
    ...correlation,
    kind: Schema.Literal("writer-proof.control"),
    step: Schema.Literal("stale.attempt"),
    stepNumber: Schema.Literal(3),
    replacementActivationId: ProjectActivationIdSchema,
    replacementWriterGeneration: Schema.Literal(2),
  }),
  Schema.Struct({
    ...correlation,
    kind: Schema.Literal("writer-proof.control"),
    step: Schema.Literal("stale.finish"),
    stepNumber: Schema.Literal(4),
  }),
  Schema.Struct({
    ...correlation,
    kind: Schema.Literal("writer-proof.control"),
    step: Schema.Literal("audit.initialize"),
    stepNumber: Schema.Literal(1),
    activationIds: Schema.Tuple([ProjectActivationIdSchema, ProjectActivationIdSchema]).check(
      Schema.makeFilter(([first, second]) => first !== second),
    ),
    expectedReceipts: Schema.Tuple([firstExpectedReceiptSchema, nextExpectedReceiptSchema]).check(
      Schema.makeFilter(([first, second]) => first.receiptId !== second.receiptId),
    ),
  }),
]);
export type WriterProofControl = typeof WriterProofControlSchema.Type;

export const WriterProofNativeTargetSchema = Schema.Literals([
  "win32-x64",
  "linux-x64",
  "linux-arm64",
  "darwin-x64",
  "darwin-arm64",
]);
export const writerProofNativePackageVersion = "1.5.1" as const;
export const writerProofNativeBindingFilename = "fs-native-extensions.node" as const;
export const WriterProofNativeMetadataSchema = Schema.Struct({
  packageName: Schema.Literal("fs-native-extensions"),
  packageVersion: Schema.Literal(writerProofNativePackageVersion),
  target: WriterProofNativeTargetSchema,
  unpackedTargetBinding: Schema.Literal(true),
  fallbackLoaded: Schema.Literal(false),
});

export const WriterProofEventSchema = Schema.Union([
  Schema.Struct({
    ...correlation,
    kind: Schema.Literal("writer-proof.result"),
    step: Schema.Literal("stale.initialize"),
    stepNumber: Schema.Literal(1),
    projectId: Schema.Literal(writerProofStaleProjectId),
    activationId: ProjectActivationIdSchema,
    writerGeneration: Schema.Literal(1),
    native: WriterProofNativeMetadataSchema,
  }),
  Schema.Struct({
    ...correlation,
    kind: Schema.Literal("writer-proof.result"),
    step: Schema.Literal("stale.release"),
    stepNumber: Schema.Literal(2),
    testLeaseReleased: Schema.Literal(true),
    oldWriterRetained: Schema.Literal(true),
  }),
  Schema.Struct({
    ...correlation,
    kind: Schema.Literal("writer-proof.result"),
    step: Schema.Literal("stale.attempt"),
    stepNumber: Schema.Literal(3),
    projectId: Schema.Literal(writerProofStaleProjectId),
    activationId: ProjectActivationIdSchema,
    commandId: Schema.Literal(writerProofStaleCommand.commandId),
    replacementActivationId: ProjectActivationIdSchema,
    replacementWriterGeneration: Schema.Literal(2),
    status: Schema.Literal("stale-writer"),
    code: Schema.Literal("WRITER_FENCE_STALE"),
    retryable: Schema.Literal(false),
    allCanonicalRowsUnchanged: Schema.Literal(true),
    registryCalls: Schema.Literal(0),
    handlerCalls: Schema.Literal(0),
    identityCalls: Schema.Literal(0),
    settlementClockCalls: Schema.Literal(0),
    writerClose: Schema.Literal("stale-refused"),
    operationalReleaseAuthorized: Schema.Literal(false),
  }).check(Schema.makeFilter((value) => value.activationId !== value.replacementActivationId)),
  Schema.Struct({
    ...correlation,
    kind: Schema.Literal("writer-proof.result"),
    step: Schema.Literal("stale.finish"),
    stepNumber: Schema.Literal(4),
    teardown: Schema.Literal("test-resources-only"),
  }),
  Schema.Struct({
    ...correlation,
    kind: Schema.Literal("writer-proof.result"),
    step: Schema.Literal("audit.initialize"),
    stepNumber: Schema.Literal(1),
    projectId: Schema.Literal(writerProofProjectId),
    audit: Schema.Literal("exact-ledger-and-abandoned-recovery"),
    lastProjectSequence: Schema.Literal(2),
    lastWriterGeneration: Schema.Literal(2),
    receipts: Schema.Literal(2),
    rejections: Schema.Literal(2),
    idempotency: Schema.Literal(2),
    events: Schema.Literal(0),
    generations: Schema.Literal(2),
    handoffs: Schema.Literal(2),
    abandonedRecoveryRecords: Schema.Literal(1),
    uncertainRecoveryRecords: Schema.Literal(0),
    fence: Schema.Literal("released"),
    native: WriterProofNativeMetadataSchema,
  }),
]);
export type WriterProofEvent = typeof WriterProofEventSchema.Type;
