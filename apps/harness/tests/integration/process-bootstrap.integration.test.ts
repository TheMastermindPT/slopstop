import { mkdir, symlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MessageChannel } from "node:worker_threads";
import {
  createHandshakeCommand,
  createProjectCloseCommand,
  createProjectCreateCommand,
  createProjectOpenCommand,
  ProjectStorageCloseRequestSchema,
  ProjectStorageOpenRequestSchema,
} from "@slopstop/protocol";
import { expect, it } from "vitest";
import type { StopHarnessRuntime } from "../../src/harness-runtime.js";
import { startHarnessProcessRuntime } from "../../src/process-bootstrap.js";
import {
  checkedInMigrationRoot,
  createRequest,
  createTemporaryApplicationRoot,
  pathExists,
  projectStorageIntegrationTimeout,
  transportFor,
} from "./project-storage-create-fixture.js";

const sentAt = "2026-08-31T12:00:00.000Z";
const openRequest = ProjectStorageOpenRequestSchema.parse({ projectId: createRequest.projectId });
const closeRequest = ProjectStorageCloseRequestSchema.parse({ projectId: createRequest.projectId });

function createProcessTransportFixture() {
  const { port1, port2 } = new MessageChannel();
  const received: unknown[] = [];
  port2.on("message", (message) => received.push(message));
  let messageSequence = 20;
  const exchange = (command: unknown): Promise<unknown> => {
    const response = new Promise<unknown>((resolve) => port2.once("message", resolve));
    port2.postMessage(command);
    return response;
  };
  const metadata = () => ({
    messageId: `00000000-0000-4000-8000-${String(messageSequence++).padStart(12, "0")}`,
    sentAt,
  });
  return {
    transport: transportFor(port1),
    received,
    handshake: () => exchange(createHandshakeCommand(metadata(), "0.0.0")),
    open: () => exchange(createProjectOpenCommand(metadata(), openRequest)),
    create: () => exchange(createProjectCreateCommand(metadata(), createRequest)),
    close: () => exchange(createProjectCloseCommand(metadata(), closeRequest)),
    closePorts() {
      port1.close();
      port2.close();
    },
  };
}

it(
  "composes persistent Project Storage from validated trusted roots",
  async () => {
    const applicationStorageRoot = await createTemporaryApplicationRoot();
    const session = createProcessTransportFixture();
    let stop: StopHarnessRuntime | undefined;

    try {
      stop = startHarnessProcessRuntime({
        bootstrap: {
          kind: "harness.connect",
          applicationStorageRootUrl: pathToFileURL(applicationStorageRoot).href,
          migrationResourcesRootUrl: pathToFileURL(checkedInMigrationRoot).href,
        },
        transport: session.transport,
      });
      await session.handshake();
      await expect(session.open()).resolves.toMatchObject({
        event: "project.open.result",
        payload: { status: "not-registered", request: openRequest },
      });
      await expect(session.create()).resolves.toMatchObject({
        event: "project.create.result",
        payload: { status: "created", request: createRequest, mode: "read-write" },
      });
      await expect(session.open()).resolves.toMatchObject({
        event: "project.open.result",
        payload: {
          status: "opened",
          request: openRequest,
          mode: "read-write",
          canonicalHealth: { status: "healthy" },
          runtimeHealth: { status: "healthy" },
        },
      });
      await expect(session.close()).resolves.toMatchObject({
        event: "project.close.result",
        payload: { status: "closed", request: closeRequest },
      });
      await Promise.resolve(stop());
      expect(JSON.stringify(session.received)).not.toContain(applicationStorageRoot);
    } finally {
      try {
        await Promise.resolve(stop?.());
      } finally {
        session.closePorts();
      }
    }
  },
  projectStorageIntegrationTimeout,
);

it("rejects overlapping bootstrap roots before starting the runtime", async () => {
  const root = await createTemporaryApplicationRoot();
  for (const [applicationRoot, migrationRoot] of [
    [root, path.join(root, "migrations")],
    [path.join(root, "storage"), root],
    [root, path.join(root, "..migrations")],
  ] as const) {
    const session = createProcessTransportFixture();
    try {
      expect(() =>
        startHarnessProcessRuntime({
          bootstrap: {
            kind: "harness.connect",
            applicationStorageRootUrl: pathToFileURL(applicationRoot).href,
            migrationResourcesRootUrl: pathToFileURL(migrationRoot).href,
          },
          transport: session.transport,
        }),
      ).toThrow("Harness bootstrap roots must not overlap.");
      expect(await pathExists(path.join(applicationRoot, "application.db"))).toBe(false);
    } finally {
      session.closePorts();
    }
  }
});

it("rejects a filesystem alias before persistence mutation", async () => {
  const applicationRoot = await createTemporaryApplicationRoot();
  const aliasRoot = await createTemporaryApplicationRoot();
  const migrationRoot = path.join(applicationRoot, "migrations");
  const migrationAlias = path.join(aliasRoot, "migration-alias");
  await mkdir(migrationRoot);
  await symlink(migrationRoot, migrationAlias, process.platform === "win32" ? "junction" : "dir");
  const session = createProcessTransportFixture();

  try {
    expect(() =>
      startHarnessProcessRuntime({
        bootstrap: {
          kind: "harness.connect",
          applicationStorageRootUrl: pathToFileURL(applicationRoot).href,
          migrationResourcesRootUrl: pathToFileURL(migrationAlias).href,
        },
        transport: session.transport,
      }),
    ).toThrow();
    expect(await pathExists(path.join(applicationRoot, "application.db"))).toBe(false);
  } finally {
    session.closePorts();
  }
});
