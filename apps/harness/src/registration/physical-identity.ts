import { z } from "zod";

const PhysicalNumberSchema = z.string().regex(/^[1-9][0-9]*$/);

export const PhysicalIdentitySchema = z.strictObject({
  platform: z.enum(["win32", "linux"]),
  volumeIdentity: PhysicalNumberSchema,
  fileIdentity: PhysicalNumberSchema,
  birthIdentity: PhysicalNumberSchema,
});

export const PhysicalDirectoryKeySchema = PhysicalIdentitySchema.extend({
  version: z.literal("physical-directory/v1"),
});

export type PhysicalIdentity = z.infer<typeof PhysicalIdentitySchema>;

export const RepositoryPhysicalSnapshotSchema = z.strictObject({
  physical: z.strictObject({
    worktree: PhysicalDirectoryKeySchema,
    gitDirectory: PhysicalDirectoryKeySchema,
    commonDirectory: PhysicalDirectoryKeySchema,
  }),
  metadataFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
});
export type RepositoryPhysicalSnapshot = z.infer<typeof RepositoryPhysicalSnapshotSchema>;

export function samePhysicalIdentity(left: PhysicalIdentity, right: PhysicalIdentity): boolean {
  return (
    left.platform === right.platform &&
    left.volumeIdentity === right.volumeIdentity &&
    left.fileIdentity === right.fileIdentity &&
    left.birthIdentity === right.birthIdentity
  );
}

export const RepositoryDirectoryObservationSchema = z.union([
  z.strictObject({ status: z.literal("observed"), key: PhysicalDirectoryKeySchema }),
  z.strictObject({
    status: z.literal("unavailable"),
    code: z.enum(["IDENTITY_CAPABILITY_UNAVAILABLE", "REPOSITORY_INACCESSIBLE"]),
  }),
  z.strictObject({
    status: z.literal("rejected"),
    code: z.enum(["REPOSITORY_NOT_FOUND", "OBSERVATION_INVALID"]),
  }),
  z.strictObject({ status: z.literal("broken"), code: z.literal("INTERNAL_FAILURE") }),
]);

export type RepositoryDirectoryObservation = z.infer<typeof RepositoryDirectoryObservationSchema>;
