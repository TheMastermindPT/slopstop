import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { checkEffectDiagnostics } from "../../scripts/check-effect-diagnostics.mjs";

const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const checker = fileURLToPath(
  new URL("../../scripts/check-effect-diagnostics.mjs", import.meta.url),
);
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

/** A temporary root whose fake `@effect/tsgo` resolves inside it. */
function fakeRoot() {
  const root = mkdtempSync(join(tmpdir(), "slopstop-effect-gate-"));
  roots.push(root);
  return root;
}

const canaryFolder = "apps/harness/scripts/effect-diagnostics-canary";

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
