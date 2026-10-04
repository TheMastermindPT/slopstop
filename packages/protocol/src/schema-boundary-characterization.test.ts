import { describe, expect, it } from "vitest";
import {
  acceptsStrict,
  CanonicalCommandReceiptSchema,
  CanonicalJsonValueSchema,
  CanonicalProjectSwitchRequestSchema,
  CanonicalProjectSwitchResultSchema,
  CanonicalSettlementTimeSchema,
  CommandRejectionSchema,
  decodeStrict,
  HarnessBootstrapSchema,
  MessageIdSchema,
  ProjectIdSchema,
  ProjectListRequestSchema,
  parseDesktopMessage,
  TypedCommandSchema,
} from "./index.js";

// Characterizes accept/reject behavior that must survive the schema-library migration.
// Written and passed against the Zod schemas first; now exercised through strict decoding.
const accepts = acceptsStrict;
const decoded = decodeStrict;

const projectId = "018f47a3-4e3d-7d2b-9c41-7df4605c0a11";
const activationId = "018f47a3-4e3d-7d2b-9c41-7df4605c0a12";

describe("schema boundary characterization", () => {
  it("accepts only UTC settlement instants with seconds", () => {
    for (const value of [
      "2026-10-03T12:00:00Z",
      "2026-10-03T12:00:00.123456Z",
      "2024-02-29T00:00:00Z",
    ]) {
      expect(accepts(CanonicalSettlementTimeSchema, value), value).toBe(true);
    }
    for (const value of [
      "2026-10-03T12:00Z",
      "2026-10-03T12:00:00+01:00",
      "2023-02-29T00:00:00Z",
      "2026-10-03T12:00:00z",
      "2026-10-03 12:00:00Z",
      "2026-10-03T24:00:00Z",
    ]) {
      expect(accepts(CanonicalSettlementTimeSchema, value), value).toBe(false);
    }
  });

  it("accepts message timestamps with offsets and without seconds", () => {
    const handshake = (sentAt: string) => ({
      protocolVersion: 5,
      messageType: "command",
      messageId: "00000000-0000-4000-8000-000000000001",
      sentAt,
      command: "system.handshake",
      payload: { desktopVersion: "1.0.0" },
    });
    for (const sentAt of [
      "2026-10-03T12:00Z",
      "2026-10-03T12:00:00.5+05:30",
      "2026-10-03T12:00:00-00:00",
    ]) {
      expect(parseDesktopMessage(handshake(sentAt)).ok, sentAt).toBe(true);
    }
    for (const sentAt of ["2026-10-03T12:00:00+24:00", "2026-10-03T12:00:00", "2026-10-03"]) {
      expect(parseDesktopMessage(handshake(sentAt)).ok, sentAt).toBe(false);
    }
  });

  it("keeps domain identities lowercase and message identities broad", () => {
    expect(accepts(ProjectIdSchema, projectId)).toBe(true);
    expect(accepts(ProjectIdSchema, projectId.toUpperCase())).toBe(false);
    expect(accepts(ProjectIdSchema, "00000000-0000-0000-0000-000000000000")).toBe(false);
    expect(accepts(MessageIdSchema, "00000000-0000-0000-0000-000000000000")).toBe(true);
    expect(accepts(MessageIdSchema, "ffffffff-ffff-ffff-ffff-ffffffffffff")).toBe(true);
    expect(accepts(MessageIdSchema, "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF")).toBe(false);
    expect(accepts(MessageIdSchema, "018F47A3-4E3D-7D2B-9C41-7DF4605C0A11")).toBe(true);
    expect(accepts(MessageIdSchema, "018f47a3-4e3d-0d2b-9c41-7df4605c0a11")).toBe(false);
  });

  it("treats an optional member as absent or undefined but never null", () => {
    const base = {
      status: "target-result",
      request: { from: { projectId, activationId }, to: { projectId } },
      target: { status: "not-registered", request: { projectId } },
    };
    expect(accepts(CanonicalProjectSwitchResultSchema, base)).toBe(true);
    expect(
      accepts(CanonicalProjectSwitchResultSchema, { ...base, sourceReleased: undefined }),
    ).toBe(true);
    expect(accepts(CanonicalProjectSwitchResultSchema, { ...base, sourceReleased: true })).toBe(
      true,
    );
    expect(accepts(CanonicalProjectSwitchResultSchema, { ...base, sourceReleased: null })).toBe(
      false,
    );
  });

  it("rejects unknown keys at every nesting level", () => {
    const request = { from: { projectId, activationId }, to: { projectId } };
    expect(accepts(CanonicalProjectSwitchRequestSchema, request)).toBe(true);
    expect(accepts(CanonicalProjectSwitchRequestSchema, { ...request, extra: 1 })).toBe(false);
    expect(
      accepts(CanonicalProjectSwitchRequestSchema, {
        ...request,
        from: { ...request.from, extra: 1 },
      }),
    ).toBe(false);
  });

  it("accepts only a memberless object as the project list request", () => {
    expect(accepts(ProjectListRequestSchema, {})).toBe(true);
    for (const value of [{ a: 1 }, [], "x", null, undefined]) {
      expect(accepts(ProjectListRequestSchema, value)).toBe(false);
    }
    // Structured-clone survivors without own enumerable string keys pass, as they did before.
    for (const value of [Object.create(null), new Date(0), new Map(), new (class {})()]) {
      expect(accepts(ProjectListRequestSchema, value)).toBe(true);
    }
    expect(
      accepts(
        ProjectListRequestSchema,
        new (class {
          x = 1;
        })(),
      ),
    ).toBe(false);
  });

  it("shallow-freezes receipts, their event lists, and rejections", () => {
    const metadata = {
      receiptId: "018f47a3-4e3d-7d2b-9c41-7df4605c0a21",
      projectId,
      commandId: "018f47a3-4e3d-7d2b-9c41-7df4605c0a13",
      commandType: "counter.increment",
      commandVersion: 1,
      projectSequence: 1,
      writerGeneration: 1,
      settledAt: "2026-10-03T12:00:00Z",
    };
    const applied = decoded(CanonicalCommandReceiptSchema, {
      ...metadata,
      outcome: "applied",
      events: [{ eventId: "018f47a3-4e3d-7d2b-9c41-7df4605c0a31", eventOrdinal: 0 }],
    });
    expect(Object.isFrozen(applied)).toBe(true);
    expect(Object.isFrozen(applied.events)).toBe(true);
    expect(applied.events.every(Object.isFrozen)).toBe(true);
    const rejected = decoded(CanonicalCommandReceiptSchema, {
      ...metadata,
      outcome: "rejected",
      events: [],
      rejection: { code: "DOMAIN_RULE", retryable: false },
    });
    expect(Object.isFrozen(rejected.events)).toBe(true);
    expect(rejected.outcome === "rejected" && Object.isFrozen(rejected.rejection)).toBe(true);
    const request = decoded(CanonicalProjectSwitchRequestSchema, {
      from: { projectId, activationId },
      to: { projectId },
    });
    expect(Object.isFrozen(request)).toBe(false);
  });

  it("accepts only finite plain JSON data", () => {
    for (const value of [null, 1, "x", true, [1, [2]], { a: { b: [null] } }]) {
      expect(accepts(CanonicalJsonValueSchema, value)).toBe(true);
    }
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    for (const value of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      1n,
      undefined,
      new Date(0),
      cyclic,
      { a: undefined },
    ]) {
      expect(accepts(CanonicalJsonValueSchema, value)).toBe(false);
    }
  });

  it("trims typed command types and rejects blank ones", () => {
    const command = {
      commandId: "018f47a3-4e3d-7d2b-9c41-7df4605c0a13",
      type: "  counter.increment ",
      version: 1,
      payload: { by: 1 },
    };
    expect(decoded(TypedCommandSchema, command)).toEqual({ ...command, type: "counter.increment" });
    expect(accepts(TypedCommandSchema, { ...command, type: "   " })).toBe(false);
    expect(accepts(TypedCommandSchema, { ...command, version: 0 })).toBe(false);
    expect(accepts(TypedCommandSchema, { ...command, version: 1.5 })).toBe(false);
  });

  it("rejects retryable system command rejections", () => {
    expect(accepts(CommandRejectionSchema, { code: "DOMAIN_RULE", retryable: true })).toBe(true);
    expect(
      accepts(CommandRejectionSchema, { code: "IDEMPOTENCY_CONFLICT", retryable: false }),
    ).toBe(true);
    expect(accepts(CommandRejectionSchema, { code: "IDEMPOTENCY_CONFLICT", retryable: true })).toBe(
      false,
    );
    expect(accepts(CommandRejectionSchema, { code: "lower", retryable: false })).toBe(false);
  });

  it("accepts only plain local file roots in the harness bootstrap", () => {
    const bootstrap = (root: string) => ({
      kind: "harness.connect",
      applicationStorageRootUrl: root,
      migrationResourcesRootUrl: "file:///C:/resources",
    });
    expect(accepts(HarnessBootstrapSchema, bootstrap("file:///C:/Users/me/data"))).toBe(true);
    for (const root of [
      "file:///C:/a?b",
      "file:////server/share",
      "file:///C:/a%2fb",
      "file:///C:/a%zz",
      "file:///C:/a b",
      "http://example.com/",
    ]) {
      expect(accepts(HarnessBootstrapSchema, bootstrap(root)), root).toBe(false);
    }
  });
});
