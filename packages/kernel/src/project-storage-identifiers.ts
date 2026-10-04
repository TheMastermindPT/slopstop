import { Schema } from "effect";
import type { DomainIdentity } from "./workspace-identifiers.js";

export type StorageId = DomainIdentity<"StorageId">;
export type StorageGenerationId = DomainIdentity<"StorageGenerationId">;
export type CanonicalDatabaseLineageId = DomainIdentity<"CanonicalDatabaseLineageId">;
export type RuntimeDatabaseLineageId = DomainIdentity<"RuntimeDatabaseLineageId">;
export type ProjectStorageCreateRequestId = DomainIdentity<"ProjectStorageCreateRequestId">;
export type ProjectActivationId = DomainIdentity<"ProjectActivationId">;
export type CommandId = DomainIdentity<"CommandId">;
export type CommandReceiptId = DomainIdentity<"CommandReceiptId">;
export type CanonicalEventId = DomainIdentity<"CanonicalEventId">;

const PositiveSafeIntegerSchema = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0));

export const WriterGenerationSchema = PositiveSafeIntegerSchema.pipe(
  Schema.brand("WriterGeneration"),
);
export type WriterGeneration = typeof WriterGenerationSchema.Type;

export const ProjectSequenceSchema = PositiveSafeIntegerSchema.pipe(
  Schema.brand("ProjectSequence"),
);
export type ProjectSequence = typeof ProjectSequenceSchema.Type;

export const CanonicalEventOrdinalSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
).pipe(Schema.brand("CanonicalEventOrdinal"));
export type CanonicalEventOrdinal = typeof CanonicalEventOrdinalSchema.Type;

export const isWriterGeneration = Schema.is(WriterGenerationSchema);
export const isProjectSequence = Schema.is(ProjectSequenceSchema);
export const isCanonicalEventOrdinal = Schema.is(CanonicalEventOrdinalSchema);
