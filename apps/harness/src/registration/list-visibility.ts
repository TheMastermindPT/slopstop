import {
  decodeStrictResult,
  type ProjectId,
  type ProjectRegistrationRequest,
  type ProjectRegistrationResult,
} from "@slopstop/protocol";
import { Effect, Result, Schema } from "effect";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import type { ProjectRegistrationFlow } from "./project-registration-flow.js";
import { readProjectRegistrationRecords } from "./registration-confirmation-store.js";
import { failureOf } from "./registration-step.js";
import type { RegistrationDatabaseOptions } from "./registry-database.js";
import { registryRows } from "./registry-database.js";
import { RegistryReadFailed, registryRead, withRegistryTransaction } from "./registry-effect.js";

const hiddenRowsSchema = Schema.Array(Schema.Struct({ projectId: Schema.String }));
const corrupt = new RegistryReadFailed({ failure: { status: "broken", code: "REGISTRY_CORRUPT" } });

const statement = (
  transaction: LocalLibsqlTransaction,
  sql: string,
  args: ReadonlyArray<string> = [],
) => registryRead(transaction, (open) => open.execute({ sql, args: [...args] }));

/** The Projects removed from the saved list; their data and registration stay. */
export function readHiddenProjectIds(
  transaction: LocalLibsqlTransaction,
): Effect.Effect<ReadonlySet<string>, RegistryReadFailed> {
  return Effect.flatMap(
    statement(transaction, "SELECT project_id AS projectId FROM registration_list_visibility"),
    (rows) => {
      const decoded = decodeStrictResult(hiddenRowsSchema, registryRows(rows));
      return Result.isSuccess(decoded)
        ? Effect.succeed(new Set(decoded.success.map((row) => row.projectId)))
        : Effect.fail(corrupt);
    },
  );
}

/** Brings a removed Project back to the saved list. */
export function showProject(transaction: LocalLibsqlTransaction, projectId: string) {
  return Effect.asVoid(
    statement(transaction, "DELETE FROM registration_list_visibility WHERE project_id = ?", [
      projectId,
    ]),
  );
}

function hideProject(transaction: LocalLibsqlTransaction, projectId: ProjectId) {
  return Effect.gen(function* () {
    const records = yield* registryRead(transaction, readProjectRegistrationRecords);
    const record = records.find(({ reservation }) => reservation.projectId === projectId);
    if (record === undefined) return { status: "rejected", code: "PROJECT_NOT_FOUND" } as const;
    if (record.publication === undefined)
      return { status: "rejected", code: "REGISTRATION_INCOMPLETE" } as const;
    yield* statement(
      transaction,
      "INSERT OR IGNORE INTO registration_list_visibility (project_id, hidden_at) VALUES (?, ?)",
      [projectId, new Date().toISOString()],
    );
    return { status: "removed", projectId } as const;
  });
}

/**
 * Remove from list (option A). The active-Project guard lives only here: it reads the Project
 * the session holds before hiding, so moving it into the coordinator's queue stays local.
 */
export function createListRemoval(
  dependencies: Readonly<{
    options: RegistrationDatabaseOptions;
    activeProjectId(): ProjectId | undefined;
  }>,
) {
  return (projectId: ProjectId): Effect.Effect<ProjectRegistrationResult> =>
    dependencies.activeProjectId() === projectId
      ? Effect.succeed({ status: "rejected", code: "PROJECT_ACTIVE" })
      : withRegistryTransaction(dependencies.options, (transaction) =>
          hideProject(transaction, projectId),
        ).pipe(
          Effect.catchTag("RegistryReadFailed", (failed) =>
            Effect.succeed(failureOf(failed.failure)),
          ),
        );
}

/** The registration flow with Remove from list answered by the removal owner. */
export function withListRemoval(
  flow: ProjectRegistrationFlow,
  remove: ReturnType<typeof createListRemoval>,
): ProjectRegistrationFlow {
  return {
    handle: (request: ProjectRegistrationRequest) =>
      request.step === "remove-from-list" ? remove(request.projectId) : flow.handle(request),
  };
}
