import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  attentionHeadingId,
  focusHeadingAttribute,
  projectsHeadingId,
  workHeadingId,
} from "./focus-headings.js";

/** The renderer's folder, found from this file, not from where the run started. */
const renderer = path.resolve(import.meta.dirname, "..");

/** The renderer's source files and style sheets, relative to it, without tests and their setup. */
const sources = readdirSync(renderer, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(ts|tsx|css)$/u.test(entry.name))
  .filter((entry) => !/\.test\.tsx?$/u.test(entry.name) && entry.name !== "test-setup.ts")
  .map((entry) =>
    path.relative(renderer, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"),
  )
  .sort();

const owner = "shell/focus-headings.ts";

/** The files, other than `skip`, whose text holds any of `texts`. */
const holding = (texts: readonly string[], skip: readonly string[] = []) =>
  sources.filter(
    (file) =>
      !skip.includes(file) &&
      texts.some((text) => readFileSync(path.join(renderer, file), "utf8").includes(text)),
  );

describe("the focus headings' owner", () => {
  it("SH-B24: reads the renderer's sources and style sheets, tests left out", () => {
    expect(sources).toEqual(
      expect.arrayContaining([
        owner,
        "conversation/conversation-region.tsx",
        "add-repository/flow-screens.tsx",
        "shell/shell-frame.module.css",
      ]),
    );
    expect(sources.filter((file) => /\.test\.|test-setup/u.test(file))).toEqual([]);
  });

  it("SH-B24: writes each focus heading id in its owner and in no other file", () => {
    expect(holding([projectsHeadingId, attentionHeadingId, workHeadingId], [owner])).toEqual([]);
  });

  it("SH-B24: writes the ring attribute only in its owner and the ring rule", () => {
    expect(holding([focusHeadingAttribute])).toEqual([owner, "shell/shell-frame.module.css"]);
  });
});
