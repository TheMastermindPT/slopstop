import {
  decodeStrict,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
} from "@slopstop/protocol";
import { describe, expect, it, vi } from "vitest";
import type { ProjectStorageOwnerPort } from "./project-storage-application.js";
import {
  createProjectStorageApplication,
  createUnavailableProjectStorageApplication,
} from "./project-storage-application.js";

const projectId = "00000000-0000-4000-8000-000000000010";
const anotherProjectId = "00000000-0000-4000-8000-000000000020";
const createRequestId = "00000000-0000-4000-8000-000000000011";
const anotherCreateRequestId = "00000000-0000-4000-8000-000000000021";
const openRequest = decodeStrict(ProjectStorageOpenRequestSchema, { projectId });
const createRequest = decodeStrict(ProjectStorageCreateRequestSchema, {
  projectId,
  createRequestId,
});
const closeRequest = decodeStrict(ProjectStorageCloseRequestSchema, { projectId });
const unavailableDiagnostic = {
  code: "PROJECT_STORAGE_UNAVAILABLE",
  message: "Project Storage owner is unavailable.",
} as const;

function createOwner(overrides: Partial<ProjectStorageOwnerPort> = {}): ProjectStorageOwnerPort {
  const unavailable = async () => ({
    status: "unavailable" as const,
    message: "Project Storage owner is unavailable.",
  });
  return {
    open: unavailable,
    create: unavailable,
    close: unavailable,
    stop: () => Promise.resolve(),
    ...overrides,
  };
}

async function expectUnavailableOwnerMapping(): Promise<void> {
  const explicit = createOwner({
    open: async () => ({ status: "unavailable", message: "Storage temporarily offline." }),
  });
  await expect(createProjectStorageApplication(explicit).open(openRequest)).resolves.toMatchObject({
    status: "unavailable",
    diagnostic: { message: "Storage temporarily offline." },
  });
  const blank = createOwner({
    open: async () => ({ status: "unavailable", message: "   " }),
  });
  await expect(createProjectStorageApplication(blank).open(openRequest)).resolves.toEqual({
    status: "unavailable",
    request: openRequest,
    diagnostic: unavailableDiagnostic,
  });
}

async function expectInvalidOwnerMapping(): Promise<void> {
  const wrongProject = createOwner({
    open: async () => ({
      status: "ready",
      result: { status: "not-registered", request: { projectId: anotherProjectId } },
    }),
  });
  await expect(createProjectStorageApplication(wrongProject).open(openRequest)).resolves.toEqual({
    status: "broken",
    request: openRequest,
    diagnostic: {
      code: "PROJECT_STORAGE_RESULT_INVALID",
      message: "Project Storage owner returned an invalid result.",
    },
  });
  const wrongCreateRequest = createOwner({
    create: async () => ({
      status: "ready",
      result: {
        status: "unavailable",
        request: { projectId, createRequestId: anotherCreateRequestId },
        diagnostic: unavailableDiagnostic,
      },
    }),
  });
  await expect(
    createProjectStorageApplication(wrongCreateRequest).create(createRequest),
  ).resolves.toMatchObject({
    status: "broken",
    request: createRequest,
    diagnostic: { code: "PROJECT_STORAGE_RESULT_INVALID" },
  });
  const malformed = createOwner({ open: async () => ({ status: "ready", result: null }) });
  await expect(createProjectStorageApplication(malformed).open(openRequest)).resolves.toMatchObject(
    {
      status: "broken",
      request: openRequest,
      diagnostic: { code: "PROJECT_STORAGE_RESULT_INVALID" },
    },
  );
}

async function expectFailedOwnerMapping(): Promise<void> {
  const thrown = createOwner({
    open: async () => {
      throw new Error("private owner failure");
    },
  });
  await expect(createProjectStorageApplication(thrown).open(openRequest)).resolves.toEqual({
    status: "broken",
    request: openRequest,
    diagnostic: {
      code: "PROJECT_STORAGE_OWNER_FAILED",
      message: "Project Storage owner failed.",
    },
  });
  const explicit = createOwner({
    open: async () => ({ status: "broken", message: "Owner reported failure." }),
  });
  await expect(createProjectStorageApplication(explicit).open(openRequest)).resolves.toMatchObject({
    status: "broken",
    request: openRequest,
    diagnostic: {
      code: "PROJECT_STORAGE_OWNER_FAILED",
      message: "Owner reported failure.",
    },
  });
}

describe("Project Storage application", () => {
  it("keeps unavailable, invalid, and failed owner outcomes distinct", async () => {
    await expectUnavailableOwnerMapping();
    await expectInvalidOwnerMapping();
    await expectFailedOwnerMapping();
  });

  it("echoes every unavailable request and delegates stop", async () => {
    const stop = vi.fn(async () => undefined);
    const application = createProjectStorageApplication(createOwner({ stop }));
    const [openResult, createResult, closeResult] = await Promise.all([
      application.open(openRequest),
      application.create(createRequest),
      application.close(closeRequest),
    ]);

    expect(openResult).toEqual({
      status: "unavailable",
      request: openRequest,
      diagnostic: unavailableDiagnostic,
    });
    expect(createResult).toEqual({
      status: "unavailable",
      request: createRequest,
      diagnostic: unavailableDiagnostic,
    });
    expect(closeResult).toEqual({
      status: "unavailable",
      request: closeRequest,
      diagnostic: unavailableDiagnostic,
    });

    await application.stop();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("never invents absence for the truthful no-store application", async () => {
    const result = await createUnavailableProjectStorageApplication().open(openRequest);
    expect(result.status).toBe("unavailable");
    expect(result.status).not.toBe("not-registered");
  });
});
