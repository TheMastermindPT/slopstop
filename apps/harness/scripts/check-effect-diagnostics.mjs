import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** The packages the gate checks, from the repository root. */
const defaultProjects = ["packages/kernel", "packages/protocol", "apps/harness", "apps/desktop"];

// `file(line,col): error|warning TSnnnn: message`; an Effect message ends with `effect(<rule>)`,
// possibly on a later line.
const diagnosticHeader = /^(.+)\((\d+),(\d+)\): (error|warning) TS\d+: /;
const effectRule = /effect\((\w+)\)\s*$/;

// The binary belongs to the repository that holds this script, not to the checked root.
const resolveFromScript = createRequire(import.meta.url).resolve;

/** A failure result whose `lines` name its cause, at most 20 of them. */
function failure(code, lines) {
  const shown = lines.length > 20 ? [...lines.slice(0, 19), `… ${lines.length - 19} more`] : lines;
  return { ok: false, code, lines: shown };
}

/** The Effect build's `lib/tsc`, or a failure naming the missing package or executable. */
function binaryPath(resolveModule, exists) {
  const binaryPackage = `@effect/tsgo-${process.platform}-${process.arch}`;
  let manifest;
  try {
    manifest = resolveModule(`${binaryPackage}/package.json`);
  } catch {
    return { failure: failure("EFFECT_GATE_BINARY_MISSING", [`cannot resolve ${binaryPackage}`]) };
  }
  const binary = join(dirname(manifest), "lib", process.platform === "win32" ? "tsc.exe" : "tsc");
  if (!exists(binary)) {
    return { failure: failure("EFFECT_GATE_BINARY_MISSING", [`missing executable ${binary}`]) };
  }
  return { binary };
}

/** The diagnostic a header line opens, or undefined for a continuation line. */
function diagnosticAt(line) {
  const header = diagnosticHeader.exec(line);
  if (!header) return undefined;
  const [, file = "", lineNumber = "", column = "", severity = ""] = header;
  return { file, line: Number(lineNumber), column: Number(column), severity };
}

/** The rule ends a diagnostic's last line; the first one found after its header is its rule. */
function attachRule(current, line) {
  const rule = effectRule.exec(line)?.[1];
  if (current?.rule === undefined && rule) current.rule = rule;
}

/** Every diagnostic in the output, each with its Effect rule when it has one. */
function parseDiagnostics(output) {
  const diagnostics = [];
  for (const line of output.split(/\r?\n/)) {
    const opened = diagnosticAt(line);
    if (opened) diagnostics.push(opened);
    if (diagnostics.length > 0) attachRule(diagnostics.at(-1), line);
  }
  return diagnostics;
}

/** The binary was not started, was killed, or ended without an exit status. */
const didNotFinish = (run) => Boolean(run.error ?? run.signal) || run.status === null;
const isTscExit = (status) => status === 0 || status === 1;
const location = ({ file, line, column }) => `${file}(${line},${column})`;

/** Why a run did not finish: its spawn error code, its signal, or a missing exit status. */
function unfinishedCause(run) {
  if (run.error) return `spawn failed ${run.error.code ?? run.error.message}`;
  return run.signal ? `killed by ${run.signal}` : "no exit status";
}

/** One run of the binary on a project: a run that did not finish, or exited 2+, is a failure. */
function spawnProject({ root, binary, spawn }, project) {
  const run = spawn(
    binary,
    ["--noEmit", "--pretty", "false", "-p", join(project, "tsconfig.json")],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  if (didNotFinish(run)) {
    return failure("EFFECT_GATE_BINARY_FAILED", [`${project}: ${unfinishedCause(run)}`]);
  }
  if (!isTscExit(run.status)) {
    return failure("EFFECT_GATE_BROKEN", [`${project}: exit ${run.status}`]);
  }
  const output = [run.stdout ?? "", run.stderr ?? ""].join("\n");
  return { status: run.status, output, diagnostics: parseDiagnostics(output) };
}

/** The first non-empty output lines, for a run whose output cannot be read as diagnostics. */
const outputHead = (output) =>
  output
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .slice(0, 10);

/**
 * One package run, classified: a run that did not finish, or whose output cannot be trusted, is
 * a failure and never a clean result.
 */
function runProject(context, project) {
  const run = spawnProject(context, project);
  if (run.code) return run;
  const { diagnostics, status } = run;
  const errors = diagnostics.filter((entry) => entry.severity === "error");
  // Exit 1 names its errors and exit 0 has none; anything else is an untrustworthy run. An error
  // that is not an Effect diagnostic is one too: the gate cannot report that tree as clean.
  if (status === 1 && errors.length === 0) {
    const head = outputHead(run.output);
    return failure("EFFECT_GATE_BROKEN", [`${project}: exit 1 with no error line`, ...head]);
  }
  if (status === 0 && errors.length > 0) {
    const named = errors.map((entry) => `${project}: exit 0 with error ${location(entry)}`);
    return failure("EFFECT_GATE_BROKEN", named);
  }
  const plain = errors.filter((entry) => entry.rule === undefined);
  if (plain.length > 0) {
    const named = plain.map((entry) => `${project}: non-Effect error ${location(entry)}`);
    return failure("EFFECT_GATE_BROKEN", named);
  }
  return { diagnostics };
}

/** The canary project, from the repository root; its tsconfig inherits the real plugin block. */
const canaryProject = "apps/harness/scripts/effect-diagnostics-canary";

/**
 * Every diagnostic the canary must produce, relative to the canary folder, and nothing else: the
 * planted `newPromise` and `unknownInEffectCatch` errors with their advisory warnings. The waived
 * line and the two planted test-file lines must be absent.
 */
const expectedCanary = [
  "src/canary.ts(3,24) error newPromise",
  "src/canary.ts(4,14) warning anyUnknownInErrorContext",
  "src/canary.ts(4,24) error unknownInEffectCatch",
  "src/canary.ts(4,24) warning anyUnknownInErrorContext",
];

function canaryKey({ file, line, column, severity, rule }) {
  const relative = file.split("\\").join("/").replace(`${canaryProject}/`, "");
  return `${relative}(${line},${column}) ${severity} ${rule ?? "-"}`;
}

const byText = (first, second) => first.localeCompare(second);

/**
 * Runs the canary; any added, missing or moved diagnostic is a mismatch, never a pass. The
 * Effect build carries the plugin itself, so a removed or changed plugin block shows up here as
 * the defaults' diagnostics and exit code, which differ from the expected set.
 */
function checkCanary(context) {
  const run = spawnProject(context, canaryProject);
  if (run.code) return run;
  const actual = run.diagnostics.map(canaryKey).sort(byText);
  const expected = [...expectedCanary].sort(byText);
  const matched =
    run.status === 1 &&
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
  return matched ? undefined : canaryMismatch(run.status, actual, expected);
}

/** The mismatch, naming each differing key and an exit status other than 1. */
function canaryMismatch(status, actual, expected) {
  const extra = actual.filter((key) => !expected.includes(key)).map((key) => `extra ${key}`);
  const missing = expected.filter((key) => !actual.includes(key)).map((key) => `missing ${key}`);
  const exit = status === 1 ? [] : [`canary exit ${status}`];
  return failure("EFFECT_GATE_CANARY_MISMATCH", [...exit, ...extra, ...missing]);
}

/**
 * Runs each package and blocks on every `error`-level Effect diagnostic, listed across all the
 * packages. A run that cannot be trusted stops the gate at once, before any later package.
 */
function checkProjects(context, projects) {
  let warnings = 0;
  const errors = [];
  for (const project of projects) {
    const run = runProject(context, project);
    if (run.code) return run;
    warnings += run.diagnostics.filter((entry) => entry.severity === "warning").length;
    errors.push(...run.diagnostics.filter((entry) => entry.severity === "error"));
  }
  // A pass names the packages it checked, in order.
  if (errors.length === 0) return { ok: true, warnings, projects: [...projects] };
  const lines = errors.map((entry) => `${location(entry)} ${entry.rule}`);
  return {
    ...failure("EFFECT_GATE_VIOLATIONS", lines),
    violations: errors.map(({ file, line, rule }) => ({ file, line, rule })),
  };
}

/** The register's entries, or undefined when it cannot be read as a JSON list. */
function readRegister(root) {
  try {
    const entries = JSON.parse(readFileSync(join(root, waiverRegister), "utf8"));
    return Array.isArray(entries) ? entries : undefined;
  } catch {
    return undefined;
  }
}

/** The register of waived Effect diagnostics, from the repository root. */
const waiverRegister = "apps/harness/scripts/effect-diagnostics-waivers.json";
const directive = /@effect-diagnostics/;
const nextLineDirective = /^\s*\/\/ @effect-diagnostics-next-line (\w+):off\s*$/;
const waiverLine = /^\s*\/\/ Effect waiver (EW\d+): .+\.\s*$/;

/**
 * What the four checked tsconfigs include: each package's `src`, `tests` and `build` folders and
 * its root-level files. `scripts/` (the gate, its tests and the canary's waived line) is never
 * scanned, nor is `node_modules`.
 */
const scannedFolders = ["src", "tests", "build"];
const scannedFile = /\.(?:ts|tsx|mts|cts|mjs)$/;

/** Every package folder under `apps` and `packages`. */
function packageFolders(root) {
  return ["apps", "packages"]
    .map((area) => join(root, area))
    .filter((areaRoot) => existsSync(areaRoot))
    .flatMap((areaRoot) =>
      readdirSync(areaRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(areaRoot, entry.name)),
    );
}

/** The scanned files of one package: its root-level files and its scanned folders' files. */
function packageFiles(folder) {
  const rootFiles = readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isFile());
  const nested = scannedFolders
    .map((name) => join(folder, name))
    .filter((path) => existsSync(path))
    .flatMap((path) => readdirSync(path, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile() && !entry.parentPath.includes("node_modules"));
  return [...rootFiles, ...nested]
    .filter((entry) => scannedFile.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

/** The files the waiver register covers, relative to the root and `/`-separated. */
function sourceFiles(root) {
  return packageFolders(root)
    .flatMap(packageFiles)
    .map((file) => relative(root, file).split("\\").join("/"));
}

/** Each register entry needs a non-empty `reason` and `removeWhen`. */
function incompleteEntries(entries) {
  return entries.flatMap((entry) =>
    ["reason", "removeWhen"]
      .filter((field) => typeof entry[field] !== "string" || entry[field].trim() === "")
      .map((field) => `${entry.id}: missing ${field}`),
  );
}

/** Each `@effect-diagnostics` directive with the waiver id on the line above it, if any. */
function directivesIn(root, file) {
  const lines = readFileSync(join(root, file), "utf8").split(/\r?\n/);
  return lines.flatMap((line, index) => {
    if (!directive.test(line)) return [];
    const rule = nextLineDirective.exec(line)?.[1];
    const id = waiverLine.exec(lines[index - 1] ?? "")?.[1];
    return [{ file, line: index + 1, rule, id }];
  });
}

/**
 * Every directive in the sources has its register entry and its waiver line, and every entry
 * has its directive.
 */
function checkWaivers(root) {
  const entries = readRegister(root);
  if (entries === undefined)
    return failure("EFFECT_GATE_BROKEN", [`${waiverRegister} is unreadable`]);
  const incomplete = incompleteEntries(entries);
  if (incomplete.length > 0) return failure("EFFECT_GATE_BROKEN", incomplete);
  const directives = sourceFiles(root).flatMap((file) => directivesIn(root, file));
  const matches = (entry, found) =>
    entry.id === found.id && entry.file === found.file && entry.rule === found.rule;
  const unregistered = directives.filter(
    (found) => found.rule === undefined || !entries.some((entry) => matches(entry, found)),
  );
  if (unregistered.length > 0) {
    const lines = unregistered.map(({ file, line }) => `${file}(${line}) unregistered directive`);
    return failure("EFFECT_GATE_WAIVER_UNREGISTERED", lines);
  }
  const stale = entries.filter((entry) => !directives.some((found) => matches(entry, found)));
  if (stale.length > 0) {
    const lines = stale.map(({ id, file }) => `${id} ${file} has no directive`);
    return failure("EFFECT_GATE_WAIVER_STALE", lines);
  }
  return undefined;
}

/**
 * Runs the Effect build of TypeScript-Go, in tsc mode, over each project and blocks on every
 * `error`-level Effect diagnostic. Warnings are counted, never blocking. The full gate (no
 * `projects` given) first proves on the canary that the real configuration is active, then
 * checks the waiver register against the sources; a call that names its projects checks only
 * those, unless `canary` or `register` asks for those steps too.
 */
export function checkEffectDiagnostics({
  root = process.cwd(),
  projects,
  canary = projects === undefined,
  register = projects === undefined,
  resolve: resolveModule = resolveFromScript,
  exists = existsSync,
  spawn = spawnSync,
} = {}) {
  const { binary, failure: missing } = binaryPath(resolveModule, exists);
  if (missing) return missing;
  const context = { root, binary, spawn };
  const canaryFailure = canary ? checkCanary(context) : undefined;
  if (canaryFailure) return canaryFailure;
  const waivers = register ? checkWaivers(root) : undefined;
  if (waivers) return waivers;
  const result = checkProjects(context, projects ?? defaultProjects);
  return result.ok && canary ? { ...result, canary: "matched" } : result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const projects = process.argv.slice(2);
  const result = checkEffectDiagnostics(projects.length > 0 ? { projects } : {});
  if (result.ok) {
    process.stdout.write(`Effect diagnostics verified; ${result.warnings} advisory warnings.\n`);
  } else {
    process.stderr.write(`${[result.code, ...(result.lines ?? [])].join("\n")}\n`);
    process.exitCode = 1;
  }
}
