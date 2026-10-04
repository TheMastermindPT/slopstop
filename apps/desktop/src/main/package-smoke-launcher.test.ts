import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  spawn: vi.fn(),
  lstat: vi.fn(),
  mkdir: vi.fn(),
  mkdtemp: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
  realpath: vi.fn(),
  rename: vi.fn(),
  rm: vi.fn(),
  symlink: vi.fn(),
  unlink: vi.fn(),
  writeFile: vi.fn(),
  open: vi.fn(),
}));
vi.mock("node:child_process", () => ({ spawn: ports.spawn }));
vi.mock("node:fs/promises", () => ports);

const terminal = "Package smoke writer processes terminal.\n";
const pass = "Package smoke writer proof passed.\n";
const failure = "Package smoke proof failed at writer-transport.\n";
const unconfirmed = "Package smoke writer process exit unconfirmed.\n";
const summary =
  "Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof.\n";
const project = "00000000-0000-4000-8000-000000000101";
const generation = "00000000-0000-4000-8000-000000000201";
const native = readFileSync(
  path.join(
    path.dirname(
      createRequire(path.resolve("apps/harness/package.json")).resolve("fs-native-extensions"),
    ),
    "prebuilds/win32-x64/fs-native-extensions.node",
  ),
);
const hostPlatform = process.platform;
const hostArchitecture = process.arch;
type Entry = { kind: "file" | "dir" | "link"; value?: string | Buffer };
type SmokeEnvironment = NodeJS.ProcessEnv & {
  SLOPSTOP_PACKAGE_SMOKE_SCENARIO?: string;
  SLOPSTOP_PACKAGE_SMOKE_USER_DATA?: string;
  SLOPSTOP_PACKAGE_SMOKE_TOKEN?: string;
  NODE_PATH?: string;
  NODE_OPTIONS?: string;
};
type Launch = { env: SmokeEnvironment; cwd: string };
const tree = new Map<string, Entry>();
const operations: string[] = [];
const launches: Launch[] = [];
let serial = 0;
let writerOutput = terminal + pass;
let writerStdout = "";
let writerCode: number | null = 0;
let writerDelay = 0;
let closeWriter = true;
let spawnError = false;
let killThrows = false;
let bootstrapStderr: string | Buffer = "";
let bootstrapDelay = 0;
let bootstrapCode = 0;
let witnessMutation: (value: Record<string, unknown>) => string | Buffer | undefined;
let beforeWriter: (root: string) => void;
let missingEOF = false;
const challengeName = ".slopstop-runtime-challenge.json";
const witnessName = ".slopstop-runtime-witness.json";
const executableBytes = Buffer.from("pinned packaged executable");
const executableHash = createHash("sha256").update(executableBytes).digest("hex");
let writerMutation: (root: string) => void;
let resourceMutation: (root: string) => void;
let stdout: ReturnType<typeof vi.spyOn>;
let stderr: ReturnType<typeof vi.spyOn>;
let previousExit: typeof process.exitCode;

function put(file: string, entry: Entry) {
  tree.set(path.normalize(file), entry);
}
function get(file: string) {
  const entry = tree.get(path.normalize(file));
  if (!entry) throw Object.assign(new Error("absent"), { code: "ENOENT" });
  return entry;
}
function stat(entry: Entry, name = "") {
  return {
    name,
    dev: 1,
    ino: 1,
    mtimeMs: 1,
    size: entry.value?.length ?? 1,
    isFile: () => entry.kind === "file",
    isDirectory: () => entry.kind === "dir",
    isSymbolicLink: () => entry.kind === "link",
  };
}
function remove(file: string) {
  for (const key of tree.keys())
    if (key === file || key.startsWith(file + path.sep)) tree.delete(key);
}
function archive() {
  const manifest = JSON.stringify({ name: "fs-native-extensions", version: "1.5.1" });
  const files = {
    ...Object.fromEntries(
      ["harness.cjs", "writer-proof-fixture.cjs", "shared.cjs"].map((name) => [
        name,
        { size: 1, offset: "0" },
      ]),
    ),
    node_modules: {
      files: {
        "fs-native-extensions": {
          files: { "package.json": { size: manifest.length, offset: "1" } },
        },
      },
    },
  };
  const json = Buffer.from(JSON.stringify({ files: { ".vite": { files: { build: { files } } } } }));
  const bytes = Buffer.alloc(16 + json.length + 1 + manifest.length);
  bytes.writeUInt32LE(8 + json.length, 4);
  bytes.writeUInt32LE(json.length, 12);
  json.copy(bytes, 16);
  bytes.write(`;${manifest}`, 16 + json.length);
  return bytes;
}
function resources(output: string) {
  put(path.join(output, "SlopStop.exe"), { kind: "file", value: executableBytes });
  put(path.join(output, "SlopStop"), { kind: "file", value: executableBytes });
  const root = path.join(output, "resources");
  put(path.join(root, "app.asar"), { kind: "file", value: archive() });
  for (const kind of ["application", "canonical", "runtime"]) {
    const base = path.join(root, "harness-migrations", kind);
    put(path.join(base, "0001.sql"), { kind: "file", value: "SQL" });
    put(path.join(base, "meta/_journal.json"), { kind: "file", value: '{"entries":[{}]}' });
  }
  const modules = path.join(root, "app.asar.unpacked/.vite/build/node_modules");
  for (const dir of [
    ".vite",
    ".vite/build",
    ".vite/build/node_modules",
    ".vite/build/node_modules/@libsql",
    ".vite/build/node_modules/@libsql/win32-x64",
    ".vite/build/node_modules/fs-native-extensions",
    ".vite/build/node_modules/fs-native-extensions/prebuilds",
    ".vite/build/node_modules/fs-native-extensions/prebuilds/win32-x64",
    ".vite/build/node_modules/@koromix",
    ".vite/build/node_modules/@koromix/koffi-win32-x64",
    ".vite/build/node_modules/@koromix/koffi-win32-x64/win32_x64",
  ])
    put(path.join(root, "app.asar.unpacked", dir), { kind: "dir" });
  put(path.join(modules, "@libsql/win32-x64/index.node"), { kind: "file", value: "binding" });
  put(path.join(modules, "@koromix/koffi-win32-x64/win32_x64/koffi.node"), {
    kind: "file",
    value: "binding",
  });
  put(path.join(modules, "fs-native-extensions/prebuilds/win32-x64/fs-native-extensions.node"), {
    kind: "file",
    value: native,
  });
  resourceMutation(root);
}
function bootstrap(root: string) {
  const base = path.join(root, "storage/projects", project, generation);
  put(base, { kind: "dir" });
  put(path.join(base, "manifest.json"), {
    kind: "file",
    value: JSON.stringify({ projectId: project, generationId: generation }),
  });
  put(path.join(base, "mastra.db"), { kind: "file", value: "runtime" });
  put(path.join(root, "storage/application.db"), { kind: "file", value: "application" });
  beforeWriter(root);
}
function validMarker(entry: Entry, token: string) {
  if (entry.kind !== "file" || typeof entry.value !== "string") return false;
  const marker = JSON.parse(entry.value);
  return Object.keys(marker).length === 2 && marker.version === 1 && marker.token === token;
}
function authorized(env: SmokeEnvironment) {
  const root = env.SLOPSTOP_PACKAGE_SMOKE_USER_DATA;
  const token = env.SLOPSTOP_PACKAGE_SMOKE_TOKEN;
  try {
    if (!root || !token) return false;
    if (!path.isAbsolute(root)) return false;
    if (!/^[a-f0-9]{64}$/.test(token)) return false;
    if (get(root).kind !== "dir") return false;
    const entry = get(path.join(root, ".slopstop-package-smoke.json"));
    if (!validMarker(entry, token)) return false;
    if (env.SLOPSTOP_PACKAGE_SMOKE_SCENARIO === "bootstrap")
      return [...tree.keys()].filter((key) => path.dirname(key) === root).length === 1;
    return ["writer-proof", "missing-runtime", "witnessed-staging"].includes(
      env.SLOPSTOP_PACKAGE_SMOKE_SCENARIO ?? "",
    );
  } catch {
    return false;
  }
}
function makeChild() {
  return Object.assign(new EventEmitter(), {
    pid: 27620,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    unref: vi.fn(),
    kill: vi.fn(() => {
      operations.push("kill");
      if (killThrows) throw new Error("private-kill-detail");
      return true;
    }),
  });
}
function writeWriter(child: ReturnType<typeof makeChild>, launch: Launch) {
  const root = launch.env.SLOPSTOP_PACKAGE_SMOKE_USER_DATA ?? "";
  put(path.join(root, "storage/projects", project, ".slopstop-writer.lock"), { kind: "file" });
  writerMutation(root);
  const challenge = tree.get(path.join(root, challengeName));
  const value: Record<string, unknown> = {
    version: 1,
    nonce: challenge ? JSON.parse(String(challenge.value)).nonce : "a".repeat(64),
    mainPid: child.pid,
    platform: process.platform,
    arch: process.arch,
    electronVersion: "43.4.0",
    executableSha256: executableHash,
  };
  const contents = witnessMutation(value);
  if (contents !== undefined) put(path.join(root, witnessName), { kind: "file", value: contents });
  child.stdout.write(writerStdout);
  child.stderr.write(writerOutput);
  if (spawnError) child.emit("error", new Error("private-spawn-detail"));
}
function prepareBootstrap(launch: Launch, valid: boolean) {
  if (valid && launch.env.SLOPSTOP_PACKAGE_SMOKE_SCENARIO === "bootstrap") {
    bootstrap(launch.env.SLOPSTOP_PACKAGE_SMOKE_USER_DATA ?? "");
    return bootstrapStderr;
  }
  return "";
}
function completeLaunch(input: {
  launch: Launch;
  child: ReturnType<typeof makeChild>;
  valid: boolean;
  writer: boolean;
}) {
  const { launch, child, valid, writer } = input;
  const scenario = launch.env.SLOPSTOP_PACKAGE_SMOKE_SCENARIO;
  child.stderr.write(prepareBootstrap(launch, valid));
  if (writer) writeWriter(child, launch);
  else if (!valid) child.stderr.write("Package smoke authorization failed.\n");
  if (writer && !closeWriter) return;
  operations.push(`close:${scenario}`);
  finishChild({ child, code: writer ? writerCode : valid ? bootstrapCode : 1, writer });
}
function finishChild(input: {
  child: ReturnType<typeof makeChild>;
  code: number | null;
  writer: boolean;
}) {
  const { child, code, writer } = input;
  child.emit("exit", code);
  if (!writer || !missingEOF) {
    child.stdout.emit("end");
    child.stderr.emit("end");
  }
  child.emit("close", code);
}
function spawn(_executable: string, _args: string[], launch: Launch) {
  launches.push(launch);
  const child = makeChild();
  setTimeout(() => child.emit("spawn"), 0);
  const valid = authorized(launch.env);
  const writer = valid && launch.env.SLOPSTOP_PACKAGE_SMOKE_SCENARIO === "writer-proof";
  setTimeout(
    () => completeLaunch({ launch, child, valid, writer }),
    writer ? writerDelay : valid ? bootstrapDelay : 0,
  );
  return child;
}
beforeEach(() => {
  Object.defineProperty(process, "platform", { value: "win32" });
  Object.defineProperty(process, "arch", { value: "x64" });
  vi.resetAllMocks();
  vi.resetModules();
  vi.useFakeTimers();
  tree.clear();
  operations.length = 0;
  launches.length = 0;
  serial = 0;
  writerOutput = terminal + pass;
  writerStdout = "\r\n";
  writerCode = 0;
  writerDelay = 0;
  closeWriter = true;
  spawnError = false;
  killThrows = false;
  bootstrapStderr = "";
  bootstrapDelay = 0;
  bootstrapCode = 0;
  witnessMutation = (value) => JSON.stringify(value);
  beforeWriter = () => {};
  missingEOF = false;
  writerMutation = () => {};
  resourceMutation = () => {};
  previousExit = process.exitCode;
  process.exitCode = 0;
  stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  ports.spawn.mockImplementation(spawn);
  installFilesystem();
});
function installFilesystem() {
  ports.open.mockImplementation(openFixtureFile);
  installDirectoryPorts();
}
async function openFixtureFile(file: string, flags: "r" | "wx") {
  if (flags === "wx") {
    if (tree.has(file)) throw Object.assign(new Error("exists"), { code: "EEXIST" });
    put(file, { kind: "file", value: "" });
  }
  const entry = get(file);
  return {
    stat: async () => stat(entry),
    read: async (buffer: Buffer, offset: number, length: number, position: number) => {
      const bytes = Buffer.from(entry.value ?? "");
      return { buffer, bytesRead: bytes.copy(buffer, offset, position, position + length) };
    },
    writeFile: async (value: string) => {
      entry.value = value;
    },
    close: async () => {
      operations.push(`closed-file:${path.basename(file)}`);
    },
  };
}
function installDirectoryPorts() {
  ports.lstat.mockImplementation(async (file: string) => stat(get(file)));
  ports.realpath.mockImplementation(async (file: string) => file);
  ports.mkdir.mockImplementation(async (file: string) => put(file, { kind: "dir" }));
  ports.mkdtemp.mockImplementation(async (prefix: string) => {
    const file = `${prefix}${++serial}`;
    put(file, { kind: "dir" });
    return file;
  });
  ports.writeFile.mockImplementation(async (file: string, value: string) =>
    put(file, { kind: "file", value }),
  );
  ports.readFile.mockImplementation(async (file: string, encoding?: string) => {
    const value = get(file).value ?? "";
    return encoding ? value.toString() : Buffer.from(value);
  });
  ports.readdir.mockImplementation(async (file: string, options?: { withFileTypes: boolean }) =>
    [...tree]
      .filter(([key]) => path.dirname(key) === file)
      .map(([key, value]) =>
        options?.withFileTypes ? stat(value, path.basename(key)) : path.basename(key),
      ),
  );
  ports.rename.mockImplementation(async (from: string, to: string) => {
    operations.push("rename");
    if (operations.filter((op) => op === "rename").length === 1) resources(to);
    else {
      for (const [key, entry] of [...tree])
        if (key.startsWith(from + path.sep)) put(to + key.slice(from.length), entry);
      remove(from);
    }
  });
  ports.rm.mockImplementation(async (file: string) => {
    operations.push(`rm:${file}`);
    remove(file);
  });
  ports.unlink.mockImplementation(async (file: string) => {
    operations.push(`unlink:${path.basename(file)}`);
    remove(file);
  });
  ports.symlink.mockImplementation(async (_target: string, file: string) =>
    put(file, { kind: "link" }),
  );
}
it.each(["harness.cjs", "writer-proof-fixture.cjs", "shared.cjs"])(
  "rejects missing ASAR entry %s",
  async (name) => {
    resourceMutation = (root) => {
      const bytes = archive();
      const text = bytes.toString("utf8", 16, 16 + bytes.readUInt32LE(12));
      put(path.join(root, "app.asar"), {
        kind: "file",
        value: Buffer.from(
          bytes.toString("binary").replace(name, "x".repeat(name.length)),
          "binary",
        ),
      });
      expect(text).toContain(name);
    };
    await execute();
    expect(process.exitCode).toBe(1);
    expect(ports.spawn).not.toHaveBeenCalled();
  },
);
afterEach(() => {
  Object.defineProperty(process, "platform", { value: hostPlatform });
  Object.defineProperty(process, "arch", { value: hostArchitecture });
  vi.useRealTimers();
  vi.restoreAllMocks();
  process.exitCode = previousExit;
});

async function execute() {
  const entry = "../../tests/e2e/package-smoke.mjs";
  let completed = false;
  const pending = import(entry).then(() => {
    completed = true;
  });
  await vi.waitFor(() => expect(completed || ports.spawn.mock.calls.length > 0).toBe(true));
  await vi.runAllTimersAsync();
  await pending;
}
function retained() {
  expect(operations.filter((op) => op === "rename")).toHaveLength(1);
  const writer = [...launches]
    .reverse()
    .find((launch) => launch.env.SLOPSTOP_PACKAGE_SMOKE_SCENARIO === "writer-proof");
  expect(writer).toBeDefined();
  expect(operations).not.toContain(`rm:${writer?.env.SLOPSTOP_PACKAGE_SMOKE_USER_DATA}`);
  expect(operations).not.toContain("unlink:mastra.db");
}
it("requires exact Writer proof completion before cleanup", async () => {
  await execute();
  expect(launches.map((launch) => launch.env.SLOPSTOP_PACKAGE_SMOKE_SCENARIO)).toContain(
    "writer-proof",
  );
  expect(stdout).toHaveBeenCalledWith(summary);
  expect(process.exitCode).toBe(0);
  expect(operations.filter((op) => op === "rename")).toHaveLength(2);
  expect(operations.indexOf("close:writer-proof")).toBeLessThan(
    operations.indexOf("unlink:mastra.db"),
  );
});
it.each([
  ["missing", ""],
  ["terminal only", terminal],
  ["pass only", pass],
  ["truncated terminal", terminal.trimEnd() + pass],
  ["truncated pass", terminal + pass.trimEnd()],
  ["duplicate terminal", terminal + terminal + pass],
  ["duplicate pass", terminal + pass + pass],
  ["reversed", pass + terminal],
  ["unconfirmed terminal", unconfirmed + terminal + pass],
  ["failure and pass", terminal + failure + pass],
  ["unknown output", `${terminal + pass}noise\n`],
  ["overflow", terminal + pass + "x".repeat(4001)],
])("rejects %s completion and preserves unconfirmed ownership", async (_name, output) => {
  writerOutput = output;
  await execute();
  expect(process.exitCode).toBe(1);
  expect(stdout).not.toHaveBeenCalled();
  retained();
});
it("allows cleanup only for a closed valid nonzero terminal failure", async () => {
  writerOutput = terminal + failure;
  writerCode = 1;
  await execute();
  expect(process.exitCode).toBe(1);
  expect(stdout).not.toHaveBeenCalled();
  expect(operations.filter((op) => op === "rename")).toHaveLength(2);
  expect(operations).not.toContain("unlink:mastra.db");
});
it.each([0, null, 1])("never passes a terminal-free exit %s", async (code) => {
  writerOutput = "";
  writerCode = code;
  await execute();
  expect(process.exitCode).toBe(1);
  retained();
});
it.each([
  "",
  "\n",
  "\r",
  "\r\n\r\n",
  " \r\n",
  "\r\n ",
  " ",
  "private-data",
  "x".repeat(4001),
  "é".repeat(2001),
])("rejects stdout bytes %j", async (output) => {
  writerStdout = output;
  await execute();
  expect(process.exitCode).toBe(1);
  retained();
});
it("rejects a spawn error even with later valid completion", async () => {
  spawnError = true;
  await execute();
  expect(process.exitCode).toBe(1);
  retained();
  expect(JSON.stringify(stderr.mock.calls)).not.toContain("private-spawn-detail");
});
it.each([119999, 120000, 120001, 124999, 125000])(
  "enforces the Writer deadline at %sms",
  async (delay) => {
    writerDelay = delay;
    await execute();
    expect(process.exitCode).toBe(delay < 120000 ? 0 : 1);
    if (delay >= 120000) retained();
  },
);
it.each([false, true])(
  "withholds cleanup at terminal cap despite kill throw=%s",
  async (throws) => {
    closeWriter = false;
    killThrows = throws;
    await execute();
    expect(process.exitCode).toBe(1);
    retained();
    expect(operations).toContain("kill");
    expect(JSON.stringify(stderr.mock.calls)).not.toContain("private-kill-detail");
  },
);
it.each(["extra", "directory-lock", "symlink-lock", "second-generation", "changed-manifest"])(
  "rejects %s Storage witness before mutation",
  async (kind) => {
    writerMutation = (root) => {
      const base = path.join(root, "storage/projects", project);
      if (kind === "extra") put(path.join(base, "extra"), { kind: "file" });
      if (kind === "directory-lock") put(path.join(base, ".slopstop-writer.lock"), { kind: "dir" });
      if (kind === "symlink-lock") put(path.join(base, ".slopstop-writer.lock"), { kind: "link" });
      if (kind === "second-generation")
        put(path.join(base, "00000000-0000-4000-8000-000000000202"), { kind: "dir" });
      if (kind === "changed-manifest")
        put(path.join(base, generation, "manifest.json"), {
          kind: "file",
          value: '{"projectId":"wrong"}',
        });
    };
    await execute();
    expect(process.exitCode).toBe(1);
    expect(operations).not.toContain("unlink:mastra.db");
  },
);
it("runs the four stages on one root outside the workspace with child-only environment filtering", async () => {
  vi.stubEnv("NODE_PATH", "private-node-path");
  vi.stubEnv("NODE_OPTIONS", "private-node-options");
  try {
    await execute();
    const stages = launches.slice(-3);
    expect(stages.map((launch) => launch.env.SLOPSTOP_PACKAGE_SMOKE_SCENARIO)).toEqual([
      "writer-proof",
      "missing-runtime",
      "witnessed-staging",
    ]);
    expect(new Set(stages.map((launch) => launch.env.SLOPSTOP_PACKAGE_SMOKE_USER_DATA)).size).toBe(
      1,
    );
    for (const launch of launches) {
      expect(launch.env.NODE_PATH).toBeUndefined();
      expect(launch.env.NODE_OPTIONS).toBeUndefined();
      expect(launch.cwd).toContain("slopstop-packaged-app-");
    }
    expect(process.env["NODE_PATH"]).toBe("private-node-path");
    expect(process.env["NODE_OPTIONS"]).toBe("private-node-options");
  } finally {
    vi.unstubAllEnvs();
  }
});
it.each(["missing", "empty", "corrupt", "symlink", "directory", "other-target", "renamed"])(
  "rejects %s native binding at executable preflight",
  async (kind) => {
    resourceMutation = (root) => {
      const file = path.join(
        root,
        "app.asar.unpacked/.vite/build/node_modules/fs-native-extensions/prebuilds/win32-x64/fs-native-extensions.node",
      );
      if (["missing", "other-target", "renamed"].includes(kind)) remove(file);
      if (kind === "empty") put(file, { kind: "file", value: Buffer.alloc(0) });
      if (kind === "corrupt") put(file, { kind: "file", value: Buffer.from("wrong") });
      if (kind === "symlink") put(file, { kind: "link", value: native });
      if (kind === "directory") put(file, { kind: "dir" });
    };
    await execute();
    expect(process.exitCode).toBe(1);
    expect(ports.spawn).not.toHaveBeenCalled();
  },
);
it.each([
  { name: "ASCII boundary", value: "x".repeat(4000), exit: 0 },
  { name: "ASCII overflow", value: "x".repeat(4001), exit: 1 },
  { name: "UTF8 boundary", value: "é".repeat(2000), exit: 0 },
  { name: "UTF8 overflow", value: "é".repeat(2001), exit: 1 },
  { name: "binary boundary", value: Buffer.alloc(4000, 255), exit: 0 },
  { name: "binary overflow", value: Buffer.alloc(4001, 255), exit: 1 },
])("counts actual captured bytes at $name", async ({ value, exit }) => {
  bootstrapStderr = value;
  await execute();
  expect(process.exitCode).toBe(exit);
});
it.each([29999, 30000, 30001])("retains the old scenario deadline at %sms", async (delay) => {
  bootstrapDelay = delay;
  await execute();
  expect(process.exitCode).toBe(delay < 30000 ? 0 : 1);
});
it("never grants cleanup for a nonzero pass pair", async () => {
  writerCode = 1;
  await execute();
  expect(process.exitCode).toBe(1);
  retained();
});
it("never reflects raw child stages in fixed CI failure output", async () => {
  vi.stubEnv("CI", "true");
  bootstrapCode = 1;
  bootstrapStderr = "Package smoke proof failed at private-child-detail.\n";
  try {
    await execute();
    expect(process.exitCode).toBe(1);
    expect(JSON.stringify(stderr.mock.calls)).not.toContain("private-child-detail");
  } finally {
    vi.unstubAllEnvs();
  }
});
it("binds native CRLF to this packaged main invocation", async () => {
  await execute();
  expect(process.exitCode).toBe(0);
  expect(
    ports.open.mock.calls.some(
      ([file, flags]) => String(file).endsWith(challengeName) && flags === "wx",
    ),
  ).toBe(true);
  expect(stdout).toHaveBeenCalledWith(summary);
});
it.each([
  ["nonce", "b".repeat(64)],
  ["mainPid", 1],
  ["mainPid", 0],
  ["mainPid", 1.5],
  ["mainPid", Number.MAX_SAFE_INTEGER + 1],
  ["platform", "linux"],
  ["arch", "arm64"],
  ["electronVersion", "43.4.1"],
  ["electronVersion", ""],
  ["executableSha256", "f".repeat(64)],
  ["version", "1"],
  ["nonce", 1],
  ["executableSha256", null],
  ["extra", "private"],
])("refuses runtime identity spoofing: %s=%j", async (field, value) => {
  witnessMutation = (record) => JSON.stringify({ ...record, [String(field)]: value });
  await execute();
  expect(process.exitCode).toBe(1);
  retained();
});
it.each(["version", "nonce", "mainPid", "platform", "arch", "electronVersion", "executableSha256"])(
  "refuses missing witness %s",
  async (field) => {
    witnessMutation = (record) => {
      delete record[field];
      return JSON.stringify(record);
    };
    await execute();
    expect(process.exitCode).toBe(1);
    retained();
  },
);
it.each(["absent", "truncated", "duplicate", "escaped-duplicate", "utf8", "513", "512"])(
  "requires exact bounded local evidence: %s",
  async (fault) => {
    witnessMutation = (record) => {
      const text = JSON.stringify(record);
      if (fault === "absent") return undefined;
      if (fault === "truncated") return text.slice(0, -1);
      if (fault === "duplicate") return text.replace('"version":1', '"version":1,"version":1');
      if (fault === "escaped-duplicate")
        return text.replace('"version":1', '"version":1,"vers\\u0069on":1');
      if (fault === "utf8") return Buffer.concat([Buffer.from(text), Buffer.from([255])]);
      return text.padEnd(Number(fault), " ");
    };
    await execute();
    expect(process.exitCode).toBe(fault === "512" ? 0 : 1);
    if (fault !== "512") retained();
  },
);
it.each([challengeName, witnessName])("refuses pre-existing evidence: %s", async (name) => {
  beforeWriter = (root) => put(path.join(root, name), { kind: "file", value: "{}" });
  await execute();
  expect(process.exitCode).toBe(1);
  expect(operations.filter((op) => op === "rename")).toHaveLength(1);
});
it.each(["directory", "symlink", "changed-exe", "symlink-exe"])(
  "refuses runtime file or executable drift: %s",
  async (fault) => {
    writerMutation = (root) => {
      const launch = launches[launches.length - 1];
      if (!launch) throw new Error("No launch");
      if (fault.endsWith("exe"))
        put(path.join(launch.cwd, "SlopStop.exe"), {
          kind: fault === "symlink-exe" ? "link" : "file",
          value: "changed",
        });
      else put(path.join(root, witnessName), { kind: fault === "symlink" ? "link" : "dir" });
    };
    if (!fault.endsWith("exe")) witnessMutation = () => undefined;
    await execute();
    expect(process.exitCode).toBe(1);
    retained();
  },
);
it("requires independent stream EOF despite close and a valid runtime witness", async () => {
  missingEOF = true;
  await execute();
  expect(process.exitCode).toBe(1);
  retained();
});
it.each(["", "\r\n"])("keeps non-Windows stdout empty with bound runtime: %j", async (output) => {
  Object.defineProperty(process, "platform", { value: "linux" });
  writerStdout = output;
  resourceMutation = (root) => {
    const base = path.join(root, "app.asar.unpacked/.vite/build/node_modules/@libsql");
    for (const target of ["linux-x64-gnu", "linux-x64-musl"]) {
      put(path.join(base, target), { kind: "dir" });
      put(path.join(base, target, "index.node"), { kind: "file" });
    }
    const koffi = path.join(
      root,
      "app.asar.unpacked/.vite/build/node_modules/@koromix/koffi-linux-x64",
    );
    put(koffi, { kind: "dir" });
    put(path.join(koffi, "linux_x64"), { kind: "dir" });
    put(path.join(koffi, "linux_x64/koffi.node"), { kind: "file" });
    const installed = path.dirname(
      createRequire(path.resolve("apps/harness/package.json")).resolve("fs-native-extensions"),
    );
    put(
      path.join(
        root,
        "app.asar.unpacked/.vite/build/node_modules/fs-native-extensions/prebuilds/linux-x64/fs-native-extensions.node",
      ),
      {
        kind: "file",
        value: readFileSync(path.join(installed, "prebuilds/linux-x64/fs-native-extensions.node")),
      },
    );
  };
  await execute();
  expect(process.exitCode).toBe(output === "" ? 0 : 1);
});
