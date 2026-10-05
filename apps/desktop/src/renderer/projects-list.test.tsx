import { decodeStrict, type ProjectListResult, ProjectListResultSchema } from "@slopstop/protocol";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "./app.js";
import { exposeApi, readyApi } from "./test-api.js";

const registeredId = "11111111-1111-4111-8111-111111111111";
const unboundId = "22222222-2222-4222-8222-222222222222";

const namedAndUnbound = decodeStrict(ProjectListResultSchema, {
  status: "listed",
  projects: [
    {
      registration: "registered",
      projectId: registeredId,
      name: "chess",
      repositoryBindingId: registeredId,
      workspaceId: registeredId,
      access: "not-assessed",
      repositoryLocation: { status: "present" },
      storage: { status: "healthy", storageId: registeredId, generationId: registeredId },
    },
    {
      registration: "unbound",
      projectId: unboundId,
      access: "not-assessed",
      repositoryLocation: { status: "not-bound" },
      storage: { status: "healthy", storageId: unboundId, generationId: unboundId },
    },
  ],
  hiddenCount: 0,
});

function renderWithList(list: ProjectListResult, linux = false) {
  const chooseRepository = vi.fn(async () => ({ status: "cancelled" as const }));
  exposeApi(
    readyApi({
      listProjects: async () => list,
      chooseRepository,
      getRegistrationCapability: async () =>
        linux
          ? { status: "unavailable", code: "IDENTITY_CAPABILITY_UNAVAILABLE" }
          : { status: "available" },
    }),
  );
  render(<App />);
  return { chooseRepository };
}

const addButton = () => screen.findByRole("button", { name: "Add existing repository" });

describe("Projects list", () => {
  it("names registered Projects by folder and unbound ones by short id", async () => {
    renderWithList(namedAndUnbound);
    expect(await screen.findByRole("button", { name: "Open Project chess" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Open Project without a repository 22222222" }),
    ).toBeTruthy();
  });

  it("offers adding an existing repository with its hint", async () => {
    renderWithList(namedAndUnbound);
    const add = await addButton();
    expect(add.getAttribute("aria-disabled")).toBeNull();
    expect(add.getAttribute("aria-describedby")).toBe("add-hint");
    expect(screen.getByText("Choose a Git repository folder on this computer.")).toBeTruthy();
  });

  it("explains on Linux why adding is unavailable before any folder dialog", async () => {
    const { chooseRepository } = renderWithList(namedAndUnbound, true);
    expect(
      await screen.findByText(
        "Not available on Linux in this version. Adding repositories works on Windows only.",
      ),
    ).toBeTruthy();
    const add = await addButton();
    expect(add.getAttribute("aria-disabled")).toBe("true");
    await userEvent.setup().click(add);
    expect(chooseRepository).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Adding repositories isn't available on Linux in this version."),
    ).toBeTruthy();
  });

  it("shows a busy registry as a status, never as an empty list", async () => {
    renderWithList({ status: "unavailable", code: "REGISTRY_BUSY" });
    const status = (await screen.findByText("Saved Projects are busy")).closest("[role=status]");
    if (status === null) throw new Error("Busy status missing");
    expect(status.textContent).toContain("Saved Projects are busy");
    expect(status.textContent).toContain(
      "Another Ragnarok window is updating them. Use Refresh in a moment.",
    );
    expect(status.textContent).toContain("Reference: REGISTRY_BUSY");
    expect((await addButton()).getAttribute("aria-disabled")).toBeNull();
    expect(screen.queryByText(/No saved Projects yet/)).toBeNull();
  });

  it("shows a damaged registry as an alert and disables adding with the reason", async () => {
    renderWithList({ status: "broken", code: "REGISTRY_CORRUPT" });
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Saved Projects can't be read")).toBeTruthy();
    expect(alert.textContent).toContain(
      "The Project registry is damaged or was written by a newer Ragnarok. Nothing was changed or reset.",
    );
    expect(alert.textContent).toContain("Reference: REGISTRY_CORRUPT");
    expect((await addButton()).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Unavailable while saved Projects can't be read.")).toBeTruthy();
  });

  it("invites adding a repository when no Projects are saved", async () => {
    renderWithList({ status: "listed", projects: [], hiddenCount: 0 });
    expect(
      await screen.findByText("No saved Projects yet. Add an existing repository to start."),
    ).toBeTruthy();
  });

  it("says removed Projects come back when every saved Project is hidden", async () => {
    renderWithList({ status: "listed", projects: [], hiddenCount: 2 });
    expect(
      await screen.findByText(
        "No Projects in your list. Removed Projects come back when you add their folder again.",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText("No saved Projects yet. Add an existing repository to start."),
    ).toBeNull();
  });
});
