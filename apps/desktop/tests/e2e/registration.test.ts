import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { type ElectronApplication, expect, test } from "@playwright/test";
import { launchBuiltDesktop } from "./electron-launch.js";

const installedGit = path.join(
  process.env["ProgramFiles"] ?? "C:/Program Files",
  "Git/cmd/git.exe",
);

async function launchWithFreshUserData() {
  const proof = await mkdtemp(path.join(tmpdir(), "opencode/pc-s1-registration-"));
  const userData = path.join(proof, "user-data");
  const repository = path.join(proof, "repository");
  execFileSync(installedGit, ["init", "--quiet", repository]);
  const application = await launchBuiltDesktop(proof, userData);
  return { application, repository };
}

/** Replaces the main process's native folder dialog for this launch only. */
function answerFolderDialog(application: ElectronApplication, directory: string | undefined) {
  return application.evaluate(({ dialog }, chosen) => {
    dialog.showOpenDialog = async () =>
      chosen === undefined
        ? { canceled: true, filePaths: [] }
        : { canceled: false, filePaths: [chosen] };
  }, directory);
}

/**
 * Runs every registration step from the renderer through the preload API; serialised into
 * the page, so it uses only page globals.
 */
async function registerThroughPreload() {
  const api = window.slopstop;
  const selected = await api.chooseRepository();
  if (selected.status !== "repository-selected") return selected;
  const trustId = crypto.randomUUID();
  await api.registerProject({
    step: "decide-trust",
    repositorySelectionId: selected.repositorySelectionId,
    trustId,
    decision: "accepted",
  });
  const git = await api.registerProject({ step: "prepare-git" });
  if (git.status !== "git-prepared") return git;
  const version = await api.registerProject({
    step: "decide-git-version",
    selectionId: git.selectionId,
    consentId: crypto.randomUUID(),
    decision: "accepted",
  });
  if (version.status !== "git-version-observed") return version;
  const consent = {
    selectionId: git.selectionId,
    observationId: version.observationId,
    consentId: crypto.randomUUID(),
  };
  await api.registerProject({
    step: "decide-identity-queries",
    ...consent,
    decision: "accepted",
  });
  const preparation = {
    preparationRequestId: crypto.randomUUID(),
    ...consent,
    repositorySelectionId: selected.repositorySelectionId,
    trustId,
  };
  const proposal = await api.registerProject({ step: "prepare", ...preparation });
  if (proposal.status !== "proposal-prepared") return proposal;
  return {
    selected,
    result: await api.registerProject({
      step: "confirm",
      requestId: crypto.randomUUID(),
      ...preparation,
      proposalId: proposal.proposalId,
      proposalFingerprint: proposal.proposalFingerprint,
    }),
    list: await api.listProjects(),
  };
}

test("registers a repository chosen in the main-process dialog through the preload API", async () => {
  test.setTimeout(120_000);
  const { application, repository } = await launchWithFreshUserData();
  try {
    const page = await application.firstWindow();
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.slopstop.getRegistrationCapability())).toEqual({
      status: "available",
    });

    await answerFolderDialog(application, undefined);
    expect(await page.evaluate(() => window.slopstop.chooseRepository())).toEqual({
      status: "cancelled",
    });

    await answerFolderDialog(application, repository);
    const registered = await page.evaluate(registerThroughPreload);
    expect(registered).toMatchObject({
      selected: { status: "repository-selected", directory: repository },
      result: { status: "registered", name: "repository" },
      list: { status: "listed", projects: [{ registration: "registered", name: "repository" }] },
    });
  } finally {
    await application.close();
  }
});

test("refuses a renderer-supplied directory without reaching the harness", async () => {
  test.setTimeout(60_000);
  const { application, repository } = await launchWithFreshUserData();
  try {
    const page = await application.firstWindow();
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    const attempt = await page.evaluate(async (directory) => {
      try {
        await Reflect.apply(window.slopstop.registerProject, window.slopstop, [
          { step: "select-repository", directory },
        ]);
        return "accepted";
      } catch {
        return "refused";
      }
    }, repository);
    expect(attempt).toBe("refused");
    expect(await page.evaluate(() => window.slopstop.listProjects())).toEqual({
      status: "listed",
      projects: [],
    });
  } finally {
    await application.close();
  }
});

test("adds a repository through the add flow in the real window and opens it", async () => {
  test.setTimeout(120_000);
  const { application, repository } = await launchWithFreshUserData();
  try {
    const page = await application.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const add = page.getByRole("button", { name: "Add existing repository", exact: true });
    await expect(add).toBeVisible();
    await answerFolderDialog(application, repository);
    await add.click();
    const heading = (name: string) => page.getByRole("heading", { level: 2, name, exact: true });
    await expect(heading("Do you trust this repository?")).toBeFocused();
    await expect(page.getByText(repository, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Trust and continue" }).click();
    await expect(heading("Check the Git program")).toBeFocused();
    await page.getByRole("button", { name: "Run version check" }).click();
    await expect(heading("Allow Git to identify repository?")).toBeFocused();
    await page.getByRole("button", { name: "Allow 6 queries" }).click();
    await expect(heading("Ready to add repository")).toBeFocused();
    await page.getByRole("button", { name: "Confirm registration" }).click();
    await expect(heading("repository was added")).toBeFocused();
    await expect(page.getByRole("button", { name: "Open Project repository, new" })).toBeVisible();

    await page.getByRole("button", { name: "Open Project", exact: true }).click();
    await expect(heading("Project repository")).toBeVisible();
    await expect(page.getByText("Read-write", { exact: true })).toBeVisible();

    await answerFolderDialog(application, repository);
    await add.click();
    await page.getByRole("button", { name: "Trust and continue" }).click();
    await expect(heading("repository is already registered")).toBeFocused();
    expect(errors).toEqual([]);
  } finally {
    await application.close();
  }
});

test("removes a Project from the list in the real window and brings it back by re-adding", async () => {
  test.setTimeout(120_000);
  const { application, repository } = await launchWithFreshUserData();
  try {
    const page = await application.firstWindow();
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    await answerFolderDialog(application, repository);
    expect(await page.evaluate(registerThroughPreload)).toMatchObject({
      result: { status: "registered" },
    });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    const heading = (name: string) => page.getByRole("heading", { level: 2, name, exact: true });

    await page.getByRole("button", { name: "Remove repository from list" }).click();
    await expect(heading("Remove repository from the list?")).toBeFocused();
    await page.getByRole("button", { name: "Remove from list" }).click();
    await expect(
      page.locator("p[role=status]", {
        hasText:
          "repository was removed from the list. Its data is still saved; adding its folder again brings it back.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Open Project repository/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add existing repository" })).toBeFocused();

    await answerFolderDialog(application, repository);
    await page.getByRole("button", { name: "Add existing repository" }).click();
    await page.getByRole("button", { name: "Trust and continue" }).click();
    // The earlier registration used the preload API, so this window approves Git first.
    await page.getByRole("button", { name: "Run version check" }).click();
    await page.getByRole("button", { name: "Allow 6 queries" }).click();
    await expect(heading("repository is back in your list")).toBeFocused();
    await expect(page.getByRole("button", { name: /^Open Project repository/ })).toBeVisible();
  } finally {
    await application.close();
  }
});
