import {
  CanonicalProjectActivationResultSchema,
  decodeStrict,
  ProjectListResultSchema,
} from "@slopstop/protocol";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../app.js";
import { exposeApi, readyApi } from "../test-api.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const note = "No model is connected yet. Messages are saved on this computer.";
const placeholder =
  "Project identity and local Storage are connected. Conversation and repository registration controls are not available in this view yet.";

const listed = decodeStrict(ProjectListResultSchema, {
  status: "listed",
  projects: [
    {
      registration: "registered",
      projectId,
      name: "repo-a",
      repositoryBindingId: projectId,
      workspaceId: projectId,
      access: "not-assessed",
      repositoryLocation: { status: "present" },
      storage: { status: "healthy", storageId: projectId, generationId: projectId },
    },
  ],
  hiddenCount: 0,
});

/** Opens repo-a with the activation result the test chooses and returns the workspace region. */
async function openProject(activation: (request: unknown) => unknown) {
  exposeApi(
    readyApi({
      listProjects: async () => listed,
      activateProject: async (request) =>
        decodeStrict(CanonicalProjectActivationResultSchema, activation(request)),
    }),
  );
  render(<App />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Open Project repo-a" }));
  return within(screen.getByRole("region", { name: "Project workspace" }));
}

const activationId = "22222222-2222-4222-8222-222222222222";
const readWrite = (request: unknown) => ({
  status: "active",
  request,
  access: "read-write",
  activationId,
  writerGeneration: 1,
});
const readOnly = (request: unknown) => ({
  status: "active",
  request,
  access: "read-only",
  activationId,
  writerGeneration: null,
  diagnostic: {
    code: "WRITER_UNAVAILABLE",
    message: "Another session owns the writer.",
    retryable: true,
  },
});

describe("the Conversation region frame", () => {
  it("shows the frame for a read-write activation", async () => {
    const workspace = await openProject(readWrite);
    expect(await workspace.findByRole("heading", { name: "Project repo-a" })).toBeTruthy();
    expect(workspace.queryByText(placeholder)).toBeNull();
    expect(workspace.getByText("Read-write", { exact: true })).toBeTruthy();
    expect(workspace.getByText(projectId, { exact: true })).toBeTruthy();
    expect(workspace.getByText(note, { exact: true })).toBeTruthy();
    const region = screen.getByRole("region", { name: "Project workspace" });
    const icons = [...region.querySelectorAll("svg")];
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.getAttribute("focusable")).toBe("false");
    }
  });

  it("shows Read-only for a read-only activation", async () => {
    const workspace = await openProject(readOnly);
    expect(await workspace.findByText("Read-only", { exact: true })).toBeTruthy();
    expect(workspace.getByText(note, { exact: true })).toBeTruthy();
  });

  it("keeps the safe-mode view", async () => {
    const workspace = await openProject((request) => ({
      status: "safe-mode",
      request,
      identity: {
        storageId: projectId,
        generationId: projectId,
        canonicalDatabaseLineageId: projectId,
        runtimeDatabaseLineageId: projectId,
      },
      canonicalHealth: { status: "healthy" },
      runtimeHealth: {
        status: "missing",
        diagnostic: { code: "DATABASE_MISSING", message: "Database missing" },
      },
    }));
    expect(
      await workspace.findByText(
        "Writes unavailable. Storage needs attention before this Project can be used.",
        { exact: true },
      ),
    ).toBeTruthy();
    expect(workspace.queryByText(note)).toBeNull();
  });
});
