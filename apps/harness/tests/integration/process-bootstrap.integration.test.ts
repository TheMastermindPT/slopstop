import { createHash } from "node:crypto";
import { mkdir, symlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MessageChannel } from "node:worker_threads";
import {
  type CanonicalCommandReceipt,
  CanonicalCommandReceiptSchema,
  CanonicalProjectActivationRequestSchema,
  CanonicalProjectCommandRequestSchema,
  createHandshakeCommand,
  createProjectActivateCommand,
  createProjectCloseCommand,
  createProjectCommand,
  createProjectCreateCommand,
  createProjectOpenCommand,
  decodeStrict,
  ProjectStorageCloseRequestSchema,
  ProjectStorageCreateRequestSchema,
  ProjectStorageOpenRequestSchema,
  parseHarnessMessage,
} from "@slopstop/protocol";
import { assert, expect, it } from "vitest";
import type { StopHarnessRuntime } from "../../src/harness-runtime.js";
import { startHarnessProcessRuntime } from "../../src/process-bootstrap.js";
import { createWorkerLocalLibsqlClient } from "../../src/storage/local-libsql-worker-client.js";
import {
  checkedInMigrationRoot,
  createRequest,
  createTemporaryApplicationRoot,
  pathExists,
  projectStorageIntegrationTimeout,
  transportFor,
} from "./project-storage-create-fixture.js";

const sentAt = "2026-08-31T12:00:00.000Z";
const openRequest = decodeStrict(ProjectStorageOpenRequestSchema, {
  projectId: createRequest.projectId,
});
const closeRequest = decodeStrict(ProjectStorageCloseRequestSchema, {
  projectId: createRequest.projectId,
});

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
    exchange,
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

async function readBootstrapSettlement(file: string) {
  const client = createWorkerLocalLibsqlClient(file, "generation");
  try {
    const tables = [
      "command_receipts",
      "command_idempotency",
      "command_rejections",
      "canonical_events",
      "project_state",
    ] as const;
    const rows = [];
    for (const table of tables) {
      rows.push((await client.execute(`SELECT * FROM ${table}`)).rows);
    }
    return rows;
  } finally {
    await client.close();
  }
}

function bootstrapEvent(raw: unknown) {
  const parsed = parseHarnessMessage(raw);
  assert(parsed.ok, "Bootstrap response must be a valid protocol envelope.");
  assert(parsed.value.messageType === "event", "Bootstrap response must be an event.");
  return parsed.value;
}

async function createBootstrapCommand(session: ReturnType<typeof createProcessTransportFixture>) {
  const projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
  const request = decodeStrict(ProjectStorageCreateRequestSchema, {
    projectId,
    createRequestId: "44444444-4444-4444-8444-444444444500",
  });
  await session.handshake();
  const created = bootstrapEvent(
    await session.exchange(
      createProjectCreateCommand(
        {
          messageId: "11111111-1111-4111-8111-111111111500",
          sentAt,
        },
        request,
      ),
    ),
  );
  assert(created.event === "project.create.result");
  assert(created.payload.status === "created");
  const activated = bootstrapEvent(
    await session.exchange(
      createProjectActivateCommand(
        {
          messageId: "11111111-1111-4111-8111-111111111501",
          sentAt,
        },
        decodeStrict(CanonicalProjectActivationRequestSchema, { projectId }),
      ),
    ),
  );
  assert(activated.event === "project.activate.result");
  assert(activated.payload.status === "active");
  expect(activated.payload.access).toBe("read-write");
  return {
    generationId: created.payload.identity.generationId,
    command: decodeStrict(CanonicalProjectCommandRequestSchema, {
      projectId,
      activationId: activated.payload.activationId,
      command: {
        commandId: "44444444-4444-4444-8444-444444444501",
        type: "conformance.counter.set",
        version: 1,
        payload: { value: 7, meta: { b: 2, a: 1 }, tags: ["x", "y"] },
      },
    }),
  };
}

async function expectBootstrapSettlementRows(file: string, receipt: CanonicalCommandReceipt) {
  const { projectId, commandId, receiptId, settledAt } = receipt;
  const fingerprint = createHash("sha256")
    .update(
      '{"commandId":"44444444-4444-4444-8444-444444444501","fingerprintVersion":1,"payload":{"meta":{"a":1,"b":2},"tags":["x","y"],"value":7},"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","type":"conformance.counter.set","version":1}',
    )
    .digest("hex");
  const rows = await readBootstrapSettlement(file);
  expect(rows.slice(0, 4)).toEqual([
    [
      [
        projectId,
        receiptId,
        commandId,
        "conformance.counter.set",
        1,
        fingerprint,
        "rejected",
        1,
        1,
        settledAt,
      ],
    ],
    [[projectId, commandId, fingerprint, receiptId, settledAt]],
    [
      [
        projectId,
        receiptId,
        "rejected",
        1,
        "COMMAND_TYPE_UNSUPPORTED",
        0,
        '{"version":1}',
        createHash("sha256").update('{"version":1}').digest("hex"),
      ],
    ],
    [],
  ]);
  assert(rows[4]?.length === 1, "Bootstrap must retain exactly one Project state row.");
  expect(rows[4][0]?.slice(0, 3)).toEqual([projectId, 1, 1]);
  return rows;
}

function expectUnsupportedBootstrapReceipt(value: unknown) {
  const receipt = decodeStrict(CanonicalCommandReceiptSchema, value);
  expect(receipt).toEqual({
    receiptId: receipt.receiptId,
    projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    commandId: "44444444-4444-4444-8444-444444444501",
    commandType: "conformance.counter.set",
    commandVersion: 1,
    outcome: "rejected",
    projectSequence: 1,
    writerGeneration: 1,
    settledAt: receipt.settledAt,
    events: [],
    rejection: { code: "COMMAND_TYPE_UNSUPPORTED", retryable: false },
  });
  return receipt;
}

function startTrustedBootstrap(
  applicationStorageRoot: string,
  session: ReturnType<typeof createProcessTransportFixture>,
) {
  return startHarnessProcessRuntime({
    bootstrap: {
      kind: "harness.connect",
      applicationStorageRootUrl: pathToFileURL(applicationStorageRoot).href,
      migrationResourcesRootUrl: pathToFileURL(checkedInMigrationRoot).href,
    },
    transport: session.transport,
  });
}

it(
  "settles an unsupported command through the bootstrap-composed empty registry",
  async () => {
    const applicationStorageRoot = await createTemporaryApplicationRoot();
    const session = createProcessTransportFixture();
    let stop: StopHarnessRuntime | undefined;
    try {
      stop = startTrustedBootstrap(applicationStorageRoot, session);
      const { command, generationId } = await createBootstrapCommand(session);
      const { projectId } = command;
      const file = path.join(
        applicationStorageRoot,
        "projects",
        projectId,
        generationId,
        "slopstop.db",
      );
      const messageId = "11111111-1111-4111-8111-111111111502";
      const result = bootstrapEvent(
        await session.exchange(createProjectCommand({ messageId, sentAt }, command)),
      );
      assert(result.event === "project.command.result");
      expect(result.payload.status).toBe("settled");
      assert(result.payload.status === "settled");
      const receipt = expectUnsupportedBootstrapReceipt(result.payload.receipt);
      expect(result.payload).toEqual({
        status: "settled",
        projectId,
        activationId: command.activationId,
        commandId: command.command.commandId,
        receipt,
      });
      expect(result.causationId).toBe(messageId);
      const beforeRetry = await expectBootstrapSettlementRows(file, receipt);
      const retryId = "11111111-1111-4111-8111-111111111504";
      const retry = bootstrapEvent(
        await session.exchange(createProjectCommand({ messageId: retryId, sentAt }, command)),
      );
      expect(retry.event).toBe("project.command.result");
      expect(retry.payload).toEqual(result.payload);
      expect(retry.causationId).toBe(retryId);
      expect(retry.sequence).toBe(result.sequence + 1);
      expect(await readBootstrapSettlement(file)).toEqual(beforeRetry);
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

it(
  "composes persistent Project Storage from validated trusted roots",
  async () => {
    const applicationStorageRoot = await createTemporaryApplicationRoot();
    const session = createProcessTransportFixture();
    let stop: StopHarnessRuntime | undefined;

    try {
      stop = startTrustedBootstrap(applicationStorageRoot, session);
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
