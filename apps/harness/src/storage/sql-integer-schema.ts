import { Schema, SchemaTransformation } from "effect";

const SafeIntegerSchema = Schema.Number.check(Schema.isInt());

// SQLite integers arrive as numbers or bigints; both decode to one safe integer.
export const SqlIntegerSchema = Schema.Union([SafeIntegerSchema, Schema.BigInt]).pipe(
  Schema.decodeTo(
    SafeIntegerSchema,
    SchemaTransformation.transform<number, number | bigint>({
      decode: (value) => Number(value),
      encode: (value) => value,
    }),
  ),
);
