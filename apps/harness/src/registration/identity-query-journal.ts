import { randomUUID } from "node:crypto";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import { withWriteTransaction } from "../storage/project-storage-transaction.js";
import { type IdentityQueryDispatch, identityQueryArguments } from "./identity-query-child.js";
import { ObserverChildIdentitySchema, ObserverTerminalSchema } from "./observer-journal.js";
import { type RegistrationDatabaseOptions, withRegistrationDatabase } from "./registry-database.js";
import { RegistryFault } from "./registry-failure.js";
import { authorizeQueries, type RepositoryTrustOwner } from "./repository-trust.js";
import type {
  ObserverTerminalProof,
  WindowsObserverChildIdentity,
} from "./version-observation-execution.js";

type Request = Parameters<RepositoryTrustOwner["admitRepositoryIdentityQueries"]>[0];

async function commitDecision<Result extends Readonly<{ status: string }>>(
  transaction: LocalLibsqlTransaction,
  id: string,
  decide: () => Result,
): Promise<Result> {
  let staged: string | null = null;
  for (;;) {
    const result = decide();
    const encoded = JSON.stringify(result);
    if (encoded === staged) {
      // Synchronous final decision immediately before commit dispatch; no intervening await.
      await transaction.commit();
      return result;
    }
    const updated = await transaction.execute({
      sql: "UPDATE registration_identity_query_attempts SET result_json = ?, settled_at = ? WHERE observation_id = ? AND terminal_json IS NOT NULL AND result_json IS ?",
      args: [encoded, new Date().toISOString(), id, staged],
    });
    if (updated.rowsAffected !== 1)
      throw new RegistryFault({ status: "pending-recovery", code: "OBSERVER_CLEANUP_UNCONFIRMED" });
    // Only this transaction's uncommitted value may be revised. Committed history is never replaced.
    staged = encoded;
  }
}

export function createIdentityQueryJournal(options: RegistrationDatabaseOptions) {
  const owned = new Set<string>();
  const write = <T>(operation: (transaction: LocalLibsqlTransaction) => Promise<T>) =>
    withRegistrationDatabase(
      options,
      (client) => withWriteTransaction(client, operation),
      "existing-only",
    );
  const update = async (sql: string, args: string[]) => {
    await write(async (transaction) => {
      const result = await transaction.execute({ sql, args });
      if (result.rowsAffected !== 1)
        throw new RegistryFault({
          status: "pending-recovery",
          code: "OBSERVER_CLEANUP_UNCONFIRMED",
        });
    });
  };
  return {
    begin: async (request: Request, phase: IdentityQueryDispatch) => {
      const result = await write(async (transaction) => {
        const authority = await authorizeQueries(transaction, request);
        if (authority.status !== "authorized") return authority;
        const observationId = randomUUID();
        await transaction.execute({
          sql: "INSERT INTO registration_identity_query_attempts (observation_id, repository_selection_id, consent_id, query_kind, scope_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          args: [
            observationId,
            request.repositorySelectionId,
            request.consentId,
            phase.query,
            JSON.stringify({
              request,
              authority,
              phase,
              arguments: identityQueryArguments(phase.query),
            }),
            new Date().toISOString(),
          ],
        });
        return { status: "started" as const, observationId, authority, phase };
      });
      if (result.status === "started") owned.add(result.observationId);
      return result;
    },
    hasUnsettled: async () => {
      if (owned.size === 0) return false;
      return write(async (transaction) => {
        const result = await transaction.execute({
          sql: `SELECT observation_id FROM registration_identity_query_attempts WHERE result_json IS NULL AND observation_id IN (${[...owned].map(() => "?").join(",")}) LIMIT 1`,
          args: [...owned],
        });
        return result.rows.length > 0;
      });
    },
    recordChild: (id: string, child: WindowsObserverChildIdentity) => {
      const parsed = ObserverChildIdentitySchema.parse(child);
      if (parsed.jobName !== `Local\\SlopStop.Registration.Observer.${id}`)
        throw new Error("Query child scope mismatch");
      return update(
        "UPDATE registration_identity_query_attempts SET child_json = ? WHERE observation_id = ? AND child_json IS NULL AND result_json IS NULL",
        [JSON.stringify(parsed), id],
      );
    },
    recordTerminal: (id: string, terminal: ObserverTerminalProof) =>
      update(
        "UPDATE registration_identity_query_attempts SET terminal_json = ? WHERE observation_id = ? AND child_json IS NOT NULL AND terminal_json IS NULL AND result_json IS NULL",
        [JSON.stringify(ObserverTerminalSchema.parse(terminal)), id],
      ),
    settle: <Result extends Readonly<{ status: string }>>(id: string, decide: () => Result) =>
      withRegistrationDatabase(
        options,
        async (client) => {
          const transaction = await client.transaction("write");
          try {
            return await commitDecision(transaction, id, decide);
          } catch (error) {
            if (!transaction.closed) await transaction.rollback();
            throw error;
          } finally {
            await transaction.close();
          }
        },
        "existing-only",
      ).then((result) => {
        owned.delete(id);
        return result;
      }),
    noDispatch: (id: string, result: Readonly<{ status: string }>) =>
      update(
        "UPDATE registration_identity_query_attempts SET result_json = ?, settled_at = ? WHERE observation_id = ? AND child_json IS NULL AND result_json IS NULL",
        [JSON.stringify(result), new Date().toISOString(), id],
      ).then(() => {
        owned.delete(id);
      }),
  };
}
