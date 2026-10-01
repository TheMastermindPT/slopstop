import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  type GitVersionInspectionResult,
  GitVersionInspectionResultSchema,
  type ObserverAdmissionPort,
  PreparedGitVersionSchema,
} from "../project-registration-observer.js";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { withWriteTransaction } from "../storage/project-storage-transaction.js";
import { readConsent, readSelection } from "./executable-consent-store.js";
import { sameExecutableIdentity } from "./executable-identity.js";
import { type RegistryRunner, registryRows } from "./registry-database.js";
import { RegistryFault, registryFailure } from "./registry-failure.js";
import type {
  ObserverAbsencePort,
  VersionDispatch,
  VersionObserverJournal,
} from "./version-observation-execution.js";

type ObservationId = z.infer<typeof PreparedGitVersionSchema.shape.observationId>;
export interface ObserverRecoveryPort {
  reconcileObservers(
    absence?: ObserverAbsencePort,
  ): Promise<Readonly<{ status: "settled" }> | ReturnType<typeof registryFailure>>;
}
const sqlInteger = z.union([z.number().int(), z.bigint()]).transform(Number).pipe(z.number().int());
const childSchema = z.strictObject({
  platform: z.literal("win32"),
  processId: z.number().int().positive().max(4294967295),
  creationTime100ns: z.string().regex(/^[1-9][0-9]*$/),
  jobName: z.string().min(1),
  sessionId: z.number().int().nonnegative().max(4294967295).optional(),
});
const terminalSchema = z.strictObject({
  exitCode: z.number().int(),
  stdoutClosed: z.literal(true),
  stderrClosed: z.literal(true),
  treeEmpty: z.literal(true),
});

export { childSchema as ObserverChildIdentitySchema, terminalSchema as ObserverTerminalSchema };

async function queryChildIsSettled(
  record: { id: string; child: string | null; terminal: string | null },
  absence?: ObserverAbsencePort,
) {
  if (record.child === null) return false;
  const child = childSchema.parse(JSON.parse(record.child));
  if (child.jobName !== `Local\\SlopStop.Registration.Observer.${record.id}`)
    throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
  if (record.terminal !== null) {
    terminalSchema.parse(JSON.parse(record.terminal));
    return true;
  }
  return (await absence?.inspect(child))?.status === "absent";
}

async function reconcileIdentityQueryAttempts(
  transaction: LocalLibsqlTransaction,
  absence?: ObserverAbsencePort,
) {
  const rows = await transaction.execute(
    "SELECT observation_id AS id, child_json AS child, terminal_json AS terminal FROM registration_identity_query_attempts WHERE result_json IS NULL",
  );
  const records = z
    .array(
      z.strictObject({
        id: z.uuid(),
        child: z.string().nullable(),
        terminal: z.string().nullable(),
      }),
    )
    .parse(registryRows(rows));
  for (const record of records) {
    if (!(await queryChildIsSettled(record, absence))) continue;
    await transaction.execute({
      sql: "UPDATE registration_identity_query_attempts SET result_json = ?, settled_at = ? WHERE observation_id = ? AND result_json IS NULL",
      args: [
        JSON.stringify({ status: "broken", code: "INTERNAL_FAILURE" }),
        new Date().toISOString(),
        record.id,
      ],
    });
  }
}
const resultRowSchema = z.strictObject({
  observationId: PreparedGitVersionSchema.shape.observationId,
  resultJson: z.string(),
});

function unsettled(): never {
  throw new RegistryFault({ status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" });
}

export async function hasUnsettled(transaction: LocalLibsqlTransaction): Promise<boolean> {
  const result = await transaction.execute(
    "SELECT i.observation_id FROM registration_observer_intents i LEFT JOIN registration_observer_outcomes o ON o.observation_id = i.observation_id WHERE o.observation_id IS NULL UNION ALL SELECT observation_id FROM registration_identity_query_attempts WHERE result_json IS NULL LIMIT 1",
  );
  return result.rows.length > 0;
}

async function requireDispatchAuthority(
  transaction: LocalLibsqlTransaction,
  request: VersionDispatch,
): Promise<void> {
  const consent = await readConsent(transaction, request.consentId);
  const selection = await readSelection(transaction, request.selectionId);
  if (!consentMatches(consent, request.selectionId)) {
    throw new Error("Observer consent authority is invalid.");
  }
  if (selection === undefined || selection.executablePath !== request.executablePath) {
    throw new Error("Observer selection authority is invalid.");
  }
  if (!sameExecutableIdentity(selection.executableIdentity, request.executableIdentity)) {
    throw new Error("Observer executable authority is invalid.");
  }
}

function consentMatches(
  consent: Awaited<ReturnType<typeof readConsent>>,
  selectionId: string,
): boolean {
  return consent?.decision === "accepted" && consent.selectionId === selectionId;
}

async function readResult(
  transaction: LocalLibsqlTransaction,
  request: VersionDispatch,
): Promise<GitVersionInspectionResult | undefined> {
  await requireDispatchAuthority(transaction, request);
  const result = await transaction.execute({
    sql: "SELECT i.observation_id AS observationId, o.result_json AS resultJson FROM registration_observer_intents i JOIN registration_observer_outcomes o ON o.observation_id = i.observation_id WHERE i.consent_id = ? AND i.selection_id = ?",
    args: [request.consentId, request.selectionId],
  });
  const row = resultRowSchema.array().max(1).parse(registryRows(result))[0];
  if (row === undefined) return undefined;
  const decoded = GitVersionInspectionResultSchema.parse(JSON.parse(row.resultJson));
  if (decoded.status === "prepared") {
    if (
      decoded.observationId !== row.observationId ||
      decoded.selectionId !== request.selectionId
    ) {
      throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
    }
  }
  return decoded;
}

async function confirmedExit(
  transaction: LocalLibsqlTransaction,
  observationId: ObservationId,
): Promise<number> {
  const result = await transaction.execute({
    sql: "SELECT exit_code FROM registration_observer_terminals WHERE observation_id = ? AND stdout_closed = 1 AND stderr_closed = 1 AND tree_empty = 1",
    args: [observationId],
  });
  if (result.rows.length === 0) return unsettled();
  return z.tuple([z.tuple([sqlInteger])]).parse(result.rows)[0][0];
}

async function writeOutcome(
  transaction: LocalLibsqlTransaction,
  observationId: ObservationId,
  result: GitVersionInspectionResult,
): Promise<void> {
  await transaction.execute({
    sql: "INSERT INTO registration_observer_outcomes (observation_id, result_json, settled_at) VALUES (?, ?, ?)",
    args: [observationId, JSON.stringify(result), new Date().toISOString()],
  });
}

function invalidatedResult(
  code: Parameters<VersionObserverJournal["invalidate"]>[1],
  exitCode: number,
): GitVersionInspectionResult {
  if (code === "GIT_QUERY_FAILED") return { status: "unavailable", code, exitCode };
  if (code === "OBSERVATION_INVALID") return { status: "rejected", code };
  if (code === "INTERNAL_FAILURE") return { status: "broken", code };
  return GitVersionInspectionResultSchema.parse({ status: "unavailable", code });
}

async function beginObservation(transaction: LocalLibsqlTransaction, request: VersionDispatch) {
  const previous = await readResult(transaction, request);
  if (previous !== undefined) return { status: "settled" as const, result: previous };
  if (await hasUnsettled(transaction)) return unsettled();
  const observationId = PreparedGitVersionSchema.shape.observationId.parse(randomUUID());
  await transaction.execute({
    sql: "INSERT INTO registration_observer_intents (observation_id, selection_id, consent_id, created_at) VALUES (?, ?, ?, ?)",
    args: [observationId, request.selectionId, request.consentId, new Date().toISOString()],
  });
  return { status: "started" as const, observationId };
}

async function completeObservation(
  transaction: LocalLibsqlTransaction,
  result: z.infer<typeof PreparedGitVersionSchema>,
) {
  const prepared = PreparedGitVersionSchema.parse(result);
  if ((await confirmedExit(transaction, prepared.observationId)) !== 0) {
    throw new Error("A failed child cannot validate an executable version.");
  }
  const intent = await transaction.execute({
    sql: "SELECT selection_id FROM registration_observer_intents WHERE observation_id = ?",
    args: [prepared.observationId],
  });
  if (intent.rows[0]?.[0] !== prepared.selectionId)
    throw new Error("Version observation scope is invalid.");
  await writeOutcome(transaction, prepared.observationId, prepared);
}

async function reconcileStoredTerminals(transaction: LocalLibsqlTransaction) {
  const pending = await transaction.execute(`
    SELECT i.observation_id AS observationId, c.identity_json AS identityJson
    FROM registration_observer_intents i
    JOIN registration_observer_children c ON c.observation_id = i.observation_id
    JOIN registration_observer_terminals t ON t.observation_id = i.observation_id
    LEFT JOIN registration_observer_outcomes o ON o.observation_id = i.observation_id
    WHERE o.observation_id IS NULL AND t.stdout_closed = 1 AND t.stderr_closed = 1 AND t.tree_empty = 1`);
  const rows = z
    .array(
      z.strictObject({
        observationId: PreparedGitVersionSchema.shape.observationId,
        identityJson: z.string(),
      }),
    )
    .parse(registryRows(pending));
  for (const row of rows) {
    const child = childSchema.parse(JSON.parse(row.identityJson));
    if (child.jobName !== `Local\\SlopStop.Registration.Observer.${row.observationId}`) {
      throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
    }
    await confirmedExit(transaction, row.observationId);
    // The unique terminal outcome fences any former publisher in this same transaction.
    await writeOutcome(transaction, row.observationId, {
      status: "broken",
      code: "INTERNAL_FAILURE",
    });
  }
  if (await hasUnsettled(transaction)) {
    return { status: "pending-recovery" as const, code: "OBSERVER_CLEANUP_UNCONFIRMED" as const };
  }
  return { status: "settled" as const };
}

async function reconcileAbsentOwners(
  transaction: LocalLibsqlTransaction,
  absence: ObserverAbsencePort,
) {
  const pending = await transaction.execute(`
    SELECT i.observation_id AS observationId, c.identity_json AS identityJson
    FROM registration_observer_intents i
    JOIN registration_observer_children c ON c.observation_id = i.observation_id
    LEFT JOIN registration_observer_outcomes o ON o.observation_id = i.observation_id
    WHERE o.observation_id IS NULL`);
  const rows = z
    .array(
      z.strictObject({
        observationId: PreparedGitVersionSchema.shape.observationId,
        identityJson: z.string(),
      }),
    )
    .parse(registryRows(pending));
  for (const row of rows) {
    const child = childSchema.parse(JSON.parse(row.identityJson));
    if (child.jobName !== `Local\\SlopStop.Registration.Observer.${row.observationId}`) {
      throw new RegistryFault({ status: "broken", code: "REGISTRY_CORRUPT" });
    }
    if ((await absence.inspect(child)).status !== "absent") continue;
    await writeOutcome(transaction, row.observationId, {
      status: "broken",
      code: "INTERNAL_FAILURE",
      reconciliation: "exact-owner-absence",
    });
  }
  if (await hasUnsettled(transaction)) return unsettled();
  return { status: "settled" as const };
}

export function createRegistryObserverJournal(
  run: RegistryRunner,
): VersionObserverJournal & ObserverAdmissionPort & ObserverRecoveryPort {
  const write = <Result>(operation: (transaction: LocalLibsqlTransaction) => Promise<Result>) =>
    run((client) => withWriteTransaction(client, operation));
  return {
    reconcileObservers: (absence) =>
      write(async (transaction) => {
        await reconcileIdentityQueryAttempts(transaction, absence);
        const terminalResult = await reconcileStoredTerminals(transaction);
        if (absence === undefined) return terminalResult;
        return reconcileAbsentOwners(transaction, absence);
      }).catch(registryFailure),
    hasUnsettled: () => write(hasUnsettled),
    readResult: (request) => write((transaction) => readResult(transaction, request)),
    begin: (request) => write((transaction) => beginObservation(transaction, request)),
    recordNoDispatch: (observationId, reason) =>
      write(async (transaction) => {
        const children = await transaction.execute({
          sql: "SELECT observation_id FROM registration_observer_children WHERE observation_id = ?",
          args: [observationId],
        });
        if (children.rows.length !== 0) return unsettled();
        await writeOutcome(
          transaction,
          observationId,
          reason === "cancelled"
            ? { status: "cancelled" }
            : { status: "unavailable", code: "GIT_UNAVAILABLE" },
        );
      }),
    recordChild: (observationId, input) =>
      write(async (transaction) => {
        const child = childSchema.parse(input);
        if (child.jobName !== `Local\\SlopStop.Registration.Observer.${observationId}`) {
          throw new Error("Observer child has a different owner.");
        }
        await transaction.execute({
          sql: "INSERT INTO registration_observer_children (observation_id, identity_json) VALUES (?, ?)",
          args: [observationId, JSON.stringify(child)],
        });
      }),
    recordTerminal: (observationId, input) =>
      write(async (transaction) => {
        const terminal = terminalSchema.parse(input);
        await transaction.execute({
          sql: "INSERT INTO registration_observer_terminals (observation_id, exit_code, stdout_closed, stderr_closed, tree_empty, observed_at) VALUES (?, ?, 1, 1, 1, ?)",
          args: [observationId, terminal.exitCode, new Date().toISOString()],
        });
      }),
    complete: (result) => write((transaction) => completeObservation(transaction, result)),
    cancel: (observationId) =>
      write(async (transaction) => {
        await confirmedExit(transaction, observationId);
        await writeOutcome(transaction, observationId, { status: "cancelled" });
      }),
    invalidate: (observationId, code) =>
      write(async (transaction) => {
        const exitCode = await confirmedExit(transaction, observationId);
        await writeOutcome(transaction, observationId, invalidatedResult(code, exitCode));
      }),
  };
}
