import { Schema } from "effect";

const PhysicalNumberSchema = Schema.String.check(Schema.isPattern(/^[1-9][0-9]*$/));

const physicalIdentityFields = {
  platform: Schema.Literals(["win32", "linux"]),
  volumeIdentity: PhysicalNumberSchema,
  fileIdentity: PhysicalNumberSchema,
  birthIdentity: PhysicalNumberSchema,
};

export const PhysicalIdentitySchema = Schema.Struct(physicalIdentityFields);

export const PhysicalDirectoryKeySchema = Schema.Struct({
  ...physicalIdentityFields,
  version: Schema.Literal("physical-directory/v1"),
});

export type PhysicalIdentity = typeof PhysicalIdentitySchema.Type;

export const RepositoryPhysicalSnapshotSchema = Schema.Struct({
  physical: Schema.Struct({
    worktree: PhysicalDirectoryKeySchema,
    gitDirectory: PhysicalDirectoryKeySchema,
    commonDirectory: PhysicalDirectoryKeySchema,
  }),
  metadataFingerprint: Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/)),
});
export type RepositoryPhysicalSnapshot = typeof RepositoryPhysicalSnapshotSchema.Type;

export function samePhysicalIdentity(left: PhysicalIdentity, right: PhysicalIdentity): boolean {
  return (
    left.platform === right.platform &&
    left.volumeIdentity === right.volumeIdentity &&
    left.fileIdentity === right.fileIdentity &&
    left.birthIdentity === right.birthIdentity
  );
}

const RepositoryDirectoryObservationSchema = Schema.Union([
  Schema.Struct({ status: Schema.Literal("observed"), key: PhysicalDirectoryKeySchema }),
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    code: Schema.Literals(["IDENTITY_CAPABILITY_UNAVAILABLE", "REPOSITORY_INACCESSIBLE"]),
  }),
  Schema.Struct({
    status: Schema.Literal("rejected"),
    code: Schema.Literals(["REPOSITORY_NOT_FOUND", "OBSERVATION_INVALID"]),
  }),
  Schema.Struct({ status: Schema.Literal("broken"), code: Schema.Literal("INTERNAL_FAILURE") }),
]);

export type RepositoryDirectoryObservation = typeof RepositoryDirectoryObservationSchema.Type;
