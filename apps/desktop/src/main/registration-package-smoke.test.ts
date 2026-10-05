import path from "node:path";
import type { ProjectRegistrationRequest, ProjectRegistrationResult } from "@slopstop/protocol";
import { describe, expect, it, vi } from "vitest";
import {
  RegistrationPackageSmokeError,
  runRegistrationPackageSmoke,
} from "./registration-package-smoke.js";

const root = path.join("C:", "smoke-root");
const selectionId = "44444444-4444-4444-8444-444444444444";
const listed = {
  status: "listed",
  projects: [{ registration: "registered", name: "repository" }],
};

function smoke(
  selected: ProjectRegistrationResult,
  rendered: unknown = { result: { status: "registered", name: "repository" }, list: listed },
) {
  const register = vi.fn(async (_request: ProjectRegistrationRequest) => selected);
  const runInRenderer = vi.fn(async (_script: string) => rendered);
  return {
    register,
    runInRenderer,
    run: () => runRegistrationPackageSmoke({ root, register, runInRenderer }),
  };
}

describe("registration package smoke", () => {
  it("selects the authorized root's repository in main and hands only the selection id to the renderer", async () => {
    const { register, runInRenderer, run } = smoke({
      status: "repository-selected",
      repositorySelectionId: selectionId,
    });
    await expect(run()).resolves.toBeUndefined();
    expect(register).toHaveBeenCalledWith({
      step: "select-repository",
      directory: path.join(root, "repository"),
    });
    const script = runInRenderer.mock.calls[0]?.[0] ?? "";
    expect(script).toContain(JSON.stringify(selectionId));
    expect(script).not.toContain(root);
  });

  it.each([
    ["select", { status: "unavailable", code: "GIT_UNAVAILABLE" }, undefined],
    [
      "register",
      { status: "repository-selected", repositorySelectionId: selectionId },
      { result: { status: "unavailable", code: "GIT_UNAVAILABLE" }, list: listed },
    ],
    [
      "list",
      { status: "repository-selected", repositorySelectionId: selectionId },
      {
        result: { status: "registered", name: "repository" },
        list: { status: "listed", projects: [] },
      },
    ],
  ] as const)("fails at stage %s with a distinct error", async (stage, selected, rendered) => {
    const { run } = smoke(selected as ProjectRegistrationResult, rendered);
    await expect(run()).rejects.toEqual(new RegistrationPackageSmokeError(stage));
  });
});
