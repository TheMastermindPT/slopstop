import {
  type CanonicalCommandReceipt,
  CanonicalCommandReceiptSchema,
  CanonicalEventIdSchema,
  CanonicalSettlementTimeSchema,
  CommandReceiptIdSchema,
  type ProjectId,
  SystemCommandRejectionCodeSchema,
  type WriterGeneration,
} from "@slopstop/protocol";
import {
  type CanonicalCommandDecision,
  CanonicalCommandDecisionSchema,
  type CanonicalCommandRegistry,
  type CanonicalCommandTransaction,
  type PreparedCanonicalCommand,
} from "../canonical-command-registry.js";
import {
  type CanonicalCommandSnapshot,
  canonicalJsonText,
  hashCanonicalJson,
  parseCanonicalJson,
} from "../canonical-json.js";
import { persistCanonicalSettlement, readCanonicalSettlement } from "./canonical-command-ledger.js";
import type { LocalLibsqlResultSet, LocalLibsqlTransaction } from "./local-libsql-worker-client.js";

export type CanonicalSettlementDependencies = Readonly<{
  registry: CanonicalCommandRegistry;
  createReceiptId(): string;
  createEventId(): string;
  now(): string;
}>;
export type CanonicalCommandSettlementResult =
  | Readonly<{ status: "settled"; receipt: CanonicalCommandReceipt }>
  | Readonly<{ status: "stale-writer" }>
  | Readonly<{ status: "sequence-exhausted" }>;

function handlerTransaction(tx: LocalLibsqlTransaction) {
  let active = true;
  const issued: Promise<LocalLibsqlResultSet>[] = [];
  const failures: unknown[] = [];
  const transaction: CanonicalCommandTransaction = Object.freeze({
    execute: (statement, args) => {
      if (!active) throw new Error("Canonical command transaction capability is revoked.");
      try {
        const copy = structuredClone({ statement, args });
        const pending = tx.execute(copy.statement, copy.args);
        issued.push(pending);
        void pending.catch((error) => {
          failures.push(error);
        });
        return pending;
      } catch (error) {
        failures.push(error);
        throw error;
      }
    },
  });
  return {
    transaction,
    revoke: () => {
      active = false;
    },
    drain: async () => {
      await Promise.allSettled(issued);
      if (failures.length !== 0) throw failures[0];
    },
  };
}

function snapshotHandlerDecision(value: unknown): CanonicalCommandDecision {
  const decision = CanonicalCommandDecisionSchema.parse(
    parseCanonicalJson(canonicalJsonText(value)),
  );
  if (
    decision.outcome === "rejected" &&
    SystemCommandRejectionCodeSchema.safeParse(decision.rejection.code).success
  )
    throw new Error("Handler rejection uses a reserved system code.");
  return decision;
}

async function runHandler(
  prepared: Extract<PreparedCanonicalCommand, { status: "ready" }>,
  projectId: ProjectId,
  tx: LocalLibsqlTransaction,
): Promise<CanonicalCommandDecision> {
  const capability = handlerTransaction(tx);
  const result = await (async () => {
    try {
      const decision = snapshotHandlerDecision(
        await prepared.run({ projectId, transaction: capability.transaction }),
      );
      return { status: "returned", decision } as const;
    } catch (error) {
      return { status: "failed", error } as const;
    } finally {
      capability.revoke();
    }
  })();
  await capability.drain();
  if (result.status === "failed") throw result.error;
  return result.decision;
}

function settlementEvents(
  decision: CanonicalCommandDecision,
  dependencies: CanonicalSettlementDependencies,
) {
  if (decision.outcome !== "applied") return [];
  return decision.events.map(({ payload, ...source }, eventOrdinal) => ({
    ...source,
    eventOrdinal,
    eventId: CanonicalEventIdSchema.parse(dependencies.createEventId()),
    payloadText: canonicalJsonText(payload),
    payloadHash: hashCanonicalJson(payload),
  }));
}

export async function settleFirstCanonicalCommand(
  input: Readonly<{
    transaction: LocalLibsqlTransaction;
    command: CanonicalCommandSnapshot;
    writerGeneration: WriterGeneration;
    dependencies: CanonicalSettlementDependencies;
  }>,
): Promise<CanonicalCommandSettlementResult> {
  const { transaction: tx, command, dependencies } = input;
  const prior = await readCanonicalSettlement(tx, command, input.writerGeneration);
  if (prior.status === "settled" || prior.status === "sequence-exhausted") return prior;
  const { projectSequence } = prior;
  const decision =
    prior.status === "conflict"
      ? {
          outcome: "rejected" as const,
          rejection: { code: "IDEMPOTENCY_CONFLICT", retryable: false },
        }
      : await prepareDecision(tx, command, dependencies);
  const settledAt = CanonicalSettlementTimeSchema.parse(dependencies.now());
  const receiptId = CommandReceiptIdSchema.parse(dependencies.createReceiptId());
  const events = settlementEvents(decision, dependencies);
  const receipt = CanonicalCommandReceiptSchema.parse({
    receiptId,
    projectId: command.projectId,
    commandId: command.commandId,
    commandType: command.type,
    commandVersion: command.version,
    outcome: decision.outcome,
    projectSequence,
    writerGeneration: input.writerGeneration,
    settledAt,
    events: events.map(({ eventId, eventOrdinal }) => ({ eventId, eventOrdinal })),
    ...(decision.outcome === "rejected" ? { rejection: decision.rejection } : {}),
  });
  await persistCanonicalSettlement({
    transaction: tx,
    receipt,
    events,
    fingerprint: hashCanonicalJson(command),
    original: prior.status === "new",
  });
  return { status: "settled", receipt };
}

async function prepareDecision(
  tx: LocalLibsqlTransaction,
  command: CanonicalCommandSnapshot,
  dependencies: CanonicalSettlementDependencies,
) {
  const prepared = dependencies.registry.prepare(command);
  if (prepared.status !== "ready")
    return { outcome: "rejected" as const, rejection: prepared.rejection };
  await tx.execute("SAVEPOINT canonical_command_handler");
  const decision = await runHandler(prepared, command.projectId, tx);
  if (decision.outcome !== "applied") await tx.execute("ROLLBACK TO canonical_command_handler");
  await tx.execute("RELEASE canonical_command_handler");
  return decision;
}
