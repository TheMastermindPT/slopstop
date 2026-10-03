import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  CanonicalProjectActivationRequestSchema,
  CanonicalProjectActivationResultSchema,
  createProjectActivateResultEvent,
  createProjectListResultEvent,
  type DesktopMessage,
  decodeStrict,
} from "@slopstop/protocol";
import { expect, it } from "vitest";
import { HarnessSession } from "./harness-session.js";
import { createProjectEntryBridge } from "./project-entry-bridge.js";

const now = () => "2026-10-03T12:00:00.000Z";

class Port extends EventEmitter {
  sent: DesktopMessage[] = [];
  start() {}
  close() {}
  postMessage(message: DesktopMessage) {
    this.sent.push(message);
  }
  metadata() {
    const command = this.sent.at(-1);
    if (command === undefined) throw new Error("No pending command");
    return { messageId: randomUUID(), sentAt: now(), sequence: 1, causationId: command.messageId };
  }
}

function setup() {
  const session = new HarnessSession();
  const port = new Port();
  session.attach(port);
  const bridge = createProjectEntryBridge({ session, createId: randomUUID, now });
  return { session, port, bridge };
}

it("returns a real list response and does not confuse disconnect with an empty installation", async () => {
  const { session, port, bridge } = setup();
  const listed = bridge.list();
  port.emit("message", {
    data: createProjectListResultEvent(port.metadata(), { status: "listed", projects: [] }),
  });
  expect(await listed).toEqual({ status: "listed", projects: [] });
  const pending = bridge.list();
  session.detach();
  expect(await pending).toEqual({ status: "broken", code: "PROJECT_LIST_TRANSPORT_FAILED" });
  bridge.stop();
});

it("rejects activation replies for a different Project even with a matching message correlation", async () => {
  const { port, bridge } = setup();
  const request = decodeStrict(CanonicalProjectActivationRequestSchema, {
    projectId: randomUUID(),
  });
  const result = bridge.activate(request);
  port.emit("message", {
    data: createProjectActivateResultEvent(
      port.metadata(),
      decodeStrict(CanonicalProjectActivationResultSchema, {
        status: "not-registered",
        request: { projectId: randomUUID() },
      }),
    ),
  });
  expect(await result).toMatchObject({ status: "unavailable", request });
  bridge.stop();
});

it("settles pending work on malformed input and rejects calls after stop", async () => {
  const { port, bridge } = setup();
  const pending = bridge.list();
  port.emit("message", { data: { event: "project.list.result", payload: [] } });
  expect(await pending).toMatchObject({ status: "broken" });
  bridge.stop();
  expect(await bridge.list()).toMatchObject({ status: "broken" });
});
