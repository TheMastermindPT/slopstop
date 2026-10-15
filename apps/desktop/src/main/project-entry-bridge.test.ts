import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  CanonicalProjectActivationRequestSchema,
  CanonicalProjectActivationResultSchema,
  CanonicalProjectSwitchRequestSchema,
  createProjectActivateResultEvent,
  createProjectConversationReadResultEvent,
  createProjectConversationSaveResultEvent,
  createProjectListResultEvent,
  createProjectUpgradeResultEvent,
  createRequestFailureEvent,
  type DesktopMessage,
  decodeStrict,
  type HarnessFailureCode,
  harnessFailureMessages,
  ProjectConversationReadRequestSchema,
  ProjectConversationReadResultSchema,
  ProjectConversationSaveRequestSchema,
  ProjectConversationSaveResultSchema,
  ProjectUpgradeRequestSchema,
  type ProjectUpgradeResult,
  ProjectUpgradeResultSchema,
  projectConversationDiagnostics,
  projectUpgradeDiagnostics,
} from "@slopstop/protocol";
import { expect, it } from "vitest";
import { upgradeResultForRow } from "../shared/upgrade-result-fixtures.js";
import { HarnessSession } from "./harness-session.js";
import {
  readConversationFailure,
  saveConversationFailure,
} from "./project-conversation-failure.js";
import { createProjectEntryBridge } from "./project-entry-bridge.js";
import { projectUpgradeFailure } from "./project-upgrade-failure.js";

const now = () => "2026-10-03T12:00:00.000Z";

class Port extends EventEmitter {
  sent: DesktopMessage[] = [];
  postFails = false;
  start() {}
  close() {}
  postMessage(message: DesktopMessage) {
    if (this.postFails) throw new Error("Port closed");
    this.sent.push(message);
  }
  metadata() {
    const command = this.sent.at(-1);
    if (command === undefined) throw new Error("No pending command");
    return { messageId: randomUUID(), sentAt: now(), sequence: 1, causationId: command.messageId };
  }
  failLast(code: HarnessFailureCode, message: string) {
    this.emit("message", {
      data: createRequestFailureEvent(this.metadata(), { code, message, retryable: true }),
    });
  }
}

function setup(createId: () => string = randomUUID) {
  const session = new HarnessSession();
  const port = new Port();
  session.attach(port);
  const bridge = createProjectEntryBridge({ session, createId, now });
  return { session, port, bridge };
}

it("returns a real list response and does not confuse disconnect with an empty installation", async () => {
  const { session, port, bridge } = setup();
  const listed = bridge.list();
  port.emit("message", {
    data: createProjectListResultEvent(port.metadata(), {
      status: "listed",
      projects: [],
      hiddenCount: 0,
    }),
  });
  expect(await listed).toEqual({ status: "listed", projects: [], hiddenCount: 0 });
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

const upgradeRequest = decodeStrict(ProjectUpgradeRequestSchema, { projectId: randomUUID() });
const otherRequest = decodeStrict(ProjectUpgradeRequestSchema, { projectId: randomUUID() });
const rows = projectUpgradeDiagnostics;
const protocolInvalid = {
  status: "broken",
  request: upgradeRequest,
  diagnostic: rows.protocolMessageInvalid,
};
const connectionLost = {
  status: "unavailable",
  request: upgradeRequest,
  diagnostic: rows.connectionLost,
};
const notRequired = { status: "not-required", request: upgradeRequest } as const;

const echoedResults: ReadonlyArray<readonly [string, ProjectUpgradeResult]> = [
  [
    "upgraded",
    decodeStrict(ProjectUpgradeResultSchema, {
      status: "upgraded",
      request: upgradeRequest,
      sourceGenerationId: randomUUID(),
      generationId: randomUUID(),
      upgradeId: randomUUID(),
    }),
  ],
  ["not-required", notRequired],
  ["not-registered", { status: "not-registered", request: upgradeRequest }],
  ...Object.entries(rows).map(
    ([key, row]) => [key, upgradeResultForRow(upgradeRequest, row)] as const,
  ),
];

it.for(echoedResults)(
  "answers every upgrade reply with one strict result: echoes %s",
  async ([, result]) => {
    const { port, bridge } = setup();
    const answer = bridge.upgrade(upgradeRequest);
    expect(port.sent).toEqual([
      expect.objectContaining({ command: "project.upgrade", payload: upgradeRequest }),
    ]);
    port.emit("message", { data: createProjectUpgradeResultEvent(port.metadata(), result) });
    expect(await answer).toEqual(result);
    bridge.stop();
  },
);

type Fixture = ReturnType<typeof setup>;
type UpgradeFault = readonly [string, object, (fixture: Fixture) => Promise<ProjectUpgradeResult>];

const faults: ReadonlyArray<UpgradeFault> = [
  [
    "a reply for another Project",
    protocolInvalid,
    ({ port, bridge }) => {
      const answer = bridge.upgrade(upgradeRequest);
      port.emit("message", {
        data: createProjectUpgradeResultEvent(port.metadata(), {
          status: "not-required",
          request: otherRequest,
        }),
      });
      return answer;
    },
  ],
  [
    "an activation result for the upgrade",
    protocolInvalid,
    ({ port, bridge }) => {
      const answer = bridge.upgrade(upgradeRequest);
      port.emit("message", {
        data: createProjectActivateResultEvent(port.metadata(), {
          status: "not-registered",
          request: upgradeRequest,
        }),
      });
      return answer;
    },
  ],
  [
    "a session protocol error",
    protocolInvalid,
    ({ port, bridge }) => {
      const answer = bridge.upgrade(upgradeRequest);
      port.emit("message", { data: { event: "project.upgrade.result", payload: [] } });
      return answer;
    },
  ],
  [
    "a lost connection while pending",
    connectionLost,
    ({ session, bridge }) => {
      const answer = bridge.upgrade(upgradeRequest);
      session.detach();
      return answer;
    },
  ],
  [
    "a call after the connection was lost",
    connectionLost,
    ({ session, bridge }) => {
      session.detach();
      return bridge.upgrade(upgradeRequest);
    },
  ],
  [
    "a send that fails",
    connectionLost,
    ({ port, bridge }) => {
      port.postFails = true;
      return bridge.upgrade(upgradeRequest);
    },
  ],
  [
    "a stop while pending",
    connectionLost,
    ({ bridge }) => {
      const answer = bridge.upgrade(upgradeRequest);
      bridge.stop();
      return answer;
    },
  ],
  [
    "a call after stop",
    connectionLost,
    ({ bridge }) => {
      bridge.stop();
      return bridge.upgrade(upgradeRequest);
    },
  ],
];

it.for(faults)(
  "answers every upgrade reply with one strict result: %s",
  async ([, expected, act]) => {
    const fixture = setup();
    expect(await act(fixture)).toEqual(expected);
    fixture.bridge.stop();
  },
);

it("answers every upgrade reply with one strict result: an invalid message id", async () => {
  const { port, bridge } = setup(() => "not-a-uuid");
  expect(await bridge.upgrade(upgradeRequest)).toEqual(protocolInvalid);
  expect(port.sent).toEqual([]);
  bridge.stop();
});

it("answers every upgrade reply with one strict result: a repeated message id", async () => {
  const id = randomUUID();
  const { port, bridge } = setup(() => id);
  const first = bridge.upgrade(upgradeRequest);
  expect(await bridge.upgrade(upgradeRequest)).toEqual(protocolInvalid);
  expect(port.sent).toHaveLength(1);
  port.emit("message", { data: createProjectUpgradeResultEvent(port.metadata(), notRequired) });
  expect(await first).toEqual(notRequired);
  bridge.stop();
});

const harnessRows: ReadonlyArray<readonly [HarnessFailureCode, object]> = [
  ["HARNESS_INTERNAL_FAILURE", rows.harnessInternalFailure],
  ["PROTOCOL_MESSAGE_INVALID", rows.protocolMessageInvalid],
  ["PROTOCOL_VERSION_UNSUPPORTED", rows.protocolVersionUnsupported],
];

it.for(harnessRows)(
  "answers every upgrade reply with one strict result: request.failure %s",
  async ([code, row]) => {
    const { port, bridge } = setup();
    const answer = bridge.upgrade(upgradeRequest);
    port.failLast(code, `Not the protocol message: ${harnessFailureMessages[code]}`);
    expect(await answer).toEqual({ status: "broken", request: upgradeRequest, diagnostic: row });
    bridge.stop();
  },
);

it("answers every upgrade reply with one strict result: an invalid command at send", () => {
  expect(
    projectUpgradeFailure(upgradeRequest, {
      kind: "send",
      code: "HARNESS_SESSION_MESSAGE_INVALID",
    }),
  ).toEqual(protocolInvalid);
});

const projectConnectionUnavailable = {
  code: "PROJECT_COORDINATOR_UNAVAILABLE",
  message: "The Project connection is unavailable.",
} as const;

const legacyFaults: ReadonlyArray<readonly [string, (port: Port) => void]> = [
  [
    "request.failure",
    (port) => port.failLast("HARNESS_INTERNAL_FAILURE", "Harness failed while handling a message."),
  ],
  ["a session protocol error", (port) => port.emit("message", { data: { event: "nope" } })],
  [
    "a wrong-event reply",
    (port) =>
      port.emit("message", {
        data: createProjectUpgradeResultEvent(port.metadata(), notRequired),
      }),
  ],
];

it.for(legacyFaults)("keeps the activation result unchanged on %s", async ([, fault]) => {
  const { port, bridge } = setup();
  const request = { projectId: upgradeRequest.projectId };
  const activated = bridge.activate(request);
  fault(port);
  expect(await activated).toEqual({
    status: "unavailable",
    request,
    diagnostic: { ...projectConnectionUnavailable, retryable: true },
  });
  bridge.stop();
});

it.for(legacyFaults)("keeps the switch result unchanged on %s", async ([, fault]) => {
  const { port, bridge } = setup();
  const request = decodeStrict(CanonicalProjectSwitchRequestSchema, {
    from: { projectId: randomUUID(), activationId: randomUUID() },
    to: { projectId: upgradeRequest.projectId },
  });
  const switched = bridge.switchProject(request);
  fault(port);
  expect(await switched).toEqual({
    status: "coordinator-unavailable",
    request,
    diagnostic: { ...projectConnectionUnavailable, retryable: false },
  });
  bridge.stop();
});

it("keeps list and registration transport results unchanged on request.failure", async () => {
  const { port, bridge } = setup();
  const listed = bridge.list();
  port.failLast("HARNESS_INTERNAL_FAILURE", "Harness failed while handling a message.");
  expect(await listed).toEqual({ status: "broken", code: "PROJECT_LIST_TRANSPORT_FAILED" });
  const registered = bridge.register({ step: "select-repository", directory: "C:/repo" });
  port.failLast("HARNESS_INTERNAL_FAILURE", "Harness failed while handling a message.");
  expect(await registered).toEqual({
    status: "broken",
    code: "PROJECT_REGISTRATION_TRANSPORT_FAILED",
  });
  bridge.stop();
});

const conversationRows = projectConversationDiagnostics;
const activation = { projectId: randomUUID(), activationId: randomUUID() };
const readRequest = decodeStrict(ProjectConversationReadRequestSchema, {
  ...activation,
  after: null,
});
const saveRequest = decodeStrict(ProjectConversationSaveRequestSchema, {
  ...activation,
  saveId: randomUUID(),
  expectedRevision: 0,
  text: "Hello",
});

/** Every shared failure a read or a save can answer, as a (status, row) pair. */
const sharedRows = [
  ["inactive", conversationRows.inactive],
  ["project-mismatch", conversationRows.projectMismatch],
  ["stale-activation", conversationRows.staleActivation],
  ["coordinator-unavailable", conversationRows.coordinatorUnavailable],
  ["unavailable", conversationRows.storageUnavailable],
  ["unavailable", conversationRows.connectionLost],
  ["broken", conversationRows.storageBroken],
  ["broken", conversationRows.harnessInternalFailure],
  ["broken", conversationRows.protocolMessageInvalid],
  ["broken", conversationRows.protocolVersionUnsupported],
] as const;
const saveOnlyRows = [
  ["rejected", conversationRows.saveIdReused],
  ["uncertain", conversationRows.saveUnconfirmed],
  ["read-only", conversationRows.readOnly],
  ["writer-unavailable", conversationRows.writerUnavailable],
  ["stale-writer", conversationRows.staleWriter],
] as const;

const savedMessage = {
  conversationMessageId: randomUUID(),
  cursor: 1,
  author: "user",
  text: "Hello",
  savedAt: now(),
} as const;
const readResults = [
  decodeStrict(ProjectConversationReadResultSchema, {
    status: "read",
    request: readRequest,
    conversation: null,
  }),
  decodeStrict(ProjectConversationReadResultSchema, {
    status: "read",
    request: readRequest,
    conversation: {
      conversationId: randomUUID(),
      branchId: randomUUID(),
      revision: 1,
      messages: [savedMessage],
      nextCursor: null,
    },
  }),
  ...sharedRows.map(([status, diagnostic]) =>
    decodeStrict(ProjectConversationReadResultSchema, { status, request: readRequest, diagnostic }),
  ),
];
const saveResults = [
  decodeStrict(ProjectConversationSaveResultSchema, {
    status: "saved",
    request: saveRequest,
    conversationMessageId: randomUUID(),
    cursor: 1,
    revision: 1,
    savedAt: now(),
    replayed: false,
  }),
  decodeStrict(ProjectConversationSaveResultSchema, {
    status: "conflict",
    request: saveRequest,
    currentRevision: 3,
  }),
  ...[...saveOnlyRows, ...sharedRows].map(([status, diagnostic]) =>
    decodeStrict(ProjectConversationSaveResultSchema, { status, request: saveRequest, diagnostic }),
  ),
];

it.for(readResults.map((result) => [result.status, result] as const))(
  "passes a %s read result through unchanged",
  async ([, result]) => {
    const { port, bridge } = setup();
    const answer = bridge.readConversation(readRequest);
    expect(port.sent).toEqual([
      expect.objectContaining({ command: "project.conversation.read", payload: readRequest }),
    ]);
    port.emit("message", {
      data: createProjectConversationReadResultEvent(port.metadata(), result),
    });
    expect(await answer).toEqual(result);
    bridge.stop();
  },
);

it.for(saveResults.map((result) => [result.status, result] as const))(
  "passes a %s save result through unchanged",
  async ([, result]) => {
    const { port, bridge } = setup();
    const answer = bridge.saveConversationMessage(saveRequest);
    expect(port.sent).toEqual([
      expect.objectContaining({ command: "project.conversation.save", payload: saveRequest }),
    ]);
    port.emit("message", {
      data: createProjectConversationSaveResultEvent(port.metadata(), result),
    });
    expect(await answer).toEqual(result);
    bridge.stop();
  },
);

type Operation = "read" | "save";
type ConversationCall = (fixture: Fixture) => Promise<unknown>;
const conversationCalls: Readonly<Record<Operation, ConversationCall>> = {
  read: ({ bridge }) => bridge.readConversation(readRequest),
  save: ({ bridge }) => bridge.saveConversationMessage(saveRequest),
};
const conversationRequests = { read: readRequest, save: saveRequest } as const;
const operations = ["read", "save"] as const;

/** A decodable reply for the right command, but echoing another activation. */
function foreignReply(fixture: Fixture, operation: Operation) {
  const activationId = randomUUID();
  return operation === "read"
    ? createProjectConversationReadResultEvent(fixture.port.metadata(), {
        status: "read",
        request: decodeStrict(ProjectConversationReadRequestSchema, {
          ...readRequest,
          activationId,
        }),
        conversation: null,
      })
    : createProjectConversationSaveResultEvent(fixture.port.metadata(), {
        status: "conflict",
        request: decodeStrict(ProjectConversationSaveRequestSchema, {
          ...saveRequest,
          activationId,
        }),
        currentRevision: 0,
      });
}

/** One fault, acted on a fixture around the operation's call. */
type ConversationFault = readonly [
  string,
  Readonly<Record<Operation, object>>,
  (fixture: Fixture, operation: Operation) => Promise<unknown>,
];
const lost = { status: "unavailable", diagnostic: conversationRows.connectionLost };
const invalid = { status: "broken", diagnostic: conversationRows.protocolMessageInvalid };
const unconfirmed = { status: "uncertain", diagnostic: conversationRows.saveUnconfirmed };

const conversationFaults: ReadonlyArray<ConversationFault> = [
  [
    "a reply with the wrong event",
    { read: invalid, save: invalid },
    (fixture, operation) => {
      const answer = conversationCalls[operation](fixture);
      fixture.port.emit("message", {
        data: createProjectUpgradeResultEvent(fixture.port.metadata(), notRequired),
      });
      return answer;
    },
  ],
  [
    "a reply for another activation",
    { read: invalid, save: invalid },
    (fixture, operation) => {
      const answer = conversationCalls[operation](fixture);
      fixture.port.emit("message", { data: foreignReply(fixture, operation) });
      return answer;
    },
  ],
  [
    "a malformed reply while pending",
    { read: invalid, save: unconfirmed },
    (fixture, operation) => {
      const answer = conversationCalls[operation](fixture);
      fixture.port.emit("message", { data: { event: "project.conversation.read.result" } });
      return answer;
    },
  ],
  [
    "a lost connection while pending",
    { read: lost, save: unconfirmed },
    (fixture, operation) => {
      const answer = conversationCalls[operation](fixture);
      fixture.session.detach();
      return answer;
    },
  ],
  [
    "a stop while pending",
    { read: lost, save: unconfirmed },
    (fixture, operation) => {
      const answer = conversationCalls[operation](fixture);
      fixture.bridge.stop();
      return answer;
    },
  ],
  [
    "a call after stop",
    { read: lost, save: lost },
    (fixture, operation) => {
      fixture.bridge.stop();
      return conversationCalls[operation](fixture);
    },
  ],
  [
    "a call after the connection was lost",
    { read: lost, save: lost },
    (fixture, operation) => {
      fixture.session.detach();
      return conversationCalls[operation](fixture);
    },
  ],
  [
    "a send that fails",
    { read: lost, save: lost },
    (fixture, operation) => {
      fixture.port.postFails = true;
      return conversationCalls[operation](fixture);
    },
  ],
];

it.for(
  conversationFaults.flatMap(([label, expected, act]) =>
    operations.map((operation) => [operation, label, expected, act] as const),
  ),
)("answers a conversation %s with one strict result: %s", async ([operation, , expected, act]) => {
  const fixture = setup();
  expect(await act(fixture, operation)).toEqual({
    ...expected[operation],
    request: conversationRequests[operation],
  });
  fixture.bridge.stop();
});

it.for(
  harnessRows.flatMap(([code, row]) =>
    operations.map((operation) => [operation, code, row] as const),
  ),
)("answers a conversation %s request.failure %s as broken", async ([operation, code, row]) => {
  const fixture = setup();
  const answer = conversationCalls[operation](fixture);
  fixture.port.failLast(code, `Not the protocol message: ${harnessFailureMessages[code]}`);
  expect(await answer).toEqual({
    status: "broken",
    request: conversationRequests[operation],
    diagnostic: row,
  });
  fixture.bridge.stop();
});

it.for(operations)(
  "answers a conversation %s with an invalid or a repeated message id as broken",
  async (operation) => {
    const expected = { ...invalid, request: conversationRequests[operation] };
    const invalidId = setup(() => "not-a-uuid");
    expect(await conversationCalls[operation](invalidId)).toEqual(expected);
    invalidId.bridge.stop();
    const id = randomUUID();
    const repeated = setup(() => id);
    void conversationCalls[operation](repeated);
    expect(await conversationCalls[operation](repeated)).toEqual(expected);
    repeated.bridge.stop();
  },
);

it("maps a send refused as an invalid message to broken for both operations", () => {
  const fault = { kind: "send", code: "HARNESS_SESSION_MESSAGE_INVALID" } as const;
  expect(readConversationFailure(readRequest, fault)).toEqual({ ...invalid, request: readRequest });
  expect(saveConversationFailure(saveRequest, fault)).toEqual({ ...invalid, request: saveRequest });
});
