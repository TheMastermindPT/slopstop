import { isDomainIdentity } from "@slopstop/kernel";
import {
  type CanonicalJsonValue,
  CanonicalJsonValueSchema,
  type CommandRejection,
  CommandRejectionSchema,
  type ProjectId,
  type TypedCommand,
  TypedCommandSchema,
} from "@slopstop/protocol";
import { z } from "zod";
import {
  CanonicalStoredIdentitySchema,
  canonicalJsonText,
  parseCanonicalJson,
} from "./canonical-json.js";
import type { LocalLibsqlTransaction } from "./storage/local-libsql-worker-client.js";

export type CanonicalCommandTransaction = Readonly<Pick<LocalLibsqlTransaction, "execute">>;
const nonblankTextSchema = z.string().refine((value) => value.trim().length > 0);
export const CanonicalEventInputSchema = z.strictObject({
  aggregateType: nonblankTextSchema,
  aggregateId: CanonicalStoredIdentitySchema.refine(isDomainIdentity),
  aggregateVersion: TypedCommandSchema.shape.version,
  eventType: nonblankTextSchema,
  eventVersion: TypedCommandSchema.shape.version,
  payload: CanonicalJsonValueSchema,
});
export type CanonicalEventInput = z.infer<typeof CanonicalEventInputSchema>;
export const CanonicalCommandDecisionSchema = z.discriminatedUnion("outcome", [
  z.strictObject({ outcome: z.literal("applied"), events: z.array(CanonicalEventInputSchema) }),
  z.strictObject({ outcome: z.literal("unchanged") }),
  z.strictObject({ outcome: z.literal("rejected"), rejection: CommandRejectionSchema }),
]);
export type CanonicalCommandDecision = z.infer<typeof CanonicalCommandDecisionSchema>;

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

const registrationKeySchema = TypedCommandSchema.pick({ type: true, version: true });

export function defineCanonicalCommand<Payload>(
  input: Readonly<{
    type: string;
    version: number;
    payloadSchema: z.ZodType<Payload>;
    handle: (
      context: Readonly<{
        projectId: ProjectId;
        payload: NoInfer<Payload>;
        transaction: CanonicalCommandTransaction;
      }>,
    ) => CanonicalCommandDecision | Promise<CanonicalCommandDecision>;
  }>,
): RegisteredCanonicalCommand {
  const { type, version } = registrationKeySchema.parse({
    type: input.type,
    version: input.version,
  });
  if (type !== input.type) throw new Error("Command registration type is not canonical.");
  const { payloadSchema, handle } = input;
  return Object.freeze({
    type,
    version,
    prepare: (payload: CanonicalJsonValue): PreparedCanonicalCommand => {
      const parsed = payloadSchema.safeParse(payload);
      if (!parsed.success) {
        return {
          status: "rejected",
          rejection: { code: "COMMAND_PAYLOAD_INVALID", retryable: false },
        };
      }
      return { status: "ready", run: (context) => handle({ ...context, payload: parsed.data }) };
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
    const { type, version } = registrationKeySchema.parse({
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
