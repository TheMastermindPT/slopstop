import path from "node:path";
import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { projectConversationDiagnostics as rows } from "@slopstop/protocol";
import {
  cspViolations,
  layoutFacts,
  recordCspViolations,
  setZoom,
  sizeContent,
} from "./accessibility.js";
import {
  conversation,
  expectAccessibleState,
  expectOneLeftEdge,
  expectSlotHiddenButAnnounced,
  fieldGapToWindowEdge,
  focusFacts,
  regionSelector,
  regionTransitionDurations,
  replaceHandlers,
  scrollAfterSaved,
  shadowLayers,
  streamAtEnd,
} from "./conversation-window.js";
import { expectNoHarnessRequestFailure, launchBuiltDesktop } from "./electron-launch.js";
import { seedTwoProjects } from "./harness-seed.js";
import { temporaryRoot } from "./temporary-root.js";

const canvas = [5, 6, 6];
const frost = [156, 201, 224];
const blood = [229, 118, 106];
const tooLong = "This message is longer than 32 KiB.";

type Launched = Readonly<{ application: ElectronApplication; page: Page; errors: string[] }>;

/** Launches the built desktop on a seeded `userData`, sized, with CSP violations recorded. */
async function launchOn(userData: string, proof: string, scale = 1): Promise<Launched> {
  const application = await launchBuiltDesktop(proof, userData, [
    `--force-device-scale-factor=${scale}`,
  ]);
  const page = await application.firstWindow();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await recordCspViolations(page);
  return { application, page, errors };
}

async function openProject(page: Page, name: "repository-a" | "repository-b") {
  await page.getByRole("button", { name: `Open Project ${name}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: `Project ${name}`, exact: true })).toBeVisible();
}

async function expectCleanRun({ page, errors }: Launched) {
  expect(errors).toEqual([]);
  expect(await cspViolations(page)).toEqual([]);
}

/** Saves one message by keyboard and waits for "Saved". */
async function saveByKeyboard(page: Page, text: string) {
  const { composer, status } = conversation(page);
  await composer.fill(text);
  await expect(status).not.toHaveText("Saved");
  await composer.press("Control+Enter");
  await expect(status).toHaveText("Saved");
}

/** Step 2: the decided focus ring on Save and the field, in normal and forced colours. */
async function expectFocusRings(page: Page) {
  const { composer, save, field } = conversation(page);
  await composer.fill("A second message");
  // Round 1 T2: the new input ends the first "Saved", so the next one is this save's own.
  await expect(conversation(page).status).not.toHaveText("Saved");
  await page.keyboard.press("Tab");
  const ring = await focusFacts(save);
  expect(ring).toMatchObject({
    focused: true,
    outlineColor: "rgba(0, 0, 0, 0)",
    outlineWidth: "2px",
    outlineOffset: "2px",
    borderWidth: "0px",
    fontFamily: "Red Hat Text",
  });
  expect(shadowLayers(ring.boxShadow)).toEqual(frostRing);
  await save.hover();
  expect((await focusFacts(save)).backgroundColor).toBe("rgb(178, 214, 232)");
  await page.emulateMedia({ forcedColors: "active" });
  expect(await focusFacts(save)).toMatchObject({
    outlineStyle: "solid",
    outlineWidth: "2px",
    outlineOffset: "2px",
    borderWidth: "1px",
  });
  await page.emulateMedia({ forcedColors: "none" });
  await page.keyboard.press("Enter");
  await expect(conversation(page).status).toHaveText("Saved");
  await expect(composer).toBeFocused();
  for (const forcedColors of ["none", "active"] as const) {
    await page.emulateMedia({ forcedColors });
    expect((await focusFacts(composer)).outlineStyle).toBe("none");
  }
  await page.emulateMedia({ forcedColors: "none" });
  expect(shadowLayers((await focusFacts(field)).boxShadow)).toEqual([
    { colour: frost, spread: 1.5 },
    { colour: [...frost, 0.22], spread: 5 },
  ]);
  await page.emulateMedia({ forcedColors: "active" });
  expect(await focusFacts(field)).toMatchObject({ outlineStyle: "solid", outlineWidth: "2px" });
  await page.emulateMedia({ forcedColors: "none" });
}

/** Step 6: no horizontal overflow and Save wholly visible. */
async function expectFits(page: Page) {
  expect((await layoutFacts(page, regionSelector)).overflows).toBe(false);
  expect(
    (await layoutFacts(page, `${regionSelector} button >> text="Save locally"`)).inViewport,
  ).toBe(true);
}

/** Steps 1 and 2: the empty state, then saving by keyboard and the focus rings. */
async function stepsOneAndTwo(page: Page, shots: string) {
  const { composer, status, messages } = conversation(page);
  await openProject(page, "repository-a");
  await expect(composer).toBeFocused();
  // ui-ux C4: an empty field leaves Save unavailable, still focusable, and painted so (§54).
  expect(
    await conversation(page).save.evaluate((save) => {
      const style = getComputedStyle(save);
      return [style.opacity, style.cursor, style.boxShadow];
    }),
  ).toEqual(["0.45", "not-allowed", "none"]);
  // ui-ux C1: the composer sits in one centred column of at most 720px.
  const column = await conversation(page).field.evaluate(
    (field) => field.getBoundingClientRect().width,
  );
  expect(column).toBeLessThanOrEqual(720);
  // Round 1 T1: the unavailable Save keeps its focus ring when the keyboard reaches it.
  await page.keyboard.press("Tab");
  expect(shadowLayers((await focusFacts(conversation(page).save)).boxShadow)).toEqual(frostRing);
  // ui-ux: focused, the unavailable Save lifts from 0.45 to 0.7.
  expect(await conversation(page).save.evaluate((save) => getComputedStyle(save).opacity)).toBe(
    "0.7",
  );
  // Round 2 F3: under forced colours the focused unavailable Save shows the system outline.
  await page.emulateMedia({ forcedColors: "active" });
  expect((await focusFacts(conversation(page).save)).outlineStyle).toBe("solid");
  await page.emulateMedia({ forcedColors: "none" });
  await shotBothModes(page, shots, "t1-save-unavailable");
  await composer.focus();
  await expectOneLeftEdge(page);
  await expectAccessibleState(page, shots, "1-empty");
  await composer.pressSequentially("First line");
  await composer.press("Shift+Enter");
  await composer.pressSequentially("Second line");
  await composer.press("Control+Enter");
  await expect(status).toHaveText("Saved");
  await expect(messages.getByRole("listitem").last()).toBeInViewport();
  await expect(composer).toBeFocused();
  await expectOneLeftEdge(page);
  await expectFocusRings(page);
  await expectAccessibleState(page, shots, "2-saved");
}

/** Step 3: the over-limit fault, then clearing it. */
async function stepThree(page: Page, shots: string) {
  const { composer, status } = conversation(page);
  await composer.fill(`${"é".repeat(16_384)}a`);
  await expect(status).toHaveText(tooLong);
  // ui-ux C6: the field's ring turns blood while the text is over the limit, focused or not.
  expect(shadowLayers((await focusFacts(conversation(page).field)).boxShadow)).toEqual([
    { colour: blood, spread: 1.5 },
    { colour: [...blood, 0.14], spread: 4 },
  ]);
  await expectAccessibleState(page, shots, "3-over-limit");
  await composer.fill("");
  await expect(status).not.toHaveText(tooLong);
}

/** Step 4: enough messages to overflow the stream; reopening shows the newest one. */
async function stepFour(page: Page, shots: string) {
  const { messages, stream } = conversation(page);
  for (let index = 0; index < 12; index += 1) await saveByKeyboard(page, `Message ${index}`);
  expect(await stream.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true,
  );
  await openProject(page, "repository-b");
  await openProject(page, "repository-a");
  await expect(messages.getByRole("listitem").last()).toBeInViewport();
  await page.screenshot({ path: path.join(shots, "4-many.png") });
}

/** Step 5: reduced motion, with no smooth or late scrolling after a save. */
async function stepFive(page: Page) {
  const { composer, stream } = conversation(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(new Set(await regionTransitionDurations(page))).toEqual(new Set(["0s"]));
  await composer.fill("Reduced motion");
  const scrolled = scrollAfterSaved(page);
  await composer.press("Control+Enter");
  expect(await scrolled).toEqual({ atEnd: true, movedAfter: false });
  expect(await stream.evaluate((element) => getComputedStyle(element).scrollBehavior)).toBe("auto");
  expect(await streamAtEnd(page)).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
}

/** Step 6: zoom 50 % and 200 %. */
async function stepSix(application: ElectronApplication, page: Page) {
  for (const factor of [0.5, 2]) {
    await setZoom(application, page, { factor, width: 1280, height: 800 });
    await expectFits(page);
  }
  await setZoom(application, page, { factor: 1, width: 1280, height: 800 });
}

test("meets the accessibility checklist in the real window", async () => {
  test.setTimeout(150_000);
  const proof = await temporaryRoot("s4b-a11y-");
  const userData = path.join(proof, "user-data");
  const shots = path.join(proof, "s4b-visual");
  await seedTwoProjects(userData);
  const launched = await launchOn(userData, proof);
  const { application, page } = launched;
  try {
    await sizeContent(application, page, 1280, 800);

    await stepsOneAndTwo(page, shots);
    await stepThree(page, shots);
    await stepFour(page, shots);
    await stepFive(page);
    await stepSix(application, page);
    await expectCleanRun(launched);
  } finally {
    await application.close();
  }

  // 6, second launch: 150 % scale at 853x533; also the screenshots for Pedro's 150 % display.
  const scaled = await launchOn(userData, proof, 1.5);
  try {
    await scaled.application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(853, 533);
    });
    await expect
      .poll(() => scaled.page.evaluate(() => Math.abs(window.innerWidth - 853) <= 1))
      .toBe(true);
    await openProject(scaled.page, "repository-a");
    await expectFits(scaled.page);
    await scaled.page.screenshot({ path: path.join(shots, "6-scale-150.png") });
    await expectCleanRun(scaled);
  } finally {
    await scaled.application.close();
  }
  await expectNoHarnessRequestFailure(userData);
  console.log(`S4b accessibility screenshots: ${shots}`);
});

type UnreachableGroup = Readonly<{
  name: string;
  replacements: Parameters<typeof replaceHandlers>[1];
  act(page: Page): Promise<void>;
}>;

const readChannel = "projects:conversation:read";
const saveChannel = "projects:conversation:save";
const emptyRead = { status: "read", conversation: null };

/** Presses Save with text and waits for the status slot to change from "Saving…". */
async function pressSave(page: Page, text: string) {
  const { composer, save, status } = conversation(page);
  await composer.fill(text);
  await save.click();
  await expect(status).not.toHaveText("Saving…");
}

/** The focus facts of the focused Try again or Reload button, in both colour modes. */
/** Moves keyboard focus to a control with Tab, as a keyboard user reaches it (`:focus-visible`). */
async function tabTo(page: Page, name: "Try again" | "Reload") {
  const action = conversation(page).region.getByRole("button", { name });
  for (let presses = 0; presses < 20; presses += 1) {
    await page.keyboard.press("Tab");
    if (await action.evaluate((element) => element === document.activeElement)) return action;
  }
  throw new Error(`Tab never reached ${name}`);
}

/** Deep review I4/Q10: with Reload or Try again mounted, no region control animates (G26). */
async function expectStillUnderReducedMotion(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(new Set(await regionTransitionDurations(page))).toEqual(new Set(["0s"]));
  await page.emulateMedia({ reducedMotion: "no-preference" });
}

/** Deep review Q12: under forced colours the Unknown status row draws a real edge. */
async function expectUnknownRowEdge(page: Page) {
  await page.emulateMedia({ forcedColors: "active" });
  const edge = await page.locator("#conversation-status").evaluate((slot) => {
    const style = slot.parentElement ? getComputedStyle(slot.parentElement) : undefined;
    return [
      slot.parentElement?.getAttribute("data-tone"),
      style?.borderTopStyle,
      style?.borderTopWidth,
    ];
  });
  expect(edge).toEqual(["unknown", "solid", "1px"]);
  await page.emulateMedia({ forcedColors: "none" });
}

/** One screenshot in normal colours and one under forced colours, for the ui-ux review. */
async function shotBothModes(page: Page, folder: string, name: string) {
  await page.screenshot({ path: path.join(folder, `${name}.png`) });
  await page.emulateMedia({ forcedColors: "active" });
  await page.screenshot({ path: path.join(folder, `${name}-forced.png`) });
  await page.emulateMedia({ forcedColors: "none" });
}

/** The focus ring on a frost-filled button: a canvas gap, the frost line and its halo. */
const frostRing = [
  { colour: canvas, spread: 2 },
  { colour: frost, spread: 3.5 },
  { colour: [...frost, 0.22], spread: 7 },
];

/**
 * Round 1 T1: a focused ghost button that cannot act (aria-disabled) still draws its focus ring,
 * and the system outline under forced colours.
 */
async function expectUnavailableRing(page: Page, name: "Try again" | "Reload") {
  const action = conversation(page).region.getByRole("button", { name });
  await expect(action).toHaveAttribute("aria-disabled", "true");
  await expect(action).toBeFocused();
  // ui-ux: focused, an unavailable control lifts to 0.7 so its ring stays clear.
  expect(await action.evaluate((element) => getComputedStyle(element).opacity)).toBe("0.7");
  expect(shadowLayers((await focusFacts(action)).boxShadow)[0]).toEqual({
    colour: frost,
    spread: 1.5,
  });
  await page.emulateMedia({ forcedColors: "active" });
  expect((await focusFacts(action)).outlineStyle).toBe("solid");
  await page.emulateMedia({ forcedColors: "none" });
}

async function expectActionRing(page: Page, name: "Try again" | "Reload") {
  const action = await tabTo(page, name);
  const ring = await focusFacts(action);
  expect(ring).toMatchObject({
    outlineColor: "rgba(0, 0, 0, 0)",
    outlineWidth: "2px",
    outlineOffset: "2px",
  });
  expect(shadowLayers(ring.boxShadow)[0]).toEqual({ colour: frost, spread: 1.5 });
  await page.emulateMedia({ forcedColors: "active" });
  expect((await focusFacts(action)).outlineStyle).toBe("solid");
  await page.emulateMedia({ forcedColors: "none" });
}

const unreachable: UnreachableGroup[] = [
  {
    name: "a-save-faults",
    replacements: [
      { channel: readChannel, answers: [emptyRead] },
      {
        channel: saveChannel,
        answers: [
          { status: "uncertain", diagnostic: rows.saveUnconfirmed },
          { status: "broken", diagnostic: rows.storageBroken },
          "throw",
        ],
      },
    ],
    async act(page) {
      await pressSave(page, "Uncertain");
      await expect(conversation(page).status).toContainText("Not confirmed.");
      await expectActionRing(page, "Try again");
      await expectStillUnderReducedMotion(page);
      await expectUnknownRowEdge(page);
      await expectAccessibleState(page, unreachableShots(page), "8a-uncertain");
      await conversation(page).composer.fill("Broken");
      await conversation(page).save.click();
      await expect(page.getByRole("alert")).toContainText("Code PROJECT_STORAGE_BROKEN");
      await expectAccessibleState(page, unreachableShots(page), "8a-broken");
      await conversation(page).composer.fill("Rejected");
      await conversation(page).save.click();
      await expect(conversation(page).status).toContainText(
        "The desktop could not complete this save.",
      );
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expectAccessibleState(page, unreachableShots(page), "8a-rejected");
    },
  },
  {
    name: "b-read-unavailable",
    replacements: [
      {
        channel: readChannel,
        answers: [{ status: "unavailable", diagnostic: rows.storageUnavailable }, "hang"],
      },
    ],
    async act(page) {
      await expectSlotHiddenButAnnounced(page, "Could not load this conversation.");
      await expectOneLeftEdge(page);
      await expectStillUnderReducedMotion(page);
      // ui-ux review 3: with the slot hidden, the field still sits 20px above the window edge.
      expect(await fieldGapToWindowEdge(page)).toBe(20);
      await expectActionRing(page, "Reload");
      await expectAccessibleState(page, unreachableShots(page), "8b-read-unavailable");
      // Round 1 T1: Reload stays focused and ringed while its read is in flight.
      await page.keyboard.press("Enter");
      await expectUnavailableRing(page, "Reload");
      await shotBothModes(page, unreachableShots(page), "t1-reload-unavailable");
    },
  },
  {
    name: "c-read-broken",
    replacements: [
      { channel: readChannel, answers: [{ status: "broken", diagnostic: rows.storageBroken }] },
    ],
    async act(page) {
      await expect(page.getByRole("alert")).toContainText("Code PROJECT_STORAGE_BROKEN");
      await expectActionRing(page, "Reload");
      await expectAccessibleState(page, unreachableShots(page), "8c-read-broken");
    },
  },
  {
    name: "d-read-rejected",
    replacements: [{ channel: readChannel, answers: ["throw"] }],
    async act(page) {
      await expect(conversation(page).region).toContainText(
        "The desktop could not load this conversation.",
      );
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expectSlotHiddenButAnnounced(page, "Could not load this conversation.");
      await expectActionRing(page, "Reload");
      await expectAccessibleState(page, unreachableShots(page), "8d-read-rejected");
    },
  },
  {
    name: "e-read-stale",
    replacements: [
      {
        channel: readChannel,
        answers: [{ status: "stale-activation", diagnostic: rows.staleActivation }],
      },
    ],
    async act(page) {
      await expect(conversation(page).region).toContainText(
        "This Project was reopened elsewhere. Restart Ragnarok to open it again.",
      );
      await expectSlotHiddenButAnnounced(page, "Could not load this conversation.");
      await expect(conversation(page).region.getByRole("button", { name: "Reload" })).toHaveCount(
        0,
      );
      await expectAccessibleState(page, unreachableShots(page), "8e-read-stale");
    },
  },
  {
    name: "g-try-again-unavailable",
    replacements: [
      { channel: readChannel, answers: [emptyRead, emptyRead, "hang"] },
      {
        channel: saveChannel,
        answers: [{ status: "unavailable", diagnostic: rows.storageUnavailable }],
      },
    ],
    async act(page) {
      await pressSave(page, "Kept");
      await openProject(page, "repository-a");
      await openProject(page, "repository-b");
      await tabTo(page, "Try again");
      await expectUnavailableRing(page, "Try again");
      await shotBothModes(page, unreachableShots(page), "t1-try-again-unavailable");
    },
  },
  {
    name: "f-read-only",
    replacements: [
      {
        channel: "projects:activate",
        answers: [
          {
            status: "active",
            access: "read-only",
            activationId: "00000000-0000-4000-8000-0000000000f1",
            writerGeneration: null,
            diagnostic: {
              code: "WRITER_UNAVAILABLE",
              message: "Another session owns the writer.",
              retryable: true,
            },
          },
        ],
      },
      { channel: readChannel, answers: [emptyRead] },
    ],
    async act(page) {
      await expect(page.getByText(`Read only: ${rows.readOnly.message}`)).toBeVisible();
      await expectOneLeftEdge(page);
      await expectAccessibleState(page, unreachableShots(page), "8f-read-only");
    },
  },
];

const shotsByPage = new WeakMap<Page, string>();
function unreachableShots(page: Page): string {
  const shots = shotsByPage.get(page);
  if (shots === undefined) throw new Error("No screenshot folder for this page");
  return shots;
}

test.describe("reaches the states the seed cannot", () => {
  let userData = "";
  let proof = "";
  test.beforeAll(async () => {
    test.setTimeout(150_000);
    proof = await temporaryRoot("s4b-states-");
    userData = path.join(proof, "user-data");
    await seedTwoProjects(userData);
  });

  for (const group of unreachable) {
    test(`shows ${group.name} accessibly`, async () => {
      test.setTimeout(150_000);
      const launched = await launchOn(userData, proof);
      try {
        shotsByPage.set(launched.page, path.join(proof, "s4b-visual"));
        await sizeContent(launched.application, launched.page, 1280, 800);
        await replaceHandlers(launched.application, group.replacements);
        await openProject(launched.page, "repository-b");
        await group.act(launched.page);
        await expectCleanRun(launched);
      } finally {
        await launched.application.close();
      }
      await expectNoHarnessRequestFailure(userData);
    });
  }
});
