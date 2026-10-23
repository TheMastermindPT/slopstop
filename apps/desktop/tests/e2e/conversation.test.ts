import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
  conversation,
  recordSlotTexts,
  type ShownMessage,
  shownMessages,
  slotTexts,
} from "./conversation-window.js";
import { expectDesktopLog, launchBuiltDesktop } from "./electron-launch.js";
import { seedConversationJourney } from "./harness-seed.js";

/** The RFC 3339 UTC instant a saved message carries in `time@datetime`. */
const rfc3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const upgraded = ["Opening Project…", "Updating Project…", ""];

type Opening = Readonly<{ name: string; upgrade: boolean }>;

let userData = "";
let proof = "";
let storageOnly = "";
/** The Projects that upgrade when first opened, in opening order. */
let upgradedProjectIds: readonly string[] = [];

/** The forwarded `completed` line of each upgrade, in opening order. */
const completedUpgrades = () =>
  upgradedProjectIds.map((projectId) => ({
    source: "harness",
    event: "project-storage.upgrade.completed",
    projectId,
  }));

/**
 * Launches the built desktop, runs one part of the journey with no page error, and closes it. A
 * failing close never hides the journey's own failure: the close error's message names the close,
 * and the journey failure is its `cause`, which Playwright prints.
 */
async function withLaunch<T>(run: (page: Page) => Promise<T>): Promise<T> {
  const application = await launchBuiltDesktop(proof, userData);
  let result: T;
  try {
    const page = await application.firstWindow();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    result = await run(page);
    expect(errors).toEqual([]);
  } catch (failure) {
    await application.close().catch((closing: unknown) => {
      throw new Error(`Closing the app failed after the journey failed: ${String(closing)}`, {
        cause: failure,
      });
    });
    throw failure;
  }
  await application.close();
  return result;
}

/**
 * Opens a Project from the list, recording the progress line: an upgrade open records exactly the
 * three steps (R5); any other open records no "Updating Project…".
 */
async function openProject(page: Page, { name, upgrade }: Opening) {
  const open = page.getByRole("button", { name: `Open Project ${name}`, exact: true });
  await expect(open).toBeEnabled();
  await recordSlotTexts(page, "ws-progress");
  await open.click();
  const workspace = page.getByRole("region", { name: "Project workspace" });
  await expect(
    workspace.getByRole("heading", { name: `Project ${name}`, exact: true }),
  ).toBeVisible();
  await expect(workspace.getByText("Read-write", { exact: true })).toBeVisible();
  const progress = async () => (await slotTexts(page, "ws-progress")).texts;
  if (upgrade) {
    await expect.poll(progress).toEqual(upgraded);
  } else {
    await expect.poll(async () => (await progress()).at(-1)).toBe("");
    expect(await progress()).not.toContain("Updating Project…");
  }
  await expect(page.getByRole("alert")).toHaveCount(0);
}

/**
 * Waits until the region has loaded `count` messages with the composer focused and an empty slot,
 * then installs the status recorder on this activation's slot (R3).
 */
async function loaded(page: Page, count: number) {
  const { composer, messages, region, status } = conversation(page);
  await expect(composer).toBeFocused();
  await expect(messages.locator(":scope > li")).toHaveCount(count);
  if (count === 0) await expect(region.getByText("No messages yet")).toBeVisible();
  await expect(status).toHaveText("");
  await recordSlotTexts(page, "conversation-status");
}

/**
 * Saves one message by pressing Save locally (R2): the slot records exactly "Saving…" then
 * "Saved", and when "Saved" first appears the list already ends with the new message. The next
 * input records "". Returns the message as it was shown with "Saved".
 */
async function saveOne(page: Page, text: string, before: readonly ShownMessage[]) {
  const { composer, save, status } = conversation(page);
  await composer.fill(text);
  expect((await slotTexts(page, "conversation-status")).texts).toEqual([]);
  await save.click();
  await expect(status).toHaveText("Saved");
  const { texts, messagesAtSaved } = await slotTexts(page, "conversation-status", true);
  expect(texts).toEqual(["Saving…", "Saved"]);
  const added = messagesAtSaved?.at(-1);
  expect(messagesAtSaved?.slice(0, -1)).toEqual(before);
  expect(added?.text).toBe(text);
  expect(added?.savedAt).toMatch(rfc3339);
  await composer.fill(`${text}.`);
  // Wait without clearing, so a transient line before the empty slot stays in the record.
  await expect
    .poll(async () => (await slotTexts(page, "conversation-status")).texts.at(-1))
    .toBe("");
  expect((await slotTexts(page, "conversation-status", true)).texts).toEqual([""]);
  await composer.fill("");
  if (added === undefined) throw new Error("No message at Saved");
  return added;
}

/** Opens a Project and checks it shows exactly the messages captured at their saves (R4). */
async function reopen(page: Page, opening: Opening, saved: readonly ShownMessage[]) {
  await openProject(page, opening);
  await loaded(page, saved.length);
  expect(await shownMessages(page)).toEqual(saved);
}

test.beforeAll(async () => {
  test.setTimeout(150_000);
  proof = await mkdtemp(path.join(tmpdir(), "slopstop-conversation-"));
  userData = path.join(proof, "user-data");
  await mkdir(userData);
  const seeded = await seedConversationJourney(userData);
  storageOnly = `without a repository ${seeded.storageOnlyShort}`;
  upgradedProjectIds = seeded.upgradedProjectIds;
});

/** Opens a Project with no messages yet and saves the given ones in order. */
async function openAndSave(page: Page, opening: Opening, texts: readonly string[]) {
  await openProject(page, opening);
  await loaded(page, 0);
  const saved: ShownMessage[] = [];
  for (const text of texts) saved.push(await saveOne(page, text, saved));
  return saved;
}

test("saves, switches, restarts and reopens", async () => {
  test.setTimeout(150_000);
  const a = { name: "repository-a", upgrade: false };
  const b = { name: "repository-b", upgrade: true };
  const storage = { name: storageOnly, upgrade: true };
  const saved = await withLaunch(async (page) => {
    const messagesA = await test.step("repository-a saves two messages", () =>
      openAndSave(page, a, [
        "First message in repository-a",
        "  Second message\nhas a line break  ",
      ]));
    const messagesB = await test.step("repository-b updates on opening, then saves", () =>
      openAndSave(page, b, ["One message in repository-b"]));
    await test.step("repository-a still shows its two messages", () => reopen(page, a, messagesA));
    const messagesStorage =
      await test.step("the Project without a repository updates, then saves", () =>
        openAndSave(page, storage, ["One message without a repository"]));
    return { a: messagesA, b: messagesB, storage: messagesStorage };
  });
  await expectDesktopLog(userData, 1, completedUpgrades());

  await withLaunch((page) =>
    test.step("after a restart, each Project reopens with its messages", async () => {
      await reopen(page, a, saved.a);
      await reopen(page, { ...b, upgrade: false }, saved.b);
      await reopen(page, { ...storage, upgrade: false }, saved.storage);
    }),
  );
  // The reopens upgrade nothing, so the log still holds only the first launch's two lines.
  await expectDesktopLog(userData, 2, completedUpgrades());
});
