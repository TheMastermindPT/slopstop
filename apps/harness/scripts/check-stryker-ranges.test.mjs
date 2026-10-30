import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { checkStrykerRanges, runStrykerRanges } from "./check-stryker-ranges.mjs";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const checker = fileURLToPath(new URL("./check-stryker-ranges.mjs", import.meta.url));
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const sourceA = Array.from(
  { length: 12 },
  (_, index) => `export const a${index + 1} = ${index + 1};`,
);
const sourceB = Array.from(
  { length: 6 },
  (_, index) => `export const b${index + 1} = ${index + 1};`,
);

/** The anchor of `entry`, taken from the lines the range holds in `source`. */
function anchor(config, entry, source) {
  const [, first, last] = /:(\d+)-(\d+)$/.exec(entry);
  return { config, entry, first: source[first - 1], last: source[last - 1] };
}

const aligned = {
  "stryker.config.json": ["src/a.ts:3-5", "src/a.ts:8-10", "src/whole.ts"],
  "stryker.small.config.json": ["src/b.ts:2-4"],
};
const alignedAnchors = [
  anchor("stryker.config.json", "src/a.ts:3-5", sourceA),
  anchor("stryker.config.json", "src/a.ts:8-10", sourceA),
  anchor("stryker.small.config.json", "src/b.ts:2-4", sourceB),
];

/**
 * A temporary root with the given configs (`mutate` lists, or raw text), anchors (a list, raw
 * text, or `null` for no anchors file) and source files (line lists, each written with a
 * final newline, or raw text).
 */
function plantedRoot({
  configs = aligned,
  anchors = alignedAnchors,
  files = { "src/a.ts": sourceA, "src/b.ts": sourceB, "src/whole.ts": ["export {};"] },
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "slopstop-stryker-ranges-"));
  roots.push(root);
  for (const [name, mutate] of Object.entries(configs)) {
    const text = typeof mutate === "string" ? mutate : JSON.stringify({ mutate });
    writeFileSync(join(root, name), text);
  }
  if (anchors !== null) {
    const text = typeof anchors === "string" ? anchors : JSON.stringify(anchors);
    writeFileSync(join(root, "stryker-range-anchors.json"), text);
  }
  for (const [path, lines] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), typeof lines === "string" ? lines : `${lines.join("\n")}\n`);
  }
  return root;
}

const alignedResult = {
  ok: true,
  configs: [
    { config: "stryker.config.json", ranges: 2, wholeFiles: 1 },
    { config: "stryker.small.config.json", ranges: 1, wholeFiles: 0 },
  ],
};

function withLine(lines, at, text) {
  return [...lines.slice(0, at), text, ...lines.slice(at)];
}

function replaced(lines, lineNumber, text) {
  return lines.map((line, index) => (index === lineNumber - 1 ? text : line));
}

it("passes configs whose ranges hold their anchored boundary lines", () => {
  expect(checkStrykerRanges({ root: plantedRoot() })).toEqual(alignedResult);
});

it("passes an edit inside a range whose boundary lines stay put", () => {
  const files = {
    "src/a.ts": replaced(sourceA, 4, "export const a4 = 40;"),
    "src/b.ts": sourceB,
    "src/whole.ts": ["export {};"],
  };
  expect(checkStrykerRanges({ root: plantedRoot({ files }) })).toEqual(alignedResult);
});

it.each([
  ["the single re-pointed range when a line is inserted above a range", 0, "src/a.ts:4-6"],
  ["the widened range when a line is inserted inside a range", 3, "src/a.ts:3-6"],
])("names %s", (_case, at, moved) => {
  const files = {
    "src/a.ts": withLine(sourceA, at, "// inserted"),
    "src/b.ts": sourceB,
    "src/whole.ts": ["export {};"],
  };
  expect(checkStrykerRanges({ root: plantedRoot({ files }) })).toEqual({
    ok: false,
    code: "STRYKER_RANGE_DRIFT",
    lines: [
      `stryker.config.json: src/a.ts:3-5 moved to ${moved}`,
      "stryker.config.json: src/a.ts:8-10 moved to src/a.ts:9-11",
    ],
  });
});

it.each([
  [
    "first",
    3,
    "stryker.config.json: src/a.ts:3-5 drifted; first line found nowhere, last line found at 5",
  ],
  [
    "last",
    5,
    "stryker.config.json: src/a.ts:3-5 drifted; first line found at 3, last line found nowhere",
  ],
])("reports a changed %s boundary line with no suggestion", (_boundary, lineNumber, line) => {
  const files = {
    "src/a.ts": replaced(sourceA, lineNumber, "export const changed = 0;"),
    "src/b.ts": sourceB,
    "src/whole.ts": ["export {};"],
  };
  expect(checkStrykerRanges({ root: plantedRoot({ files }) })).toEqual({
    ok: false,
    code: "STRYKER_RANGE_DRIFT",
    lines: [line],
  });
});

it("names both places when the anchored pair is found twice", () => {
  const configs = { "stryker.small.config.json": ["src/b.ts:2-4"] };
  const anchors = [anchor("stryker.small.config.json", "src/b.ts:2-4", sourceB)];
  const files = { "src/b.ts": ["// inserted", ...sourceB, ...sourceB.slice(1, 4)] };
  expect(checkStrykerRanges({ root: plantedRoot({ configs, anchors, files }) })).toEqual({
    ok: false,
    code: "STRYKER_RANGE_DRIFT",
    lines: [
      "stryker.small.config.json: src/b.ts:2-4 drifted; anchored pair found at src/b.ts:3-5, src/b.ts:8-10",
    ],
  });
});

it("fails a range with no anchor", () => {
  const configs = { ...aligned, "stryker.small.config.json": ["src/b.ts:2-4", "src/b.ts:5-6"] };
  expect(checkStrykerRanges({ root: plantedRoot({ configs }) })).toEqual({
    ok: false,
    code: "STRYKER_RANGE_UNANCHORED",
    lines: ["stryker.small.config.json: src/b.ts:5-6 has no anchor"],
  });
});

it("fails an anchor whose range was removed", () => {
  const configs = { ...aligned, "stryker.config.json": ["src/a.ts:3-5", "src/whole.ts"] };
  expect(checkStrykerRanges({ root: plantedRoot({ configs }) })).toEqual({
    ok: false,
    code: "STRYKER_RANGE_STALE_ANCHOR",
    lines: ["stryker.config.json: src/a.ts:8-10 is anchored but has no range"],
  });
});

it.each([
  [
    "a missing source file",
    { files: { "src/a.ts": sourceA, "src/whole.ts": ["export {};"] } },
    "stryker.small.config.json: src/b.ts:2-4 names a missing source file",
  ],
  [
    "a range past the end of the file",
    {
      configs: { ...aligned, "stryker.small.config.json": ["src/b.ts:2-7"] },
      anchors: [...alignedAnchors.slice(0, 2), { ...alignedAnchors[2], entry: "src/b.ts:2-7" }],
    },
    "stryker.small.config.json: src/b.ts:2-7 ends past the file's last line (6)",
  ],
  [
    "a range that starts after it ends",
    {
      configs: { ...aligned, "stryker.small.config.json": ["src/b.ts:4-2"] },
      anchors: [...alignedAnchors.slice(0, 2), { ...alignedAnchors[2], entry: "src/b.ts:4-2" }],
    },
    "stryker.small.config.json: src/b.ts:4-2 starts after it ends",
  ],
  [
    "invalid JSON in a config",
    { configs: { ...aligned, "stryker.small.config.json": "{ mutate: [" } },
    "stryker.small.config.json: unreadable or invalid JSON",
  ],
  [
    "invalid JSON in the anchors",
    { anchors: "[{" },
    "stryker-range-anchors.json: unreadable or invalid JSON",
  ],
  [
    "a line and column entry",
    {
      configs: { ...aligned, "stryker.small.config.json": ["src/b.ts:2-4", "src/b.ts:1:2-3:4"] },
    },
    "stryker.small.config.json: src/b.ts:1:2-3:4 has a line or column form the check does not parse",
  ],
  ...["null", "[]", "5"].map((text) => [
    `a config whose JSON is ${text}`,
    { configs: { ...aligned, "stryker.small.config.json": text } },
    "stryker.small.config.json: not a JSON object",
  ]),
  [
    "a root Stryker file the check does not recognise",
    { configs: { ...aligned, "stryker-extra.json": ["src/b.ts:2-4"] } },
    "stryker-extra.json: a root Stryker file the check does not recognise",
  ],
  [
    "a duplicate anchor",
    { anchors: [...alignedAnchors, alignedAnchors[0]] },
    "stryker-range-anchors.json: duplicate anchor for stryker.config.json src/a.ts:3-5",
  ],
])("fails %s as broken", (_case, planted, line) => {
  expect(checkStrykerRanges({ root: plantedRoot(planted) })).toEqual({
    ok: false,
    code: "STRYKER_RANGE_BROKEN",
    lines: [line],
  });
});

it("reports every range as unanchored when the anchors file is missing", () => {
  expect(checkStrykerRanges({ root: plantedRoot({ anchors: null }) })).toEqual({
    ok: false,
    code: "STRYKER_RANGE_UNANCHORED",
    lines: [
      "stryker.config.json: src/a.ts:3-5 has no anchor",
      "stryker.config.json: src/a.ts:8-10 has no anchor",
      "stryker.small.config.json: src/b.ts:2-4 has no anchor",
    ],
  });
});

it("fails an anchors file that cannot be read as broken, not as missing", () => {
  const root = plantedRoot({ anchors: null });
  mkdirSync(join(root, "stryker-range-anchors.json"));
  expect(checkStrykerRanges({ root })).toEqual({
    ok: false,
    code: "STRYKER_RANGE_BROKEN",
    lines: ["stryker-range-anchors.json: unreadable or invalid JSON"],
  });
});

const notAnchors = "stryker-range-anchors.json: not a list of anchors";
const notEntries = "stryker.small.config.json: mutate is not a list of entries";

it.each([
  ["anchors that are not a list", { anchors: "{}" }, notAnchors],
  [
    "an anchor without its last line",
    { anchors: [...alignedAnchors, { config: "stryker.config.json", entry: "src/a.ts:1-2" }] },
    notAnchors,
  ],
  [
    "an anchor whose last line is not text",
    { anchors: [...alignedAnchors, { ...alignedAnchors[0], entry: "src/a.ts:1-2", last: 2 }] },
    notAnchors,
  ],
  ["a null anchor", { anchors: [...alignedAnchors, null] }, notAnchors],
  [
    "a mutate that is not a list",
    { configs: { ...aligned, "stryker.small.config.json": '{ "mutate": "src/b.ts:2-4" }' } },
    notEntries,
  ],
  [
    "a mutate entry that is not text",
    { configs: { ...aligned, "stryker.small.config.json": '{ "mutate": ["src/b.ts:2-4", 5] }' } },
    notEntries,
  ],
])("fails %s as broken", (_case, planted, line) => {
  expect(checkStrykerRanges({ root: plantedRoot(planted) })).toEqual({
    ok: false,
    code: "STRYKER_RANGE_BROKEN",
    lines: [line],
  });
});

it("counts a config without a mutate list as empty", () => {
  const configs = { ...aligned, "stryker.empty.config.json": "{}" };
  expect(checkStrykerRanges({ root: plantedRoot({ configs }) })).toEqual({
    ok: true,
    configs: [
      { config: "stryker.config.json", ranges: 2, wholeFiles: 1 },
      { config: "stryker.empty.config.json", ranges: 0, wholeFiles: 0 },
      { config: "stryker.small.config.json", ranges: 1, wholeFiles: 0 },
    ],
  });
});

it("lists the configs in code-unit order, whatever the directory order", () => {
  const configs = {
    "stryker.a.config.json": ["src/whole.ts"],
    "stryker.B.config.json": ["src/whole.ts"],
  };
  expect(checkStrykerRanges({ root: plantedRoot({ configs, anchors: [] }) })).toEqual({
    ok: true,
    configs: [
      { config: "stryker.B.config.json", ranges: 0, wholeFiles: 1 },
      { config: "stryker.a.config.json", ranges: 0, wholeFiles: 1 },
    ],
  });
});

/** A root with one range, `src/c.ts:2-4` unless named, anchored to `first` and `last`. */
function singleRangeRoot(source, first, last, entry = "src/c.ts:2-4") {
  return plantedRoot({
    configs: { "stryker.config.json": [entry] },
    anchors: [{ config: "stryker.config.json", entry, first, last }],
    files: { "src/c.ts": source },
  });
}

it("reads a source without a final newline up to its last line", () => {
  const root = singleRangeRoot("c1\nc2\nc3", "c2", "c3", "src/c.ts:2-3");
  expect(checkStrykerRanges({ root })).toEqual({
    ok: true,
    configs: [{ config: "stryker.config.json", ranges: 1, wholeFiles: 0 }],
  });
});

it.each([
  [
    "a first line found twice and no pair at the range's distance",
    replaced(withLine(sourceA, 3, "// inserted"), 13, sourceA[2]),
    "src/a.ts:3-5 drifted; first line found at 3, 13, last line found at 6",
  ],
  [
    "a pair found once while its first line also stands elsewhere",
    replaced(withLine(sourceA, 0, "// inserted"), 13, sourceA[2]),
    "src/a.ts:3-5 moved to src/a.ts:4-6",
  ],
])("names %s", (_case, source, line) => {
  const files = { "src/a.ts": source, "src/b.ts": sourceB, "src/whole.ts": ["export {};"] };
  expect(checkStrykerRanges({ root: plantedRoot({ files }) })).toEqual({
    ok: false,
    code: "STRYKER_RANGE_DRIFT",
    lines: [
      `stryker.config.json: ${line}`,
      "stryker.config.json: src/a.ts:8-10 moved to src/a.ts:9-11",
    ],
  });
});

it.each([
  [
    "boundaries found once but in reverse order",
    ["c1", "c4", "c3", "c2", "c5"],
    ["c2", "c4"],
    "src/c.ts:2-4 drifted; first line found at 4, last line found at 2",
  ],
  [
    "a range whose first and last lines match and now stand on one line",
    ["c1", "x", "c3", "c4", "c5"],
    ["x", "x"],
    "src/c.ts:2-4 moved to src/c.ts:2-2",
  ],
])("names %s", (_case, source, [first, last], line) => {
  expect(checkStrykerRanges({ root: singleRangeRoot(source, first, last) })).toEqual({
    ok: false,
    code: "STRYKER_RANGE_DRIFT",
    lines: [`stryker.config.json: ${line}`],
  });
});

it("fails a source that cannot be read as broken, apart from a missing one", () => {
  const root = plantedRoot({ files: { "src/a.ts": sourceA, "src/whole.ts": ["export {};"] } });
  mkdirSync(join(root, "src/b.ts"));
  expect(checkStrykerRanges({ root })).toEqual({
    ok: false,
    code: "STRYKER_RANGE_BROKEN",
    lines: ["stryker.small.config.json: src/b.ts:2-4 names an unreadable source file"],
  });
});

/** Two roots for the command line: one that passes with mixed counts, one with two failures. */
const cliCases = [
  [
    "a passing root",
    () =>
      plantedRoot({
        configs: {
          "stryker.config.json": ["src/b.ts:2-4", "src/whole.ts"],
          "stryker.small.config.json": ["src/a.ts:3-5", "src/a.ts:8-10"],
        },
        anchors: [
          anchor("stryker.config.json", "src/b.ts:2-4", sourceB),
          anchor("stryker.small.config.json", "src/a.ts:3-5", sourceA),
          anchor("stryker.small.config.json", "src/a.ts:8-10", sourceA),
        ],
      }),
    {
      status: 0,
      stdout:
        "Stryker ranges verified: stryker.config.json 1 range, 1 whole file; " +
        "stryker.small.config.json 2 ranges, 0 whole files.\n",
      stderr: "",
    },
  ],
  [
    "a failing root",
    () => plantedRoot({ anchors: null }),
    {
      status: 1,
      stdout: "",
      stderr:
        "STRYKER_RANGE_UNANCHORED\n" +
        "stryker.config.json: src/a.ts:3-5 has no anchor\n" +
        "stryker.config.json: src/a.ts:8-10 has no anchor\n" +
        "stryker.small.config.json: src/b.ts:2-4 has no anchor\n",
    },
  ],
];

it.each(cliCases)("prints the command line's exact answer for %s", (_case, root, expected) => {
  const run = spawnSync(process.execPath, [checker], { cwd: root(), encoding: "utf8" });
  expect({ status: run.status, stdout: run.stdout, stderr: run.stderr }).toEqual(expected);
});

it.each(cliCases)("writes the same exact answer in process for %s", (_case, root, expected) => {
  const out = [];
  const err = [];
  const status = runStrykerRanges({
    root: root(),
    stdout: { write: (text) => out.push(text) },
    stderr: { write: (text) => err.push(text) },
  });
  expect({ status, stdout: out.join(""), stderr: err.join("") }).toEqual(expected);
});

it("passes on the repository's own configs and anchors", () => {
  expect(checkStrykerRanges({ root: repository })).toEqual({
    ok: true,
    configs: [
      { config: "stryker.config.json", ranges: 19, wholeFiles: 33 },
      { config: "stryker.conversation.config.json", ranges: 0, wholeFiles: 7 },
      { config: "stryker.desktop-s6.config.json", ranges: 14, wholeFiles: 2 },
      { config: "stryker.desktop-s7.config.json", ranges: 7, wholeFiles: 2 },
      { config: "stryker.desktop-s8.config.json", ranges: 3, wholeFiles: 0 },
      { config: "stryker.effect-gate.config.json", ranges: 0, wholeFiles: 1 },
      { config: "stryker.ledger-table.config.json", ranges: 0, wholeFiles: 1 },
      { config: "stryker.ledger.config.json", ranges: 2, wholeFiles: 1 },
      { config: "stryker.project-storage-desktop.config.json", ranges: 0, wholeFiles: 4 },
      { config: "stryker.project-storage.config.json", ranges: 28, wholeFiles: 17 },
      { config: "stryker.stryker-ranges.config.json", ranges: 0, wholeFiles: 1 },
    ],
  });
});
