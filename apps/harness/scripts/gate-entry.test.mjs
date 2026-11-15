import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it, vi } from "vitest";
import { gateEntry, runGateEntry } from "./gate-entry.mjs";

const own = join(tmpdir(), "slopstop-gate", "scripts", "check-gate.mjs");
const moduleUrl = pathToFileURL(own).href;
const linked = join(tmpdir(), "slopstop-gate", "linked", "check-gate.mjs");
const other = join(tmpdir(), "slopstop-gate", "runner", "vitest.mjs");

/**
 * A fake `stat` over `identities` (path to `{ dev, ino, directory? }`) that fails with
 * `failures[path]`; each answer is a file unless its `directory` is true.
 */
function fakeStat(identities, failures = {}) {
  return vi.fn((path) => {
    const code = failures[path];
    if (code) throw Object.assign(new Error(`${code}: planted`), { code });
    const { directory = false, ...identity } = identities[path];
    return { ...identity, isDirectory: () => directory };
  });
}

it("answers entry when the entry path is the module's own file under another name", () => {
  const stat = fakeStat({ [own]: { dev: 3n, ino: 41n }, [linked]: { dev: 3n, ino: 41n } });
  expect(gateEntry(moduleUrl, { entry: linked, stat })).toBe("entry");
  expect(stat).toHaveBeenCalledWith(linked, { bigint: true });
  expect(stat).toHaveBeenCalledWith(own, { bigint: true });
});

const importedRows = [
  { name: "another file", entry: other, identity: { dev: 3n, ino: 42n } },
  { name: "another device", entry: other, identity: { dev: 4n, ino: 41n } },
  { name: "no entry path", entry: undefined, identity: undefined },
];

it.each(importedRows)(
  "answers imported for another file and for no entry path: $name",
  ({ entry, identity }) => {
    const stat = fakeStat({ [own]: { dev: 3n, ino: 41n }, [other]: identity });
    expect(gateEntry(moduleUrl, { entry, stat })).toBe("imported");
    if (entry === undefined) expect(stat.mock.calls).toStrictEqual([[own, { bigint: true }]]);
  },
);

const unreadableRows = [
  { name: "the entry path", entry: linked, failing: linked, code: "EPERM" },
  { name: "the module's own file", entry: linked, failing: own, code: "EPERM" },
  { name: "the entry path -", entry: "-", failing: "-", code: "ENOENT" },
];

it.each(unreadableRows)(
  "answers unknown when a file cannot be read: $name",
  ({ entry, failing, code }) => {
    const identities = { [own]: { dev: 3n, ino: 41n }, [linked]: { dev: 3n, ino: 41n } };
    const stat = fakeStat(identities, { [failing]: code });
    expect(gateEntry(moduleUrl, { entry, stat })).toStrictEqual({
      unknown: `cannot read ${failing}: ${code}`,
    });
  },
);

/** The run ports of one row: a `run` spy, a stderr spy and an exit-code spy. */
function runPorts(entry, failures) {
  const stat = fakeStat(
    {
      [own]: { dev: 3n, ino: 41n },
      [linked]: { dev: 3n, ino: 41n },
      [other]: { dev: 3n, ino: 42n },
    },
    failures,
  );
  return {
    run: vi.fn(() => "ran"),
    ports: { entry, stat, stderr: { write: vi.fn() }, setExitCode: vi.fn() },
  };
}

it("runs only as the entry and fails visibly when it cannot tell: entry", () => {
  const { run, ports } = runPorts(linked);
  expect(runGateEntry(moduleUrl, run, ports)).toBe("ran");
  expect(run).toHaveBeenCalledOnce();
  expect(ports.stderr.write).not.toHaveBeenCalled();
  expect(ports.setExitCode).not.toHaveBeenCalled();
});

it("runs only as the entry and fails visibly when it cannot tell: imported", () => {
  const { run, ports } = runPorts(other);
  runGateEntry(moduleUrl, run, ports);
  expect(run).not.toHaveBeenCalled();
  expect(ports.stderr.write).not.toHaveBeenCalled();
  expect(ports.setExitCode).not.toHaveBeenCalled();
});

it("runs only as the entry and fails visibly when it cannot tell: unknown", () => {
  const { run, ports } = runPorts(linked, { [linked]: "EPERM" });
  runGateEntry(moduleUrl, run, ports);
  expect(run).not.toHaveBeenCalled();
  expect(ports.stderr.write.mock.calls).toStrictEqual([
    [`GATE_ENTRY_UNKNOWN: cannot read ${linked}: EPERM\n`],
  ]);
  expect(ports.setExitCode.mock.calls).toStrictEqual([[1]]);
});

it("answers unknown when the entry path is a directory", () => {
  const folder = join(tmpdir(), "slopstop-gate", "linked");
  const stat = fakeStat({
    [own]: { dev: 3n, ino: 41n },
    [folder]: { dev: 3n, ino: 7n, directory: true },
  });
  expect(gateEntry(moduleUrl, { entry: folder, stat })).toStrictEqual({
    unknown: `entry path is a directory: ${folder}`,
  });
  expect(stat).not.toHaveBeenCalledWith(own, expect.anything());
});

const allOnes = 0xffffffffffffffffn;
const noFileIndexRows = [
  {
    name: "entry ino 0",
    entry: { dev: 3n, ino: 0n },
    mine: { dev: 3n, ino: 41n },
    named: linked,
    value: "0",
  },
  {
    name: "entry ino all ones",
    entry: { dev: 3n, ino: allOnes },
    mine: { dev: 3n, ino: 41n },
    named: linked,
    value: "18446744073709551615",
  },
  {
    name: "entry ino -1",
    entry: { dev: 3n, ino: -1n },
    mine: { dev: 3n, ino: 41n },
    named: linked,
    value: "-1",
  },
  {
    name: "own file ino 0",
    entry: { dev: 3n, ino: 41n },
    mine: { dev: 3n, ino: 0n },
    named: own,
    value: "0",
  },
  {
    name: "both ino 0",
    entry: { dev: 3n, ino: 0n },
    mine: { dev: 3n, ino: 0n },
    named: linked,
    value: "0",
  },
];

it.each(noFileIndexRows)(
  "answers unknown when a file has no file identity: $name",
  ({ entry, mine, named, value }) => {
    const stat = fakeStat({ [own]: mine, [linked]: entry });
    expect(gateEntry(moduleUrl, { entry: linked, stat })).toStrictEqual({
      unknown: `no file identity for ${named}: ino ${value}`,
    });
  },
);

const devZeroRows = [
  {
    name: "win32 entry dev 0",
    platform: "win32",
    entry: { dev: 0n, ino: 41n },
    mine: { dev: 3n, ino: 41n },
    named: linked,
  },
  {
    name: "win32 own file dev 0",
    platform: "win32",
    entry: { dev: 3n, ino: 41n },
    mine: { dev: 0n, ino: 41n },
    named: own,
  },
  {
    name: "win32 both dev 0",
    platform: "win32",
    entry: { dev: 0n, ino: 41n },
    mine: { dev: 0n, ino: 41n },
    named: linked,
  },
  {
    name: "linux both dev 0, same ino",
    platform: "linux",
    entry: { dev: 0n, ino: 41n },
    mine: { dev: 0n, ino: 41n },
    answer: "entry",
  },
  {
    name: "linux dev 0, other ino",
    platform: "linux",
    entry: { dev: 0n, ino: 42n },
    mine: { dev: 0n, ino: 41n },
    answer: "imported",
  },
];

it.each(devZeroRows)(
  "answers unknown for dev 0 on win32 only: $name",
  ({ platform, entry, mine, named, answer }) => {
    const stat = fakeStat({ [own]: mine, [linked]: entry });
    const expected = answer ?? { unknown: `no volume identity for ${named}: dev 0` };
    expect(gateEntry(moduleUrl, { entry: linked, stat, platform })).toStrictEqual(expected);
  },
);

const noEntryUnknownRows = [
  {
    name: "unreadable",
    mine: { dev: 3n, ino: 41n },
    failures: { [own]: "ENOENT" },
    platform: "linux",
    reason: `cannot read ${own}: ENOENT`,
  },
  {
    name: "ino 0",
    mine: { dev: 3n, ino: 0n },
    platform: "linux",
    reason: `no file identity for ${own}: ino 0`,
  },
  {
    name: "win32 dev 0",
    mine: { dev: 0n, ino: 41n },
    platform: "win32",
    reason: `no volume identity for ${own}: dev 0`,
  },
];

it.each(noEntryUnknownRows)(
  "answers unknown with no entry path when the module's own file has no identity: $name",
  ({ mine, failures, platform, reason }) => {
    const stat = fakeStat({ [own]: mine }, failures);
    expect(gateEntry(moduleUrl, { entry: undefined, stat, platform })).toStrictEqual({
      unknown: reason,
    });
  },
);

const processPlatformRows = [
  {
    name: "win32",
    platform: "win32",
    answer: { unknown: `no volume identity for ${linked}: dev 0` },
  },
  { name: "linux", platform: "linux", answer: "entry" },
];

it.each(processPlatformRows)(
  "reads the process platform when none is given: $name",
  ({ platform, answer }) => {
    const stat = fakeStat({ [own]: { dev: 0n, ino: 41n }, [linked]: { dev: 0n, ino: 41n } });
    const original = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", { ...original, value: platform });
    try {
      expect(gateEntry(moduleUrl, { entry: linked, stat })).toStrictEqual(answer);
    } finally {
      Object.defineProperty(process, "platform", original);
    }
  },
);
