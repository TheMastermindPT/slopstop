import type { ProjectRegistrationResult } from "@slopstop/protocol";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../app.js";
import { exposeApi } from "../test-api.js";
import { gitPath, projectId, registrationApi } from "./registration-fake.js";

type Fake = ReturnType<typeof registrationApi>;

async function startAdding(fake: Fake = registrationApi()) {
  exposeApi(fake.api);
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Add existing repository" }));
  return { user, fake };
}

const heading = (name: string) => screen.findByRole("heading", { level: 2, name });
const press = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole("button", { name }));

async function reachProposal(fake?: Fake) {
  const started = await startAdding(fake);
  await heading("Do you trust this repository?");
  await press(started.user, "Trust and continue");
  await heading("Check the Git program");
  await press(started.user, "Run version check");
  await heading("Allow Git to identify repository?");
  await press(started.user, "Allow 6 queries");
  await heading("Ready to add repository");
  return started;
}

describe("Add existing repository", () => {
  it("walks trust, both Git stages and confirmation, focusing each step heading", async () => {
    const { user, fake } = await startAdding();
    const trust = await heading("Do you trust this repository?");
    expect(document.activeElement).toBe(trust);
    expect(screen.getByText("C:\\work\\repository")).toBeTruthy();
    expect(
      screen.getByText("This version doesn't protect against a hostile Git configuration"),
    ).toBeTruthy();
    expect(screen.getByText("Step 2 of 5", { exact: false })).toBeTruthy();

    await press(user, "Trust and continue");
    expect(document.activeElement).toBe(await heading("Check the Git program"));
    expect(screen.getByText(gitPath)).toBeTruthy();
    expect(screen.queryByText(/Choose a different Git program/)).toBeNull();

    await press(user, "Run version check");
    expect(document.activeElement).toBe(await heading("Allow Git to identify repository?"));
    expect(
      screen.getAllByRole("listitem").filter((item) => item.textContent?.includes("git rev-parse")),
    ).toHaveLength(6);

    await press(user, "Allow 6 queries");
    expect(document.activeElement).toBe(await heading("Ready to add repository"));
    const facts = screen.getByText("Project name").closest("dl");
    if (facts === null) throw new Error("Proposal facts missing");
    expect(within(facts).getByText("C:\\work\\repository")).toBeTruthy();
    expect(within(facts).getByText("2.53.0.windows.1")).toBeTruthy();

    await press(user, "Confirm registration");
    expect(document.activeElement).toBe(await heading("repository was added"));
    expect(screen.getByText("Added")).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: "Open Project repository, new" }),
    ).toBeTruthy();
    expect(fake.steps()).toEqual([
      "decide-trust",
      "prepare-git",
      "decide-git-version",
      "decide-identity-queries",
      "prepare",
      "confirm",
    ]);
  });

  it("reuses the approved Git for a second folder and says which Git it uses", async () => {
    const fake = registrationApi();
    const { user } = await reachProposal(fake);
    await press(user, "Confirm registration");
    await heading("repository was added");
    await press(user, "Add another repository");
    await heading("Do you trust this repository?");
    expect(
      screen.getByText(
        "Trusting runs nothing by itself. Next, Ragnarok identifies the repository with the Git program you already approved (Git 2.53.0.windows.1).",
      ),
    ).toBeTruthy();
    await press(user, "Trust and continue");
    await heading("Ready to add repository");
    expect(fake.steps().slice(6)).toEqual(["decide-trust", "prepare"]);
  });

  it.each([
    ["Trust", "Cancelled. Nothing was run.", 0],
    ["Git version", "Cancelled. Git was not run.", 1],
    ["Git access", "Cancelled. Git only read its own version; no repository query was run.", 2],
  ] as const)(
    "cancels at %s with Esc, notes what ran and returns focus to Add",
    async (_step, note, advances) => {
      const { user } = await startAdding();
      await heading("Do you trust this repository?");
      const path = [
        ["Trust and continue", "Run version check"],
        ["Run version check", "Allow 6 queries"],
      ] as const;
      for (const [name, next] of path.slice(0, advances)) {
        await press(user, name);
        await screen.findByRole("button", { name: next });
      }
      await user.keyboard("{Escape}");
      expect(await screen.findByText(note, { selector: "p[role=status]" })).toBeTruthy();
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Add existing repository" }),
      );
    },
  );

  it("changes nothing when the folder dialog is cancelled", async () => {
    const fake = registrationApi({}, { status: "cancelled" });
    await startAdding(fake);
    expect(await heading("No Project selected")).toBeTruthy();
    expect(fake.steps()).toEqual([]);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add existing repository" }),
    );
  });

  type Expected = Readonly<{ word: string; title: string; reference?: string }>;
  const preparationOutcomes: ReadonlyArray<readonly [ProjectRegistrationResult, Expected]> = [
    [
      { status: "restored-to-list", projectId, name: "repository" },
      { word: "Back in your list", title: "repository is back in your list" },
    ],
    [
      { status: "belongs-to-project", projectId, name: "chess", hiddenFromList: true },
      { word: "Not added", title: "This worktree is part of a Project you removed from your list" },
    ],
    [
      { status: "already-registered", projectId, name: "repository" },
      { word: "Already registered", title: "repository is already registered" },
    ],
    [
      { status: "belongs-to-project", projectId, name: "chess" },
      { word: "Not added", title: "This worktree is part of a Project you already have" },
    ],
    [
      { status: "pending-recovery", code: "REGISTRATION_INCOMPLETE" },
      {
        word: "Needs recovery",
        title: "Adding repository was interrupted",
        reference: "REGISTRATION_INCOMPLETE",
      },
    ],
    [
      { status: "rejected", code: "REPOSITORY_NOT_FOUND" },
      {
        word: "Not added",
        title: "The selected folder can't be found",
        reference: "REPOSITORY_NOT_FOUND",
      },
    ],
    [
      { status: "unavailable", code: "REPOSITORY_INACCESSIBLE" },
      {
        word: "Not added",
        title: "Ragnarok can't open this folder",
        reference: "REPOSITORY_INACCESSIBLE",
      },
    ],
    [
      { status: "rejected", code: "NOT_WORKING_TREE" },
      {
        word: "Not added",
        title: "This folder can't be added as a Project",
        reference: "NOT_WORKING_TREE",
      },
    ],
    [
      { status: "rejected", code: "BARE_REPOSITORY" },
      {
        word: "Not added",
        title: "This folder can't be added as a Project",
        reference: "BARE_REPOSITORY",
      },
    ],
    [
      { status: "unavailable", code: "GIT_QUERY_FAILED", exitCode: 128 },
      {
        word: "Not added",
        title: "Git couldn't read this folder as a repository",
        reference: "GIT_QUERY_FAILED",
      },
    ],
    [
      { status: "unavailable", code: "IDENTITY_CAPABILITY_UNAVAILABLE" },
      {
        word: "Not supported",
        title: "Ragnarok can't identify this drive reliably",
        reference: "IDENTITY_CAPABILITY_UNAVAILABLE",
      },
    ],
    [
      { status: "rejected", code: "REPOSITORY_IDENTITY_CHANGED" },
      {
        word: "Not added",
        title: "The folder changed since it was checked",
        reference: "REPOSITORY_IDENTITY_CHANGED",
      },
    ],
    [
      { status: "broken", code: "REGISTRY_CORRUPT" },
      {
        word: "Not added",
        title: "Ragnarok couldn't add this repository",
        reference: "REGISTRY_CORRUPT",
      },
    ],
  ];

  it.each(preparationOutcomes)(
    "answers preparation %j with its outcome",
    async (result, expected) => {
      const { user } = await startAdding(registrationApi({ prepare: result }));
      await heading("Do you trust this repository?");
      await press(user, "Trust and continue");
      await press(user, "Run version check");
      await heading("Allow Git to identify repository?");
      await press(user, "Allow 6 queries");
      expect(document.activeElement).toBe(await heading(expected.title));
      expect(screen.getByText(expected.word)).toBeTruthy();
      if (expected.reference === undefined) expect(screen.queryByText(/^Reference:/)).toBeNull();
      else expect(screen.getByText(`Reference: ${expected.reference}`)).toBeTruthy();
    },
  );

  it("tells the user to install Git when it can't be started and retries the check", async () => {
    const fake = registrationApi({
      "prepare-git": [
        { status: "unavailable", code: "GIT_UNAVAILABLE" },
        {
          status: "git-prepared",
          selectionId: "55555555-5555-4555-8555-555555555555",
          executablePath: gitPath,
        },
      ],
    });
    const { user } = await startAdding(fake);
    await heading("Do you trust this repository?");
    await press(user, "Trust and continue");
    await heading("Git can't be started");
    expect(
      screen.getByText(
        "Ragnarok couldn't find or start Git. Install Git for Windows, then try again.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Reference: GIT_UNAVAILABLE")).toBeTruthy();
    await press(user, "Try again");
    expect(await heading("Check the Git program")).toBeTruthy();
  });

  it("retries a busy confirmation", async () => {
    const fake = registrationApi({
      confirm: [
        { status: "unavailable", code: "REGISTRY_BUSY" },
        { status: "registered", projectId, name: "repository" },
      ],
    });
    const { user } = await reachProposal(fake);
    await press(user, "Confirm registration");
    await heading("Projects are busy");
    await press(user, "Try again");
    expect(await heading("repository was added")).toBeTruthy();
  });

  it("asks to check Git again after it changed, without the old approval", async () => {
    const fake = registrationApi({
      confirm: { status: "unavailable", code: "GIT_CONFIRMATION_REQUIRED" },
    });
    const { user } = await reachProposal(fake);
    await press(user, "Confirm registration");
    await heading("Confirm Git again");
    await press(user, "Check Git again");
    expect(await heading("Check the Git program")).toBeTruthy();
    expect(fake.steps().at(-1)).toBe("prepare-git");
  });
  it("says a hidden Project's worktree belongs to it and how to bring it back", async () => {
    const { user } = await startAdding(
      registrationApi({
        prepare: { status: "belongs-to-project", projectId, name: "chess", hiddenFromList: true },
      }),
    );
    await heading("Do you trust this repository?");
    await press(user, "Trust and continue");
    await press(user, "Run version check");
    await heading("Allow Git to identify repository?");
    await press(user, "Allow 6 queries");
    await heading("This worktree is part of a Project you removed from your list");
    expect(
      screen.getByText(
        "This worktree belongs to Project chess, which is hidden from your list. Add chess's own folder again to bring it back. Adding further worktrees is not supported yet.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show chess" })).toBeNull();
  });
});
