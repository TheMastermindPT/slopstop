import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { checkEffectDiagnostics } from "./check-effect-diagnostics.mjs";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const checker = fileURLToPath(new URL("./check-effect-diagnostics.mjs", import.meta.url));
const roots = [];
const links = [];

afterEach(() => {
  // Links go first, so removing a root never reaches the repository's `effect`.
  for (const link of links.splice(0)) unlinkSync(link);
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/**
 * Links `root/node_modules/effect` to the repository's copy (a junction on Windows). The Effect
 * language service picks its rule set from the `effect` that package resolution finds, not from
 * `paths`; without this link a temporary root gets the v3 rules.
 */
function linkEffect(root) {
  const link = join(root, "node_modules", "effect");
  mkdirSync(dirname(link), { recursive: true });
  const kind = process.platform === "win32" ? "junction" : "dir";
  symlinkSync(realpathSync(join(repository, "node_modules", "effect")), link, kind);
  links.push(link);
}

/**
 * A temporary project at the folder's root that extends the repository base config and resolves
 * `effect` through its own link. Its own plugin entry makes the two planted rules `error` and turns
 * off the promoted `anyUnknownInErrorContext` the base config would add, so these rows test the
 * gate's classification apart from the curated repository configuration.
 */
function plantedProject(source, { linked = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "slopstop-effect-gate-"));
  roots.push(root);
  if (linked) linkEffect(root);
  const modules = join(repository, "node_modules");
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify({
      extends: join(repository, "tsconfig.base.json"),
      compilerOptions: {
        noEmit: true,
        types: [],
        typeRoots: [join(modules, "@types")],
        plugins: [
          {
            name: "@effect/language-service",
            diagnosticSeverity: {
              unknownInEffectCatch: "error",
              newPromise: "error",
              anyUnknownInErrorContext: "off",
            },
            includeSuggestionsInTsc: false,
            ignoreEffectSuggestionsInTscExitCode: true,
            ignoreEffectWarningsInTscExitCode: true,
            ignoreEffectErrorsInTscExitCode: false,
          },
        ],
      },
      include: ["src"],
    }),
  );
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src", "a.ts"), source.join("\n"));
  return root;
}

const plantedRows = [
  {
    name: "unknownInEffectCatch",
    source: [
      'import { Effect } from "effect";',
      "const p = Promise.resolve(1);",
      "export const value = p;",
      "export const planted = Effect.tryPromise({ try: () => p, catch: (cause) => cause });",
    ],
    violation: { file: "src/a.ts", line: 4, rule: "unknownInEffectCatch" },
  },
  {
    name: "newPromise",
    source: [
      'import { Effect } from "effect";',
      "export const tag = Effect.void;",
      "export const planted = new Promise<number>((resolve) => resolve(1));",
    ],
    violation: { file: "src/a.ts", line: 3, rule: "newPromise" },
  },
  {
    name: "clean",
    source: ['import { Effect } from "effect";', "export const clean = Effect.succeed(1);"],
    violation: undefined,
  },
];

it.each(plantedRows)("fails on a planted Effect error: $name", ({ source, violation }) => {
  const root = plantedProject(source);
  const result = checkEffectDiagnostics({ root, projects: ["."] });
  const cli = spawnSync(process.execPath, [checker, "."], { cwd: root, encoding: "utf8" });
  if (violation === undefined) {
    expect(result).toMatchObject({ ok: true });
    expect(cli.status).toBe(0);
    return;
  }
  expect(result).toMatchObject({ ok: false, code: "EFFECT_GATE_VIOLATIONS" });
  expect(result.violations).toEqual([violation]);
  expect(cli.status).toBe(1);
  expect(cli.stderr).toContain(`${violation.file}(${violation.line},`);
  expect(cli.stderr).toContain(violation.rule);
});

// The CI failure of 2026-10-23: a root with no `effect` to resolve gets the v3 rules and a clean
// report, though its planted v4 error is there.
it("fails on a file that resolves no Effect v4", () => {
  const root = plantedProject(plantedRows[0].source, { linked: false });
  expect(checkEffectDiagnostics({ root, projects: ["."] })).toEqual({
    ok: false,
    code: "EFFECT_GATE_BROKEN",
    lines: [".: src/a.ts detects Effect unknown, not v4"],
  });
});

/** The base the temporary gated package extends, as a JSON string literal. */
const baseConfig = () => JSON.stringify(join(repository, "tsconfig.base.json"));

/** A plugin entry that turns the promoted `schemaNumber` off, as a gated package would add it. */
const ruleOff =
  '[{ "name": "@effect/language-service", "diagnosticSeverity": { "schemaNumber": "off" } }]';

/** A gated package's tsconfig text, its `compilerOptions` extended by `options` (JSONC allowed). */
const gatedConfig = (options) =>
  `{ "extends": ${baseConfig()}, "compilerOptions": { "noEmit": true, "types": []${options} }, "include": ["src"] }`;

/**
 * The gated package `packages/kernel` under a temporary root, with the tsconfig text `config` and
 * a planted `schemaNumber` violation that the base config makes an error.
 */
function gatedPackage(config) {
  const root = mkdtempSync(join(tmpdir(), "slopstop-effect-gate-"));
  roots.push(root);
  linkEffect(root);
  const folder = join(root, "packages", "kernel");
  mkdirSync(join(folder, "src"), { recursive: true });
  writeFileSync(join(folder, "tsconfig.json"), config);
  writeFileSync(
    join(folder, "src", "a.ts"),
    ['import { Schema } from "effect";', "export const unbounded = Schema.Number;"].join("\n"),
  );
  return root;
}

const declared = "packages/kernel/tsconfig.json declares compilerOptions.plugins";

const overridingRows = [
  { name: "a rule turned off", config: () => gatedConfig(`, "plugins": ${ruleOff}`) },
  { name: "an empty list", config: () => gatedConfig(', "plugins": []') },
  {
    name: "commented JSONC with a trailing comma",
    config: () => `// A gated package.\n${gatedConfig(`,\n /* off */ "plugins": ${ruleOff},\n`)}`,
  },
];

it.each(overridingRows)("refuses a gated package that declares its own plugins: $name", (row) => {
  const root = gatedPackage(row.config());
  const projects = ["packages/kernel"];
  expect(checkEffectDiagnostics({ root, projects })).toEqual({
    ok: false,
    code: "EFFECT_GATE_PLUGIN_OVERRIDE",
    lines: [declared],
  });
  const cli = spawnSync(process.execPath, [checker, ...projects], { cwd: root, encoding: "utf8" });
  expect(cli.status).toBe(1);
  expect(cli.stderr).toBe(`EFFECT_GATE_PLUGIN_OVERRIDE\n${declared}\n`);
});

it("checks a commented gated package without plugins and blocks its violation", () => {
  const root = gatedPackage(`// No plugins of its own.\n${gatedConfig(",\n")}`);
  expect(checkEffectDiagnostics({ root, projects: ["packages/kernel"] })).toMatchObject({
    ok: false,
    code: "EFFECT_GATE_VIOLATIONS",
    violations: [{ file: "packages/kernel/src/a.ts", line: 2, rule: "schemaNumber" }],
  });
});

it("refuses a gated package whose tsconfig cannot be read", () => {
  const root = gatedPackage("{ not a config");
  expect(checkEffectDiagnostics({ root, projects: ["packages/kernel"] })).toEqual({
    ok: false,
    code: "EFFECT_GATE_BROKEN",
    lines: ["packages/kernel/tsconfig.json is unreadable"],
  });
});

/** Every failure carries `lines` (at most 20) that name its cause (S5B-R1-3). */
function expectNamedCause(result, fragments) {
  expect(Array.isArray(result.lines)).toBe(true);
  expect(result.lines.length).toBeGreaterThan(0);
  expect(result.lines.length).toBeLessThanOrEqual(20);
  const text = result.lines.join("\n");
  for (const fragment of fragments) expect(text).toContain(fragment);
}

const registerPath = "apps/harness/scripts/effect-diagnostics-waivers.json";
const waivedSource = [
  "export const before = 1;",
  "// Effect waiver EW1: a legacy Promise edge.",
  "// @effect-diagnostics-next-line newPromise:off",
  "export const waived = new Promise<number>((resolve) => resolve(1));",
];
const registeredEntry = {
  id: "EW1",
  file: "apps/sample/src/a.ts",
  rule: "newPromise",
  reason: "a legacy Promise edge",
  removeWhen: "the sample moves to Effect",
};

/** A temporary tree with one source file at `path` and a waiver register. */
function waiverTree(source, entries, path = "apps/sample/src/a.ts") {
  const root = mkdtempSync(join(tmpdir(), "slopstop-effect-gate-"));
  roots.push(root);
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), source.join("\n"));
  mkdirSync(join(root, "apps", "harness", "scripts"), { recursive: true });
  writeFileSync(join(root, registerPath), JSON.stringify(entries));
  return root;
}

const waiverRows = [
  { name: "registered", source: waivedSource, entries: [registeredEntry], code: undefined },
  {
    name: "directive without entry",
    source: waivedSource,
    entries: [],
    code: "EFFECT_GATE_WAIVER_UNREGISTERED",
  },
  {
    name: "directive without waiver line",
    source: waivedSource.filter((line) => !line.includes("Effect waiver")),
    entries: [registeredEntry],
    code: "EFFECT_GATE_WAIVER_UNREGISTERED",
  },
  {
    name: "entry without directive",
    source: ["export const plain = 1;"],
    entries: [registeredEntry],
    code: "EFFECT_GATE_WAIVER_STALE",
  },
  {
    name: "directive under tests without entry",
    source: waivedSource,
    entries: [],
    path: "apps/sample/tests/a.ts",
    code: "EFFECT_GATE_WAIVER_UNREGISTERED",
  },
  {
    name: "directive under build without entry",
    source: waivedSource,
    entries: [],
    path: "apps/sample/build/a.ts",
    code: "EFFECT_GATE_WAIVER_UNREGISTERED",
  },
  {
    name: "directive in a root config without entry",
    source: waivedSource,
    entries: [],
    path: "apps/sample/vite.main.config.ts",
    code: "EFFECT_GATE_WAIVER_UNREGISTERED",
  },
  {
    name: "registered under tests",
    source: waivedSource,
    entries: [{ ...registeredEntry, file: "apps/sample/tests/a.ts" }],
    path: "apps/sample/tests/a.ts",
    code: undefined,
  },
  {
    // Under a scanned folder (`src`), so only the `node_modules` exclusion keeps it out (S5B-R2-6).
    name: "directive under node_modules is ignored",
    source: waivedSource,
    entries: [],
    path: "apps/sample/src/node_modules/x/a.ts",
    code: undefined,
  },
  {
    name: "entry without reason",
    source: waivedSource,
    entries: [{ ...registeredEntry, reason: undefined }],
    code: "EFFECT_GATE_BROKEN",
    fragments: ["EW1", "reason"],
  },
  {
    name: "entry without removeWhen",
    source: waivedSource,
    entries: [{ ...registeredEntry, removeWhen: undefined }],
    code: "EFFECT_GATE_BROKEN",
    fragments: ["EW1", "removeWhen"],
  },
];

it.each(waiverRows)("keeps the waiver register exact: $name", (row) => {
  const root = waiverTree(row.source, row.entries, row.path);
  const result = checkEffectDiagnostics({ root, projects: [], register: true });
  if (row.code === undefined) expect(result).toMatchObject({ ok: true });
  else expect(result).toMatchObject({ ok: false, code: row.code });
  if (row.fragments) expectNamedCause(result, row.fragments);
});

it.each([
  { name: "nested folder", path: "apps/x/src/deep/a.ts" },
  { name: "packages area", path: "packages/y/src/a.ts" },
  { name: "root-level file", path: "apps/x/a.ts" },
  { name: "tests folder", path: "apps/x/tests/a.ts" },
])("scans every registered location: $name", ({ path }) => {
  const root = waiverTree(waivedSource, [], path);
  const result = checkEffectDiagnostics({ root, projects: [], register: true });
  expect(result).toEqual({
    ok: false,
    code: "EFFECT_GATE_WAIVER_UNREGISTERED",
    lines: [`${path}(3) unregistered directive`],
  });
});

it.each([
  { name: "blank reason", entry: { ...registeredEntry, reason: "   " }, field: "reason" },
  {
    name: "no removeWhen",
    entry: { ...registeredEntry, removeWhen: undefined },
    field: "removeWhen",
  },
  { name: "numeric reason", entry: { ...registeredEntry, reason: 7 }, field: "reason" },
])("rejects an incomplete waiver entry: $name", ({ entry, field }) => {
  const root = waiverTree(waivedSource, [entry]);
  const result = checkEffectDiagnostics({ root, projects: [], register: true });
  expect(result).toEqual({
    ok: false,
    code: "EFFECT_GATE_BROKEN",
    lines: [`EW1: missing ${field}`],
  });
});

/** M1's recorded `effect-tsgo diagnostics --format json` runs, paths written as `<root>`/`<project>`. */
const recorded = JSON.parse(
  readFileSync(new URL("./effect-diagnostics-recorded.json", import.meta.url), "utf8"),
);

/** One `--list-files` entry: `file` (absolute, `/` separators) and the Effect version it detects. */
const listed = (file, detectedEffect = "v4") => ({
  file,
  detectedEffect,
  supportedEffect: detectedEffect === "v4" ? "v4" : "v3",
});

/**
 * A recorded run with its paths moved under `root`, in the folder `project`. A report also gets
 * the `files` list that `--list-files` adds (M2: the only change to the report), one entry per
 * `[path, detectedEffect]` in `files` under the project folder; `files: null` leaves it out.
 */
function recordedRun(name, root, project, files = [["src/a.ts", "v4"]]) {
  const place = (text) =>
    text.split("<root>").join(root.split("\\").join("/")).split("<project>").join(project);
  const { status, stdout, stderr } = recorded[name];
  const run = { status, signal: null, stdout: place(stdout), stderr: place(stderr) };
  if (files === null || !run.stdout.startsWith("{")) return run;
  const { diagnostics, summary } = JSON.parse(run.stdout);
  const base = `${root.split("\\").join("/")}/${project}`;
  const list = files.map(([path, detected]) => listed(`${base}/${path}`, detected));
  return { ...run, stdout: `${JSON.stringify({ diagnostics, files: list, summary }, null, 2)}\n` };
}

/**
 * A diagnostics report in the recorded shape, with summary counts that match its entries and a
 * `--list-files` list naming each file of its entries as `v4`.
 */
function report(diagnostics) {
  const count = (severity) => diagnostics.filter((entry) => entry.severity === severity).length;
  const files = [...new Set(diagnostics.map((entry) => entry.file))].map((file) => listed(file));
  const summary = {
    filesChecked: 1,
    filesWithoutPlugin: 0,
    totalFiles: 1,
    errors: count("error"),
    warnings: count("warning"),
    messages: count("message"),
  };
  return `${JSON.stringify({ diagnostics, files, summary }, null, 2)}\n`;
}

/** One diagnostic entry in the recorded shape, at `[file, line, column, severity, name]`. */
function entry([file, line, column, severity, name]) {
  return {
    file,
    start: 0,
    length: 1,
    line,
    column,
    endLine: line,
    endColumn: column + 1,
    severity,
    code: 377000,
    name,
    message: "Planted.",
  };
}

/** A fake `spawnSync` that answers `outcome` and counts its calls. */
function fakeSpawn(outcome) {
  const calls = [];
  const spawn = (...args) => {
    calls.push(args);
    return { status: null, signal: null, stdout: "", stderr: "", ...outcome };
  };
  return { spawn, calls };
}

/** A temporary root whose fake `@effect/tsgo` resolves inside it. */
function fakeRoot() {
  const root = mkdtempSync(join(tmpdir(), "slopstop-effect-gate-"));
  roots.push(root);
  return root;
}

const fakeManifest = (root) => join(root, "node_modules", "@effect", "tsgo", "package.json");
const fakeCli = (root) => join(root, "node_modules", "@effect", "tsgo", "dist", "effect-tsgo.cjs");

it("runs effect-tsgo diagnostics on each project", () => {
  const root = fakeRoot();
  const { spawn, calls } = fakeSpawn(recordedRun("clean", root, "packages/kernel"));
  const projects = ["packages/kernel", "apps/desktop"];
  const result = checkEffectDiagnostics({
    root,
    projects,
    resolve: () => fakeManifest(root),
    exists: () => true,
    spawn,
  });
  expect(result).toEqual({ ok: true, warnings: 0, projects });
  expect(calls).toEqual(
    projects.map((project) => [
      process.execPath,
      [
        fakeCli(root),
        "diagnostics",
        "--project",
        resolve(root, project, "tsconfig.json"),
        "--format",
        "json",
        "--list-files",
      ],
      { cwd: repository, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    ]),
  );
});

const unreadable = "first: exit 1 with unreadable output";
const noFiles = "No files to check. Please provide an existing .ts file or a project tsconfig.json";
const plantedLine = "first/src/a.ts(2,23)";

/** Each row's fake run on `first` (and `second` when the first passes), and the expected result. */
const runRows = [
  {
    name: "clean",
    run: (root) => recordedRun("clean", root, "first"),
    result: { ok: true, warnings: 0 },
  },
  {
    name: "warnings only",
    run: (root) => recordedRun("warnings", root, "first"),
    result: { ok: true, warnings: 4 },
  },
  {
    name: "planted error",
    run: (root) => recordedRun("planted", root, "first"),
    result: {
      ok: false,
      code: "EFFECT_GATE_VIOLATIONS",
      lines: [`${plantedLine} unknownInEffectCatch`, "second/src/a.ts(2,23) unknownInEffectCatch"],
      violations: [
        { file: "first/src/a.ts", line: 2, rule: "unknownInEffectCatch" },
        { file: "second/src/a.ts", line: 2, rule: "unknownInEffectCatch" },
      ],
    },
    spawns: 2,
  },
  {
    // Diagnostics mode reports no plain type error (M1 case 6); `pnpm typecheck` owns them.
    name: "plain type error",
    run: (root) => recordedRun("typeError", root, "first"),
    result: { ok: true, warnings: 0 },
  },
  {
    name: "missing tsconfig",
    run: (root) => recordedRun("missingTsconfig", root, "first"),
    result: { ok: false, code: "EFFECT_GATE_BROKEN", lines: [unreadable, noFiles] },
  },
  {
    name: "invalid tsconfig",
    run: (root) => recordedRun("invalidTsconfig", root, "first"),
    result: { ok: false, code: "EFFECT_GATE_BROKEN", lines: [unreadable, noFiles] },
  },
  {
    name: "discovery failure",
    run: (root) => recordedRun("discovery", root, "first"),
    result: {
      ok: false,
      code: "EFFECT_GATE_BINARY_MISSING",
      lines: [
        "first: [02:49:08.424] ERROR (#1): DiscoveryError: Unable to discover an installed typescript binary.",
      ],
    },
  },
  {
    name: "unparseable output",
    run: (root) => {
      const run = recordedRun("planted", root, "first");
      return { ...run, stdout: run.stdout.slice(0, run.stdout.indexOf('"severity": "error"')) };
    },
    result: {
      ok: false,
      code: "EFFECT_GATE_BROKEN",
      lines: [unreadable, "{", '  "diagnostics": ['],
    },
    lineCount: 11,
  },
  {
    name: "clean exit with an error entry",
    run: (root) => ({ ...recordedRun("planted", root, "first"), status: 0 }),
    result: {
      ok: false,
      code: "EFFECT_GATE_BROKEN",
      lines: [`first: exit 0 with error ${plantedLine}`],
    },
  },
  {
    name: "found exit with no entry",
    run: () => ({ status: 1, stdout: "", stderr: "" }),
    result: { ok: false, code: "EFFECT_GATE_BROKEN", lines: [unreadable] },
  },
  {
    name: "found exit with a clean report",
    run: (root) => ({ ...recordedRun("warnings", root, "first"), status: 1 }),
    result: { ok: false, code: "EFFECT_GATE_BROKEN", lines: ["first: exit 1 with no error entry"] },
  },
  {
    name: "counts disagree with entries",
    run: (root) => {
      const run = recordedRun("warnings", root, "first");
      return { ...run, stdout: run.stdout.replace('"warnings": 2', '"warnings": 1') };
    },
    result: { ok: false, code: "EFFECT_GATE_BROKEN" },
    head: ["first: exit 0 with unreadable output", "{"],
  },
  {
    name: "report without a file list",
    run: (root) => recordedRun("clean", root, "first", null),
    result: { ok: false, code: "EFFECT_GATE_BROKEN" },
    head: ["first: exit 0 with unreadable output", "{"],
  },
  {
    // Without an Effect v4 the language service runs the v3 rules, so a v4 rule could never fire.
    name: "file without Effect v4",
    run: (root) =>
      recordedRun("clean", root, "first", [
        ["src/a.ts", "v4"],
        ["src/b.ts", "unknown"],
      ]),
    result: {
      ok: false,
      code: "EFFECT_GATE_BROKEN",
      lines: ["first: first/src/b.ts detects Effect unknown, not v4"],
    },
  },
  {
    name: "unknown exit",
    run: () => ({ status: 7 }),
    result: { ok: false, code: "EFFECT_GATE_BROKEN", lines: ["first: exit 7"] },
  },
  {
    name: "killed",
    run: () => ({ status: null, signal: "SIGKILL" }),
    result: { ok: false, code: "EFFECT_GATE_BINARY_FAILED", lines: ["first: killed by SIGKILL"] },
  },
  {
    name: "spawn error",
    run: () => ({ error: Object.assign(new Error("operation not permitted"), { code: "EPERM" }) }),
    result: { ok: false, code: "EFFECT_GATE_BINARY_FAILED", lines: ["first: spawn failed EPERM"] },
  },
  {
    name: "no status",
    run: () => ({ status: null }),
    result: { ok: false, code: "EFFECT_GATE_BINARY_FAILED", lines: ["first: no exit status"] },
  },
  {
    name: "no effect-tsgo",
    resolve: () => {
      throw Object.assign(new Error("Cannot find module"), { code: "MODULE_NOT_FOUND" });
    },
    run: (root) => recordedRun("clean", root, "first"),
    result: {
      ok: false,
      code: "EFFECT_GATE_BINARY_MISSING",
      lines: ["cannot resolve @effect/tsgo"],
    },
    spawns: 0,
  },
  {
    name: "missing effect-tsgo script",
    exists: () => false,
    run: (root) => recordedRun("clean", root, "first"),
    result: { ok: false, code: "EFFECT_GATE_BINARY_MISSING" },
    missingCli: true,
    spawns: 0,
  },
];

it.each(runRows)("classifies a diagnostics run: $name", (row) => {
  const root = fakeRoot();
  const calls = [];
  const spawn = (...args) => {
    calls.push(args);
    const project = calls.length === 1 ? "first" : "second";
    const run = row.run(root);
    const moved = { ...run, stdout: (run.stdout ?? "").split("/first/").join(`/${project}/`) };
    return { status: null, signal: null, stdout: "", stderr: "", ...moved };
  };
  const result = checkEffectDiagnostics({
    root,
    projects: ["first", "second"],
    resolve: row.resolve ?? (() => fakeManifest(root)),
    exists: row.exists ?? (() => true),
    spawn,
  });
  const expected = row.result.ok ? { ...row.result, projects: ["first", "second"] } : row.result;
  if (row.result.lines === undefined) expect(result).toMatchObject(expected);
  else if (row.lineCount === undefined) expect(result).toEqual(expected);
  else {
    expect(result).toMatchObject({ ok: false, code: row.result.code });
    expect(result.lines.slice(0, 3)).toEqual(row.result.lines);
    expect(result.lines).toHaveLength(row.lineCount);
  }
  if (row.head) expect(result.lines.slice(0, row.head.length)).toEqual(row.head);
  if (row.missingCli) expect(result.lines).toEqual([`missing executable ${fakeCli(root)}`]);
  expect(calls).toHaveLength(row.spawns ?? (row.result.ok ? 2 : 1));
});

/** `count` error-level Effect diagnostics in the recorded format, one per line of `first/src/a.ts`. */
function manyViolations(root, count) {
  const file = `${root.split("\\").join("/")}/first/src/a.ts`;
  const entries = Array.from({ length: count }, (_, index) =>
    entry([file, index + 1, 3, "error", "newPromise"]),
  );
  return { status: 1, signal: null, stdout: report(entries), stderr: "" };
}

it.each([{ count: 20 }, { count: 21 }, { count: 25 }])(
  "lists every violation: $count",
  ({ count }) => {
    const root = fakeRoot();
    const { spawn } = fakeSpawn(manyViolations(root, count));
    const result = checkEffectDiagnostics({
      root,
      projects: ["first"],
      resolve: () => fakeManifest(root),
      exists: () => true,
      spawn,
    });
    expect(result).toMatchObject({ ok: false, code: "EFFECT_GATE_VIOLATIONS" });
    expect(result.lines).toEqual(
      Array.from({ length: count }, (_, index) => `first/src/a.ts(${index + 1},3) newPromise`),
    );
    expect(result.violations).toHaveLength(count);
  },
);

it.each([
  { count: 20, tail: [] },
  { count: 21, tail: ["… 2 more"] },
  { count: 25, tail: ["… 6 more"] },
])("caps other failure details at 20 lines: $count", ({ count, tail }) => {
  const directives = Array.from(
    { length: count },
    () => "// @effect-diagnostics-next-line newPromise:off",
  );
  const root = waiverTree(directives, []);
  const result = checkEffectDiagnostics({ root, projects: [], register: true });
  const named = Array.from(
    { length: count },
    (_, index) => `apps/sample/src/a.ts(${index + 1}) unregistered directive`,
  );
  expect(result).toEqual({
    ok: false,
    code: "EFFECT_GATE_WAIVER_UNREGISTERED",
    lines: tail.length === 0 ? named : [...named.slice(0, 19), ...tail],
  });
});

const canaryFolder = "apps/harness/scripts/effect-diagnostics-canary";

/** The canary's recorded entries under `root`, relative keys as `[file, line, column, severity, rule]`. */
const canaryEntries = [
  ["src/canary.ts", 3, 24, "error", "newPromise"],
  ["src/canary.ts", 4, 14, "error", "anyUnknownInErrorContext"],
  ["src/canary.ts", 4, 24, "error", "unknownInEffectCatch"],
  ["src/canary.ts", 4, 24, "error", "anyUnknownInErrorContext"],
  ["src/canary.ts", 8, 33, "error", "schemaNumber"],
  ["src/canary.ts", 13, 10, "error", "unnecessaryFailYieldableError"],
  ["src/canary.ts", 15, 14, "error", "extendsNativeError"],
];

/** The canary's checked files as M2 lists them, each detecting Effect v4. */
const canaryFiles = [
  ["src/canary.ts", "v4"],
  ["src/planted.test.ts", "v4"],
  ["tests/planted.ts", "v4"],
];

/** Fake canary output in the recorded format: the expected set, or that set changed by `edit`. */
function canaryOutput(root, edit = (entries) => entries) {
  const base = `${root.split("\\").join("/")}/${canaryFolder}`;
  const entries = edit(canaryEntries).map(([file, line, column, severity, rule]) =>
    entry([`${base}/${file}`, line, column, severity, rule]),
  );
  return report(entries);
}

/** A copy of the repository canary under a temporary root, its plugin entry removed. */
function canaryWithoutPlugin() {
  const root = fakeRoot();
  const source = join(repository, canaryFolder);
  const target = join(root, canaryFolder);
  cpSync(source, target, { recursive: true });
  linkEffect(root);
  writeFileSync(
    join(target, "tsconfig.json"),
    JSON.stringify({
      extends: join(repository, "tsconfig.base.json"),
      compilerOptions: { noEmit: true, plugins: [] },
      include: ["src", "tests"],
    }),
  );
  return root;
}

it("runs the canary before any package: real canary", () => {
  expect(checkEffectDiagnostics({ root: repository, projects: [], canary: true })).toMatchObject({
    ok: true,
    canary: "matched",
  });
});

it("runs the canary before any package: plugin removed, real compiler", () => {
  const root = canaryWithoutPlugin();
  const result = checkEffectDiagnostics({ root, projects: [], canary: true });
  expect(result).toEqual({
    ok: false,
    code: "EFFECT_GATE_CANARY_MISMATCH",
    lines: [
      "extra src/planted.test.ts(1,30) error newPromise",
      "extra tests/planted.ts(1,31) error newPromise",
    ],
  });
});

const missingEverything = [
  "missing src/canary.ts(13,10) error unnecessaryFailYieldableError",
  "missing src/canary.ts(15,14) error extendsNativeError",
  "missing src/canary.ts(3,24) error newPromise",
  "missing src/canary.ts(4,14) error anyUnknownInErrorContext",
  "missing src/canary.ts(4,24) error anyUnknownInErrorContext",
  "missing src/canary.ts(4,24) error unknownInEffectCatch",
  "missing src/canary.ts(8,33) error schemaNumber",
];

const canaryRows = [
  {
    name: "extra diagnostic",
    edit: (entries) => [...entries, ["src/canary.ts", 1, 1, "error", "newPromise"]],
    lines: ["extra src/canary.ts(1,1) error newPromise"],
  },
  {
    name: "missing diagnostic",
    edit: (entries) => [...entries, ["src/canary.ts", 7, 23, "error", "newPromise"]],
    lines: ["extra src/canary.ts(7,23) error newPromise"],
  },
  {
    name: "override not applied",
    edit: (entries) => [...entries, ["src/planted.test.ts", 1, 30, "error", "newPromise"]],
    lines: ["extra src/planted.test.ts(1,30) error newPromise"],
  },
  { name: "exit 0 with the expected set", status: 0, lines: ["canary exit 0"] },
  {
    name: "missing the last expected diagnostic",
    edit: (entries) => entries.slice(0, -1),
    lines: ["missing src/canary.ts(15,14) error extendsNativeError"],
  },
  {
    name: "inactive language service",
    status: 0,
    edit: () => [],
    lines: ["canary exit 0", ...missingEverything],
  },
  {
    // M1 case 7c: the canary's tsconfig with `"plugins": []`.
    name: "plugin removed",
    run: (root) => recordedRun("canaryWithoutPlugin", root, canaryFolder, canaryFiles),
    lines: [
      "extra src/planted.test.ts(1,30) error newPromise",
      "extra tests/planted.ts(1,31) error newPromise",
    ],
  },
];

it.each(canaryRows)("runs the canary before any package: $name", (row) => {
  const root = fakeRoot();
  const run = row.run?.(root) ?? { status: row.status ?? 1, stdout: canaryOutput(root, row.edit) };
  const { spawn, calls } = fakeSpawn(run);
  const result = checkEffectDiagnostics({
    root,
    resolve: () => fakeManifest(root),
    exists: () => true,
    spawn,
  });
  expect(result).toEqual({ ok: false, code: "EFFECT_GATE_CANARY_MISMATCH", lines: row.lines });
  expect(calls).toHaveLength(1);
});

const [firstKey, secondKey] = [
  "src/canary.ts(3,24) error newPromise",
  "src/canary.ts(4,14) error anyUnknownInErrorContext",
];

const differenceRows = [
  {
    name: "duplicated line",
    edit: (entries) => [...entries, entries[0]],
    lines: [`extra ${firstKey}`],
  },
  {
    name: "duplicate replaces a line",
    edit: (entries) => [entries[0], entries[0], ...entries.slice(2)],
    lines: [`extra ${firstKey}`, `missing ${secondKey}`],
  },
  {
    name: "moved",
    edit: ([first, ...rest]) => [[first[0], first[1], first[2] + 1, first[3], first[4]], ...rest],
    lines: ["extra src/canary.ts(3,25) error newPromise", `missing ${firstKey}`],
  },
  { name: "clean exit, same set", status: 0, lines: ["canary exit 0"] },
];

it.each(differenceRows)("names every canary difference: $name", ({ edit, status = 1, lines }) => {
  const root = fakeRoot();
  const { spawn } = fakeSpawn({ status, stdout: canaryOutput(root, edit) });
  const result = checkEffectDiagnostics({
    root,
    projects: [],
    canary: true,
    resolve: () => fakeManifest(root),
    exists: () => true,
    spawn,
  });
  expect(result).toEqual({ ok: false, code: "EFFECT_GATE_CANARY_MISMATCH", lines });
  expect(result.lines.length).toBeGreaterThan(0);
});

it("names every canary difference: matched", () => {
  const root = fakeRoot();
  const reversed = canaryOutput(root, (entries) => [...entries].reverse());
  const { spawn, calls } = fakeSpawn({ status: 1, stdout: reversed });
  const result = checkEffectDiagnostics({
    root,
    projects: [],
    canary: true,
    resolve: () => fakeManifest(root),
    exists: () => true,
    spawn,
  });
  expect(result).toEqual({ ok: true, warnings: 0, projects: [], canary: "matched" });
  expect(calls).toHaveLength(1);
});

// The canary plus four packages take about 7.6 s alone in diagnostics mode locally and 12.6-13.4 s
// on the 2-vCPU CI runners (2026-10-23); Pedro raised this row's bound to 30 s.
it("passes on the repository", { timeout: 30_000 }, () => {
  const result = checkEffectDiagnostics({ root: repository });
  expect(result).toMatchObject({ ok: true, canary: "matched" });
  expect(result.projects).toEqual([
    "packages/kernel",
    "packages/protocol",
    "apps/harness",
    "apps/desktop",
  ]);
});

it("keeps exactly the registered waivers", () => {
  const register = JSON.parse(readFileSync(join(repository, registerPath), "utf8"));
  expect(register.map((entry) => entry.id)).toEqual(["EW1", "EW2", "EW3", "EW4", "EW5", "EW9"]);
});
