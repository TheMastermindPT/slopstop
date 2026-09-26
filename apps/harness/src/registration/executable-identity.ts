import { z } from "zod";
import { PhysicalIdentitySchema, samePhysicalIdentity } from "./physical-identity.js";

export const ExecutableIdentitySchema = PhysicalIdentitySchema.extend({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export type ExecutableIdentity = z.infer<typeof ExecutableIdentitySchema>;

export const ExecutableIdentityObservationSchema = z.union([
  z.strictObject({ status: z.literal("observed"), identity: ExecutableIdentitySchema }),
  z.strictObject({
    status: z.literal("unavailable"),
    code: z.enum(["GIT_UNAVAILABLE", "IDENTITY_CAPABILITY_UNAVAILABLE"]),
  }),
  z.strictObject({ status: z.literal("broken"), code: z.literal("INTERNAL_FAILURE") }),
]);

export type ExecutableIdentityObservation = z.infer<typeof ExecutableIdentityObservationSchema>;

export function sameExecutableIdentity(
  left: ExecutableIdentity,
  right: ExecutableIdentity,
): boolean {
  return samePhysicalIdentity(left, right) && left.sha256 === right.sha256;
}
