import {
  decodeStrict,
  ProjectIdSchema,
  ProjectStorageCreateRequestIdSchema,
} from "@slopstop/protocol";
import { expect, it, vi } from "vitest";
import { createUpgradeDiagnosticsLogger } from "./upgrade-diagnostics-logger.js";

const projectId = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-000000000010");
const upgradeId = decodeStrict(
  ProjectStorageCreateRequestIdSchema,
  "00000000-0000-4000-8000-0000000000a1",
);

it("maps upgrade diagnostics to log calls", () => {
  for (const reason of ["failed", "interrupted"] as const) {
    const logger = { info: vi.fn(), warn: vi.fn() };
    createUpgradeDiagnosticsLogger(logger).abandoned({ projectId, upgradeId, reason });
    expect(logger.info.mock.calls).toEqual([
      [{ event: "project-storage.upgrade.abandoned", projectId, upgradeId, reason }],
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
  }
  for (const cause of ["busy", "broken", "unproven"] as const) {
    const logger = { info: vi.fn(), warn: vi.fn() };
    createUpgradeDiagnosticsLogger(logger).discardFailed({ projectId, upgradeId, cause });
    expect(logger.warn.mock.calls).toEqual([
      [{ event: "project-storage.upgrade.discard-failed", projectId, upgradeId, cause }],
    ]);
    expect(logger.info).not.toHaveBeenCalled();
  }
});
