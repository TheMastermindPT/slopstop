import { isDomainIdentity } from "@slopstop/kernel";
import {
  type CanonicalJsonValue,
  CanonicalJsonValueSchema,
  type CommandRejection,
  CommandRejectionSchema,
  decodeStrict,
  decodeStrictResult,
  NonBlankTextSchema,
  type ProjectId,
  type TypedCommand,
  TypedCommandSchema,
} from "@slopstop/protocol";
import { Result, Schema } from "effect";
import {
  CanonicalStoredIdentitySchema,
  canonicalJsonText,
  parseCanonicalJson,
} from "./canonical-json.js";
import type { LocalLibsqlTransaction } from "./storage/local-libsql-worker-client.js";

export type CanonicalCommandTransaction = Readonly<Pick<LocalLibsqlTransaction, "execute">>;
export const CanonicalEventInputSchema = Schema.Struct({
  aggregateType: NonBlankTextSchema,
  aggregateId: CanonicalStoredIdentitySchema.check(Schema.makeFilter(isDomainIdentity)),
  aggregateVersion: TypedCommandSchema.fields.version,
  eventType: NonBlankTextSchema,
  eventVersion: TypedCommandSchema.fields.version,
  payload: CanonicalJsonValueSchema,
});
export type CanonicalEventInput = typeof CanonicalEventInputSchema.Type;
export const CanonicalCommandDecisionSchema = Schema.Union([
  Schema.Struct({
    outcome: Schema.Literal("applied"),
    events: Schema.Array(CanonicalEventInputSchema),
  }),
  Schema.Struct({ outcome: Schema.Literal("unchanged") }),
  Schema.Struct({ outcome: Schema.Literal("rejected"), rejection: CommandRejectionSchema }),
]);
export type CanonicalCommandDecision = typeof CanonicalCommandDecisionSchema.Type;

export type PreparedCanonicalCommand =
  | Readonly<{ status: "rejected"; rejection: CommandRejection }>
  | Readonly<{
      status: "ready";
      run(
        context: Readonly<{ projectId: ProjectId; transaction: CanonicalCommandTransaction }>,
      ): CanonicalCommandDecision | Promise<CanonicalCommandDecision>;
    }>;

export type RegisteredCanonicalCommand = Readonly<{
  type: string;
  version: number;
  prepare(payload: CanonicalJsonValue): PreparedCanonicalCommand;
}>;

const registrationKeySchema = Schema.Struct({
  type: TypedCommandSchema.fields.type,
  version: TypedCommandSchema.fields.version,
});

export function defineCanonicalCommand<Payload>(
  input: Readonly<{
    type: string;
    version: number;
    payloadSchema: Schema.Decoder<Payload>;
    handle: (
      context: Readonly<{
        projectId: ProjectId;
        payload: NoInfer<Payload>;
        transaction: CanonicalCommandTransaction;
      }>,
    ) => CanonicalCommandDecision | Promise<CanonicalCommandDecision>;
  }>,
): RegisteredCanonicalCommand {
  const { type, version } = decodeStrict(registrationKeySchema, {
    type: input.type,
    version: input.version,
  });
  if (type !== input.type) throw new Error("Command registration type is not canonical.");
  const { payloadSchema, handle } = input;
  return Object.freeze({
    type,
    version,
    prepare: (payload: CanonicalJsonValue): PreparedCanonicalCommand => {
      const parsed = decodeStrictResult(payloadSchema, payload);
      if (Result.isFailure(parsed)) {
        return {
          status: "rejected",
          rejection: { code: "COMMAND_PAYLOAD_INVALID", retryable: false },
        };
      }
      const decoded = parsed.success;
      return { status: "ready", run: (context) => handle({ ...context, payload: decoded }) };
    },
  });
}

export interface CanonicalCommandRegistry {
  prepare(command: TypedCommand): PreparedCanonicalCommand;
}

export function createCanonicalCommandRegistry(
  definitions: readonly RegisteredCanonicalCommand[],
): CanonicalCommandRegistry {
  const types = new Map<string, Map<number, RegisteredCanonicalCommand["prepare"]>>();
  for (const definition of definitions) {
    const { type, version } = decodeStrict(registrationKeySchema, {
      type: definition.type,
      version: definition.version,
    });
    if (type !== definition.type) throw new Error("Command registration type is not canonical.");
    let versions = types.get(type);
    if (versions === undefined) {
      versions = new Map();
      types.set(type, versions);
    }
    if (versions.has(version)) throw new Error("Duplicate canonical command registration.");
    versions.set(version, definition.prepare);
  }
  return Object.freeze({
    prepare: (command: TypedCommand): PreparedCanonicalCommand => {
      const prepare = types.get(command.type)?.get(command.version);
      if (prepare === undefined) {
        return {
          status: "rejected",
          rejection: { code: "COMMAND_TYPE_UNSUPPORTED", retryable: false },
        };
      }
      // Schema transforms may mutate input, but never the submitted snapshot.
      return prepare(parseCanonicalJson(canonicalJsonText(command.payload)));
    },
  });
}
