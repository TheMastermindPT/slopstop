import {
  decodeStrict,
  ProjectIdSchema,
  type ProjectListResult,
  ProjectListResultSchema,
  type ProjectRegistrationResult,
} from "@slopstop/protocol";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "../app.js";
import { exposeApi, readyApi } from "../test-api.js";

const chess = decodeStrict(ProjectIdSchema, "11111111-1111-4111-8111-111111111111");
const maxreps = decodeStrict(ProjectIdSchema, "22222222-2222-4222-8222-222222222222");
const stuck = decodeStrict(ProjectIdSchema, "33333333-3333-4333-8333-333333333333");

function entry(projectId: string, name: string, registration: "registered" | "incomplete") {
  return {
    registration,
    ...(registration === "incomplete" ? { code: "REGISTRATION_INCOMPLETE" } : {}),
    projectId,
    name,
    repositoryBindingId: projectId,
    workspaceId: projectId,
    access: "not-assessed",
    repositoryLocation: { status: "present" },
    storage: { status: "healthy", storageId: projectId, generationId: projectId },
  };
}

function listOf(...ids: string[]): ProjectListResult {
  const all = [
    entry(chess, "chess", "registered"),
    entry(maxreps, "maxreps", "registered"),
    entry(stuck, "stuck", "incomplete"),
  ];
  return decodeStrict(ProjectListResultSchema, {
    status: "listed",
    projects: all.filter((project) => ids.includes(project.projectId)),
  });
}

function renderList(removals: ProjectRegistrationResult[], visible = [chess, maxreps, stuck]) {
  let shown = visible;
  const registerProject = vi.fn(async (): Promise<ProjectRegistrationResult> => {
    const result: ProjectRegistrationResult = removals.shift() ?? {
      status: "broken",
      code: "INTERNAL_FAILURE",
    };
    if (result.status === "removed") shown = shown.filter((id) => id !== result.projectId);
    return result;
  });
  exposeApi(readyApi({ listProjects: async () => listOf(...shown), registerProject }));
  render(<App />);
  return { registerProject, user: userEvent.setup() };
}

const removeButton = (name: string) =>
  screen.findByRole("button", { name: `Remove ${name} from list` });
const heading = (name: string) => screen.findByRole("heading", { level: 2, name });

describe("Remove from list", () => {
  it("keeps an incomplete registration in the list with its reason", async () => {
    const { user, registerProject } = renderList([]);
    const stuckRemove = await removeButton("stuck");
    expect(stuckRemove.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Needs recovery; it stays visible until recovered.")).toBeTruthy();
    await user.click(stuckRemove);
    expect(
      await screen.findByText("This Project needs recovery; it stays visible until recovered."),
    ).toBeTruthy();
    expect(registerProject).not.toHaveBeenCalled();
  });

  it("confirms in the workspace, hides the Project and moves focus to the next entry", async () => {
    const { user, registerProject } = renderList([{ status: "removed", projectId: chess }]);
    await user.click(await removeButton("chess"));
    expect(document.activeElement).toBe(await heading("Remove chess from the list?"));
    for (const line of [
      "It disappears from your Projects list.",
      "Its Ragnarok data stays saved on this computer.",
      "The repository and its files are not changed.",
      "Adding the same folder again brings this Project back: the same Project, not a copy.",
    ])
      expect(screen.getByText(line)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remove from list" }));
    const note =
      "chess was removed from the list. Its data is still saved; adding its folder again brings it back.";
    expect(await screen.findByText(note, { selector: "p[role=status]" })).toBeTruthy();
    expect(registerProject).toHaveBeenCalledWith({ step: "remove-from-list", projectId: chess });
    expect(screen.queryByRole("button", { name: "Open Project chess" })).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Open Project maxreps" }),
    );
  });

  it("moves focus to Add when the last visible Project is removed", async () => {
    const { user } = renderList([{ status: "removed", projectId: chess }], [chess]);
    await user.click(await removeButton("chess"));
    await user.click(await screen.findByRole("button", { name: "Remove from list" }));
    await screen.findByText(/chess was removed from the list/, { selector: "p[role=status]" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add existing repository" }),
    );
  });

  it("cancels with Esc and returns focus to the entry's Remove button", async () => {
    const { user, registerProject } = renderList([]);
    await user.click(await removeButton("maxreps"));
    await heading("Remove maxreps from the list?");
    await user.keyboard("{Escape}");
    expect(await heading("No Project selected")).toBeTruthy();
    expect(document.activeElement).toBe(await removeButton("maxreps"));
    expect(registerProject).not.toHaveBeenCalled();
  });

  it("keeps busy and damaged registries distinct and the list unchanged", async () => {
    const { user } = renderList([
      { status: "unavailable", code: "REGISTRY_BUSY" },
      { status: "broken", code: "REGISTRY_CORRUPT" },
    ]);
    await user.click(await removeButton("chess"));
    await user.click(await screen.findByRole("button", { name: "Remove from list" }));
    expect(document.activeElement).toBe(await heading("chess wasn't removed"));
    expect(screen.getByText("Your list was not changed.")).toBeTruthy();
    expect(screen.getByText("Reference: REGISTRY_BUSY")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(document.activeElement).toBe(await heading("Saved Projects can't be updated"));
    expect(screen.getByText("Reference: REGISTRY_CORRUPT")).toBeTruthy();
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Back to Projects" }));
    });
    expect(document.activeElement).toBe(await removeButton("chess"));
    expect(screen.getByRole("button", { name: "Open Project chess" })).toBeTruthy();
  });
});
