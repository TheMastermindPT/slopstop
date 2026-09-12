import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type WriterProofControl,
  WriterProofControlSchema,
  WriterProofEventSchema,
  WriterProofNativeMetadataSchema,
  WriterProofNativeTargetSchema,
  type WriterProofStart,
  WriterProofStartSchema,
} from "@slopstop/protocol";
import type {
  WriterProofFixture,
  WriterProofRoots,
} from "./canonical-writer-package-smoke-fixture.js";

export interface WriterProofPort {
  start(): void;
  close(): void;
  send(message: unknown): void;
  subscribe(receive: (message: unknown) => void, closed: () => void): void;
}

type ControllerDependencies = Readonly<{
  exit(code: number): void;
  diagnostic(message: string): void | Promise<void>;
  nativePreflight(): unknown;
  createFixture(roots: WriterProofRoots): WriterProofFixture | Promise<WriterProofFixture>;
}>;

function requireFixture(value: unknown): asserts value {
  if (!value) throw new Error("Writer proof fixture failed.");
}

function missingPath(error: unknown) {
  if (!(error instanceof Error)) return false;
  return "code" in error && error.code === "ENOENT";
}

function physicalRoot(url: string) {
  const root = fileURLToPath(url);
  requireFixture(path.isAbsolute(root));
  let current = path.resolve(root);
  const missing: string[] = [];
  for (;;) {
    try {
      const stat = lstatSync(current);
      requireFixture(stat.isDirectory() && !stat.isSymbolicLink());
      return path.join(realpathSync.native(current), ...missing.reverse());
    } catch (error) {
      if (!missingPath(error)) throw error;
      missing.push(path.basename(current));
      const parent = path.dirname(current);
      requireFixture(parent !== current);
      current = parent;
    }
  }
}

function overlaps(first: string, second: string) {
  const relative = path.relative(first, second);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`))
  );
}

function rootsFor(start: WriterProofStart): WriterProofRoots {
  const applicationStorageRoot = physicalRoot(start.bootstrap.applicationStorageRootUrl);
  const migrationResourcesRoot = physicalRoot(start.bootstrap.migrationResourcesRootUrl);
  requireFixture(!overlaps(applicationStorageRoot, migrationResourcesRoot));
  requireFixture(!overlaps(migrationResourcesRoot, applicationStorageRoot));
  return { applicationStorageRoot, migrationResourcesRoot };
}

type FixtureStep = WriterProofControl["step"] | "initialize" | "completed";

function nextStep(control: WriterProofControl): FixtureStep {
  const next = {
    "stale.initialize": "stale.release",
    "stale.release": "stale.attempt",
    "stale.attempt": "stale.finish",
    "stale.finish": "completed",
    "audit.initialize": "completed",
  } as const;
  return next[control.step];
}

function validStep(expected: FixtureStep, control: WriterProofControl) {
  if (expected !== "initialize") return control.step === expected;
  return ["audit.initialize", "stale.initialize"].includes(control.step);
}

function closeFailedPorts(ports: Iterable<WriterProofPort>) {
  for (const port of ports) {
    try {
      port.close();
    } catch {
      /* Port failure cannot replace the already selected nonzero exit. */
    }
  }
}

export function startWriterProofController(dependencies: ControllerDependencies) {
  let started = false;
  let failed = false;
  let exited = false;
  let busy = false;
  let expected: FixtureStep = "initialize";
  let start: WriterProofStart | undefined;
  let port: WriterProofPort | undefined;
  let fixture: WriterProofFixture | undefined;
  let ready: Promise<void> = Promise.resolve();
  let work: Promise<void> = Promise.resolve();
  let native: unknown;
  const requests = new Set<string>();
  const ownedPorts = new Set<WriterProofPort>();
  const finishExit = (code: number) => {
    if (exited) return;
    exited = true;
    dependencies.exit(code);
  };
  const fail = () => {
    if (failed || exited) return;
    failed = true;
    void (async () => {
      await ready.catch(() => undefined);
      await work.catch(() => undefined);
      try {
        await fixture?.close();
      } catch {
        /* Failed teardown remains failure. */
      }
      closeFailedPorts(ownedPorts);
      try {
        await dependencies.diagnostic("Writer proof fixture failed.\n");
      } catch {
        /* Reporting failure never permits a clean exit. */
      } finally {
        finishExit(1);
      }
    })();
  };
  const receive = (message: unknown) => {
    if (failed || exited) return;
    try {
      const control = WriterProofControlSchema.parse(message);
      requireFixture(start);
      requireFixture(control.proofId === start.proofId);
      requireFixture(!busy);
      requireFixture(!requests.has(control.requestId));
      requireFixture(validStep(expected, control));
      busy = true;
      requests.add(control.requestId);
      work = (async () => {
        await ready;
        requireFixture(fixture);
        requireFixture(!failed);
        const observation = await fixture.control(control);
        requireFixture(!failed);
        const result = WriterProofEventSchema.parse({
          version: 1,
          kind: "writer-proof.result",
          proofId: control.proofId,
          requestId: control.requestId,
          step: control.step,
          stepNumber: control.stepNumber,
          ...observation,
          ...(control.step.endsWith("initialize") ? { native } : {}),
        });
        expected = nextStep(control);
        requireFixture(port);
        port.send(result);
        busy = false;
      })();
      void work.catch(fail);
    } catch {
      fail();
    }
  };
  return {
    start: (message: unknown, ports: readonly WriterProofPort[]) => {
      for (const received of ports) ownedPorts.add(received);
      try {
        requireFixture(!started);
        started = true;
        port = ports[0];
        requireFixture(ports.length === 1 && port);
        start = WriterProofStartSchema.parse(message);
        const roots = rootsFor(start);
        port.subscribe(receive, () => {
          if (expected === "completed" && !busy && !failed) finishExit(0);
          else fail();
        });
        native = WriterProofNativeMetadataSchema.parse(dependencies.nativePreflight());
        ready = Promise.resolve(dependencies.createFixture(roots)).then((value) => {
          fixture = value;
        });
        void ready.catch(fail);
        port.start();
      } catch {
        fail();
      }
    },
    fail,
  };
}

// Independent published pins: this test-owned observer does not import Desktop.
const hashes = {
  "win32-x64": "dd3f8eb1d53441f151551c84a1211c79524b1eab74ff83ab93e68037f3997ba4",
  "linux-x64": "13657db7ce92f823ee8066cc7244f3a475340707fc065fd4f5aceeebbfa898c3",
  "linux-arm64": "895dd0dca09438454f28bba250bcafa3e69c937fe97ea46b1b6212dc3a81315c",
  "darwin-x64": "973e4b2addf30901b955c75626ac153d3a37cebcfa621375bcd490f199884c8e",
  "darwin-arm64": "1e93b74e556b7d1767d57fabb197d9d1df5641453967170537278f72ed46f018",
};

function nativePaths(bundleDirectory: string) {
  const target = WriterProofNativeTargetSchema.parse(`${process.platform}-${process.arch}`);
  const resources = path.resolve(bundleDirectory, "../../..");
  requireFixture(bundleDirectory === path.join(resources, "app.asar", ".vite", "build"));
  const suffix = path.join(".vite", "build", "node_modules", "fs-native-extensions");
  const virtual = path.join(resources, "app.asar", suffix);
  const bindingSuffix = path.join("prebuilds", target, "fs-native-extensions.node");
  const binding = path.join(resources, "app.asar.unpacked", suffix, bindingSuffix);
  return { target, binding, virtual, bindingSuffix };
}

function verifyNativeFiles(input: ReturnType<typeof nativePaths>) {
  const { binding, target, virtual } = input;
  const stat = lstatSync(binding);
  requireFixture(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0);
  requireFixture(realpathSync.native(binding) === binding);
  requireFixture(
    createHash("sha256").update(readFileSync(binding)).digest("hex") === hashes[target],
  );
  const manifest: unknown = JSON.parse(readFileSync(path.join(virtual, "package.json"), "utf8"));
  requireFixture(typeof manifest === "object" && manifest !== null);
  requireFixture("name" in manifest && manifest.name === "fs-native-extensions");
  requireFixture("version" in manifest && manifest.version === "1.5.1");
}

function observeFixtureNative(bundleDirectory: string, input: ReturnType<typeof nativePaths>) {
  const { binding, virtual, bindingSuffix } = input;
  const load = createRequire(path.join(bundleDirectory, "writer-proof-fixture.cjs"));
  requireFixture(load.resolve("fs-native-extensions") === path.join(virtual, "index.js"));
  const original = process.dlopen;
  let count = 0;
  process.dlopen = (...args) => {
    const [, filename] = args;
    requireFixture(
      filename === binding ||
        filename === path.join(virtual, bindingSuffix) ||
        filename === path.toNamespacedPath(binding),
    );
    const result = original.apply(process, args);
    count++;
    return result;
  };
  try {
    const api: unknown = load("fs-native-extensions");
    requireFixture(count === 1 && typeof api === "object" && api !== null);
    requireFixture("tryLock" in api && typeof api.tryLock === "function");
    requireFixture("unlock" in api && typeof api.unlock === "function");
  } finally {
    process.dlopen = original;
  }
}

export function verifyFixtureNativeOrigin(bundleDirectory: string) {
  try {
    const input = nativePaths(bundleDirectory);
    verifyNativeFiles(input);
    observeFixtureNative(bundleDirectory, input);
    return WriterProofNativeMetadataSchema.parse({
      packageName: "fs-native-extensions",
      packageVersion: "1.5.1",
      target: input.target,
      unpackedTargetBinding: true,
      fallbackLoaded: false,
    });
  } catch {
    const error = new Error("Packaged Writer proof failed.");
    error.name = "WriterProofError";
    throw Object.assign(error, { stage: "native-preflight" });
  }
}

interface UtilityPort {
  start(): void;
  close(): void;
  postMessage(value: unknown): void;
  on(event: "message", listener: (event: { data: unknown }) => void): void;
  on(event: "close", listener: () => void): void;
}
interface UtilityParent {
  on(event: "message", listener: (event: { data: unknown; ports: UtilityPort[] }) => void): void;
}
const utilityProcess = process as NodeJS.Process & { parentPort?: UtilityParent };
if (utilityProcess.parentPort !== undefined) {
  const controller = startWriterProofController({
    exit: (code) => process.exit(code),
    diagnostic: (message) =>
      new Promise<void>((resolve, reject) => {
        process.stderr.write(message, (error) => (error ? reject(error) : resolve()));
      }),
    nativePreflight: () => verifyFixtureNativeOrigin(path.dirname(process.argv[1] ?? "")),
    createFixture: async (roots) => {
      const { createWriterProofFixture } = await import(
        "./canonical-writer-package-smoke-fixture.js"
      );
      return createWriterProofFixture(roots);
    },
  });
  utilityProcess.parentPort.on("message", (event) =>
    controller.start(
      event.data,
      event.ports.map((port) => ({
        start: () => port.start(),
        close: () => port.close(),
        send: (value) => port.postMessage(value),
        subscribe: (receive, closed) => {
          port.on("message", (event) => receive(event.data));
          port.on("close", closed);
        },
      })),
    ),
  );
  process.on("uncaughtException", controller.fail);
  process.on("unhandledRejection", controller.fail);
}
