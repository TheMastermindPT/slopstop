import {
  decodeStrict,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
} from "@slopstop/protocol";
import { describe, expect, it, vi } from "vitest";
import {
  recordingRequestDiagnostics,
  silentRequestDiagnostics,
} from "../tests/integration/request-diagnostics-fixture.js";
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
  const requests = recordingRequestDiagnostics();
  const explicit = createOwner({
    open: async () => ({ status: "unavailable", message: "Storage temporarily offline." }),
  });
  await expect(
    createProjectStorageApplication(explicit, requests.diagnostics).open(openRequest),
  ).resolves.toMatchObject({
    status: "unavailable",
    diagnostic: { message: "Storage temporarily offline." },
  });
  const blank = createOwner({
    open: async () => ({ status: "unavailable", message: "   " }),
  });
  await expect(
    createProjectStorageApplication(blank, requests.diagnostics).open(openRequest),
  ).resolves.toEqual({
    status: "unavailable",
    request: openRequest,
    diagnostic: unavailableDiagnostic,
  });
  expect(requests.calls).toEqual([]);
}

async function expectInvalidOwnerMapping(): Promise<void> {
  const requests = recordingRequestDiagnostics();
  const wrongProject = createOwner({
    open: async () => ({
      status: "ready",
      result: { status: "not-registered", request: { projectId: anotherProjectId } },
    }),
  });
  await expect(
    createProjectStorageApplication(wrongProject, requests.diagnostics).open(openRequest),
  ).resolves.toEqual({
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
    createProjectStorageApplication(wrongCreateRequest, requests.diagnostics).create(createRequest),
  ).resolves.toMatchObject({
    status: "broken",
    request: createRequest,
    diagnostic: { code: "PROJECT_STORAGE_RESULT_INVALID" },
  });
  const malformed = createOwner({ open: async () => ({ status: "ready", result: null }) });
  await expect(
    createProjectStorageApplication(malformed, requests.diagnostics).open(openRequest),
  ).resolves.toMatchObject({
    status: "broken",
    request: openRequest,
    diagnostic: { code: "PROJECT_STORAGE_RESULT_INVALID" },
  });
  expect(requests.calls).toEqual([]);
}

async function expectFailedOwnerMapping(): Promise<void> {
  const requests = recordingRequestDiagnostics();
  const ownerFailure = new Error("private owner failure");
  const thrown = createOwner({
    open: async () => {
      throw ownerFailure;
    },
  });
  await expect(
    createProjectStorageApplication(thrown, requests.diagnostics).open(openRequest),
  ).resolves.toEqual({
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
  await expect(
    createProjectStorageApplication(explicit, requests.diagnostics).open(openRequest),
  ).resolves.toMatchObject({
    status: "broken",
    request: openRequest,
    diagnostic: {
      code: "PROJECT_STORAGE_OWNER_FAILED",
      message: "Owner reported failure.",
    },
  });
  expect(requests.calls).toHaveLength(1);
  expect(requests.calls[0]?.boundary).toBe("project-storage.owner");
  expect(requests.calls[0]?.failure).toBe(ownerFailure);
}

describe("Project Storage application", () => {
  it("keeps unavailable, invalid, and failed owner outcomes distinct", async () => {
    await expectUnavailableOwnerMapping();
    await expectInvalidOwnerMapping();
    await expectFailedOwnerMapping();
  });

  it("echoes every unavailable request and delegates stop", async () => {
    const stop = vi.fn(async () => undefined);
    const application = createProjectStorageApplication(
      createOwner({ stop }),
      silentRequestDiagnostics,
    );
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
    const result =
      await createUnavailableProjectStorageApplication(silentRequestDiagnostics).open(openRequest);
    expect(result.status).toBe("unavailable");
    expect(result.status).not.toBe("not-registered");
  });
});
