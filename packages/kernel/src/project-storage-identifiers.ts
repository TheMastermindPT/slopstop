import { Schema } from "effect";

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
