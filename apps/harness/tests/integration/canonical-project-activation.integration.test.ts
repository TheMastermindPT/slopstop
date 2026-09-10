import { createHash } from "node:crypto";
import path from "node:path";
import { setImmediate as nextTurn } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { MessageChannel } from "node:worker_threads";
import {
  CanonicalProjectCommandRequestSchema,
  createProjectActivateCommand,
  createProjectCommand,
  createProjectCreateCommand,
  ProjectActivationIdSchema,
  parseHarnessMessage,
} from "@slopstop/protocol";
import { expect, it } from "vitest";
import { createActiveProjectCoordinator } from "../../src/active-project-coordinator.js";
import { createCanonicalProjectApplication } from "../../src/canonical-project-application.js";
import { startHarnessRuntime } from "../../src/harness-runtime.js";
import { startHarnessProcessRuntime } from "../../src/process-bootstrap.js";
import { createProjectStorageApplication } from "../../src/project-storage-application.js";
import * as repositories from "../../src/storage/canonical-command-repository.js";
import { createNodeCanonicalWriterLeaseFactory } from "../../src/storage/canonical-writer-lease.js";
import {
  createWorkerLocalLibsqlClient,
  type LocalLibsqlClient,
} from "../../src/storage/local-libsql-worker-client.js";
import { createNodeProjectStorageDependencies } from "../../src/storage/project-storage-node-adapters.js";
import { createProjectStorageOwner } from "../../src/storage/project-storage-store.js";
import { createUnavailableWorkspaceApplication } from "../../src/workspace-application.js";
import {
  checkedInMigrationRoot,
  createRequest,
  createStorageRuntimeForRoot,
  createTemporaryApplicationRoot,
  fixedCreationIds,
  transportFor,
} from "./project-storage-create-fixture.js";

it("configures every canonical activation and release transaction", async () => {
  const create = repositories.createCanonicalCommandRepositoryFactory;
  expect(create).toBeTypeOf("function");
  if (typeof create !== "function") throw new Error("Canonical repository factory is missing.");
  const root = await createTemporaryApplicationRoot();
  const storage = await createStorageRuntimeForRoot(root);
  try {
    await storage.create(createRequest);
  } finally {
    await storage.stop();
  }
  const file = path.join(
    root,
    "projects",
    createRequest.projectId,
    fixedCreationIds.generationId,
    "slopstop.db",
  );
  const client = createWorkerLocalLibsqlClient(file, "generation");
  const settings: unknown[] = [];
  const observed: LocalLibsqlClient = {
    execute: (statement, args) => client.execute(statement, args),
    close: () => client.close(),
    transaction: async (mode) => {
      const transaction = await client.transaction(mode);
      settings.push({
        foreignKeys: (await transaction.execute("PRAGMA foreign_keys")).rows,
        busyTimeout: (await transaction.execute("PRAGMA busy_timeout")).rows,
      });
      return transaction;
    },
  };
  const poison = async () => {
    await client.execute("PRAGMA foreign_keys=OFF");
    await client.execute("PRAGMA busy_timeout=0");
  };
  try {
    await poison();
    const factory = create({
      openClient: () => observed,
      sha256Text: async (value) => createHash("sha256").update(value).digest("hex"),
      createHandoffId: () => "00000000-0000-4000-8000-000000000051",
      createRecoveryRecordId: () => "00000000-0000-4000-8000-000000000052",
    });
    const result = await factory.activate({
      canonicalDatabasePath: file,
      projectId: createRequest.projectId,
      activationId: ProjectActivationIdSchema.parse("00000000-0000-4000-8000-000000000011"),
      writerToken: repositories.WriterCapabilityTokenSchema.parse("a".repeat(64)),
      activatedAt: "2026-09-04T12:00:00.000Z",
    });
    expect(result.status).toBe("activated");
    if (result.status !== "activated") throw result.error;
    await poison();
    expect(await result.repository.releaseFence("2026-09-04T12:01:00.000Z")).toEqual({
      status: "current",
    });
    expect(settings).toEqual([
      { foreignKeys: [[1]], busyTimeout: [[5000]] },
      { foreignKeys: [[1]], busyTimeout: [[5000]] },
    ]);
    await result.repository.close();
  } finally {
    await client.close();
  }
});

it("round-trips canonical activation and contains canonical request failures", async () => {
  const root = await createTemporaryApplicationRoot();
  const creator = await createStorageRuntimeForRoot(root);
  try {
    await creator.create(createRequest);
  } finally {
    await creator.stop();
  }
  const leases = createNodeCanonicalWriterLeaseFactory();
  const held = await leases.acquire(
    path.join(root, "projects", createRequest.projectId, ".slopstop-writer.lock"),
  );
  expect(held.status).toBe("acquired");
  if (held.status !== "acquired") throw new Error("Test lease was not acquired.");
  const f = activationTransport(root, leases);
  try {
    const activationId = "00000000-0000-4000-8000-000000000011";
    const request = { projectId: createRequest.projectId };
    expect(await f.activate()).toEqual(
      f.envelope("project.activate.result", 1, "00000000-0000-4000-8000-000000000101", {
        status: "active",
        request,
        access: "read-only",
        activationId,
        writerGeneration: null,
        diagnostic: {
          code: "WRITER_UNAVAILABLE",
          message: "Another SlopStop process holds Project write authority.",
          retryable: true,
        },
      }),
    );
    expect(await f.execute()).toEqual(
      f.envelope("project.command.result", 2, "00000000-0000-4000-8000-000000000102", {
        status: "read-only",
        projectId: request.projectId,
        activationId,
        commandId: "00000000-0000-4000-8000-000000000012",
        diagnostic: {
          code: "WRITER_UNAVAILABLE",
          message: "The active Project has no write authority.",
          retryable: true,
        },
      }),
    );
    f.fail();
    const failure = {
      code: "HARNESS_INTERNAL_FAILURE",
      message: "Harness failed while handling a message.",
      retryable: false,
    };
    expect(await f.activate()).toEqual(
      f.envelope("request.failure", 3, "00000000-0000-4000-8000-000000000101", failure),
    );
    expect(await f.execute()).toEqual(
      f.envelope("request.failure", 4, "00000000-0000-4000-8000-000000000102", failure),
    );
  } finally {
    try {
      await f.stop();
    } finally {
      await held.lease.release();
    }
  }
});

function activationTransport(
  root: string,
  leases: ReturnType<typeof createNodeCanonicalWriterLeaseFactory>,
) {
  const { port1, port2 } = new MessageChannel();
  const storage = createProjectStorageOwner(
    createNodeProjectStorageDependencies({
      applicationStorageRoot: root,
      migrationResourcesRoot: checkedInMigrationRoot,
      applicationVersion: "0.0.0",
    }),
  );
  const coordinator = createActiveProjectCoordinator({
    storage,
    leases,
    repositories: {
      activate: async () => {
        throw new Error("Contender must not create a repository.");
      },
    },
    createWriterToken: () => {
      throw new Error("Contender must not create a token.");
    },
    createActivationId: () =>
      ProjectActivationIdSchema.parse("00000000-0000-4000-8000-000000000011"),
    now: () => "2026-09-04T12:00:00.000Z",
  });
  const app = createCanonicalProjectApplication(coordinator);
  let entered = false;
  let fail = false;
  let delivered = (): void => undefined;
  const canonicalProjectApplication = {
    activate: async (request: Parameters<typeof app.activate>[0]) => {
      entered = true;
      if (fail) throw new Error("C:\\private\\project\\slopstop.db");
      return app.activate(request);
    },
    switchProject: async () => {
      throw new Error("Unexpected canonical Project switch in this fixture.");
    },
    execute: async (request: Parameters<typeof app.execute>[0]) => {
      entered = true;
      if (fail) throw new Error("secret command payload");
      return app.execute(request);
    },
    stop: () => app.stop(),
  };
  let id = 900;
  const sentAt = "2026-09-04T12:00:00.000Z";
  const base = transportFor(port1);
  const options = {
    transport: {
      ...base,
      subscribe: (listener: (message: unknown) => void) =>
        base.subscribe((message) => {
          listener(message);
          delivered();
        }),
    },
    canonicalProjectApplication,
    projectStorageApplication: createProjectStorageApplication(storage),
    workspaceApplication: createUnavailableWorkspaceApplication(),
    harnessVersion: "0.0.0",
    createId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
    now: () => sentAt,
  };
  const stop = startHarnessRuntime(options);
  const exchange = async (message: unknown): Promise<unknown> => {
    entered = false;
    const delivery = new Promise<void>((resolve) => {
      delivered = resolve;
    });
    const response = new Promise<unknown>((resolve) => port2.once("message", resolve));
    port2.postMessage(message);
    await delivery;
    await nextTurn();
    expect(entered).toBe(true);
    return response;
  };
  return {
    activate: () =>
      exchange(
        createProjectActivateCommand(
          { messageId: "00000000-0000-4000-8000-000000000101", sentAt },
          { projectId: createRequest.projectId },
        ),
      ),
    execute: () =>
      exchange(
        createProjectCommand(
          { messageId: "00000000-0000-4000-8000-000000000102", sentAt },
          CanonicalProjectCommandRequestSchema.parse({
            projectId: createRequest.projectId,
            activationId: "00000000-0000-4000-8000-000000000011",
            command: {
              commandId: "00000000-0000-4000-8000-000000000012",
              type: "fixture.noop",
              version: 1,
              payload: {},
            },
          }),
        ),
      ),
    fail: () => {
      fail = true;
    },
    envelope: (event: string, sequence: number, causationId: string, payload: unknown) => ({
      protocolVersion: 4,
      messageType: "event",
      messageId: `00000000-0000-4000-8000-${String(900 + sequence).padStart(12, "0")}`,
      sentAt,
      event,
      sequence,
      causationId,
      payload,
    }),
    stop: async () => {
      try {
        await stop();
      } finally {
        port1.close();
        port2.close();
      }
    },
  };
}

async function productionTransport() {
  const root = await createTemporaryApplicationRoot();
  const { port1, port2 } = new MessageChannel();
  const sent: unknown[] = [];
  let delivered = (): void => undefined;
  const base = transportFor(port1);
  const stop = startHarnessProcessRuntime({
    bootstrap: {
      kind: "harness.connect",
      applicationStorageRootUrl: pathToFileURL(root).href,
      migrationResourcesRootUrl: pathToFileURL(checkedInMigrationRoot).href,
    },
    transport: {
      send: (message) => {
        sent.push(message);
        base.send(message);
      },
      subscribe: (listener) =>
        base.subscribe((message) => {
          listener(message);
          delivered();
        }),
    },
  });
  const exchange = (message: unknown) => {
    const result = new Promise<unknown>((resolve) => port2.once("message", resolve));
    port2.postMessage(message);
    return result;
  };
  return {
    sent,
    exchange,
    delivery: () =>
      new Promise<void>((resolve) => {
        delivered = resolve;
      }),
    stop: async () => {
      try {
        await stop();
      } finally {
        port1.close();
        port2.close();
      }
    },
  };
}

const bootstrapInput = CanonicalProjectCommandRequestSchema.parse({
  projectId: createRequest.projectId,
  activationId: "00000000-0000-4000-8000-000000000011",
  command: {
    commandId: "00000000-0000-4000-8000-000000000012",
    type: "fixture.noop",
    version: 1,
    payload: {},
  },
});

it("composes exclusive activation through production bootstrap", async () => {
  const f = await productionTransport();
  const { exchange, sent } = f;
  const input = bootstrapInput;
  const metadata = {
    messageId: "00000000-0000-4000-8000-000000000102",
    sentAt: "2026-09-04T12:00:00.000Z",
  };
  try {
    const delivery = f.delivery();
    const initial = exchange(createProjectCommand(metadata, input));
    await delivery;
    await nextTurn();
    expect(sent).toHaveLength(1);
    expect(await initial).toMatchObject({
      event: "project.command.result",
      payload: { status: "inactive", diagnostic: { code: "PROJECT_INACTIVE" } },
    });
    expect(
      await exchange(
        createProjectCreateCommand(
          { ...metadata, messageId: "00000000-0000-4000-8000-000000000103" },
          createRequest,
        ),
      ),
    ).toMatchObject({ event: "project.create.result", payload: { status: "created" } });
    expect(await exchange(createProjectCommand(metadata, input))).toMatchObject({
      event: "project.command.result",
      payload: { status: "inactive" },
    });
    const activated = await exchange(
      createProjectActivateCommand(
        { ...metadata, messageId: "00000000-0000-4000-8000-000000000101" },
        { projectId: createRequest.projectId },
      ),
    );
    expect(activated).toMatchObject({
      event: "project.activate.result",
      payload: {
        status: "active",
        access: "read-write",
        writerGeneration: 1,
        request: { projectId: createRequest.projectId },
      },
    });
    const parsed = parseHarnessMessage(activated);
    if (!parsed.ok || parsed.value.event !== "project.activate.result")
      throw new Error("Activation envelope invalid.");
    if (parsed.value.payload.status !== "active")
      throw new Error("Activation did not become active.");
    expect(
      await exchange(
        createProjectCommand(metadata, {
          ...input,
          activationId: parsed.value.payload.activationId,
        }),
      ),
    ).toMatchObject({
      event: "project.command.result",
      payload: {
        status: "settlement-unavailable",
        diagnostic: { code: "COMMAND_SETTLEMENT_UNAVAILABLE" },
      },
    });
  } finally {
    await f.stop();
  }
});
