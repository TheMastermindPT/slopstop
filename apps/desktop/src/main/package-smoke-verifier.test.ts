import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  packageSmokeRendererScript,
  validatePackageSmokeResult,
  verifyPackagedWriterNative,
} from "./package-smoke-verifier.js";

const nativePorts = vi.hoisted(() => ({
  stat: vi.fn(),
  realpath: vi.fn(),
  read: vi.fn(),
  require: vi.fn(),
  resolve: vi.fn(),
  createRequire: vi.fn(),
}));
vi.mock("node:fs", async (original) => ({
  ...(await original<typeof import("node:fs")>()),
  lstatSync: nativePorts.stat,
  realpathSync: Object.assign(vi.fn(), { native: nativePorts.realpath }),
  readFileSync: nativePorts.read,
}));
vi.mock("node:module", async (original) => ({
  ...(await original<typeof import("node:module")>()),
  createRequire: nativePorts.createRequire,
}));

const packageName = "fs-native-extensions";
const bindingName = "fs-native-extensions.node";
const resourcesPath = path.resolve("native-unit-fixture", "resources");
const mainBundleDirectory = path.join(resourcesPath, "app.asar", ".vite", "build");
const virtualRoot = path.join(mainBundleDirectory, "node_modules", packageName);
const unpackedRoot = path.join(
  resourcesPath,
  "app.asar.unpacked",
  ".vite",
  "build",
  "node_modules",
  packageName,
);
const nativeApi = { tryLock: () => true, unlock: () => undefined };
const nativeInput = { resourcesPath, mainBundleDirectory };
const nativeModule = { exports: {} };
const loaderFlags = 1;
let virtualBinding: string;
let unpackedBinding: string;
let delegatedLoad = vi.fn<typeof process.dlopen>();
const originalPlatform = process.platform;
const originalArch = process.arch;

function setNativeTarget(platform: string, arch: string): void {
  Object.defineProperty(process, "platform", { value: platform });
  Object.defineProperty(process, "arch", { value: arch });
}

async function configureNativeTarget(platform: string, arch: string): Promise<void> {
  setNativeTarget(platform, arch);
  const suffix = path.join("prebuilds", `${platform}-${arch}`, bindingName);
  virtualBinding = path.join(virtualRoot, suffix);
  unpackedBinding = path.join(unpackedRoot, suffix);
  // Read-only release bytes; mocked loader/filesystem ports do not prove native compatibility.
  const bytes = await readFile(path.resolve("node_modules/fs-native-extensions", suffix));
  nativePorts.read.mockImplementation((filename: string) => {
    if (filename === unpackedBinding) return bytes;
    if (filename === path.join(virtualRoot, "package.json")) {
      return JSON.stringify({ name: packageName, version: "1.5.1" });
    }
    throw new Error("Unexpected private filesystem path");
  });
  nativePorts.realpath.mockReturnValue(unpackedBinding);
}

function invokeNativeLoad(filename = virtualBinding): void {
  process.dlopen(nativeModule, filename, loaderFlags);
}

function expectNativeFailure(input = nativeInput): void {
  let observed: unknown;
  try {
    verifyPackagedWriterNative(input);
  } catch (error) {
    observed = error;
  }
  expect(observed).toBeInstanceOf(Error);
  expect(observed).toMatchObject({
    name: "WriterProofError",
    stage: "native-preflight",
    message: "Packaged Writer proof failed.",
  });
  expect(observed).not.toHaveProperty("cause");
  expect(process.dlopen).toBe(delegatedLoad);
}

describe("requires the exact unpacked Writer native load", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    delegatedLoad = vi.spyOn(process, "dlopen").mockImplementation(() => undefined);
    nativePorts.stat.mockReturnValue({ isFile: () => true, isSymbolicLink: () => false, size: 1 });
    nativePorts.resolve.mockReturnValue(path.join(virtualRoot, "index.js"));
    nativePorts.createRequire.mockReturnValue(
      Object.assign(nativePorts.require, { resolve: nativePorts.resolve }),
    );
    nativePorts.require.mockImplementation(() => {
      invokeNativeLoad();
      return nativeApi;
    });
    await configureNativeTarget("win32", "x64");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setNativeTarget(originalPlatform, originalArch);
  });

  it.each([
    ["win32", "x64"],
    ["linux", "x64"],
    ["linux", "arm64"],
    ["darwin", "x64"],
    ["darwin", "arm64"],
  ])("accepts pinned %s-%s through the exact virtual origin", async (platform, arch) => {
    await configureNativeTarget(platform, arch);
    expect(() => verifyPackagedWriterNative(nativeInput)).not.toThrow();
    expect(delegatedLoad).toHaveBeenCalledExactlyOnceWith(
      nativeModule,
      virtualBinding,
      loaderFlags,
    );
    expect(delegatedLoad.mock.contexts).toEqual([process]);
    expect(createRequire).toHaveBeenCalledWith(path.join(mainBundleDirectory, "harness.cjs"));
    expect(readFileSync).toHaveBeenCalledWith(unpackedBinding);
    expect(process.dlopen).toBe(delegatedLoad);
  });
  it.each(["ordinary", "namespaced"])(
    "accepts the corresponding unpacked spelling: %s",
    (spelling) => {
      const filename =
        spelling === "namespaced" ? path.toNamespacedPath(unpackedBinding) : unpackedBinding;
      nativePorts.require.mockImplementation(() => {
        invokeNativeLoad(filename);
        return nativeApi;
      });
      verifyPackagedWriterNative(nativeInput);
      expect(delegatedLoad).toHaveBeenCalledExactlyOnceWith(nativeModule, filename, loaderFlags);
      expect(process.dlopen).toBe(delegatedLoad);
    },
  );
  it("preserves omitted dlopen flags without synthesizing an undefined third argument", () => {
    nativePorts.require.mockImplementation(() => {
      process.dlopen(nativeModule, virtualBinding);
      return nativeApi;
    });
    delegatedLoad.mockImplementation((...args) => {
      if (args.length !== 2) throw new Error("invalid mode for dlopen(): Invalid argument");
    });
    expect(() => verifyPackagedWriterNative(nativeInput)).not.toThrow();
    expect(delegatedLoad).toHaveBeenCalledExactlyOnceWith(nativeModule, virtualBinding);
    expect(delegatedLoad.mock.contexts).toEqual([process]);
    expect(process.dlopen).toBe(delegatedLoad);
  });
  it.each([
    "missing",
    "empty",
    "directory",
    "symlink",
    "noncanonical",
    "corrupt",
    "rebuilt",
    "renamed",
    "other-target",
  ])("rejects %s physical binding before loading", (fault) => {
    const faults: Record<string, () => void> = {
      missing: () =>
        nativePorts.stat.mockImplementation(() => {
          throw new Error("private missing");
        }),
      empty: () =>
        nativePorts.stat.mockReturnValue({
          isFile: () => true,
          isSymbolicLink: () => false,
          size: 0,
        }),
      directory: () =>
        nativePorts.stat.mockReturnValue({
          isFile: () => false,
          isSymbolicLink: () => false,
          size: 1,
        }),
      symlink: () =>
        nativePorts.stat.mockReturnValue({
          isFile: () => true,
          isSymbolicLink: () => true,
          size: 1,
        }),
      noncanonical: () => nativePorts.realpath.mockReturnValue(`${unpackedBinding}.elsewhere`),
      corrupt: () => nativePorts.read.mockReturnValue(Buffer.from("corrupt")),
      rebuilt: () => nativePorts.read.mockReturnValue(Buffer.alloc(8192, 1)),
      renamed: () =>
        nativePorts.stat.mockImplementation(() => {
          throw new Error("only renamed.node exists");
        }),
      "other-target": () =>
        nativePorts.read.mockImplementation(() => Buffer.from("other target bytes")),
    };
    faults[fault]?.();
    expectNativeFailure();
    expect(delegatedLoad).not.toHaveBeenCalled();
    expect(nativePorts.require).not.toHaveBeenCalled();
  });
  it.each([
    null,
    [],
    {},
    { name: "other", version: "1.5.1" },
    { name: packageName, version: "1.5.0" },
    { name: packageName, version: "1.5.2" },
  ])("rejects contradictory manifest %#", (manifest) => {
    const read = nativePorts.read.getMockImplementation();
    nativePorts.read.mockImplementation((filename: string) =>
      filename.endsWith("package.json") ? JSON.stringify(manifest) : read?.(filename),
    );
    expectNativeFailure();
    expect(delegatedLoad).not.toHaveBeenCalled();
  });
  it.each([
    "manifest-read",
    "manifest-json",
    "realpath",
    "resolve",
    "create-require",
    "require",
    "dlopen",
  ])("sanitizes %s exception and restores observer", (fault) => {
    const fail = () => {
      throw new Error("private /secret/path");
    };
    const read = nativePorts.read.getMockImplementation();
    const ports: Record<string, () => void> = {
      "manifest-read": () => nativePorts.read.mockImplementation(fail),
      "manifest-json": () =>
        nativePorts.read.mockImplementation((filename: string) =>
          filename.endsWith("package.json") ? "{" : read?.(filename),
        ),
      realpath: () => nativePorts.realpath.mockImplementation(fail),
      resolve: () => nativePorts.resolve.mockImplementation(fail),
      "create-require": () => nativePorts.createRequire.mockImplementation(fail),
      require: () => nativePorts.require.mockImplementation(fail),
      dlopen: () => delegatedLoad.mockImplementation(fail),
    };
    ports[fault]?.();
    expectNativeFailure();
  });
  it.each(["alternate.js", "index.cjs", "../index.js", "index.js/", "INDEX.JS"])(
    "rejects alternate JS entry %s",
    (entry) => {
      nativePorts.resolve.mockReturnValue(`${virtualRoot}${path.sep}${entry}`);
      expectNativeFailure();
      expect(delegatedLoad).not.toHaveBeenCalled();
    },
  );
  it.each(["outside", "other-target", "renamed", "relative", "normalized-alias", "suffix"])(
    "blocks %s native candidate before delegation",
    (candidate) => {
      const candidates: Record<string, string> = {
        outside: path.resolve("outside", bindingName),
        "other-target": path.join(virtualRoot, "prebuilds", "linux-x64", bindingName),
        renamed: path.join(path.dirname(virtualBinding), "renamed.node"),
        relative: path.relative(process.cwd(), virtualBinding),
        "normalized-alias": `${path.dirname(virtualBinding)}${path.sep}.${path.sep}${bindingName}`,
        suffix: `${virtualBinding}.extra`,
      };
      nativePorts.require.mockImplementation(() => {
        invokeNativeLoad(candidates[candidate]);
        return nativeApi;
      });
      expectNativeFailure();
      expect(delegatedLoad).not.toHaveBeenCalled();
    },
  );
  it("allows a caught rejected candidate followed by exactly one legitimate success", () => {
    nativePorts.require.mockImplementation(() => {
      try {
        invokeNativeLoad(path.resolve("fallback.node"));
      } catch {
        /* Resolver tries the legitimate candidate. */
      }
      invokeNativeLoad();
      return nativeApi;
    });
    verifyPackagedWriterNative(nativeInput);
    expect(delegatedLoad).toHaveBeenCalledExactlyOnceWith(
      nativeModule,
      virtualBinding,
      loaderFlags,
    );
    expect(process.dlopen).toBe(delegatedLoad);
  });
  it.each([0, 2])("rejects %i successful load witnesses", (count) => {
    nativePorts.require.mockImplementation(() => {
      for (let index = 0; index < count; index += 1) invokeNativeLoad();
      return nativeApi;
    });
    expectNativeFailure();
  });
  it("does not count a caught failed delegation as a successful witness", () => {
    delegatedLoad.mockImplementation(() => {
      throw new Error("private loader failure");
    });
    nativePorts.require.mockImplementation(() => {
      try {
        invokeNativeLoad();
      } catch {
        /* Cached API is not a native-load witness. */
      }
      return nativeApi;
    });
    expectNativeFailure();
  });
  it("counts only the successful delegation after a caught legitimate load failure", () => {
    delegatedLoad.mockImplementationOnce(() => {
      throw new Error("private loader failure");
    });
    nativePorts.require.mockImplementation(() => {
      try {
        invokeNativeLoad();
      } catch {
        /* Only the following successful load is a witness. */
      }
      invokeNativeLoad(unpackedBinding);
      return nativeApi;
    });
    verifyPackagedWriterNative(nativeInput);
    expect(delegatedLoad).toHaveBeenCalledTimes(2);
    expect(process.dlopen).toBe(delegatedLoad);
  });
  it.each([
    null,
    [],
    {},
    { tryLock: true, unlock: nativeApi.unlock },
    { tryLock: nativeApi.tryLock },
    { tryLock: nativeApi.tryLock, unlock: "function" },
  ])("rejects missing native API %#", (api) => {
    nativePorts.require.mockImplementation(() => {
      invokeNativeLoad();
      return api;
    });
    expectNativeFailure();
  });
  it.each([
    ["win32", "arm64"],
    ["linux", "ia32"],
    ["freebsd", "x64"],
  ])("rejects unsupported executing target %s-%s", (platform, arch) => {
    setNativeTarget(platform, arch);
    expectNativeFailure();
    expect(delegatedLoad).not.toHaveBeenCalled();
  });
  it.each([
    { resourcesPath: "relative", mainBundleDirectory },
    { resourcesPath: "", mainBundleDirectory },
    { resourcesPath, mainBundleDirectory: "relative" },
    { resourcesPath, mainBundleDirectory: path.resolve("outside") },
    { resourcesPath: `${resourcesPath}${path.sep}..${path.sep}resources`, mainBundleDirectory },
  ])("rejects invalid package input %#", (input) => {
    expectNativeFailure(input);
    expect(delegatedLoad).not.toHaveBeenCalled();
  });
});

const query = {
  query: "memory-library.read",
  projectId: "00000000-0000-4000-8000-000000000001",
  cursor: null,
} as const;
const exactResult = {
  processType: "undefined",
  requireType: "undefined",
  methods: [
    "activateProject",
    "getHarnessStatus",
    "listProjects",
    "queryWorkspace",
    "retryHarness",
    "submitWorkspaceIntent",
    "subscribeHarnessStatus",
    "subscribeWorkspaceNotifications",
    "switchProject",
  ],
  queryResult: {
    status: "unavailable",
    query,
    diagnostic: {
      code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
      message: "Memory producer is unavailable.",
    },
  },
  intentResult: {
    status: "unavailable",
    capability: "memory",
    diagnostic: {
      code: "WORKSPACE_CAPABILITY_UNAVAILABLE",
      message: "Memory producer is unavailable.",
    },
  },
} as const;

describe("packaged renderer boundary verifier", () => {
  it("validates exact packaged renderer boundary results", () => {
    expect(() => validatePackageSmokeResult(exactResult)).not.toThrow();

    for (const value of [null, "not-an-object", []]) {
      expect(() => validatePackageSmokeResult(value)).toThrowError(
        "Packaged renderer smoke returned an invalid result.",
      );
    }
    expect(() =>
      validatePackageSmokeResult({ ...exactResult, requireType: "function" }),
    ).toThrowError("Packaged renderer smoke did not satisfy the production boundary.");

    const invalidResults = [
      { ...exactResult, injected: true },
      { ...exactResult, methods: [...exactResult.methods, "unexpected"] },
      { ...exactResult, processType: "object" },
      {
        ...exactResult,
        queryResult: {
          status: "ready",
          query,
          projection: {
            projection: "memory-library",
            revision: 0,
            projectId: query.projectId,
            items: [],
            nextCursor: null,
          },
        },
      },
      { ...exactResult, intentResult: { status: "forwarded", capability: "memory" } },
      { methods: exactResult.methods },
    ];
    for (const value of invalidResults) {
      expect(() => validatePackageSmokeResult(value)).toThrow();
    }

    expect(packageSmokeRendererScript).toContain(JSON.stringify(query));
    expect(packageSmokeRendererScript).not.toContain("process.env");
    expect(packageSmokeRendererScript).not.toContain("process.argv");
    expect(packageSmokeRendererScript).not.toContain("SLOPSTOP_");
  });
});
