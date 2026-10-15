import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.resolve(import.meta.dirname, file), "utf8");
const legacyShell = read("legacy-shell.css");
const declared = new Set(
  [...legacyShell.matchAll(/(--legacy-[\w-]+)\s*:/g)].map((match) => match[1]),
);

describe("the old shell's style sheets", () => {
  it.each(["legacy-shell.css", "global.css", "projects-workspace.module.css"])(
    "only use --legacy-* properties that legacy-shell.css declares (%s)",
    (file) => {
      const used = [...read(file).matchAll(/var\((--legacy-[\w-]+)/g)].map((match) => match[1]);
      expect(used.filter((property) => !declared.has(property))).toEqual([]);
    },
  );

  it("declares the old tokens", () => {
    expect(declared.size).toBeGreaterThan(0);
  });
});
