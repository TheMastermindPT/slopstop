import { SchemaError } from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  canonicalDatabaseFilename,
  parseProjectStorageBackupManifest,
  parseProjectStorageManifest,
  runtimeDatabaseFilename,
  serializeProjectStorageBackupManifest,
  serializeProjectStorageManifest,
} from "./project-storage-manifest.js";

const applicationStorageRoot = "C:\\private\\slopstop";
const validInitialManifest = {
  manifestVersion: 1,
  projectId: "00000000-0000-4000-8000-000000000010",
  storageId: "00000000-0000-4000-8000-000000000abc",
  generationId: "00000000-0000-4000-8000-000000000013",
  provenance: {
    kind: "initial-create",
    createRequestId: "00000000-0000-4000-8000-000000000011",
    sourceGenerationId: null,
    storageOperationId: null,
  },
  canonical: {
    kind: "canonical",
    databaseLineageId: "00000000-0000-4000-8000-000000000014",
    filename: "slopstop.db",
    formatVersion: 1,
    schemaVersion: 1,
    lastMigrationId: "0000_initial",
    activationBaseline: {
      algorithm: "sha256",
      sizeBytes: 123,
      sha256: "a".repeat(64),
    },
  },
  runtime: {
    kind: "runtime",
    databaseLineageId: "00000000-0000-4000-8000-000000000015",
    filename: "mastra.db",
    adapterFormatVersion: 1,
    adapterSchemaVersion: 1,
    adapterLastMigrationId: "0000_initial",
    mastraMigrationHead: null,
    activationBaseline: {
      algorithm: "sha256",
      sizeBytes: 456,
      sha256: "b".repeat(64),
    },
  },
  projectSequence: 0,
  runtimeWaterline: 0,
  producingApplicationVersion: "0.0.0",
  createdAt: "2026-08-31T12:00:00.000Z",
};

function invalidIdentityManifests(): readonly unknown[] {
  const nilIdentity = "00000000-0000-0000-0000-000000000000";
  return [
    { ...validInitialManifest, projectId: "00000000-0000-4000-8000-00000000000A" },
    { ...validInitialManifest, storageId: validInitialManifest.storageId.toUpperCase() },
    { ...validInitialManifest, generationId: nilIdentity },
    {
      ...validInitialManifest,
      provenance: {
        ...validInitialManifest.provenance,
        createRequestId: "00000000-0000-4000-8000-00000000000B",
      },
    },
    {
      ...validInitialManifest,
      canonical: {
        ...validInitialManifest.canonical,
        databaseLineageId: nilIdentity,
      },
    },
    {
      ...validInitialManifest,
      runtime: {
        ...validInitialManifest.runtime,
        databaseLineageId: "00000000-0000-4000-8000-00000000000C",
      },
    },
  ];
}

function invalidProvenanceManifests(): readonly unknown[] {
  return [
    {
      ...validInitialManifest,
      provenance: {
        ...validInitialManifest.provenance,
        sourceGenerationId: "00000000-0000-4000-8000-000000000020",
      },
    },
    {
      ...validInitialManifest,
      provenance: {
        ...validInitialManifest.provenance,
        storageOperationId: "00000000-0000-4000-8000-000000000021",
      },
    },
  ];
}

function invalidDatabaseManifests(): readonly unknown[] {
  return [
    {
      ...validInitialManifest,
      canonical: { ...validInitialManifest.canonical, filename: "nested/slopstop.db" },
    },
    {
      ...validInitialManifest,
      runtime: { ...validInitialManifest.runtime, filename: "nested\\mastra.db" },
    },
    {
      ...validInitialManifest,
      canonical: {
        ...validInitialManifest.canonical,
        activationBaseline: {
          ...validInitialManifest.canonical.activationBaseline,
          sizeBytes: -1,
        },
      },
    },
    {
      ...validInitialManifest,
      runtime: {
        ...validInitialManifest.runtime,
        activationBaseline: {
          ...validInitialManifest.runtime.activationBaseline,
          sizeBytes: Number.MAX_SAFE_INTEGER + 1,
        },
      },
    },
    {
      ...validInitialManifest,
      canonical: {
        ...validInitialManifest.canonical,
        activationBaseline: {
          ...validInitialManifest.canonical.activationBaseline,
          sha256: "not-a-sha256",
        },
      },
    },
    {
      ...validInitialManifest,
      runtime: { ...validInitialManifest.runtime, mastraMigrationHead: "0000_initial" },
    },
  ];
}

function invalidInitialManifests(): readonly unknown[] {
  return [
    { ...validInitialManifest, manifestVersion: 2 },
    { ...validInitialManifest, projectSequence: 1 },
    { ...validInitialManifest, runtimeWaterline: 1 },
    { ...validInitialManifest, createdAt: "2026-08-31T12:00:00+01:00" },
    { ...validInitialManifest, unexpected: true },
    ...invalidIdentityManifests(),
    ...invalidProvenanceManifests(),
    ...invalidDatabaseManifests(),
  ];
}

describe("Project Storage manifest", () => {
  it("serializes the exact initial manifest and rejects invalid version-1 shapes", () => {
    const serialized = serializeProjectStorageManifest(validInitialManifest);
    const parsed = parseProjectStorageManifest(serialized);

    expect(serialized).toBe(`${JSON.stringify(validInitialManifest, null, 2)}\n`);
    expect(parsed).toEqual(validInitialManifest);
    expect(canonicalDatabaseFilename).toBe("slopstop.db");
    expect(runtimeDatabaseFilename).toBe("mastra.db");
    expect(parsed.provenance.sourceGenerationId).toBeNull();
    expect(parsed.provenance.storageOperationId).toBeNull();
    expect(parsed.runtime.mastraMigrationHead).toBeNull();
    expect(parsed.projectSequence).toBe(0);
    expect(parsed.runtimeWaterline).toBe(0);
    expect(serialized).not.toContain(applicationStorageRoot);

    for (const invalid of invalidInitialManifests()) {
      expect(() => serializeProjectStorageManifest(invalid)).toThrow();
    }
  });
});

const upgradeId = "00000000-0000-4000-8000-0000000000a1";
const validUpgradeManifest = {
  ...validInitialManifest,
  manifestVersion: 2,
  generationId: "00000000-0000-4000-8000-000000000024",
  provenance: {
    kind: "staged-upgrade",
    createRequestId: upgradeId,
    sourceGenerationId: validInitialManifest.generationId,
    storageOperationId: upgradeId,
  },
  projectSequence: 3,
  runtimeWaterline: 0,
  createdAt: "2026-10-05T10:00:00.000Z",
};

function invalidVersionedManifests(): readonly unknown[] {
  const { sourceGenerationId: _omitted, ...withoutSource } = validUpgradeManifest.provenance;
  return [
    { ...validUpgradeManifest, provenance: validInitialManifest.provenance },
    {
      ...validUpgradeManifest,
      provenance: {
        ...validUpgradeManifest.provenance,
        storageOperationId: "00000000-0000-4000-8000-0000000000a2",
      },
    },
    { ...validUpgradeManifest, provenance: withoutSource },
    { ...validUpgradeManifest, projectSequence: -1 },
    { ...validInitialManifest, projectSequence: 3 },
    { ...validUpgradeManifest, manifestVersion: 3 },
  ];
}

describe("Project Storage upgrade manifest", () => {
  it("parses and serializes version-2 upgrade manifests strictly", () => {
    const serialized = serializeProjectStorageManifest(validUpgradeManifest);

    expect(serialized).toBe(`${JSON.stringify(validUpgradeManifest, null, 2)}\n`);
    expect(serializeProjectStorageManifest(parseProjectStorageManifest(serialized))).toBe(
      serialized,
    );
    for (const invalid of invalidVersionedManifests()) {
      expect.soft(() => serializeProjectStorageManifest(invalid)).toThrow();
    }
  });
});

const validBackupManifest = {
  manifestVersion: 1,
  kind: "pre-upgrade-backup",
  backupId: upgradeId,
  projectId: validInitialManifest.projectId,
  storageId: validInitialManifest.storageId,
  sourceGenerationId: validInitialManifest.generationId,
  canonical: validInitialManifest.canonical,
  runtime: validInitialManifest.runtime,
  projectSequence: 3,
  runtimeWaterline: 0,
  producingApplicationVersion: "0.0.0",
  createdAt: "2026-10-05T10:00:00.000Z",
};

function invalidBackupManifests(): readonly unknown[] {
  const { sourceGenerationId: _omitted, ...withoutSource } = validBackupManifest;
  return [
    { ...validBackupManifest, manifestVersion: 2 },
    { ...validBackupManifest, kind: "initial-create" },
    { ...validBackupManifest, backupId: "not-a-uuid" },
    { ...validBackupManifest, projectSequence: -1 },
    { ...validBackupManifest, runtimeWaterline: 1.5 },
    { ...validBackupManifest, createdAt: "2026-10-05T10:00:00+01:00" },
    { ...validBackupManifest, applicationStorageRoot },
    withoutSource,
  ];
}

describe("Project Storage backup manifest", () => {
  it("parses and serializes pre-upgrade backup manifests strictly", () => {
    const serialized = serializeProjectStorageBackupManifest(validBackupManifest);

    expect(serialized).toBe(`${JSON.stringify(validBackupManifest, null, 2)}
`);
    expect(parseProjectStorageBackupManifest(serialized)).toEqual(validBackupManifest);
    for (const invalid of invalidBackupManifests()) {
      expect.soft(() => serializeProjectStorageBackupManifest(invalid)).toThrow(SchemaError);
      expect
        .soft(() => parseProjectStorageBackupManifest(JSON.stringify(invalid)))
        .toThrow(SchemaError);
    }
  });
});
