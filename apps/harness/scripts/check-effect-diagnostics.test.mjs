import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { checkEffectDiagnostics } from "./check-effect-diagnostics.mjs";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const checker = fileURLToPath(new URL("./check-effect-diagnostics.mjs", import.meta.url));
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/**
 * A temporary project at the folder's root that extends the repository base config and finds
 * `effect` in the repository. Its own plugin entry makes the two planted rules `error`, so these
 * rows test the gate's classification apart from the curated repository configuration.
 */
function plantedProject(source) {
  const root = mkdtempSync(join(tmpdir(), "slopstop-effect-gate-"));
  roots.push(root);
  const modules = join(repository, "node_modules");
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify({
      extends: join(repository, "tsconfig.base.json"),
      compilerOptions: {
        noEmit: true,
        types: [],
        typeRoots: [join(modules, "@types")],
        paths: { effect: [join(modules, "effect")], "effect/*": [join(modules, "effect", "*")] },
        plugins: [
          {
            name: "@effect/language-service",
            diagnosticSeverity: { unknownInEffectCatch: "error", newPromise: "error" },
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

/** A fake `spawnSync` that answers `outcome` and counts its calls. */
function fakeSpawn(outcome) {
  const calls = [];
  const spawn = (...args) => {
    calls.push(args);
    return { status: null, signal: null, stdout: "", stderr: "", ...outcome };
  };
  return { spawn, calls };
}

const binaryRows = [
  {
    name: "missing package",
    resolve: () => {
      throw Object.assign(new Error("Cannot find module"), { code: "MODULE_NOT_FOUND" });
    },
    exists: () => true,
    outcome: { status: 0 },
    code: "EFFECT_GATE_BINARY_MISSING",
    spawns: 0,
  },
  {
    name: "missing executable",
    exists: () => false,
    outcome: { status: 0 },
    code: "EFFECT_GATE_BINARY_MISSING",
    spawns: 0,
  },
  {
    name: "spawn error",
    outcome: { error: Object.assign(new Error("operation not permitted"), { code: "EPERM" }) },
    code: "EFFECT_GATE_BINARY_FAILED",
    spawns: 1,
  },
  {
    name: "killed",
    outcome: { status: null, signal: "SIGKILL" },
    code: "EFFECT_GATE_BINARY_FAILED",
    spawns: 1,
  },
  { name: "exit 2", outcome: { status: 2 }, code: "EFFECT_GATE_BROKEN", spawns: 1 },
  {
    name: "exit 1, no diagnostic line",
    outcome: { status: 1, stdout: "something went wrong\n" },
    code: "EFFECT_GATE_BROKEN",
    spawns: 1,
  },
  {
    name: "exit 1 with a non-Effect error",
    outcome: {
      status: 1,
      stdout: "src/a.ts(1,7): error TS2322: Type 'string' is not assignable.\n",
    },
    code: "EFFECT_GATE_BROKEN",
    spawns: 1,
  },
  {
    name: "exit 0 with an error line",
    outcome: {
      status: 0,
      stdout: "src/a.ts(3,18): error TS377080: Planted. effect(newPromise)\n",
    },
    code: "EFFECT_GATE_BROKEN",
    spawns: 1,
  },
];

/** Every failure carries `lines` (at most 20) that name its cause (S5B-R1-3). */
function expectNamedCause(result, fragments) {
  expect(Array.isArray(result.lines)).toBe(true);
  expect(result.lines.length).toBeGreaterThan(0);
  expect(result.lines.length).toBeLessThanOrEqual(20);
  const text = result.lines.join("\n");
  for (const fragment of fragments) expect(text).toContain(fragment);
}

const binaryFragments = (root) => ({
  "missing package": [`@effect/tsgo-${process.platform}-${process.arch}`],
  "missing executable": [
    join(root, "node_modules", "tsgo", "lib", process.platform === "win32" ? "tsc.exe" : "tsc"),
  ],
  "spawn error": ["first", "EPERM"],
  killed: ["first", "SIGKILL"],
  "exit 2": ["first", "exit 2"],
  "exit 1, no diagnostic line": ["first", "exit 1", "something went wrong"],
  "exit 1 with a non-Effect error": ["first", "src/a.ts(1,7)"],
  "exit 0 with an error line": ["first", "exit 0", "src/a.ts(3,18)"],
});

it.each(binaryRows)("distinguishes a broken binary run: $name", (row) => {
  const root = mkdtempSync(join(tmpdir(), "slopstop-effect-gate-"));
  roots.push(root);
  const { spawn, calls } = fakeSpawn(row.outcome);
  const result = checkEffectDiagnostics({
    root,
    projects: ["first", "second"],
    resolve: row.resolve ?? (() => join(root, "node_modules", "tsgo", "package.json")),
    exists: row.exists ?? (() => true),
    spawn,
  });
  expect(result).toMatchObject({ ok: false, code: row.code });
  expectNamedCause(result, binaryFragments(root)[row.name]);
  expect(calls).toHaveLength(row.spawns);
});

const canaryFolder = "apps/harness/scripts/effect-diagnostics-canary";
const canaryLines = [
  "src/canary.ts(3,24): error TS377080: Planted. effect(newPromise)",
  "src/canary.ts(4,14): warning TS377030: Planted. effect(anyUnknownInErrorContext)",
  "src/canary.ts(4,24): error TS377021: Planted. effect(unknownInEffectCatch)",
  "src/canary.ts(4,24): warning TS377030: Planted. effect(anyUnknownInErrorContext)",
];

/** Fake canary output: the expected set, or the expected set changed by `edit`. */
function canaryOutput(edit = (lines) => lines) {
  return `${edit(canaryLines)
    .map((line) => `${canaryFolder}/${line}`)
    .join("\n")}\n`;
}

/** A copy of the repository canary under a temporary root, its plugin entry removed. */
function canaryWithoutPlugin() {
  const root = mkdtempSync(join(tmpdir(), "slopstop-effect-gate-"));
  roots.push(root);
  const source = join(repository, canaryFolder);
  const target = join(root, canaryFolder);
  cpSync(source, target, { recursive: true });
  const modules = join(repository, "node_modules");
  writeFileSync(
    join(target, "tsconfig.json"),
    JSON.stringify({
      extends: join(repository, "tsconfig.base.json"),
      compilerOptions: {
        noEmit: true,
        plugins: [],
        paths: { effect: [join(modules, "effect")], "effect/*": [join(modules, "effect", "*")] },
      },
      include: ["src", "tests"],
    }),
  );
  return root;
}

const canaryRows = [
  {
    name: "extra diagnostic",
    edit: (lines) => [...lines, "src/canary.ts(1,1): error TS1: x effect(newPromise)"],
  },
  {
    name: "missing diagnostic",
    edit: (lines) => [...lines, "src/canary.ts(7,23): error TS1: x effect(newPromise)"],
  },
  {
    name: "override not applied",
    edit: (lines) => [...lines, "src/planted.test.ts(1,30): error TS1: x effect(newPromise)"],
  },
  { name: "exit 0 with the expected set", status: 0 },
  {
    name: "missing the last expected diagnostic",
    edit: (lines) => lines.filter((line) => !line.startsWith("src/canary.ts(4,24): warning")),
  },
  { name: "inactive language service", status: 0, edit: () => [] },
];

it("runs the canary before any package: real canary", () => {
  expect(checkEffectDiagnostics({ root: repository, projects: [], canary: true })).toMatchObject({
    ok: true,
    canary: "matched",
  });
});

it("runs the canary before any package: plugin removed", () => {
  const root = canaryWithoutPlugin();
  const result = checkEffectDiagnostics({ root, projects: [], canary: true });
  expect(result).toMatchObject({ ok: false, code: "EFFECT_GATE_CANARY_MISMATCH" });
  // Its exact lines come from the real binary's defaults: at least one differing key is named.
  expectNamedCause(result, []);
  expect(result.lines.some((line) => /^(extra|missing) /.test(line))).toBe(true);
});

const missingEverything = [
  "missing src/canary.ts(3,24) error newPromise",
  "missing src/canary.ts(4,14) warning anyUnknownInErrorContext",
  "missing src/canary.ts(4,24) error unknownInEffectCatch",
  "missing src/canary.ts(4,24) warning anyUnknownInErrorContext",
];
const canaryFragments = {
  "extra diagnostic": ["extra src/canary.ts(1,1) error newPromise"],
  "missing diagnostic": ["extra src/canary.ts(7,23) error newPromise"],
  "override not applied": ["extra src/planted.test.ts(1,30) error newPromise"],
  "exit 0 with the expected set": ["canary exit 0"],
  "missing the last expected diagnostic": [
    "missing src/canary.ts(4,24) warning anyUnknownInErrorContext",
  ],
  "inactive language service": ["canary exit 0", ...missingEverything],
};

it.each(canaryRows)("runs the canary before any package: $name", ({ name, edit, status = 1 }) => {
  const { spawn, calls } = fakeSpawn({ status, stdout: canaryOutput(edit) });
  const result = checkEffectDiagnostics({
    root: repository,
    resolve: () => join(repository, "node_modules", "tsgo", "package.json"),
    exists: () => true,
    spawn,
  });
  expect(result).toMatchObject({ ok: false, code: "EFFECT_GATE_CANARY_MISMATCH" });
  expectNamedCause(result, canaryFragments[name]);
  expect(calls).toHaveLength(1);
});

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

// The canary plus four packages take about 3 s alone; the bound leaves room under `pnpm check`.
it("passes on the repository", { timeout: 15_000 }, () => {
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
