import {
  type ProjectStorageCloseRequest,
  ProjectStorageCloseResultSchema,
  type ProjectStorageCreateRequest,
  ProjectStorageCreateResultSchema,
  type ProjectStorageOpenRequest,
  type ProjectStorageOpenResult,
  ProjectStorageOpenResultSchema,
} from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import type { ProjectStorageBridgeClient } from "./project-storage-bridge.js";
import {
  parseProjectStoragePackageSmokeScenario,
  projectStoragePackageSmokeFailureStage,
  runProjectStoragePackageSmoke,
} from "./project-storage-package-smoke.js";

function unexpectedCall(): never {
  throw new Error("Unexpected package smoke bridge call.");
}

it.each(["bootstrap", "writer-proof", "missing-runtime", "witnessed-staging"])(
  "accepts the exact package smoke scenario %s",
  (scenario) => {
    expect(parseProjectStoragePackageSmokeScenario(scenario)).toBe(scenario);
  },
);

it.each([
  undefined,
  null,
  "",
  " ",
  "unknown",
  1,
  {},
  ...["bootstrap", "writer-proof", "missing-runtime", "witnessed-staging"].flatMap((scenario) => [
    ` ${scenario}`,
    `${scenario} `,
    `\t${scenario}`,
    `${scenario}\n`,
    scenario.toUpperCase(),
  ]),
])("rejects an inexact package smoke scenario %j", (scenario) => {
  expect(() => parseProjectStoragePackageSmokeScenario(scenario)).toThrow(
    new Error("Invalid packaged Project Storage scenario."),
  );
});

it("preserves the original Project101 bootstrap create and open identity", async () => {
  const identity = {
    storageId: "00000000-0000-4000-8000-000000000201",
    generationId: "00000000-0000-4000-8000-000000000202",
    canonicalDatabaseLineageId: "00000000-0000-4000-8000-000000000203",
    runtimeDatabaseLineageId: "00000000-0000-4000-8000-000000000204",
  };
  const open = vi
    .fn<(request: ProjectStorageOpenRequest) => Promise<ProjectStorageOpenResult>>()
    .mockImplementationOnce(async (request) =>
      ProjectStorageOpenResultSchema.parse({ status: "not-registered", request }),
    )
    .mockImplementationOnce(async (request) =>
      ProjectStorageOpenResultSchema.parse({
        status: "opened",
        request,
        mode: "read-write",
        identity,
        canonicalHealth: { status: "healthy" },
        runtimeHealth: { status: "healthy" },
      }),
    );
  const bridge: ProjectStorageBridgeClient = {
    open,
    create: vi.fn(async (request: ProjectStorageCreateRequest) =>
      ProjectStorageCreateResultSchema.parse({
        status: "created",
        request,
        mode: "read-write",
        identity,
      }),
    ),
    close: vi.fn(async (request: ProjectStorageCloseRequest) =>
      ProjectStorageCloseResultSchema.parse({ status: "closed", request }),
    ),
    stop: vi.fn(),
  };

  await expect(
    runProjectStoragePackageSmoke({ bridge, scenario: "bootstrap" }),
  ).resolves.toBeUndefined();
  expect(open.mock.calls).toEqual([
    [{ projectId: "00000000-0000-4000-8000-000000000102" }],
    [{ projectId: "00000000-0000-4000-8000-000000000101" }],
  ]);
  expect(bridge.create).toHaveBeenCalledExactlyOnceWith({
    projectId: "00000000-0000-4000-8000-000000000101",
    createRequestId: "00000000-0000-4000-8000-000000000111",
  });
  expect(bridge.close).toHaveBeenCalledExactlyOnceWith({
    projectId: "00000000-0000-4000-8000-000000000101",
  });
  expect(bridge.stop).not.toHaveBeenCalled();
});

it("refuses writer proof through ordinary Storage dispatch", async () => {
  const bridge: ProjectStorageBridgeClient = {
    open: vi.fn(unexpectedCall),
    create: vi.fn(unexpectedCall),
    close: vi.fn(unexpectedCall),
    stop: vi.fn(),
  };

  await expect(runProjectStoragePackageSmoke({ bridge, scenario: "writer-proof" })).rejects.toThrow(
    new Error("Writer proof requires the private process owner."),
  );
  expect(bridge.open).not.toHaveBeenCalled();
  expect(bridge.create).not.toHaveBeenCalled();
  expect(bridge.close).not.toHaveBeenCalled();
  expect(bridge.stop).not.toHaveBeenCalled();
});

it("classifies an unexpected absent-Project result before later bootstrap steps", async () => {
  const bridge: ProjectStorageBridgeClient = {
    open: vi.fn(async (request: ProjectStorageOpenRequest) =>
      ProjectStorageOpenResultSchema.parse({
        status: "broken",
        request,
        diagnostic: {
          code: "PROJECT_STORAGE_OWNER_FAILED",
          message: "Project Storage owner failed.",
        },
      }),
    ),
    create: vi.fn(unexpectedCall),
    close: vi.fn(unexpectedCall),
    stop: vi.fn(),
  };

  const failure = await runProjectStoragePackageSmoke({ bridge, scenario: "bootstrap" }).then(
    () => undefined,
    (error: unknown) => error,
  );

  expect(projectStoragePackageSmokeFailureStage(failure)).toBe("absent-project-open");
  expect(bridge.create).not.toHaveBeenCalled();
  expect(bridge.close).not.toHaveBeenCalled();
});
