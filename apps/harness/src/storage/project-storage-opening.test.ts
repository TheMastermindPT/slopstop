import {
  CanonicalDatabaseLineageIdSchema,
  ProjectStorageOpenRequestSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "@slopstop/protocol";
import { describe, expect, it, vi } from "vitest";
import {
  classifyProjectDatabaseProbe,
  classifyProjectStorageOpening,
  createOpeningRelease,
  openingVersionCompatibility,
  type ProjectDatabaseProbe,
} from "./project-storage-opening.js";

type PresentProbe = Extract<ProjectDatabaseProbe, { status: "present" }>;

it("retries only unfinished opening database closes", async () => {
  const failure = new Error("runtime close failed");
  const canonical = { close: vi.fn(async () => undefined) };
  const runtime = { close: vi.fn(async () => undefined).mockRejectedValueOnce(failure) };
  const slots: { canonical: typeof canonical | undefined; runtime: typeof runtime | undefined } = {
    canonical: undefined,
    runtime: undefined,
  };
  const release = createOpeningRelease(slots);
  slots.runtime = runtime;
  slots.canonical = canonical;
  const first = release();
  expect(release()).toBe(first);
  await expect(first).rejects.toMatchObject({
    message: "Project Storage database release failed.",
    errors: [failure],
  });
  await expect(release()).resolves.toBeUndefined();
  await expect(release()).resolves.toBeUndefined();
  expect(canonical.close).toHaveBeenCalledTimes(1);
  expect(runtime.close).toHaveBeenCalledTimes(2);
  const canonicalFailure = new Error("canonical close failed");
  const both = createOpeningRelease({
    canonical: {
      close: async () => {
        throw canonicalFailure;
      },
    },
    runtime: {
      close: async () => {
        throw failure;
      },
    },
  });
  await expect(both()).rejects.toMatchObject({ errors: [canonicalFailure, failure] });
  await expect(
    createOpeningRelease({ canonical: undefined, runtime: undefined })(),
  ).resolves.toBeUndefined();
});

function presentProbe(overrides: Partial<PresentProbe> = {}): PresentProbe {
  return {
    status: "present",
    identityMatches: true,
    format: "current",
    migration: "current",
    foreignKeysEnabled: true,
    foreignKeyViolationCount: 0,
    integrityRows: ["ok"],
    domainInvariantsValid: true,
    ...overrides,
  };
}

describe("Project database probe classification", () => {
  it("keeps corrupt and broken probe outcomes distinct", () => {
    expect(classifyProjectDatabaseProbe({ status: "corrupt" })).toEqual({
      status: "corrupt",
      diagnostic: {
        code: "DATABASE_CORRUPT",
        message: "Database integrity validation failed.",
      },
    });
    expect(classifyProjectDatabaseProbe({ status: "broken" })).toEqual({
      status: "broken",
      diagnostic: {
        code: "DATABASE_BROKEN",
        message: "Database authority is internally inconsistent.",
      },
    });
  });

  it("applies compatibility and integrity precedence exactly", () => {
    expect(
      classifyProjectDatabaseProbe(
        presentProbe({ identityMatches: false, format: "newer", integrityRows: [] }),
      ),
    ).toEqual({
      status: "identity-conflict",
      diagnostic: {
        code: "DATABASE_IDENTITY_CONFLICT",
        message: "Database identity does not agree.",
      },
    });
    expect(
      classifyProjectDatabaseProbe(presentProbe({ format: "newer", migration: "unknown" })),
    ).toEqual({
      status: "unsupported-newer",
      diagnostic: {
        code: "DATABASE_UNSUPPORTED_NEWER",
        message: "Database version is newer than supported.",
      },
    });
    expect(
      classifyProjectDatabaseProbe(
        presentProbe({ format: "known-older", foreignKeyViolationCount: 1 }),
      ),
    ).toEqual({
      status: "corrupt",
      diagnostic: {
        code: "DATABASE_CORRUPT",
        message: "Database integrity validation failed.",
      },
    });
    expect(classifyProjectDatabaseProbe(presentProbe({ migration: "unknown" }))).toEqual({
      status: "broken",
      diagnostic: {
        code: "DATABASE_BROKEN",
        message: "Database authority is internally inconsistent.",
      },
    });
  });

  it("rejects contradictory format and migration authority", () => {
    expect(
      openingVersionCompatibility({
        actual: { formatVersion: 0, schemaVersion: 0, lastMigrationId: "0001_current" },
        supported: { formatVersion: 1, schemaVersion: 1 },
        migrationIds: ["0000_initial", "0001_current"],
      }),
    ).toEqual({ format: "unknown", migration: "unknown" });
    expect(
      openingVersionCompatibility({
        actual: { formatVersion: 2, schemaVersion: 2, lastMigrationId: "0000_initial" },
        supported: { formatVersion: 1, schemaVersion: 1 },
        migrationIds: ["0000_initial", "0001_current"],
      }),
    ).toEqual({ format: "unknown", migration: "unknown" });
  });
});

it("retains the exact release handle for a selected blocked manifest", () => {
  const request = ProjectStorageOpenRequestSchema.parse({
    projectId: "00000000-0000-4000-8000-000000000010",
  });
  const release = vi.fn(async () => {});
  const identity = {
    storageId: StorageIdSchema.parse("00000000-0000-4000-8000-000000000012"),
    generationId: StorageGenerationIdSchema.parse("00000000-0000-4000-8000-000000000014"),
    canonicalDatabaseLineageId: CanonicalDatabaseLineageIdSchema.parse(
      "00000000-0000-4000-8000-000000000015",
    ),
    runtimeDatabaseLineageId: RuntimeDatabaseLineageIdSchema.parse(
      "00000000-0000-4000-8000-000000000016",
    ),
  };
  const classified = classifyProjectStorageOpening(request, {
    status: "selected-blocked",
    identity,
    manifestStatus: "broken",
    release,
  });

  expect(classified.result).toEqual({
    status: "safe-mode",
    request,
    mode: "safe-mode",
    identity,
    canonicalHealth: {
      status: "broken",
      diagnostic: {
        code: "DATABASE_BROKEN",
        message: "Database authority is internally inconsistent.",
      },
    },
    runtimeHealth: {
      status: "broken",
      diagnostic: {
        code: "DATABASE_BROKEN",
        message: "Database authority is internally inconsistent.",
      },
    },
  });
  expect("session" in classified).toBe(true);
  if (!("session" in classified)) throw new Error("Expected a retained blocked opening.");
  expect(classified.session).toEqual({ mode: "safe-mode", close: release });
});
