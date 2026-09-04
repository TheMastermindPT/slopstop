import { type ProjectStorageOpenRequest, ProjectStorageOpenResultSchema } from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import type { ProjectStorageBridgeClient } from "./project-storage-bridge.js";
import {
  projectStoragePackageSmokeFailureStage,
  runProjectStoragePackageSmoke,
} from "./project-storage-package-smoke.js";

function unexpectedCall(): never {
  throw new Error("Unexpected package smoke bridge call.");
}

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
