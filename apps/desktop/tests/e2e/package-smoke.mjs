import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const smokeTimeoutMs = 30_000;
const terminalCloseTimeoutMs = 5_000;
const maxStderrCharacters = 4_000;
const markerFilename = ".slopstop-package-smoke.json";
const authorizationFailureOutput = "Package smoke authorization failed.\n";
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
}

async function assertPackagedStorageResources() {
  const resources = packagedResourcesDirectory();
  await assertPackagedMigrations(resources);
  await assertPackagedNativeBindings(resources);
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

async function launchPackagedApp({ root, token, scenario }) {
  return new Promise((resolve) => {
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
    let standardOutput = "";
    let stdoutOverflow = false;
    let errorOutput = "";
    let stderrOverflow = false;
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
      child.kill("SIGKILL");
    }, smokeTimeoutMs);
    const terminalTimeout = setTimeout(() => {
      cleanupSafe = false;
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      settle({
        code: null,
        closed: false,
        spawnFailed,
        stderr: errorOutput,
        stderrOverflow,
        stdout: standardOutput,
        stdoutOverflow,
        timedOut: true,
      });
    }, smokeTimeoutMs + terminalCloseTimeoutMs);
    child.stdout.on("data", (chunk) => {
      const combined = `${standardOutput}${String(chunk)}`;
      stdoutOverflow ||= combined.length > maxStderrCharacters;
      standardOutput = combined.slice(0, maxStderrCharacters);
    });
    child.stderr.on("data", (chunk) => {
      const combined = `${errorOutput}${String(chunk)}`;
      stderrOverflow ||= combined.length > maxStderrCharacters;
      errorOutput = combined.slice(0, maxStderrCharacters);
    });
    child.once("error", () => {
      spawnFailed = true;
    });
    child.once("close", (code) => {
      settle({
        code,
        closed: true,
        spawnFailed,
        stderr: errorOutput,
        stderrOverflow,
        stdout: standardOutput,
        stdoutOverflow,
        timedOut,
      });
    });
  });
}

async function launchScenario(root, token, scenario) {
  const launch = await launchPackagedApp({ root, token, scenario });
  const proofFailure = /^Package smoke proof failed at ([a-z-]+)\.\n$/u.exec(launch.stderr);
  const failedCheck = [
    [!launch.closed, "did not close"],
    [launch.spawnFailed, "failed to launch"],
    [launch.timedOut, "timed out"],
    [launch.stderrOverflow, "stderr exceeded its bound"],
    [launch.stdoutOverflow, "stdout exceeded its bound"],
    [launch.stderr !== "", "emitted stderr"],
    [launch.stdout.trim() !== "", "emitted stdout"],
    [launch.code !== 0, "exited nonzero"],
  ].find(([failed]) => failed);
  if (failedCheck !== undefined) {
    activeSmokeStage = `${scenario} scenario ${proofFailure?.[1] ?? failedCheck[1]}`;
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

async function runInvalidAuthorizationCase(testCase) {
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

async function runSymlinkAuthorizationCaseIfSupported() {
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
      scenario: "bootstrap",
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

async function runRootSymlinkAuthorizationCaseIfSupported() {
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
      scenario: "bootstrap",
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
}

function isPlainGenerationEntry(entries) {
  if (entries.length !== 1) return false;
  const entry = entries[0];
  if (entry === undefined) return false;
  if (!entry.isDirectory()) return false;
  if (entry.isSymbolicLink()) return false;
  return generationIdPattern.test(entry.name);
}

function generationManifestAgrees(manifest, generationId) {
  if (typeof manifest !== "object") return false;
  if (manifest === null) return false;
  if (Array.isArray(manifest)) return false;
  if (manifest.projectId !== healthyProjectId) return false;
  return manifest.generationId === generationId;
}

async function inspectHealthyGeneration(root) {
  const projectRoot = path.join(root, "storage", "projects", healthyProjectId);
  const entries = await readdir(projectRoot, { withFileTypes: true });
  if (!isPlainGenerationEntry(entries)) {
    throw new Error("Packaged SlopStop did not create one plain active generation.");
  }
  const entry = entries[0];
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
      await removeClosedRuntimeDatabase(generationRoot);
      activeSmokeStage = "missing-runtime scenario";
      await launchScenario(root, token, "missing-runtime");
      await createStagingWitness(root);
      activeSmokeStage = "witnessed-staging scenario";
      await launchScenario(root, token, "witnessed-staging");
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
  process.stdout.write("Packaged SlopStop validated renderer isolation and Project Storage.\n");
} catch {
  const message =
    process.env["CI"] === "true"
      ? `Packaged SlopStop smoke failed at ${activeSmokeStage}.\n`
      : "Packaged SlopStop smoke failed.\n";
  process.stderr.write(message);
  process.exitCode = 1;
}
