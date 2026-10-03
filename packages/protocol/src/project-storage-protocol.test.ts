import { describe, expect, it } from "vitest";
import { decodeWithIssues } from "./decode-with-issues.test-support.js";
import {
  acceptsStrict,
  CanonicalDatabaseLineageIdSchema,
  ProjectDatabaseHealthSchema,
  ProjectIdSchema,
  ProjectStorageCloseResultSchema,
  ProjectStorageCreateRequestIdSchema,
  ProjectStorageCreateResultSchema,
  ProjectStorageOpenResultSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} from "./index.js";

const projectId = "00000000-0000-4000-8000-000000000010";
const createRequestId = "00000000-0000-4000-8000-000000000011";
const identity = {
  storageId: "00000000-0000-4000-8000-000000000012",
  generationId: "00000000-0000-4000-8000-000000000013",
  canonicalDatabaseLineageId: "00000000-0000-4000-8000-000000000014",
  runtimeDatabaseLineageId: "00000000-0000-4000-8000-000000000015",
} as const;
const unhealthyHealthCases = [
  ["migration-required", "DATABASE_MIGRATION_REQUIRED"],
  ["recovery-required", "DATABASE_RECOVERY_REQUIRED"],
  ["missing", "DATABASE_MISSING"],
  ["corrupt", "DATABASE_CORRUPT"],
  ["identity-conflict", "DATABASE_IDENTITY_CONFLICT"],
  ["unsupported-newer", "DATABASE_UNSUPPORTED_NEWER"],
  ["unavailable", "DATABASE_UNAVAILABLE"],
  ["broken", "DATABASE_BROKEN"],
] as const;
const createRequest = { projectId, createRequestId } as const;
const priorStateBlocked = {
  status: "blocked",
  request: createRequest,
  reason: "prior-state-witness",
  diagnostic: {
    code: "PROJECT_STORAGE_PRIOR_STATE_WITNESS",
    message: "witnessed",
  },
} as const;
const unavailableDiagnostic = {
  code: "PROJECT_STORAGE_UNAVAILABLE",
  message: "Project Storage is unavailable.",
} as const;
const brokenDiagnosticCodes = [
  "PROJECT_STORAGE_OWNER_FAILED",
  "PROJECT_STORAGE_RESULT_INVALID",
  "PROJECT_STORAGE_TRANSPORT_FAILED",
] as const;
const opened = {
  status: "opened",
  request: { projectId },
  mode: "read-write",
  identity,
  canonicalHealth: { status: "healthy" },
  runtimeHealth: { status: "healthy" },
} as const;
const safeMode = {
  ...opened,
  status: "safe-mode",
  mode: "safe-mode",
  runtimeHealth: {
    status: "corrupt",
    diagnostic: { code: "DATABASE_CORRUPT", message: "corrupt" },
  },
} as const;
const validOpenResults = [
  opened,
  safeMode,
  { status: "not-registered", request: { projectId } },
  { status: "unavailable", request: { projectId }, diagnostic: unavailableDiagnostic },
  ...brokenDiagnosticCodes.map((code) => ({
    status: "broken",
    request: { projectId },
    diagnostic: { code, message: "Project Storage failed." },
  })),
] as const;

describe("Project Storage protocol", () => {
  it("binds every blocked create reason to exactly one diagnostic", () => {
    const blockedCases = [
      ["prior-state-witness", "PROJECT_STORAGE_PRIOR_STATE_WITNESS"],
      ["already-registered", "PROJECT_STORAGE_ALREADY_REGISTERED"],
      ["idempotency-conflict", "PROJECT_STORAGE_IDEMPOTENCY_CONFLICT"],
    ] as const;

    for (const [reason, code] of blockedCases) {
      const blocked = {
        status: "blocked",
        request: createRequest,
        reason,
        diagnostic: { code, message: reason },
      } as const;
      expect(acceptsStrict(ProjectStorageCreateResultSchema, blocked)).toBe(true);
      expect(acceptsStrict(ProjectStorageCreateResultSchema, { ...blocked, identity })).toBe(false);

      for (const [, contradictoryCode] of blockedCases) {
        if (contradictoryCode !== code) {
          expect(
            acceptsStrict(ProjectStorageCreateResultSchema, {
              ...blocked,
              diagnostic: { code: contradictoryCode, message: reason },
            }),
          ).toBe(false);
        }
      }
    }
  });

  it("validates Project Storage identities", () => {
    const storageIdentitySchemas = [
      StorageIdSchema,
      StorageGenerationIdSchema,
      CanonicalDatabaseLineageIdSchema,
      RuntimeDatabaseLineageIdSchema,
      ProjectStorageCreateRequestIdSchema,
    ];
    const validStorageId = "018f47a3-4e3d-7d2b-9c41-7df4605c0a11";
    const validProjectId = "018f47a3-4e3d-4d2b-9c41-7df4605c0a11";

    for (const schema of storageIdentitySchemas) {
      expect(decodeWithIssues(schema, validStorageId).success).toBe(true);
      expect(decodeWithIssues(schema, validStorageId.toUpperCase()).success).toBe(false);
      expect(decodeWithIssues(schema, validStorageId.toUpperCase()).error?.issues).toEqual([
        { code: "custom", path: [], message: "Identity must use lowercase UUID text." },
      ]);
      expect(decodeWithIssues(schema, "00000000-0000-0000-0000-000000000000").success).toBe(false);
      expect(decodeWithIssues(schema, "not-a-uuid").success).toBe(false);
    }
    expect(acceptsStrict(ProjectIdSchema, validProjectId)).toBe(true);
    expect(acceptsStrict(ProjectIdSchema, validProjectId.toUpperCase())).toBe(false);
    expect(decodeWithIssues(ProjectIdSchema, validProjectId.toUpperCase()).error?.issues).toEqual([
      { code: "custom", path: [], message: "Project identity must use lowercase UUID text." },
    ]);
    expect(acceptsStrict(ProjectIdSchema, "00000000-0000-0000-0000-000000000000")).toBe(false);
    expect(acceptsStrict(ProjectIdSchema, "not-a-uuid")).toBe(false);
  });

  it("rejects contradictory Project Storage open results", () => {
    for (const result of validOpenResults) {
      expect(acceptsStrict(ProjectStorageOpenResultSchema, result)).toBe(true);
      expect(
        acceptsStrict(ProjectStorageOpenResultSchema, { ...result, storagePath: "private" }),
      ).toBe(false);
    }
    expect(
      acceptsStrict(ProjectStorageOpenResultSchema, {
        ...opened,
        runtimeHealth: {
          status: "corrupt",
          diagnostic: { code: "DATABASE_CORRUPT", message: "corrupt" },
        },
      }),
    ).toBe(false);
    expect(acceptsStrict(ProjectStorageOpenResultSchema, safeMode)).toBe(true);
    expect(
      acceptsStrict(ProjectStorageOpenResultSchema, {
        ...opened,
        status: "safe-mode",
        mode: "safe-mode",
      }),
    ).toBe(false);
    const contradictorySafeMode = decodeWithIssues(ProjectStorageOpenResultSchema, {
      ...opened,
      status: "safe-mode",
      mode: "safe-mode",
    });
    expect(contradictorySafeMode.error?.issues).toEqual([
      {
        code: "custom",
        message: "Safe mode requires at least one non-healthy database.",
        path: ["mode"],
      },
    ]);
    expect(
      acceptsStrict(ProjectStorageOpenResultSchema, {
        ...safeMode,
        canonicalHealth: safeMode.runtimeHealth,
        runtimeHealth: { status: "healthy" },
      }),
    ).toBe(true);
    expect(
      acceptsStrict(ProjectStorageOpenResultSchema, {
        status: "not-registered",
        request: { projectId },
        identity,
      }),
    ).toBe(false);
  });

  it("binds health diagnostics to exact statuses", () => {
    for (const [status, code] of unhealthyHealthCases) {
      const health = { status, diagnostic: { code, message: status } };
      const contradictoryCode =
        code === "DATABASE_CORRUPT" ? "DATABASE_MISSING" : "DATABASE_CORRUPT";
      expect(acceptsStrict(ProjectDatabaseHealthSchema, health)).toBe(true);
      expect(
        acceptsStrict(ProjectDatabaseHealthSchema, {
          ...health,
          diagnostic: { code: contradictoryCode, message: status },
        }),
      ).toBe(false);
    }
  });

  it("validates create and close result branches", () => {
    expect(
      acceptsStrict(ProjectStorageCreateResultSchema, {
        status: "created",
        request: createRequest,
        mode: "read-write",
        identity,
      }),
    ).toBe(true);
    expect(acceptsStrict(ProjectStorageCreateResultSchema, priorStateBlocked)).toBe(true);
    expect(
      acceptsStrict(ProjectStorageCreateResultSchema, {
        ...priorStateBlocked,
        diagnostic: { code: "PROJECT_STORAGE_ALREADY_REGISTERED", message: "witnessed" },
      }),
    ).toBe(false);
    expect(
      acceptsStrict(ProjectStorageCreateResultSchema, { ...priorStateBlocked, identity }),
    ).toBe(false);
    expect(
      acceptsStrict(ProjectStorageCreateResultSchema, {
        status: "unavailable",
        request: createRequest,
        diagnostic: unavailableDiagnostic,
      }),
    ).toBe(true);

    expect(
      decodeWithIssues(ProjectStorageCloseResultSchema, {
        status: "closed",
        request: { projectId },
      }).success,
    ).toBe(true);
    expect(
      acceptsStrict(ProjectStorageCloseResultSchema, {
        status: "closed",
        request: { projectId },
        wasOpen: false,
      }),
    ).toBe(false);
    expect(
      acceptsStrict(ProjectStorageCloseResultSchema, {
        status: "unavailable",
        request: { projectId },
        diagnostic: unavailableDiagnostic,
      }),
    ).toBe(true);

    for (const code of brokenDiagnosticCodes) {
      const diagnostic = { code, message: "Project Storage failed." };
      expect(
        acceptsStrict(ProjectStorageCreateResultSchema, {
          status: "broken",
          request: createRequest,
          diagnostic,
        }),
      ).toBe(true);
      expect(
        acceptsStrict(ProjectStorageCloseResultSchema, {
          status: "broken",
          request: { projectId },
          diagnostic,
        }),
      ).toBe(true);
    }
  });
});
