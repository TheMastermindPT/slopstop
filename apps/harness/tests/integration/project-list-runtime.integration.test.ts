import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MessageChannel } from "node:worker_threads";
import { protocolVersion } from "@slopstop/protocol";
import { expect, it } from "vitest";
import { startHarnessProcessRuntime } from "../../src/process-bootstrap.js";
import { silentHarnessLogger, transportFor } from "./project-storage-runtime-fixture.js";

it("dispatches a real saved Project list through the process protocol", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "opencode/pc-list-transport-"));
  const { port1, port2 } = new MessageChannel();
  const stop = startHarnessProcessRuntime({
    logger: silentHarnessLogger,
    bootstrap: {
      kind: "harness.connect",
      applicationStorageRootUrl: pathToFileURL(root).href,
      migrationResourcesRootUrl: pathToFileURL(path.resolve(import.meta.dirname, "../../drizzle"))
        .href,
    },
    transport: transportFor(port1),
  });
  try {
    const response = new Promise<unknown>((resolve) => port2.once("message", resolve));
    const messageId = randomUUID();
    port2.postMessage({
      protocolVersion,
      messageType: "command",
      messageId,
      sentAt: new Date().toISOString(),
      command: "project.list",
      payload: {},
    });
    expect(await response).toMatchObject({
      event: "project.list.result",
      causationId: messageId,
      payload: { status: "listed", projects: [] },
    });
  } finally {
    await stop();
    port1.close();
    port2.close();
    await rm(root, { recursive: true, force: true });
  }
});
