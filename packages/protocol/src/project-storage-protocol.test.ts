import { describe, expect, it } from "vitest";
import {
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
      expect(ProjectStorageCreateResultSchema.safeParse(blocked).success).toBe(true);
      expect(ProjectStorageCreateResultSchema.safeParse({ ...blocked, identity }).success).toBe(
        false,
      );

      for (const [, contradictoryCode] of blockedCases) {
        if (contradictoryCode !== code) {
          expect(
            ProjectStorageCreateResultSchema.safeParse({
              ...blocked,
              diagnostic: { code: contradictoryCode, message: reason },
            }).success,
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
      expect(schema.safeParse(validStorageId).success).toBe(true);
      expect(schema.safeParse(validStorageId.toUpperCase()).success).toBe(false);
      expect(schema.safeParse(validStorageId.toUpperCase()).error?.issues).toEqual([
        { code: "custom", path: [], message: "Identity must use lowercase UUID text." },
      ]);
      expect(schema.safeParse("00000000-0000-0000-0000-000000000000").success).toBe(false);
      expect(schema.safeParse("not-a-uuid").success).toBe(false);
    }
    expect(ProjectIdSchema.safeParse(validProjectId).success).toBe(true);
    expect(ProjectIdSchema.safeParse(validProjectId.toUpperCase()).success).toBe(false);
    expect(ProjectIdSchema.safeParse(validProjectId.toUpperCase()).error?.issues).toEqual([
      { code: "custom", path: [], message: "Project identity must use lowercase UUID text." },
    ]);
    expect(ProjectIdSchema.safeParse("00000000-0000-0000-0000-000000000000").success).toBe(false);
    expect(ProjectIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("rejects contradictory Project Storage open results", () => {
    for (const result of validOpenResults) {
      expect(ProjectStorageOpenResultSchema.safeParse(result).success).toBe(true);
      expect(
        ProjectStorageOpenResultSchema.safeParse({ ...result, storagePath: "private" }).success,
      ).toBe(false);
    }
    expect(
      ProjectStorageOpenResultSchema.safeParse({
        ...opened,
        runtimeHealth: {
          status: "corrupt",
          diagnostic: { code: "DATABASE_CORRUPT", message: "corrupt" },
        },
      }).success,
    ).toBe(false);
    expect(ProjectStorageOpenResultSchema.safeParse(safeMode).success).toBe(true);
    expect(
      ProjectStorageOpenResultSchema.safeParse({
        ...opened,
        status: "safe-mode",
        mode: "safe-mode",
      }).success,
    ).toBe(false);
    const contradictorySafeMode = ProjectStorageOpenResultSchema.safeParse({
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
      ProjectStorageOpenResultSchema.safeParse({
        ...safeMode,
        canonicalHealth: safeMode.runtimeHealth,
        runtimeHealth: { status: "healthy" },
      }).success,
    ).toBe(true);
    expect(
      ProjectStorageOpenResultSchema.safeParse({
        status: "not-registered",
        request: { projectId },
        identity,
      }).success,
    ).toBe(false);
  });

  it("binds health diagnostics to exact statuses", () => {
    for (const [status, code] of unhealthyHealthCases) {
      const health = { status, diagnostic: { code, message: status } };
      const contradictoryCode =
        code === "DATABASE_CORRUPT" ? "DATABASE_MISSING" : "DATABASE_CORRUPT";
      expect(ProjectDatabaseHealthSchema.safeParse(health).success).toBe(true);
      expect(
        ProjectDatabaseHealthSchema.safeParse({
          ...health,
          diagnostic: { code: contradictoryCode, message: status },
        }).success,
      ).toBe(false);
    }
  });

  it("validates create and close result branches", () => {
    expect(
      ProjectStorageCreateResultSchema.safeParse({
        status: "created",
        request: createRequest,
        mode: "read-write",
        identity,
      }).success,
    ).toBe(true);
    expect(ProjectStorageCreateResultSchema.safeParse(priorStateBlocked).success).toBe(true);
    expect(
      ProjectStorageCreateResultSchema.safeParse({
        ...priorStateBlocked,
        diagnostic: { code: "PROJECT_STORAGE_ALREADY_REGISTERED", message: "witnessed" },
      }).success,
    ).toBe(false);
    expect(
      ProjectStorageCreateResultSchema.safeParse({ ...priorStateBlocked, identity }).success,
    ).toBe(false);
    expect(
      ProjectStorageCreateResultSchema.safeParse({
        status: "unavailable",
        request: createRequest,
        diagnostic: unavailableDiagnostic,
      }).success,
    ).toBe(true);

    expect(
      ProjectStorageCloseResultSchema.safeParse({ status: "closed", request: { projectId } })
        .success,
    ).toBe(true);
    expect(
      ProjectStorageCloseResultSchema.safeParse({
        status: "closed",
        request: { projectId },
        wasOpen: false,
      }).success,
    ).toBe(false);
    expect(
      ProjectStorageCloseResultSchema.safeParse({
        status: "unavailable",
        request: { projectId },
        diagnostic: unavailableDiagnostic,
      }).success,
    ).toBe(true);

    for (const code of brokenDiagnosticCodes) {
      const diagnostic = { code, message: "Project Storage failed." };
      expect(
        ProjectStorageCreateResultSchema.safeParse({
          status: "broken",
          request: createRequest,
          diagnostic,
        }).success,
      ).toBe(true);
      expect(
        ProjectStorageCloseResultSchema.safeParse({
          status: "broken",
          request: { projectId },
          diagnostic,
        }).success,
      ).toBe(true);
    }
  });
});
