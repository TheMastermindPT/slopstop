import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";
import { checkGoldenSql } from "./check-golden-sql.mjs";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const checker = fileURLToPath(new URL("./check-golden-sql.mjs", import.meta.url));
const migration = "apps/harness/drizzle/canonical/0001_canonical_project_writer.sql";
const fixture = "apps/harness/tests/fixtures/canonical-project-writer-generation-2.sql";
let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "slopstop-golden-sql-"));
  for (const path of [migration, fixture]) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    copyFileSync(resolve(repository, path), join(root, path));
  }
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function runCli() {
  return spawnSync(process.execPath, [checker], { cwd: root, encoding: "utf8" });
}

function expectHashFailure(path) {
  expectFailure(path, "GOLDEN_SQL_HASH_MISMATCH");
}

function expectFailure(path, code) {
  expect(checkGoldenSql({ root })).toEqual({ ok: false, code, path });
  const run = runCli();
  expect(run.error).toBeUndefined();
  expect(run.status).toBe(1);
  expect(run.stdout).toBe("");
  expect(run.stderr).toBe(`${code}: ${path}\n`);
}

it("accepts the two independent original raw SQL forms", () => {
  expect(checkGoldenSql({ root })).toEqual({ ok: true });
  const run = runCli();
  expect(run.status).toBe(0);
  expect(run.stdout).toBe("Golden SQL verified: 2 independent pinned files.\n");
  expect(run.stderr).toBe("");
});

it.each([migration, fixture])("rejects a one-byte mutation of %s", (path) => {
  const bytes = readFileSync(join(root, path));
  bytes[0] ^= 1;
  writeFileSync(join(root, path), bytes);
  expectHashFailure(path);
});

it("rejects both files changed to the same replacement bytes", () => {
  for (const path of [migration, fixture]) writeFileSync(join(root, path), "SELECT 42;\n");
  expectHashFailure(migration);
});

it("rejects the two original files swapped", () => {
  const source = readFileSync(join(root, migration));
  writeFileSync(join(root, migration), readFileSync(join(root, fixture)));
  writeFileSync(join(root, fixture), source);
  expectHashFailure(migration);
});

it.each([migration, fixture])("does not normalize the terminal newline of %s", (path) => {
  const bytes = readFileSync(join(root, path));
  const changed =
    path === migration ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes.subarray(0, -1);
  writeFileSync(join(root, path), changed);
  expectHashFailure(path);
});

it.each([migration, fixture])("rejects a missing %s", (path) => {
  rmSync(join(root, path));
  expectFailure(path, "GOLDEN_SQL_MISSING");
});

it.each([migration, fixture])("rejects a directory at %s", (path) => {
  rmSync(join(root, path));
  mkdirSync(join(root, path));
  expectFailure(path, "GOLDEN_SQL_NOT_REGULAR");
});

it.each([migration, fixture])("rejects a hardlinked %s even with the correct bytes", (path) => {
  linkSync(join(root, path), join(root, "alias.sql"));
  expectFailure(path, "GOLDEN_SQL_ALIAS");
});

const nativeFileSystem = { lstatSync, readFileSync, realpathSync };

it.each([migration, fixture])(
  "rejects a symbolic link at %s without skipping on Windows",
  (path) => {
    const target = join(root, "target.sql");
    copyFileSync(join(root, path), target);
    rmSync(join(root, path));
    try {
      symlinkSync(target, join(root, path), "file");
    } catch (error) {
      if (error.code !== "EPERM") throw error;
      copyFileSync(target, join(root, path));
      const fileSystem = {
        ...nativeFileSystem,
        lstatSync: (name, options) => {
          const metadata = lstatSync(name, options);
          if (name === join(root, path)) metadata.isSymbolicLink = () => true;
          return metadata;
        },
      };
      expect(checkGoldenSql({ root, fileSystem })).toEqual({
        ok: false,
        code: "GOLDEN_SQL_SYMLINK",
        path,
      });
      return;
    }
    expectFailure(path, "GOLDEN_SQL_SYMLINK");
  },
);

it.each([migration, fixture])("rejects a parent-directory alias for %s", (path) => {
  const directory = dirname(join(root, path));
  const target = join(root, "relocated");
  mkdirSync(target);
  copyFileSync(join(root, path), join(target, path.split("/").at(-1)));
  rmSync(directory, { recursive: true });
  symlinkSync(target, directory, process.platform === "win32" ? "junction" : "dir");
  expectFailure(path, "GOLDEN_SQL_ALIAS");
});

it.each([migration, fixture])("classifies metadata and read failures for %s", (path) => {
  for (const [operation, code] of [
    ["lstatSync", "GOLDEN_SQL_METADATA_ERROR"],
    ["realpathSync", "GOLDEN_SQL_METADATA_ERROR"],
    ["readFileSync", "GOLDEN_SQL_READ_ERROR"],
  ]) {
    const fileSystem = {
      ...nativeFileSystem,
      [operation]: (name, ...args) => {
        if (name === join(root, path)) throw new Error("injected IO failure");
        return nativeFileSystem[operation](name, ...args);
      },
    };
    expect(checkGoldenSql({ root, fileSystem })).toEqual({ ok: false, code, path });
  }
});

it("rejects equal file identities even if link counts report one", () => {
  const identity = lstatSync(join(root, migration), { bigint: true });
  const fileSystem = {
    ...nativeFileSystem,
    lstatSync: (name, options) => {
      const metadata = lstatSync(name, options);
      metadata.dev = identity.dev;
      metadata.ino = identity.ino;
      return metadata;
    },
  };
  expect(checkGoldenSql({ root, fileSystem })).toEqual({
    ok: false,
    code: "GOLDEN_SQL_ALIAS",
    path: fixture,
  });
});

it("retains the exact single-fixture exclusion and zero-duplication policy", () => {
  const config = JSON.parse(readFileSync(join(repository, "jscpd.json"), "utf8"));
  expect(config).toEqual({
    path: ["apps", "packages"],
    threshold: 0,
    minLines: 10,
    minTokens: 60,
    reporters: ["console"],
    ignore: [
      "**/.vite/**",
      "**/coverage/**",
      "**/drizzle/**/meta/*_snapshot.json",
      "**/node_modules/**",
      "**/out/**",
      "**/playwright-report/**",
      "**/test-results/**",
      fixture,
    ],
  });
  const { scripts } = JSON.parse(readFileSync(join(repository, "package.json"), "utf8"));
  expect(scripts["check:duplicates"]).toBe(
    "node apps/harness/scripts/check-golden-sql.mjs && jscpd --config jscpd.json",
  );
  expect(scripts["check:deep:portable"]).toContain("pnpm check:duplicates");
});

function runRootCommand(scannerExit) {
  const localChecker = join(root, "apps/harness/scripts/check-golden-sql.mjs");
  mkdirSync(dirname(localChecker), { recursive: true });
  copyFileSync(checker, localChecker);
  const windows = process.platform === "win32";
  const scanner = windows
    ? `@echo off\r\necho SCANNER_RAN\r\nexit /b ${scannerExit}\r\n`
    : `#!/bin/sh\nprintf 'SCANNER_RAN\\n'\nexit ${scannerExit}\n`;
  writeFileSync(join(root, windows ? "jscpd.cmd" : "jscpd"), scanner, { mode: 0o755 });
  const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
  const env = {
    ...process.env,
    [pathKey]: [root, dirname(process.execPath), process.env[pathKey]].join(delimiter),
  };
  const { scripts } = JSON.parse(readFileSync(join(repository, "package.json"), "utf8"));
  return spawnSync(scripts["check:duplicates"], { cwd: root, env, shell: true, encoding: "utf8" });
}

it("stops the root duplicate command before scanning when golden verification fails", () => {
  writeFileSync(join(root, fixture), "SELECT 0;\n");
  const run = runRootCommand(0);
  expect(run.error).toBeUndefined();
  expect(run.status).toBe(1);
  expect(run.stdout).toBe("");
  expect(run.stderr).toBe(`GOLDEN_SQL_HASH_MISMATCH: ${fixture}\n`);
});

it.each([0, 23])("propagates scanner exit %s after successful golden verification", (exit) => {
  const run = runRootCommand(exit);
  expect(run.error).toBeUndefined();
  expect(run.status).toBe(exit);
  const scannerLine = process.platform === "win32" ? "SCANNER_RAN\r\n" : "SCANNER_RAN\n";
  expect(run.stdout).toBe(`Golden SQL verified: 2 independent pinned files.\n${scannerLine}`);
  expect(run.stderr).toBe("");
});
