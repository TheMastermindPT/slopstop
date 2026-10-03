import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createRuntimeChallenge,
  verifyRuntimeWitness,
} from "../../src/main/package-smoke-runtime.ts";

const smokeTimeoutMs = 30_000;
const writerTimeoutMs = 120_000;
const terminalCloseTimeoutMs = 5_000;
const maxOutputBytes = 4_000;
const markerFilename = ".slopstop-package-smoke.json";
const authorizationFailureOutput = "Package smoke authorization failed.\n";
const writerTerminalOutput = "Package smoke writer processes terminal.\n";
const writerPassOutput = "Package smoke writer proof passed.\n";
const writerFailureStages = new Set([
  "native-preflight",
  "spawn",
  "handshake",
  "transport",
  "unexpected-message",
  "inactive",
  "activate",
  "first-settlement",
  "contention",
  "read-only",
  "hard-kill",
  "takeover",
  "replay",
  "stale-activation",
  "next-settlement",
  "audit",
  "stale-initialize",
  "stale-release",
  "stale-attempt",
  "stale-finish",
  "clean-stop",
  "process-exit",
  "stdio-drain",
  "output-bound",
  "cancelled",
  "proof-deadline",
  "cleanup",
  "internal",
]);
const invalidRelativeSmokeRoot = "relative-smoke-root";
const healthyProjectId = "00000000-0000-4000-8000-000000000101";
const witnessProjectId = "00000000-0000-4000-8000-000000000103";
const witnessGenerationId = "00000000-0000-4000-8000-000000000113";
const generationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
let cleanupSafe = true;
let activePackageOutput;
let activeSmokeStage = "package preflight";

function packagedArchitecture() {
  return process.arch === "arm" ? "armv7l" : process.arch;
}

function packagedOutputDirectory() {
  activePackageOutput ??= path.resolve(
    "out",
    `SlopStop-${process.platform}-${packagedArchitecture()}`,
  );
  return activePackageOutput;
}

function targetBindingPrefixes() {
  const target = `${process.platform}-${process.arch}`;
  switch (target) {
    case "linux-arm":
      return ["linux-arm-gnueabihf", "linux-arm-musleabihf"];
    case "linux-arm64":
      return ["linux-arm64-gnu", "linux-arm64-musl"];
    case "linux-x64":
      return ["linux-x64-gnu", "linux-x64-musl"];
    default:
      return [target];
  }
}

function packagedExecutable() {
  const output = packagedOutputDirectory();
  if (process.platform === "win32") {
    return path.join(output, "SlopStop.exe");
  }
  if (process.platform === "darwin") {
    return path.join(output, "SlopStop.app", "Contents", "MacOS", "SlopStop");
  }
  return path.join(output, "SlopStop");
}

function packagedResourcesDirectory() {
  const output = packagedOutputDirectory();
  return process.platform === "darwin"
    ? path.join(output, "SlopStop.app", "Contents", "Resources")
    : path.join(output, "resources");
}

async function collectNodeBindings(directory) {
  const bindings = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      bindings.push(...(await collectNodeBindings(candidate)));
    } else if (entry.isFile() && entry.name.endsWith(".node")) {
      bindings.push(candidate);
    }
  }
  return bindings;
}

async function assertPackagedMigrations(resources) {
  const migrations = path.join(resources, "harness-migrations");
  for (const kind of ["application", "canonical", "runtime"]) {
    const kindRoot = path.join(migrations, kind);
    const entries = await readdir(kindRoot);
    if (!entries.some((entry) => entry.endsWith(".sql"))) {
      throw new Error("Packaged SlopStop is missing generated migration SQL.");
    }
    const journal = JSON.parse(
      await readFile(path.join(kindRoot, "meta", "_journal.json"), "utf8"),
    );
    if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
      throw new Error("Packaged SlopStop has an invalid migration journal.");
    }
  }
}

async function assertPackagedNativeBindings(resources) {
  const nativeRoot = path.join(resources, "app.asar.unpacked");
  const bindings = await collectNodeBindings(nativeRoot);
  for (const targetPrefix of targetBindingPrefixes()) {
    const found = bindings.some((binding) => {
      const packagedPath = path.relative(nativeRoot, binding).split(path.sep).join("/");
      return packagedPath.startsWith(`.vite/build/node_modules/@libsql/${targetPrefix}`);
    });
    if (!found) {
      throw new Error("Packaged SlopStop is missing the target libSQL native binding.");
    }
  }
  const koffiPrefix = `.vite/build/node_modules/@koromix/koffi-${process.platform}-${process.arch}/`;
  const koffiFound = bindings.some((binding) => {
    const packagedPath = path.relative(nativeRoot, binding).split(path.sep).join("/");
    return packagedPath.startsWith(koffiPrefix) && packagedPath.endsWith("/koffi.node");
  });
  if (!koffiFound) {
    throw new Error("Packaged SlopStop is missing the target Koffi native binding.");
  }
}

async function assertPackagedStorageResources() {
  const resources = packagedResourcesDirectory();
  await assertPackagedMigrations(resources);
  await assertPackagedNativeBindings(resources);
  await assertWriterResources(resources);
}

// Published v1.5.1 pins, retained from the approved native-origin contract.
const writerNativeHashes = {
  "win32-x64": "dd3f8eb1d53441f151551c84a1211c79524b1eab74ff83ab93e68037f3997ba4",
  "linux-x64": "13657db7ce92f823ee8066cc7244f3a475340707fc065fd4f5aceeebbfa898c3",
  "linux-arm64": "895dd0dca09438454f28bba250bcafa3e69c937fe97ea46b1b6212dc3a81315c",
  "darwin-x64": "973e4b2addf30901b955c75626ac153d3a37cebcfa621375bcd490f199884c8e",
  "darwin-arm64": "1e93b74e556b7d1767d57fabb197d9d1df5641453967170537278f72ed46f018",
};

function requireResource(condition) {
  if (!condition) throw new Error("Packaged SlopStop Writer resources are invalid.");
}

function archiveFile(bytes, headerSize, entry) {
  requireResource(
    entry && !entry.link && !entry.unpacked && Number.isSafeInteger(entry.size) && entry.size > 0,
  );
  const offset = Number(entry.offset);
  requireResource(Number.isSafeInteger(offset) && offset >= 0);
  const start = 8 + headerSize + offset;
  requireResource(start + entry.size <= bytes.length);
  return bytes.subarray(start, start + entry.size);
}

async function assertWriterArchive(resources) {
  const bytes = await readFile(path.join(resources, "app.asar"));
  const headerSize = bytes.readUInt32LE(4);
  const jsonSize = bytes.readUInt32LE(12);
  requireResource(jsonSize > 0 && jsonSize <= headerSize - 8);
  const header = JSON.parse(bytes.toString("utf8", 16, 16 + jsonSize));
  const files = header.files[".vite"].files.build.files;
  requireResource(files);
  archiveFile(bytes, headerSize, files["harness.cjs"]);
  archiveFile(bytes, headerSize, files["writer-proof-fixture.cjs"]);
  const chunks = Object.keys(files).filter((name) => name.endsWith(".cjs"));
  requireResource(
    chunks.some((name) => !["harness.cjs", "writer-proof-fixture.cjs", "main.cjs"].includes(name)),
  );
  for (const name of chunks) {
    const source = archiveFile(bytes, headerSize, files[name]).toString("utf8");
    for (const match of source.matchAll(/(?:require|import)\(["']\.\/([^"']+\.cjs)["']\)/gu)) {
      archiveFile(bytes, headerSize, files[match[1]]);
    }
  }
  const packageEntry = files.node_modules.files["fs-native-extensions"].files["package.json"];
  const manifest = JSON.parse(archiveFile(bytes, headerSize, packageEntry).toString("utf8"));
  requireResource(manifest.name === "fs-native-extensions" && manifest.version === "1.5.1");
}

async function assertWriterResources(resources) {
  const target = `${process.platform}-${process.arch}`;
  const binding = path.join(
    resources,
    "app.asar.unpacked/.vite/build/node_modules/fs-native-extensions/prebuilds",
    target,
    "fs-native-extensions.node",
  );
  const entry = await lstat(binding);
  requireResource(entry.isFile() && !entry.isSymbolicLink() && entry.size > 0);
  requireResource((await realpath(binding)) === binding);
  const bytes = await readFile(binding);
  requireResource(createHash("sha256").update(bytes).digest("hex") === writerNativeHashes[target]);
  await assertWriterArchive(resources);
}

async function isolatePackagedOutput() {
  const originalOutput = packagedOutputDirectory();
  const workspaceRoot = path.resolve(import.meta.dirname, "../../../..");
  const isolationRoot = await mkdtemp(
    path.join(path.dirname(workspaceRoot), "slopstop-packaged-app-"),
  );
  const isolatedOutput = path.join(isolationRoot, path.basename(originalOutput));
  await rename(originalOutput, isolatedOutput);
  activePackageOutput = isolatedOutput;

  return async () => {
    if (!cleanupSafe) {
      return;
    }
    activePackageOutput = originalOutput;
    await rename(isolatedOutput, originalOutput);
    await rm(isolationRoot, { recursive: true, force: true });
  };
}

function boundedOutput() {
  let bytes = Buffer.alloc(0);
  let overflow = false;
  return {
    append(chunk) {
      const input = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      overflow ||= bytes.length + input.length > maxOutputBytes;
      bytes = Buffer.concat([bytes, input.subarray(0, maxOutputBytes - bytes.length)]);
    },
    get text() {
      return bytes.toString("utf8");
    },
    get overflow() {
      return overflow;
    },
  };
}

async function launchPackagedApp({ root, token, scenario }) {
  return new Promise((resolve) => {
    const duration = scenario === "writer-proof" ? writerTimeoutMs : smokeTimeoutMs;
    const deadline = performance.now() + duration;
    const executable = packagedExecutable();
    const env = {
      ...process.env,
      SLOPSTOP_PACKAGE_SMOKE: "1",
    };
    if (process.env["CI"] === "true") {
      env.SLOPSTOP_PACKAGE_SMOKE_DIAGNOSTICS = "1";
    } else {
      delete env.SLOPSTOP_PACKAGE_SMOKE_DIAGNOSTICS;
    }
    delete env.NODE_OPTIONS;
    delete env.NODE_PATH;
    for (const [key, value] of [
      ["SLOPSTOP_PACKAGE_SMOKE_SCENARIO", scenario],
      ["SLOPSTOP_PACKAGE_SMOKE_TOKEN", token],
      ["SLOPSTOP_PACKAGE_SMOKE_USER_DATA", root],
    ]) {
      if (value === undefined) {
        delete env[key];
      } else {
        env[key] = value;
      }
    }
    const child = spawn(executable, [], {
      cwd: path.dirname(executable),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let pid;
    let exitCode;
    let exited = false;
    let stdoutEnded = false;
    let stderrEnded = false;
    child.once("spawn", () => {
      pid = child.pid;
    });
    child.once("exit", (code) => {
      exited = true;
      exitCode = code;
    });
    child.stdout.once("end", () => {
      stdoutEnded = true;
    });
    child.stderr.once("end", () => {
      stderrEnded = true;
    });
    const standardOutput = boundedOutput();
    const errorOutput = boundedOutput();
    let spawnFailed = false;
    let timedOut = false;
    let settled = false;
    const settle = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      clearTimeout(terminalTimeout);
      resolve(result);
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      cleanupSafe = false;
      try {
        child.kill("SIGKILL");
      } catch {
        // Main termination is best effort, never descendant terminal proof.
      }
    }, duration);
    const terminalTimeout = setTimeout(() => {
      cleanupSafe = false;
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      settle({
        code: null,
        closed: false,
        spawnFailed,
        stderr: errorOutput.text,
        stderrOverflow: errorOutput.overflow,
        stdout: standardOutput.text,
        stdoutOverflow: standardOutput.overflow,
        timedOut: true,
        pid,
        exited,
        stdoutEnded,
        stderrEnded,
      });
    }, duration + terminalCloseTimeoutMs);
    child.stdout.on("data", standardOutput.append);
    child.stderr.on("data", errorOutput.append);
    child.once("error", () => {
      spawnFailed = true;
    });
    for (const stream of [child.stdout, child.stderr]) {
      stream.once("error", () => {
        spawnFailed = true;
      });
    }
    child.once("close", (code) => {
      if (performance.now() >= deadline) {
        timedOut = true;
        cleanupSafe = false;
      }
      settle({
        code,
        closed: true,
        spawnFailed,
        stderr: errorOutput.text,
        stderrOverflow: errorOutput.overflow,
        stdout: standardOutput.text,
        stdoutOverflow: standardOutput.overflow,
        timedOut,
        pid,
        exited: exited && exitCode === code,
        stdoutEnded,
        stderrEnded,
      });
    });
  });
}

function cleanWriterTransport(launch) {
  return [
    launch.closed,
    !launch.spawnFailed,
    !launch.timedOut,
    !launch.stderrOverflow,
    !launch.stdoutOverflow,
    launch.exited,
    launch.stdoutEnded,
    launch.stderrEnded,
  ].every(Boolean);
}

function validWriterFailure(launch) {
  const failedStage =
    /^Package smoke writer processes terminal\.\nPackage smoke proof failed at writer-([a-z-]+)\.\n$/u.exec(
      launch.stderr,
    )?.[1];
  return Number.isInteger(launch.code) && launch.code !== 0 && writerFailureStages.has(failedStage);
}

function writerCompletion(launch, runtime) {
  const cleanTransport = cleanWriterTransport(launch) && matchesRuntimeStdout(launch, runtime);
  const passed =
    cleanTransport &&
    launch.code === 0 &&
    launch.stderr === writerTerminalOutput + writerPassOutput;
  const failedTerminal = cleanTransport && validWriterFailure(launch);
  cleanupSafe &&= passed || failedTerminal;
  if (!passed) throw new Error("Packaged SlopStop Writer completion failed.");
}
function matchesRuntimeStdout(launch, runtime) {
  return launch.stdout === (runtime.platform === "win32" ? "\r\n" : "");
}
async function launchWithRuntime(root, token, scenario) {
  if (scenario !== "writer-proof")
    return { launch: await launchPackagedApp({ root, token, scenario }) };
  const binding = await createRuntimeChallenge({ root, executable: packagedExecutable() });
  const launch = await launchPackagedApp({ root, token, scenario });
  if (!cleanWriterTransport(launch)) throw new Error("Writer transport failed.");
  return { launch, runtime: await verifyRuntimeWitness(binding, launch.pid) };
}

async function launchScenario(root, token, scenario) {
  let launch;
  let runtime;
  try {
    ({ launch, runtime } = await launchWithRuntime(root, token, scenario));
  } catch {
    if (scenario === "writer-proof") cleanupSafe = false;
    activeSmokeStage = `${scenario} scenario launch rejected`;
    throw new Error(`Packaged SlopStop ${scenario} scenario launch rejected.`);
  }
  if (scenario === "writer-proof") {
    writerCompletion(launch, runtime);
    return;
  }
  const startupFailed = launch.stderr.includes("SlopStop failed to start.\n");
  const capturedOutput = `${launch.stdout}\n${launch.stderr}`;
  const exposedPrivateInput = [root, token].some((value) => capturedOutput.includes(value));
  const failedCheck = [
    [!launch.closed, "did not close"],
    [launch.spawnFailed, "failed to launch"],
    [launch.timedOut, "timed out"],
    [launch.stderrOverflow, "stderr exceeded its bound"],
    [launch.stdoutOverflow, "stdout exceeded its bound"],
    [exposedPrivateInput, "exposed private smoke input"],
    [launch.stdout.trim() !== "", "emitted stdout"],
    [launch.code !== 0, "exited nonzero"],
  ].find(([failed]) => failed);
  if (failedCheck !== undefined) {
    const failure = startupFailed ? "startup failed" : failedCheck[1];
    activeSmokeStage = `${scenario} scenario ${failure}`;
    throw new Error(`Packaged SlopStop ${scenario} scenario ${failedCheck[1]}.`);
  }
}

function errorCode(error) {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  try {
    const code = Reflect.get(error, "code");
    return typeof code === "string" ? code : undefined;
  } catch {
    return undefined;
  }
}

async function pathExists(candidate) {
  try {
    await lstat(candidate);
    return true;
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function createAuthorizedSmokeRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-package-smoke-"));
  const token = randomBytes(32).toString("hex");
  await writeFile(path.join(root, markerFilename), JSON.stringify({ version: 1, token }), {
    flag: "wx",
  });
  return { root, token };
}

const invalidAuthorizationCases = [
  {
    name: "invalid scenario",
    launch: ({ root, token }) => ({ root, token, scenario: "invalid" }),
  },
  {
    name: "missing scenario",
    launch: ({ root, token }) => ({ root, token, scenario: undefined }),
  },
  {
    name: "missing root",
    launch: ({ token }) => ({ root: undefined, token, scenario: "bootstrap" }),
  },
  {
    name: "missing token",
    launch: ({ root }) => ({ root, token: undefined, scenario: "bootstrap" }),
  },
  {
    name: "malformed token",
    launch: ({ root }) => ({ root, token: "not-a-token", scenario: "bootstrap" }),
  },
  {
    name: "malformed marker JSON",
    prepare: async ({ root }) => writeFile(path.join(root, markerFilename), "{not-json"),
  },
  {
    name: "wrong marker version",
    prepare: async ({ root, token }) =>
      writeFile(path.join(root, markerFilename), JSON.stringify({ version: 2, token })),
  },
  {
    name: "extra marker field",
    prepare: async ({ root, token }) =>
      writeFile(
        path.join(root, markerFilename),
        JSON.stringify({ version: 1, token, extra: true }),
      ),
  },
  {
    name: "token mismatch",
    launch: ({ root, token }) => ({
      root,
      token: `${token[0] === "0" ? "1" : "0"}${token.slice(1)}`,
      scenario: "bootstrap",
    }),
  },
  {
    name: "missing marker",
    prepare: async ({ root }) => unlink(path.join(root, markerFilename)),
  },
  {
    name: "relative root",
    launch: ({ token }) => ({
      root: invalidRelativeSmokeRoot,
      token,
      scenario: "bootstrap",
    }),
  },
  {
    name: "non-marker-only bootstrap root",
    prepare: async ({ root }) => {
      await writeFile(path.join(root, "unexpected"), "witness", { flag: "wx" });
    },
  },
  {
    name: "non-directory root",
    prepare: async ({ root }) => {
      await writeFile(path.join(root, "not-a-directory"), "witness", { flag: "wx" });
    },
    launch: ({ root, token }) => ({
      root: path.join(root, "not-a-directory"),
      token,
      scenario: "bootstrap",
    }),
  },
  {
    name: "non-regular marker",
    prepare: async ({ root }) => {
      const markerPath = path.join(root, markerFilename);
      await unlink(markerPath);
      await mkdir(markerPath);
    },
  },
];

async function runInvalidAuthorizationCase(testCase, scenario = "bootstrap") {
  activeSmokeStage = `invalid authorization: ${testCase.name}`;
  const fixture = await createAuthorizedSmokeRoot();
  try {
    await testCase.prepare?.(fixture);
    const beforeEntries = [...(await readdir(fixture.root))].sort();
    const input = testCase.launch?.(fixture) ?? {
      root: fixture.root,
      token: fixture.token,
      scenario: "bootstrap",
    };
    if (input.scenario === "bootstrap") input.scenario = scenario;
    const launch = await launchPackagedApp(input);
    const secrets = [fixture.root, fixture.token, input.root, input.token].filter(
      (value) => typeof value === "string",
    );

    await assertRejectedAuthorizationLaunch({
      launch,
      protectedRoot: fixture.root,
      beforeEntries,
      secretOutput: `${launch.stderr}${launch.stdout}`,
      secrets,
      failureMessage: `Invalid package-smoke authorization case failed: ${testCase.name}.`,
    });
  } finally {
    if (cleanupSafe) {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
}

async function assertRejectedAuthorizationLaunch({
  launch,
  protectedRoot,
  beforeEntries,
  secretOutput,
  secrets,
  failureMessage,
}) {
  const storageExists = await pathExists(path.join(protectedRoot, "storage"));
  const afterEntries = [...(await readdir(protectedRoot))].sort();
  const rejectedLaunchFailed = [
    !launch.closed,
    launch.spawnFailed,
    launch.stderrOverflow,
    launch.stdoutOverflow,
    launch.timedOut,
    typeof launch.code !== "number",
    launch.code === 0,
    launch.stderr !== authorizationFailureOutput,
    launch.stdout.trim() !== "",
    secrets.some((secret) => secretOutput.includes(secret)),
    storageExists,
    JSON.stringify(afterEntries) !== JSON.stringify(beforeEntries),
  ].includes(true);
  if (rejectedLaunchFailed) {
    throw new Error(failureMessage);
  }
}

async function runSymlinkAuthorizationCaseIfSupported(scenario = "bootstrap") {
  activeSmokeStage = "invalid authorization: symlink marker";
  const fixture = await createAuthorizedSmokeRoot();
  const externalTargetRoot = await mkdtemp(
    path.join(os.tmpdir(), "slopstop-package-smoke-marker-target-"),
  );
  try {
    const markerPath = path.join(fixture.root, markerFilename);
    const targetPath = path.join(externalTargetRoot, "marker-target.json");
    await unlink(markerPath);
    await writeFile(targetPath, JSON.stringify({ version: 1, token: fixture.token }), {
      flag: "wx",
    });
    try {
      await symlink(targetPath, markerPath, "file");
    } catch (error) {
      if (["EACCES", "EPERM", "ENOSYS"].includes(errorCode(error))) {
        return;
      }
      throw error;
    }
    const beforeEntries = [...(await readdir(fixture.root))].sort();
    const launch = await launchPackagedApp({
      root: fixture.root,
      token: fixture.token,
      scenario,
    });
    await assertRejectedAuthorizationLaunch({
      launch,
      protectedRoot: fixture.root,
      beforeEntries,
      secretOutput: `${launch.stderr}${launch.stdout}`,
      secrets: [fixture.root, fixture.token],
      failureMessage: "Invalid package-smoke authorization case failed: symlink marker.",
    });
  } finally {
    if (cleanupSafe) {
      await rm(fixture.root, { recursive: true, force: true });
      await rm(externalTargetRoot, { recursive: true, force: true });
    }
  }
}

async function runRootSymlinkAuthorizationCaseIfSupported(scenario = "bootstrap") {
  activeSmokeStage = "invalid authorization: symlink root";
  const fixture = await createAuthorizedSmokeRoot();
  const linkParent = await mkdtemp(path.join(os.tmpdir(), "slopstop-package-smoke-root-link-"));
  const linkedRoot = path.join(linkParent, "authorized-root");
  try {
    try {
      await symlink(fixture.root, linkedRoot, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EACCES", "EPERM", "ENOSYS"].includes(errorCode(error))) {
        return;
      }
      throw error;
    }
    const beforeEntries = [...(await readdir(fixture.root))].sort();
    const launch = await launchPackagedApp({
      root: linkedRoot,
      token: fixture.token,
      scenario,
    });
    await assertRejectedAuthorizationLaunch({
      launch,
      protectedRoot: fixture.root,
      beforeEntries,
      secretOutput: launch.stderr,
      secrets: [fixture.root, linkedRoot, fixture.token],
      failureMessage: "Invalid package-smoke authorization case failed: symlink root.",
    });
  } finally {
    if (cleanupSafe) {
      await rm(linkParent, { recursive: true, force: true });
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
}

async function runInvalidAuthorizationMatrix() {
  for (const testCase of invalidAuthorizationCases) {
    await runInvalidAuthorizationCase(testCase);
  }
  await runSymlinkAuthorizationCaseIfSupported();
  await runRootSymlinkAuthorizationCaseIfSupported();
  for (const testCase of invalidAuthorizationCases) {
    if (testCase.name !== "non-marker-only bootstrap root") {
      await runInvalidAuthorizationCase(testCase, "writer-proof");
    }
  }
  await runSymlinkAuthorizationCaseIfSupported("writer-proof");
  await runRootSymlinkAuthorizationCaseIfSupported("writer-proof");
}

function isPlainGenerationEntry(entries, writerCompleted) {
  const generations = entries.filter((entry) => generationIdPattern.test(entry.name));
  const expectedCount = writerCompleted ? 2 : 1;
  if (entries.length !== expectedCount || generations.length !== 1) return false;
  if (writerCompleted) {
    const lock = entries.find((entry) => entry.name === ".slopstop-writer.lock");
    if (!isPlainFile(lock)) return false;
  }
  const entry = generations[0];
  if (!entry.isDirectory()) return false;
  if (entry.isSymbolicLink()) return false;
  return generationIdPattern.test(entry.name);
}

function isPlainFile(entry) {
  return entry?.isFile() && !entry.isSymbolicLink();
}

function generationManifestAgrees(manifest, generationId) {
  if (typeof manifest !== "object") return false;
  if (manifest === null) return false;
  if (Array.isArray(manifest)) return false;
  if (manifest.projectId !== healthyProjectId) return false;
  return manifest.generationId === generationId;
}

async function inspectHealthyGeneration(root, writerCompleted = false) {
  const projectRoot = path.join(root, "storage", "projects", healthyProjectId);
  const entries = await readdir(projectRoot, { withFileTypes: true });
  if (!isPlainGenerationEntry(entries, writerCompleted)) {
    throw new Error("Packaged SlopStop did not create one plain active generation.");
  }
  const entry = entries.find((entry) => generationIdPattern.test(entry.name));
  const generationRoot = path.join(projectRoot, entry.name);
  const generationEntry = await lstat(generationRoot);
  if (!generationEntry.isDirectory() || generationEntry.isSymbolicLink()) {
    throw new Error("Packaged SlopStop generation is not a plain directory.");
  }
  const manifest = JSON.parse(await readFile(path.join(generationRoot, "manifest.json"), "utf8"));
  if (!generationManifestAgrees(manifest, entry.name)) {
    throw new Error("Packaged SlopStop generation manifest does not agree.");
  }
  return generationRoot;
}

async function removeClosedRuntimeDatabase(generationRoot) {
  const runtimeDatabase = path.join(generationRoot, "mastra.db");
  const runtimeEntry = await lstat(runtimeDatabase);
  if (!runtimeEntry.isFile() || runtimeEntry.isSymbolicLink()) {
    throw new Error("Packaged SlopStop runtime database is not a plain file.");
  }
  await unlink(runtimeDatabase);
}

async function createStagingWitness(root) {
  const witnessProjectRoot = path.join(root, "storage", "projects", witnessProjectId);
  const stagingRoot = path.join(witnessProjectRoot, `.staging-${witnessGenerationId}`);
  await mkdir(witnessProjectRoot);
  await mkdir(stagingRoot);
  await writeFile(path.join(stagingRoot, "mastra.db-wal"), "", { flag: "wx" });
}

async function assertApplicationDatabase(root) {
  const applicationDatabase = await lstat(path.join(root, "storage", "application.db"));
  if (!applicationDatabase.isFile() || applicationDatabase.isSymbolicLink()) {
    throw new Error("Packaged SlopStop did not use isolated application storage.");
  }
}

async function runPackageSmoke() {
  activeSmokeStage = "package isolation";
  const restorePackagedOutput = await isolatePackagedOutput();
  try {
    activeSmokeStage = "package resource preflight";
    await assertPackagedStorageResources();
    await runInvalidAuthorizationMatrix();
    activeSmokeStage = "authorized root creation";
    const { root, token } = await createAuthorizedSmokeRoot();

    try {
      activeSmokeStage = "bootstrap scenario";
      await launchScenario(root, token, "bootstrap");
      const generationRoot = await inspectHealthyGeneration(root);
      const originalManifest = await readFile(path.join(generationRoot, "manifest.json"), "utf8");
      activeSmokeStage = "writer-proof scenario";
      await launchScenario(root, token, "writer-proof");
      const afterWriter = await inspectHealthyGeneration(root, true);
      if (
        afterWriter !== generationRoot ||
        (await readFile(path.join(afterWriter, "manifest.json"), "utf8")) !== originalManifest
      ) {
        throw new Error("Packaged SlopStop Writer changed Storage identity.");
      }
      await removeClosedRuntimeDatabase(generationRoot);
      activeSmokeStage = "missing-runtime scenario";
      await launchScenario(root, token, "missing-runtime");
      await createStagingWitness(root);
      activeSmokeStage = "witnessed-staging scenario";
      await launchScenario(root, token, "witnessed-staging");
      activeSmokeStage = "application database audit";
      await assertApplicationDatabase(root);
    } finally {
      if (cleanupSafe) {
        await rm(root, { recursive: true, force: true });
      }
    }
  } finally {
    await restorePackagedOutput();
  }
}

try {
  await runPackageSmoke();
  process.stdout.write(
    "Packaged SlopStop validated renderer isolation, Project Storage, and Writer proof.\n",
  );
} catch {
  const message =
    process.env["CI"] === "true"
      ? `Packaged SlopStop smoke failed at ${activeSmokeStage}.\n`
      : "Packaged SlopStop smoke failed.\n";
  process.stderr.write(message);
  process.exitCode = 1;
}
