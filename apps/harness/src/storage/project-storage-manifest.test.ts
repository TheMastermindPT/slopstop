import { describe, expect, it } from "vitest";
import {
  canonicalDatabaseFilename,
  parseProjectStorageManifest,
  runtimeDatabaseFilename,
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
  it("serializes the exact initial manifest and rejects non-v1 shapes", () => {
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
