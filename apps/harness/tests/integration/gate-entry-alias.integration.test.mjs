import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";

const scripts = fileURLToPath(new URL("../../scripts/", import.meta.url));
/** The current row's temporary root and, once made, its link to `scripts`. */
let made;

afterEach(() => {
  if (made === undefined) return;
  const { root, link } = made;
  made = undefined;
  // The link goes first, so removing the root never reaches the repository's `scripts` folder.
  if (link !== undefined) unlinkSync(link);
  rmSync(root, { recursive: true, force: true });
});

/**
 * A temporary root holding an empty working folder (with `files` written into it) and a link to
 * the repository's `scripts` folder: a junction on Windows, which needs no rights, a symlinked
 * folder elsewhere.
 */
function linkedScripts(files) {
  const root = mkdtempSync(join(tmpdir(), "slopstop-gate-entry-"));
  made = { root };
  const work = join(root, "work");
  mkdirSync(work);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(work, name), text);
  const link = join(root, "scripts-link");
  symlinkSync(scripts, link, process.platform === "win32" ? "junction" : "dir");
  made = { root, link };
  return { work, link };
}

/**
 * Runs `node <script> ...args` in `cwd`, answering what a gate command shows. With no `env` the
 * child inherits this process's environment.
 */
function launch(script, args, cwd, env) {
  const { status, stdout, stderr } = spawnSync(process.execPath, [script, ...args], {
    cwd,
    env,
    encoding: "utf8",
  });
  return { status, stdout, stderr };
}

const gateRows = [
  { script: "check-effect-diagnostics.mjs", args: ["."], files: {}, first: "EFFECT_GATE_BROKEN" },
  {
    script: "check-golden-sql.mjs",
    args: [],
    files: {},
    first: "GOLDEN_SQL_MISSING: apps/harness/drizzle/canonical/0001_canonical_project_writer.sql",
  },
  {
    script: "check-stryker-ranges.mjs",
    args: [],
    files: { "stryker.config.json": "{ not json" },
    first: "STRYKER_RANGE_BROKEN",
  },
];

it.each(gateRows)("gives the real answer through a linked folder: $script", (row) => {
  const { work, link } = linkedScripts(row.files);
  const real = launch(join(scripts, row.script), row.args, work);
  expect(real.status).toBe(1);
  expect(real.stderr.split("\n")[0]).toBe(row.first);
  expect(launch(join(link, row.script), row.args, work)).toEqual(real);
});

it("fails visibly when the entry path cannot be read", () => {
  const source = readFileSync(join(scripts, "check-golden-sql.mjs"), "utf8");
  const piped = spawnSync(process.execPath, ["-"], {
    cwd: scripts,
    input: source,
    encoding: "utf8",
  });
  expect({ status: piped.status, stdout: piped.stdout, stderr: piped.stderr }).toEqual({
    status: 1,
    stdout: "",
    stderr: "GATE_ENTRY_UNKNOWN: cannot read -: ENOENT\n",
  });
});

/**
 * This process's environment without `npm_execpath`. Vitest runs under pnpm, which sets it; with it
 * set the migrations gate would run the real `pnpm db:generate` over `apps/harness/drizzle`.
 */
function withoutPnpm() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => name.toLowerCase() !== "npm_execpath"),
  );
}

it("gives the migrations gate's real answer through a linked folder", () => {
  const { work, link } = linkedScripts({});
  const env = withoutPnpm();
  const real = launch(join(scripts, "check-generated-migrations.mjs"), [], work, env);
  expect(real.status).toBe(1);
  expect(real.stdout).toBe("");
  expect(real.stderr.split(/\r?\n/)).toContain("Error: pnpm entrypoint is unavailable.");
  expect(launch(join(link, "check-generated-migrations.mjs"), [], work, env)).toEqual(real);
});

const ownSource = readFileSync(join(scripts, "check-golden-sql.mjs"), "utf8");
const programRows = [
  { name: "stdin as a module", args: ["--input-type=module"], input: ownSource },
  { name: "plain stdin", args: [], input: ownSource },
  { name: "-e as a module", args: ["--input-type=module", "-e", ownSource], input: "" },
];

it.each(programRows)(
  "fails visibly when the gate's own source is the program: $name",
  ({ args, input }) => {
    const { status, stdout, stderr } = spawnSync(process.execPath, args, {
      cwd: scripts,
      input,
      encoding: "utf8",
    });
    expect({ status, stdout, stderr }).toEqual({
      status: 1,
      stdout: "",
      stderr: `GATE_ENTRY_UNKNOWN: cannot read ${join(scripts, "[eval1]")}: ENOENT\n`,
    });
  },
);
