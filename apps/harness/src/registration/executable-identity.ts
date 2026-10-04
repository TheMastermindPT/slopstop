import { Schema } from "effect";
import { PhysicalIdentitySchema, samePhysicalIdentity } from "./physical-identity.js";

export const ExecutableIdentitySchema = Schema.Struct({
  ...PhysicalIdentitySchema.fields,
  sha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
});

export type ExecutableIdentity = typeof ExecutableIdentitySchema.Type;

const ExecutableIdentityObservationSchema = Schema.Union([
  Schema.Struct({ status: Schema.Literal("observed"), identity: ExecutableIdentitySchema }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    code: Schema.Literals(["GIT_UNAVAILABLE", "IDENTITY_CAPABILITY_UNAVAILABLE"]),
  }),
  Schema.Struct({ status: Schema.Literal("broken"), code: Schema.Literal("INTERNAL_FAILURE") }),
]);

export type ExecutableIdentityObservation = typeof ExecutableIdentityObservationSchema.Type;

export function sameExecutableIdentity(
  left: ExecutableIdentity,
  right: ExecutableIdentity,
): boolean {
  return samePhysicalIdentity(left, right) && left.sha256 === right.sha256;
}
