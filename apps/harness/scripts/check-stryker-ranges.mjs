import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const anchorsFile = "stryker-range-anchors.json";
const configName = /^stryker(\.[\w-]+)?\.config\.json$/;
const strykerFile = /^stryker.*\.json$/;
const rangeEntry = /^(.+):(\d+)-(\d+)$/;
const lineForm = /:\d/;

/** A failure with every line of its code; the first code in this list that has lines wins. */
const codeOrder = [
  "STRYKER_RANGE_BROKEN",
  "STRYKER_RANGE_UNANCHORED",
  "STRYKER_RANGE_STALE_ANCHOR",
  "STRYKER_RANGE_DRIFT",
];

function readJson(root, name) {
  try {
    return { value: JSON.parse(readFileSync(join(root, name), "utf8")) };
  } catch (error) {
    return { error, missing: error.code === "ENOENT" };
  }
}

/** The anchors by `config` and `entry`; a missing file is no anchors, never a clean pass. */
function readAnchors(root, problems) {
  const read = readJson(root, anchorsFile);
  if (read.missing) return new Map();
  if (read.error) {
    problems.STRYKER_RANGE_BROKEN.push(`${anchorsFile}: unreadable or invalid JSON`);
    return new Map();
  }
  const anchors = new Map();
  if (!Array.isArray(read.value) || !read.value.every(isAnchor)) {
    problems.STRYKER_RANGE_BROKEN.push(`${anchorsFile}: not a list of anchors`);
    return anchors;
  }
  for (const anchor of read.value) {
    const key = `${anchor.config}\n${anchor.entry}`;
    if (anchors.has(key)) {
      const duplicate = `duplicate anchor for ${anchor.config} ${anchor.entry}`;
      problems.STRYKER_RANGE_BROKEN.push(`${anchorsFile}: ${duplicate}`);
    }
    anchors.set(key, anchor);
  }
  return anchors;
}

function isAnchor(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    ["config", "entry", "first", "last"].every((key) => typeof value[key] === "string")
  );
}

/** The source's lines, without the empty piece after a final newline. */
function readLines(root, file) {
  const lines = readFileSync(join(root, file), "utf8").split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function sourceLines(root, file, sources) {
  if (!sources.has(file)) {
    try {
      sources.set(file, { lines: readLines(root, file) });
    } catch (error) {
      sources.set(file, { error: error.code === "ENOENT" ? "a missing" : "an unreadable" });
    }
  }
  return sources.get(file);
}

/** Where the anchored pair stands at the range's own distance, as 1-based first lines. */
function pairPlaces(lines, anchor, distance) {
  const places = [];
  for (let index = 0; index + distance < lines.length; index += 1) {
    if (lines[index] === anchor.first && lines[index + distance] === anchor.last) {
      places.push(index + 1);
    }
  }
  return places;
}

function linesHolding(lines, text) {
  return lines.flatMap((line, index) => (line === text ? [index + 1] : []));
}

function foundAt(places) {
  return places.length === 0 ? "nowhere" : `at ${places.join(", ")}`;
}

/**
 * The drift's line. The pair at the range's own distance names a moved range; failing that, a
 * first and a last line each found once, in order, name a resized range (lines added or removed
 * inside it); otherwise the line names where each boundary was found.
 */
function driftLine(prefix, range, lines, anchor) {
  const distance = range.last - range.first;
  const places = pairPlaces(lines, anchor, distance);
  const named = places.map((first) => `${range.file}:${first}-${first + distance}`);
  if (places.length === 1) return `${prefix} moved to ${named[0]}`;
  if (places.length > 1) return `${prefix} drifted; anchored pair found at ${named.join(", ")}`;
  const firsts = linesHolding(lines, anchor.first);
  const lasts = linesHolding(lines, anchor.last);
  const resized = resizedRange(range.file, firsts, lasts);
  if (resized !== undefined) return `${prefix} moved to ${resized}`;
  return `${prefix} drifted; first line found ${foundAt(firsts)}, last line found ${foundAt(lasts)}`;
}

function onlyPlace(places) {
  return places.length === 1 ? places[0] : undefined;
}

/** The range between a first and a last line each found once, when they stand in order. */
function resizedRange(file, firsts, lasts) {
  const first = onlyPlace(firsts);
  const last = onlyPlace(lasts);
  if (first === undefined || !(last >= first)) return undefined;
  return `${file}:${first}-${last}`;
}

/** Why a range cannot be checked against its source, or `undefined` when it can. */
function brokenRange(range, source) {
  if (source.error) return `names ${source.error} source file`;
  if (range.first > range.last) return "starts after it ends";
  if (range.last > source.lines.length) {
    return `ends past the file's last line (${source.lines.length})`;
  }
  return undefined;
}

/** The problem with one range, as its code and line, or `undefined` when it holds its anchor. */
function checkRange(context, config, entry, range) {
  const prefix = `${config}: ${entry}`;
  const source = sourceLines(context.root, range.file, context.sources);
  const broken = brokenRange(range, source);
  if (broken !== undefined) return ["STRYKER_RANGE_BROKEN", `${prefix} ${broken}`];
  const { lines } = source;
  const anchor = context.anchors.get(`${config}\n${entry}`);
  if (anchor === undefined) return ["STRYKER_RANGE_UNANCHORED", `${prefix} has no anchor`];
  const holds = lines[range.first - 1] === anchor.first && lines[range.last - 1] === anchor.last;
  return holds ? undefined : ["STRYKER_RANGE_DRIFT", driftLine(prefix, range, lines, anchor)];
}

function checkEntry(context, config, entry, counts) {
  const match = rangeEntry.exec(entry);
  if (match === null) {
    if (!lineForm.test(entry)) {
      counts.wholeFiles += 1;
      return undefined;
    }
    const cause = "has a line or column form the check does not parse";
    return ["STRYKER_RANGE_BROKEN", `${config}: ${entry} ${cause}`];
  }
  counts.ranges += 1;
  context.ranged.add(`${config}\n${entry}`);
  const [, file, first, last] = match;
  return checkRange(context, config, entry, { file, first: Number(first), last: Number(last) });
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

/** The config's `mutate` entries, or why they cannot be read. */
function readMutate(root, config) {
  const read = readJson(root, config);
  if (read.error) return { cause: "unreadable or invalid JSON" };
  if (!isPlainObject(read.value)) return { cause: "not a JSON object" };
  const mutate = read.value.mutate ?? [];
  if (!Array.isArray(mutate) || !mutate.every((entry) => typeof entry === "string")) {
    return { cause: "mutate is not a list of entries" };
  }
  return { mutate };
}

function checkConfig(context, config, problems) {
  const { mutate, cause } = readMutate(context.root, config);
  if (cause !== undefined) {
    problems.STRYKER_RANGE_BROKEN.push(`${config}: ${cause}`);
    return undefined;
  }
  const counts = { config, ranges: 0, wholeFiles: 0 };
  for (const entry of mutate) {
    const problem = checkEntry(context, config, entry, counts);
    if (problem !== undefined) problems[problem[0]].push(problem[1]);
  }
  return counts;
}

/** The root Stryker configs; any other root `stryker*.json` but the anchors file is broken. */
function rootConfigs(root, problems) {
  const names = readdirSync(root)
    .filter((name) => strykerFile.test(name))
    .sort();
  for (const name of names.filter((candidate) => !configName.test(candidate))) {
    if (name !== anchorsFile) {
      problems.STRYKER_RANGE_BROKEN.push(
        `${name}: a root Stryker file the check does not recognise`,
      );
    }
  }
  return names.filter((name) => configName.test(name));
}

/**
 * Checks that every line range in the root Stryker configs still holds the boundary lines its
 * anchor recorded when it was last aligned. Pure: no git, and no config is rewritten.
 */
export function checkStrykerRanges({ root = process.cwd() } = {}) {
  const problems = Object.fromEntries(codeOrder.map((code) => [code, []]));
  const context = {
    root,
    anchors: readAnchors(root, problems),
    sources: new Map(),
    ranged: new Set(),
  };
  const names = rootConfigs(root, problems);
  const configs = names.flatMap((config) => checkConfig(context, config, problems) ?? []);
  for (const [key, anchor] of context.anchors) {
    if (!context.ranged.has(key)) {
      problems.STRYKER_RANGE_STALE_ANCHOR.push(
        `${anchor.config}: ${anchor.entry} is anchored but has no range`,
      );
    }
  }
  const code = codeOrder.find((candidate) => problems[candidate].length > 0);
  return code === undefined ? { ok: true, configs } : { ok: false, code, lines: problems[code] };
}

function counted(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Runs the check and writes its answer: the verified counts to `stdout`, or the failure's code and
 * lines to `stderr`. Returns the exit code.
 */
export function runStrykerRanges({
  root = process.cwd(),
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const result = checkStrykerRanges({ root });
  if (!result.ok) {
    stderr.write(`${result.code}\n${result.lines.join("\n")}\n`);
    return 1;
  }
  const counts = result.configs.map(
    ({ config, ranges, wholeFiles }) =>
      `${config} ${counted(ranges, "range")}, ${counted(wholeFiles, "whole file")}`,
  );
  stdout.write(`Stryker ranges verified: ${counts.join("; ")}.\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runStrykerRanges();
}
