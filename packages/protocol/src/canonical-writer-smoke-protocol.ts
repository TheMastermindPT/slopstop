import { z } from "zod";
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

export const writerProofProjectId = ProjectIdSchema.parse("00000000-0000-4000-8000-000000000101");
export const writerProofStaleProjectId = ProjectIdSchema.parse(
  "00000000-0000-4000-8000-000000000104",
);
export const writerProofStaleCreateRequestId = ProjectStorageCreateRequestIdSchema.parse(
  "00000000-0000-4000-8000-000000000114",
);
export const writerProofInactiveActivationId = ProjectActivationIdSchema.parse(
  "00000000-0000-4000-8000-000000000121",
);
export const writerProofFirstCommand = Object.freeze(
  TypedCommandSchema.parse({
    commandId: "00000000-0000-4000-8000-000000000131",
    type: "conformance.writer.noop",
    version: 1,
    payload: Object.freeze({}),
  }),
);
export const writerProofNextCommand = Object.freeze(
  TypedCommandSchema.parse({
    ...writerProofFirstCommand,
    commandId: "00000000-0000-4000-8000-000000000132",
  }),
);
export const writerProofStaleCommand = Object.freeze(
  TypedCommandSchema.parse({
    ...writerProofFirstCommand,
    commandId: "00000000-0000-4000-8000-000000000133",
  }),
);

const smokeMessageIdSchema = MessageIdSchema.refine(
  (value) =>
    value !== "00000000-0000-0000-0000-000000000000" &&
    value !== "ffffffff-ffff-ffff-ffff-ffffffffffff",
  { message: "Writer proof correlation must use a non-NIL, non-MAX message identity." },
);

export const WriterProofStartSchema = z.strictObject({
  version: z.literal(1),
  kind: z.literal("writer-proof.connect"),
  proofId: smokeMessageIdSchema,
  bootstrap: HarnessBootstrapSchema,
});
export type WriterProofStart = z.infer<typeof WriterProofStartSchema>;

const correlation = {
  version: z.literal(1),
  proofId: smokeMessageIdSchema,
  requestId: smokeMessageIdSchema,
};

function expectedReceipt(commandId: CommandId, sequence: 1 | 2) {
  return CommandReceiptMetadataSchema.extend({
    projectId: z.literal(writerProofProjectId),
    commandId: z.literal(commandId),
    commandType: z.literal("conformance.writer.noop"),
    commandVersion: z.literal(1),
    projectSequence: ProjectSequenceSchema.refine((value) => value === sequence),
    writerGeneration: WriterGenerationSchema.refine((value) => value === sequence),
    outcome: z.literal("rejected"),
    events: z.tuple([]).readonly(),
    rejection: z
      .strictObject({
        code: z.literal("COMMAND_TYPE_UNSUPPORTED"),
        retryable: z.literal(false),
      })
      .readonly(),
  }).readonly();
}

export const WriterProofControlSchema = z.discriminatedUnion("step", [
  z.strictObject({
    ...correlation,
    kind: z.literal("writer-proof.control"),
    step: z.literal("stale.initialize"),
    stepNumber: z.literal(1),
  }),
  z.strictObject({
    ...correlation,
    kind: z.literal("writer-proof.control"),
    step: z.literal("stale.release"),
    stepNumber: z.literal(2),
  }),
  z.strictObject({
    ...correlation,
    kind: z.literal("writer-proof.control"),
    step: z.literal("stale.attempt"),
    stepNumber: z.literal(3),
    replacementActivationId: ProjectActivationIdSchema,
    replacementWriterGeneration: z.literal(2),
  }),
  z.strictObject({
    ...correlation,
    kind: z.literal("writer-proof.control"),
    step: z.literal("stale.finish"),
    stepNumber: z.literal(4),
  }),
  z.strictObject({
    ...correlation,
    kind: z.literal("writer-proof.control"),
    step: z.literal("audit.initialize"),
    stepNumber: z.literal(1),
    activationIds: z
      .tuple([ProjectActivationIdSchema, ProjectActivationIdSchema])
      .refine(([first, second]) => first !== second),
    expectedReceipts: z
      .tuple([
        expectedReceipt(writerProofFirstCommand.commandId, 1),
        expectedReceipt(writerProofNextCommand.commandId, 2),
      ])
      .refine(([first, second]) => first.receiptId !== second.receiptId),
  }),
]);
export type WriterProofControl = z.infer<typeof WriterProofControlSchema>;

export const WriterProofNativeTargetSchema = z.enum([
  "win32-x64",
  "linux-x64",
  "linux-arm64",
  "darwin-x64",
  "darwin-arm64",
]);
export const writerProofNativePackageVersion = "1.5.1" as const;
export const writerProofNativeBindingFilename = "fs-native-extensions.node" as const;
export const WriterProofNativeMetadataSchema = z.strictObject({
  packageName: z.literal("fs-native-extensions"),
  packageVersion: z.literal(writerProofNativePackageVersion),
  target: WriterProofNativeTargetSchema,
  unpackedTargetBinding: z.literal(true),
  fallbackLoaded: z.literal(false),
});

export const WriterProofEventSchema = z.discriminatedUnion("step", [
  z.strictObject({
    ...correlation,
    kind: z.literal("writer-proof.result"),
    step: z.literal("stale.initialize"),
    stepNumber: z.literal(1),
    projectId: z.literal(writerProofStaleProjectId),
    activationId: ProjectActivationIdSchema,
    writerGeneration: z.literal(1),
    native: WriterProofNativeMetadataSchema,
  }),
  z.strictObject({
    ...correlation,
    kind: z.literal("writer-proof.result"),
    step: z.literal("stale.release"),
    stepNumber: z.literal(2),
    testLeaseReleased: z.literal(true),
    oldWriterRetained: z.literal(true),
  }),
  z
    .strictObject({
      ...correlation,
      kind: z.literal("writer-proof.result"),
      step: z.literal("stale.attempt"),
      stepNumber: z.literal(3),
      projectId: z.literal(writerProofStaleProjectId),
      activationId: ProjectActivationIdSchema,
      commandId: z.literal(writerProofStaleCommand.commandId),
      replacementActivationId: ProjectActivationIdSchema,
      replacementWriterGeneration: z.literal(2),
      status: z.literal("stale-writer"),
      code: z.literal("WRITER_FENCE_STALE"),
      retryable: z.literal(false),
      allCanonicalRowsUnchanged: z.literal(true),
      registryCalls: z.literal(0),
      handlerCalls: z.literal(0),
      identityCalls: z.literal(0),
      settlementClockCalls: z.literal(0),
      writerClose: z.literal("stale-refused"),
      operationalReleaseAuthorized: z.literal(false),
    })
    .refine((value) => value.activationId !== value.replacementActivationId),
  z.strictObject({
    ...correlation,
    kind: z.literal("writer-proof.result"),
    step: z.literal("stale.finish"),
    stepNumber: z.literal(4),
    teardown: z.literal("test-resources-only"),
  }),
  z.strictObject({
    ...correlation,
    kind: z.literal("writer-proof.result"),
    step: z.literal("audit.initialize"),
    stepNumber: z.literal(1),
    projectId: z.literal(writerProofProjectId),
    audit: z.literal("exact-ledger-and-abandoned-recovery"),
    lastProjectSequence: z.literal(2),
    lastWriterGeneration: z.literal(2),
    receipts: z.literal(2),
    rejections: z.literal(2),
    idempotency: z.literal(2),
    events: z.literal(0),
    generations: z.literal(2),
    handoffs: z.literal(2),
    abandonedRecoveryRecords: z.literal(1),
    uncertainRecoveryRecords: z.literal(0),
    fence: z.literal("released"),
    native: WriterProofNativeMetadataSchema,
  }),
]);
export type WriterProofEvent = z.infer<typeof WriterProofEventSchema>;
