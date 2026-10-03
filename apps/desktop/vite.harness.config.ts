import { cp, readFile, realpath, rm } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { harnessRuntimeStagingPlugin } from "./build/harness-runtime-staging-plugin.js";

const nodeBuiltins = [...builtinModules, ...builtinModules.map((module) => `node:${module}`)];
const harnessRoot = fileURLToPath(new URL("../harness", import.meta.url));
const migrationSource = fileURLToPath(new URL("../harness/drizzle", import.meta.url));
const migrationOutput = fileURLToPath(new URL("./.vite/build/harness-migrations", import.meta.url));
const nativeModulesOutput = fileURLToPath(new URL("./.vite/build/node_modules", import.meta.url));

function targetBindingPackages(): readonly string[] {
  const target = `${process.platform}-${process.arch}`;
  switch (target) {
    case "darwin-arm64":
      return ["@libsql/darwin-arm64"];
    case "darwin-x64":
      return ["@libsql/darwin-x64"];
    case "win32-x64":
      return ["@libsql/win32-x64-msvc"];
    case "linux-arm":
      return ["@libsql/linux-arm-gnueabihf", "@libsql/linux-arm-musleabihf"];
    case "linux-arm64":
      return ["@libsql/linux-arm64-gnu", "@libsql/linux-arm64-musl"];
    case "linux-x64":
      return ["@libsql/linux-x64-gnu", "@libsql/linux-x64-musl"];
    default:
      throw new Error(`Unsupported libSQL package target: ${target}`);
  }
}

// Effect ships sources, declarations, and source maps; the worker needs only its ESM runtime.
function isStagedRuntimeFile(packageName: string, source: string, candidate: string): boolean {
  if (packageName !== "effect") return true;
  const relative = path.relative(source, candidate).split(path.sep);
  if (relative.length === 1)
    return ["", "dist", "package.json", "LICENSE"].includes(relative[0] ?? "");
  if (relative[0] !== "dist") return false;
  const name = relative.at(-1) ?? "";
  return !name.includes(".") || name.endsWith(".js");
}

function isMissingFile(error: unknown): boolean {
  if (!isRecord(error)) return false;
  return error["code"] === "ENOENT";
}

type RuntimePackageManifest = Readonly<{
  name: string;
  dependencies: readonly string[];
}>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object") return false;
  return value !== null;
}

function parsePackageManifest(value: unknown): RuntimePackageManifest | undefined {
  if (!isRecord(value)) return undefined;
  const name = value["name"];
  if (typeof name !== "string") return undefined;
  const dependencies = value["dependencies"];
  if (!isRecord(dependencies)) return { name, dependencies: [] };
  return { name, dependencies: Object.keys(dependencies) };
}

async function readPackageManifest(
  manifestPath: string,
): Promise<RuntimePackageManifest | undefined> {
  try {
    const manifest: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
    return parsePackageManifest(manifest);
  } catch (error: unknown) {
    if (isMissingFile(error)) {
      return undefined;
    }
    throw error;
  }
}

async function resolveInstalledPackageRoot(packageName: string, fromRoot: string): Promise<string> {
  let current = fromRoot;
  for (;;) {
    const candidate = path.join(current, "node_modules", ...packageName.split("/"));
    const manifest = await readPackageManifest(path.join(candidate, "package.json"));
    if (manifest?.name === packageName) {
      return realpath(candidate);
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not resolve package root for ${packageName}.`);
    }
    current = parent;
  }
}

async function collectRuntimePackages(): Promise<ReadonlyMap<string, string>> {
  const packages = new Map<string, string>();
  const collect = async (packageName: string, fromRoot: string): Promise<void> => {
    const packageRoot = await resolveInstalledPackageRoot(packageName, fromRoot);
    const current = packages.get(packageName);
    if (current !== undefined) {
      if (current !== packageRoot) {
        throw new Error(`Conflicting staged versions found for ${packageName}.`);
      }
      return;
    }
    const manifest = await readPackageManifest(path.join(packageRoot, "package.json"));
    if (manifest === undefined) {
      throw new Error(`Could not read package manifest for ${packageName}.`);
    }
    packages.set(packageName, packageRoot);
    await Promise.all(manifest.dependencies.map((dependency) => collect(dependency, packageRoot)));
  };

  await Promise.all(
    ["@libsql/client", "fs-native-extensions", "libsql", "koffi", "effect"].map((packageName) =>
      collect(packageName, harnessRoot),
    ),
  );
  const libsqlRoot = packages.get("libsql");
  if (libsqlRoot === undefined) {
    throw new Error("libsql was not included in the staged runtime.");
  }
  await Promise.all(targetBindingPackages().map((packageName) => collect(packageName, libsqlRoot)));
  const koffiRoot = packages.get("koffi");
  if (koffiRoot === undefined) {
    throw new Error("koffi was not included in the staged runtime.");
  }
  // Koffi ships its native module as an optional per-target package beside koffi.
  await collect(`@koromix/koffi-${process.platform}-${process.arch}`, koffiRoot);
  return packages;
}

async function stageHarnessRuntime(): Promise<void> {
  await rm(migrationOutput, { recursive: true, force: true });
  await rm(nativeModulesOutput, { recursive: true, force: true });
  await cp(migrationSource, migrationOutput, { recursive: true });
  const runtimePackages = await collectRuntimePackages();
  for (const [packageName, source] of runtimePackages) {
    const destination = path.join(nativeModulesOutput, ...packageName.split("/"));
    await cp(source, destination, {
      recursive: true,
      filter: (candidate) =>
        candidate !== path.join(source, "node_modules") &&
        isStagedRuntimeFile(packageName, source, candidate),
    });
  }
}

export default defineConfig({
  plugins: [harnessRuntimeStagingPlugin(stageHarnessRuntime)],
  build: {
    outDir: ".vite/build",
    emptyOutDir: false,
    lib: {
      entry: {
        harness: "../harness/src/process-entry.ts",
        "writer-proof-fixture":
          "../harness/tests/integration/canonical-writer-package-smoke-entry.ts",
      },
      fileName: (_format, entryName) => `${entryName}.cjs`,
      formats: ["cjs"],
    },
    rollupOptions: {
      external: [...nodeBuiltins, "fs-native-extensions", "libsql", "koffi"],
    },
  },
});
