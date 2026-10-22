import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";
import {
  type DesktopRuntimePorts,
  makeDesktopRuntime,
  readDesktopServices,
} from "./desktop-runtime.js";
import type { HarnessSessionClient } from "./harness-session.js";

type Owner = "project-entry" | "project-storage" | "workspace" | "supervisor";
type Faults = Partial<Record<Owner, () => void | Promise<void>>>;

const session: HarnessSessionClient = {
  send: () => ({ ok: true }),
  subscribe: () => () => undefined,
};

/** Owners whose constructor throws the given error. */
type Throws = Partial<Record<"supervisor" | "bridges", Error>>;

/** A stop that runs its owner stop once, as a shared bridge's latched stop does. */
function latch(stop: () => void) {
  let ran = false;
  return {
    stop: () => {
      if (ran) return;
      ran = true;
      stop();
    },
    ran: () => ran,
  };
}

/** Fake ports whose owner stops record into `stops`; a fault replaces an owner's stop. */
function fakes(faults: Faults = {}, throws: Throws = {}) {
  const stops: Owner[] = [];
  const stopOf = (owner: Owner) =>
    vi.fn(() => {
      stops.push(owner);
      return faults[owner]?.();
    });
  const ownerStops = {
    "project-entry": stopOf("project-entry"),
    "project-storage": stopOf("project-storage"),
    workspace: stopOf("workspace"),
    supervisor: vi.fn(async () => {
      stops.push("supervisor");
      await faults.supervisor?.();
    }),
  };
  const entryOwner = {
    list: vi.fn(),
    register: vi.fn(),
    activate: vi.fn(),
    switchProject: vi.fn(),
    upgrade: vi.fn(),
    readConversation: vi.fn(),
    saveConversationMessage: vi.fn(),
  };
  const storageOwner = { open: vi.fn(), create: vi.fn(), close: vi.fn() };
  const workspaceOwner = {
    query: vi.fn(),
    submit: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
  };
  /** The faked shared bridges: three latched stops, and a release that runs the rest, isolated. */
  const release = vi.fn();
  const createHarnessBridges = vi.fn(() => {
    if (throws.bridges !== undefined) throw throws.bridges;
    const latched = {
      projectStorage: latch(ownerStops["project-storage"]),
      workspace: latch(ownerStops.workspace),
      projectEntry: latch(ownerStops["project-entry"]),
    };
    release.mockImplementation(() => {
      const failures: unknown[] = [];
      for (const bridge of Object.values(latched)) {
        if (bridge.ran()) continue;
        try {
          bridge.stop();
        } catch (error) {
          failures.push(error);
        }
      }
      if (failures.length > 0) throw failures[0];
    });
    return {
      projectEntry: { ...entryOwner, stop: latched.projectEntry.stop },
      projectStorage: { ...storageOwner, stop: latched.projectStorage.stop },
      workspace: { ...workspaceOwner, stop: latched.workspace.stop },
      release,
    };
  });
  const ports = {
    createLogger: vi.fn(() => pino({ level: "silent" })),
    harnessEntryPath: vi.fn(() => "harness.cjs"),
    harnessBootstrap: vi.fn(() => ({
      kind: "harness.connect" as const,
      applicationStorageRootUrl: "file:///C:/proof/storage",
      migrationResourcesRootUrl: "file:///C:/proof/migrations",
    })),
    createId: vi.fn(() => "id"),
    now: vi.fn(() => "2026-10-19T00:00:00.000Z"),
    createSupervisor: vi.fn(() => {
      if (throws.supervisor !== undefined) throw throws.supervisor;
      return {
        start: vi.fn(),
        stop: ownerStops.supervisor,
        subscribe: vi.fn(() => () => undefined),
        getStatus: vi.fn(() => ({ state: "stopped" as const })),
        retry: vi.fn(() => ({ ok: true as const })),
        getSession: () => session,
      };
    }),
    createHarnessBridges,
  } satisfies DesktopRuntimePorts;
  return { ports, stops, ownerStops, release };
}

const bridges: Owner[] = ["project-entry", "project-storage", "workspace"];

/** What reading the services throws, or `undefined` when the read succeeds. */
function readFailure(runtime: ReturnType<typeof makeDesktopRuntime>): unknown {
  try {
    runtime.runSync(readDesktopServices);
    return undefined;
  } catch (error) {
    return error;
  }
}

/** A runtime over the fakes, with its services read (so its Layers are built). */
function built(faults: Faults = {}) {
  const { ports, stops, ownerStops } = fakes(faults);
  const runtime = makeDesktopRuntime(ports);
  return { runtime, services: runtime.runSync(readDesktopServices), stops, ownerStops };
}

/** A built runtime whose supervisor stop rejects once. */
function builtWithFailingSupervisor() {
  const failure = new Error("private supervisor stop failure");
  return { ...built({ supervisor: () => Promise.reject(failure) }), failure };
}

describe("desktop runtime", () => {
  const rows: ReadonlyArray<Readonly<{ name: string; run(): Promise<void> }>> = [
    {
      name: "built, never stopped",
      async run() {
        const { ports, stops, release } = fakes();
        const runtime = makeDesktopRuntime(ports);
        runtime.runSync(readDesktopServices);
        await runtime.dispose();
        expect([...stops.slice(0, 3)].sort()).toEqual([...bridges].sort());
        expect(stops.slice(3)).toEqual(["supervisor"]);
        expect(release).toHaveBeenCalledOnce();
      },
    },
    {
      name: "program then dispose",
      async run() {
        const { ports, stops, release } = fakes();
        const runtime = makeDesktopRuntime(ports);
        const services = runtime.runSync(readDesktopServices);
        services.projectStorage.stop();
        services.workspace.stop();
        services.projectEntry.stop();
        await services.harness.stop();
        await expect(runtime.dispose()).resolves.toBeUndefined();
        expect(stops).toEqual(["project-storage", "workspace", "project-entry", "supervisor"]);
        expect(release).toHaveBeenCalledOnce();
      },
    },
    {
      name: "supervisor stop rejects, no program",
      async run() {
        const { runtime, stops, failure } = builtWithFailingSupervisor();
        await expect(runtime.dispose()).rejects.toBe(failure);
        expect(stops).toHaveLength(4);
      },
    },
    {
      name: "supervisor stop rejects, program first",
      async run() {
        const { runtime, services, ownerStops, failure } = builtWithFailingSupervisor();
        await expect(services.harness.stop()).rejects.toBe(failure);
        await expect(runtime.dispose()).resolves.toBeUndefined();
        expect(ownerStops.supervisor).toHaveBeenCalledOnce();
      },
    },
    {
      name: "never built",
      async run() {
        const { ports, stops } = fakes();
        const runtime = makeDesktopRuntime(ports);
        await runtime.dispose();
        for (const port of Object.values(ports)) expect(port).not.toHaveBeenCalled();
        expect(stops).toEqual([]);
      },
    },
    {
      name: "a release throws",
      async run() {
        const failure = new Error("private workspace stop failure");
        const { runtime, stops } = built({
          workspace: () => {
            throw failure;
          },
        });
        await expect(runtime.dispose()).rejects.toBe(failure);
        expect([...stops].sort()).toEqual([...bridges, "supervisor"].sort());
      },
    },
    {
      name: "build fails after the logger",
      async run() {
        const failure = new Error("private bootstrap decode failure");
        const { ports, stops } = fakes({}, { supervisor: failure });
        const runtime = makeDesktopRuntime(ports);
        expect(readFailure(runtime)).toBe(failure);
        await expect(runtime.dispose()).resolves.toBeUndefined();
        expect(stops).toEqual([]);
        expect(ports.createLogger).toHaveBeenCalledOnce();
        expect(ports.createSupervisor).toHaveBeenCalledOnce();
        expect(ports.createHarnessBridges).not.toHaveBeenCalled();
      },
    },
    {
      name: "build fails after the supervisor",
      async run() {
        const failure = new Error("private harness bridges construction failure");
        const { ports, stops } = fakes({}, { bridges: failure });
        const runtime = makeDesktopRuntime(ports);
        expect(readFailure(runtime)).toBe(failure);
        await expect(runtime.dispose()).resolves.toBeUndefined();
        expect(stops).toEqual(["supervisor"]);
        for (const port of [ports.createLogger, ports.createSupervisor, ports.createHarnessBridges])
          expect(port).toHaveBeenCalledOnce();
      },
    },
    {
      name: "stop twice",
      async run() {
        const { services, ownerStops, failure } = builtWithFailingSupervisor();
        await expect(services.harness.stop()).rejects.toBe(failure);
        await expect(services.harness.stop()).rejects.toBe(failure);
        expect(ownerStops.supervisor).toHaveBeenCalledOnce();
      },
    },
  ];

  it.each(rows)("releases every owner on dispose: $name", async ({ run }) => {
    await run();
  });
});

it("passes the bridges their session, id and clock", () => {
  const { ports } = fakes();
  makeDesktopRuntime(ports).runSync(readDesktopServices);
  expect(ports.createHarnessBridges).toHaveBeenCalledExactlyOnceWith({
    session,
    createId: ports.createId,
    now: ports.now,
  });
});
