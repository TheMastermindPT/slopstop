import {
  acceptsStrict,
  decodeStrict,
  ProjectIdSchema,
  TypedCommandSchema,
} from "@slopstop/protocol";
import { Schema, SchemaTransformation } from "effect";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import * as registryApi from "./canonical-command-registry.js";
import {
  type CanonicalCommandTransaction,
  createCanonicalCommandRegistry,
  defineCanonicalCommand,
} from "./canonical-command-registry.js";

const projectId = decodeStrict(ProjectIdSchema, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
const command = decodeStrict(TypedCommandSchema, {
  commandId: "44444444-4444-4444-8444-444444444501",
  type: "conformance.counter.set",
  version: 1,
  payload: { value: 7, meta: { b: 2, a: 1 }, tags: ["x", "y"] },
});

function isDecoder(value: unknown): value is Schema.Decoder<unknown> {
  return Schema.isSchema(value);
}

function publicSchema(name: string): Schema.Decoder<unknown> {
  const schema: unknown = Reflect.get(registryApi, name);
  expect(Schema.isSchema(schema), `Missing public schema: ${name}`).toBe(true);
  if (!isDecoder(schema)) throw new Error(`Missing public schema: ${name}`);
  return schema;
}

// Runs before payload decoding, like a Zod preprocess step.
function preprocessed<S extends Schema.Top>(preprocess: (value: unknown) => unknown, schema: S) {
  return Schema.Unknown.pipe(
    Schema.decodeTo(
      schema,
      SchemaTransformation.transform<S["Encoded"], unknown>({
        decode: (value) => preprocess(value) as S["Encoded"],
        encode: (value) => value,
      }),
    ),
  );
}

const event = {
  aggregateType: "conformance.counter",
  aggregateId: "55555555-5555-4555-8555-555555555501",
  aggregateVersion: 2,
  eventType: "conformance.counter.changed",
  eventVersion: 1,
  payload: { previous: 0, value: 7 },
};

describe("rejects nil and max aggregate identities in handler events and replay rows", () => {
  it.each([projectId, event.aggregateId])(
    "accepts valid G3 event aggregate %s unchanged",
    (aggregateId) => {
      const input = { ...event, aggregateId };
      expect(decodeStrict(publicSchema("CanonicalEventInputSchema"), input)).toEqual(input);
    },
  );

  it.each([
    "00000000-0000-0000-0000-000000000000",
    "ffffffff-ffff-ffff-ffff-ffffffffffff",
    "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAA1",
    "aaaaaaaa-aaaa-0aaa-8aaa-aaaaaaaaaaa1",
    "aaaaaaaa-aaaa-4aaa-7aaa-aaaaaaaaaaa1",
    "not-a-uuid",
  ])("rejects G3 event aggregate %s at the public schema", (aggregateId) => {
    expect(
      acceptsStrict(publicSchema("CanonicalEventInputSchema"), { ...event, aggregateId }),
    ).toBe(false);
  });

  it.each([
    ["aggregateType", ""],
    ["aggregateType", " \t"],
    ["eventType", ""],
    ["eventType", " \t"],
    ["aggregateVersion", 0],
    ["aggregateVersion", 0.5],
    ["aggregateVersion", 9007199254740992],
    ["eventVersion", 0],
    ["eventVersion", 0.5],
    ["eventVersion", 9007199254740992],
    ["payload", { value: NaN }],
    ["payload", undefined],
    ["privateDetails", "private"],
  ])("rejects malformed G3 event field %s = %s", (field, value) => {
    const input = { ...event };
    Reflect.set(input, field, value);
    expect(acceptsStrict(publicSchema("CanonicalEventInputSchema"), input)).toBe(false);
  });

  it("accepts safe-bound versions and preserves nonblank type whitespace", () => {
    const input = {
      ...event,
      aggregateVersion: Number.MAX_SAFE_INTEGER,
      eventVersion: Number.MAX_SAFE_INTEGER,
      aggregateType: " conformance.counter ",
      eventType: " conformance.counter.changed ",
    };
    expect(decodeStrict(publicSchema("CanonicalEventInputSchema"), input)).toEqual(input);
  });
});

describe("G3 public command decision schema", () => {
  it.each([
    {
      outcome: "applied",
      events: [
        event,
        { ...event, eventType: "conformance.counter.checked", payload: { value: 7 } },
      ],
    },
    { outcome: "applied", events: [] },
    { outcome: "unchanged" },
    { outcome: "rejected", rejection: { code: "TEST_COUNTER_REJECTED", retryable: false } },
    { outcome: "rejected", rejection: { code: "TEST_COUNTER_REJECTED", retryable: true } },
  ])("accepts the exact decision %j", (input) => {
    expect(decodeStrict(publicSchema("CanonicalCommandDecisionSchema"), input)).toEqual(input);
  });

  it.each([
    undefined,
    { outcome: "unknown" },
    { outcome: "applied" },
    {
      outcome: "applied",
      events: [],
      rejection: { code: "TEST_COUNTER_REJECTED", retryable: false },
    },
    { outcome: "unchanged", events: [] },
    { outcome: "unchanged", rejection: { code: "TEST_COUNTER_REJECTED", retryable: false } },
    { outcome: "rejected" },
    {
      outcome: "rejected",
      events: [],
      rejection: { code: "TEST_COUNTER_REJECTED", retryable: false },
    },
    {
      outcome: "applied",
      events: [{ ...event, aggregateId: "00000000-0000-0000-0000-000000000000" }],
    },
    { outcome: "applied", events: [{ ...event, eventVersion: 0 }] },
    { outcome: "applied", events: [{ ...event, payload: { value: Infinity } }] },
    { outcome: "unchanged", message: "private" },
  ])("rejects malformed or mixed decision %j", (input) => {
    expect(acceptsStrict(publicSchema("CanonicalCommandDecisionSchema"), input)).toBe(false);
  });

  it.each([
    { code: "", retryable: false },
    { code: "lowercase", retryable: false },
    { code: "X".repeat(65), retryable: false },
    { code: "TEST_COUNTER_REJECTED", retryable: 0 },
    { code: "TEST_COUNTER_REJECTED", retryable: false, message: "private" },
    { code: "TEST_COUNTER_REJECTED", retryable: false, details: { version: 1 } },
  ])("rejects unsafe rejection metadata %j", (rejection) => {
    expect(
      acceptsStrict(publicSchema("CanonicalCommandDecisionSchema"), {
        outcome: "rejected",
        rejection,
      }),
    ).toBe(false);
  });

  it.each(["IDEMPOTENCY_CONFLICT", "COMMAND_TYPE_UNSUPPORTED", "COMMAND_PAYLOAD_INVALID"])(
    "retains protocol retryability for %s; handler-origin exclusion belongs to settlement",
    (code) => {
      const input = { outcome: "rejected", rejection: { code, retryable: false } };
      const schema = publicSchema("CanonicalCommandDecisionSchema");
      expect(decodeStrict(schema, input)).toEqual(input);
      expect(acceptsStrict(schema, { ...input, rejection: { code, retryable: true } })).toBe(false);
    },
  );
});
const payloadSchema = Schema.Struct({
  value: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(10),
  ),
  meta: Schema.optional(Schema.Struct({ a: Schema.Number, b: Schema.Number })),
  tags: Schema.optional(Schema.Array(Schema.String)),
});
// This unused SQL port permits registry execution, not the G5 real-facade proof.
const transaction: CanonicalCommandTransaction = {
  execute: () => {
    throw new Error("Registry tests must not issue SQL.");
  },
};

describe("binds typed payload definitions and rejects duplicate registrations", () => {
  it("selects each exact version without calling handlers during preparation", async () => {
    const first = vi.fn(() => ({ outcome: "unchanged" as const }));
    const second = vi.fn(() => ({ outcome: "applied" as const, events: [] }));
    const registry = createCanonicalCommandRegistry([
      defineCanonicalCommand({ type: command.type, version: 1, payloadSchema, handle: first }),
      defineCanonicalCommand({ type: command.type, version: 2, payloadSchema, handle: second }),
    ]);
    const one = registry.prepare(command);
    const two = registry.prepare({ ...command, version: 2 });
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(one.status).toBe("ready");
    expect(two.status).toBe("ready");
    if (one.status !== "ready" || two.status !== "ready") throw new Error("Preparation failed.");
    expect(await one.run({ projectId, transaction })).toEqual({ outcome: "unchanged" });
    expect(await two.run({ projectId, transaction })).toEqual({ outcome: "applied", events: [] });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("delivers schema-transformed numeric output", async () => {
    const definition = defineCanonicalCommand({
      type: command.type,
      version: 1,
      payloadSchema: Schema.String.pipe(
        Schema.decodeTo(
          Schema.Number,
          SchemaTransformation.transform({ decode: Number, encode: String }),
        ),
      ),
      handle: ({ payload }) => {
        expectTypeOf(payload).toEqualTypeOf<number>();
        expect(payload).toBe(7);
        return { outcome: "unchanged" };
      },
    });
    const prepared = definition.prepare("7");
    expect(prepared.status).toBe("ready");
    if (prepared.status !== "ready") throw new Error("Preparation failed.");
    expect(await prepared.run({ projectId, transaction })).toEqual({ outcome: "unchanged" });
  });

  it.each([
    ["unknown type", { ...command, type: "conformance.counter.missing" }],
    ["unknown version", { ...command, version: 2 }],
  ])("rejects %s without parsing or running a handler", (_name, request) => {
    const parse = vi.fn((value: unknown) => value);
    const handle = vi.fn(() => ({ outcome: "unchanged" as const }));
    const registry = createCanonicalCommandRegistry([
      defineCanonicalCommand({
        type: command.type,
        version: 1,
        payloadSchema: preprocessed(parse, payloadSchema),
        handle,
      }),
    ]);
    expect(registry.prepare(request)).toEqual({
      status: "rejected",
      rejection: { code: "COMMAND_TYPE_UNSUPPORTED", retryable: false },
    });
    expect(parse).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
  });

  it("rejects schema-invalid payload without leaking parser details", () => {
    const handle = vi.fn(() => ({ outcome: "unchanged" as const }));
    const definition = defineCanonicalCommand({
      type: command.type,
      version: 1,
      payloadSchema,
      handle,
    });
    expect(definition.prepare({ value: "7" })).toEqual({
      status: "rejected",
      rejection: { code: "COMMAND_PAYLOAD_INVALID", retryable: false },
    });
    expect(
      createCanonicalCommandRegistry([definition]).prepare({ ...command, payload: { value: "7" } }),
    ).toEqual({
      status: "rejected",
      rejection: { code: "COMMAND_PAYLOAD_INVALID", retryable: false },
    });
    expect(handle).not.toHaveBeenCalled();
  });

  it("propagates a throwing refinement as the original unexpected error", () => {
    const error = new Error("private refinement failure");
    const handle = vi.fn(() => ({ outcome: "unchanged" as const }));
    const registry = createCanonicalCommandRegistry([
      defineCanonicalCommand({
        type: command.type,
        version: 1,
        payloadSchema: payloadSchema.check(
          Schema.makeFilter(() => {
            throw error;
          }),
        ),
        handle,
      }),
    ]);
    let caught: unknown;
    try {
      registry.prepare(command);
    } catch (failure) {
      caught = failure;
    }
    expect(caught).toBe(error);
    expect(handle).not.toHaveBeenCalled();
  });

  it("infers payload only from the schema and exposes only execute at typecheck", () => {
    defineCanonicalCommand({
      type: command.type,
      version: 1,
      payloadSchema: Schema.Number,
      handle: ({ payload, transaction: capability }) => {
        expectTypeOf(payload).toEqualTypeOf<number>();
        expectTypeOf(capability.execute).toEqualTypeOf<CanonicalCommandTransaction["execute"]>();
        // @ts-expect-error Numeric schema output is not a string.
        payload.toUpperCase();
        // @ts-expect-error Terminal operations are not handler capabilities.
        capability.commit();
        // @ts-expect-error Terminal operations are not handler capabilities.
        capability.rollback();
        // @ts-expect-error Terminal operations are not handler capabilities.
        capability.close();
        // @ts-expect-error The client is not a handler capability.
        capability.client;
        // @ts-expect-error The token is not a handler capability.
        capability.token;
        return { outcome: "unchanged" };
      },
    });
    defineCanonicalCommand({
      type: command.type,
      version: 2,
      payloadSchema: Schema.Number,
      // @ts-expect-error A callback cannot widen numeric schema inference to a string union.
      handle: ({ payload }: { payload: string }) => {
        payload.toUpperCase();
        return { outcome: "unchanged" };
      },
    });
    expectTypeOf<keyof CanonicalCommandTransaction>().toEqualTypeOf<"execute">();
  });

  it("rejects duplicate exact keys immediately without preparing or running", () => {
    const prepare = vi.fn(() => ({
      status: "rejected" as const,
      rejection: { code: "COMMAND_PAYLOAD_INVALID", retryable: false },
    }));
    expect(() =>
      createCanonicalCommandRegistry([
        { type: command.type, version: 1, prepare },
        { type: command.type, version: 2, prepare },
        { type: command.type, version: 1, prepare },
      ]),
    ).toThrow(new Error("Duplicate canonical command registration."));
    expect(prepare).not.toHaveBeenCalled();
  });

  describe.each([
    ["empty type", { type: "", version: 1 }],
    ["blank type", { type: "  ", version: 1 }],
    ["trim-changing type", { type: " conformance.counter.set ", version: 1 }],
    ["zero version", { type: command.type, version: 0 }],
    ["fractional version", { type: command.type, version: 0.5 }],
    ["unsafe version", { type: command.type, version: 9007199254740992 }],
  ])("construction: %s", (_name, key) => {
    it("rejects a definition before preparing its payload", () => {
      const handle = vi.fn(() => ({ outcome: "unchanged" as const }));
      expect(() => defineCanonicalCommand({ ...key, payloadSchema, handle })).toThrow();
      expect(handle).not.toHaveBeenCalled();
    });
    it("rejects a supplied registry entry before preparing its payload", () => {
      const prepare = vi.fn(() => ({
        status: "rejected" as const,
        rejection: { code: "COMMAND_PAYLOAD_INVALID", retryable: false },
      }));
      expect(() => createCanonicalCommandRegistry([{ ...key, prepare }])).toThrow();
      expect(prepare).not.toHaveBeenCalled();
    });
  });

  it("retains distinct type keys and the maximum safe version", async () => {
    const registry = createCanonicalCommandRegistry([
      defineCanonicalCommand({
        type: command.type,
        version: 1,
        payloadSchema,
        handle: () => ({ outcome: "unchanged" }),
      }),
      defineCanonicalCommand({
        type: "conformance.counter.other",
        version: Number.MAX_SAFE_INTEGER,
        payloadSchema,
        handle: () => ({ outcome: "applied", events: [] }),
      }),
    ]);
    const prepared = registry.prepare({
      ...command,
      type: "conformance.counter.other",
      version: Number.MAX_SAFE_INTEGER,
    });
    expect(prepared.status).toBe("ready");
    if (prepared.status !== "ready") throw new Error("Preparation failed.");
    expect(await prepared.run({ projectId, transaction })).toEqual({
      outcome: "applied",
      events: [],
    });
  });

  it.each(["payloadSchema", "handle"])(
    "binds the original %s rather than mutable definition input",
    async (field) => {
      const input = {
        type: command.type,
        version: 1,
        payloadSchema,
        handle: () => ({ outcome: "unchanged" as const }),
      };
      const definition = defineCanonicalCommand(input);
      Reflect.set(
        input,
        field,
        field === "payloadSchema" ? Schema.Never : () => ({ outcome: "applied", events: [] }),
      );
      const prepared = definition.prepare(command.payload);
      expect(prepared.status).toBe("ready");
      if (prepared.status !== "ready") throw new Error("Preparation failed.");
      expect(await prepared.run({ projectId, transaction })).toEqual({ outcome: "unchanged" });
    },
  );

  it("binds supplied prepare closures rather than mutable registry entries", () => {
    const original = {
      status: "rejected" as const,
      rejection: { code: "COMMAND_PAYLOAD_INVALID", retryable: false },
    };
    const definition = { type: command.type, version: 1, prepare: () => original };
    const definitions = [definition];
    const registry = createCanonicalCommandRegistry(definitions);
    Reflect.set(definition, "prepare", () => {
      throw new Error("Replacement must not run.");
    });
    definitions.splice(0);
    expect(registry.prepare(command)).toEqual(original);
  });

  it("does not let a schema transform mutate submitted payload meaning", async () => {
    const submitted = { ...command, payload: { value: 7, meta: { a: 1, b: 2 }, tags: ["x", "y"] } };
    const registry = createCanonicalCommandRegistry([
      defineCanonicalCommand({
        type: command.type,
        version: 1,
        payloadSchema: preprocessed((value) => {
          if (value !== null && typeof value === "object") Reflect.set(value, "value", 9);
          return value;
        }, payloadSchema),
        handle: ({ payload }) => {
          expect(payload).toEqual({ value: 9, meta: { a: 1, b: 2 }, tags: ["x", "y"] });
          return { outcome: "unchanged" };
        },
      }),
    ]);
    const prepared = registry.prepare(submitted);
    expect(submitted.payload).toEqual({ value: 7, meta: { a: 1, b: 2 }, tags: ["x", "y"] });
    expect(prepared.status).toBe("ready");
    if (prepared.status !== "ready") throw new Error("Preparation failed.");
    expect(await prepared.run({ projectId, transaction })).toEqual({ outcome: "unchanged" });
  });

  it("freezes public definition and registry objects", () => {
    const definition = defineCanonicalCommand({
      type: command.type,
      version: 1,
      payloadSchema,
      handle: () => ({ outcome: "unchanged" }),
    });
    const registry = createCanonicalCommandRegistry([definition]);
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Reflect.set(definition, "type", "replacement")).toBe(false);
    expect(Reflect.set(definition, "version", 2)).toBe(false);
    expect(Reflect.set(definition, "prepare", () => undefined)).toBe(false);
    expect(Reflect.set(registry, "prepare", () => undefined)).toBe(false);
  });

  it("keeps an explicitly empty registry unsupported", () => {
    expect(createCanonicalCommandRegistry([]).prepare(command)).toEqual({
      status: "rejected",
      rejection: { code: "COMMAND_TYPE_UNSUPPORTED", retryable: false },
    });
  });
});
