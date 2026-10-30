import type {
  ProjectId,
  ProjectRegistrationRequest,
  ProjectRegistrationResult,
} from "@slopstop/protocol";
import { Effect, Schema } from "effect";
import type { LocalLibsqlTransaction } from "../storage/local-libsql-worker-client.js";
import type { UtcClock } from "../utc-clock.js";
import type { ProjectRegistrationFlow } from "./project-registration-flow.js";
import { readProjectRegistrationRecords } from "./registration-confirmation-store.js";
import { failureOf } from "./registration-step.js";
import type { RegistrationDatabaseOptions } from "./registry-database.js";
import { decodeRegistryRows, registrationClock } from "./registry-database.js";
import {
  type RegistryReadFailed,
  registryRead,
  withRegistryTransaction,
} from "./registry-effect.js";

const hiddenRowsSchema = Schema.Array(Schema.Struct({ projectId: Schema.String }));

const statement = (
  transaction: LocalLibsqlTransaction,
  sql: string,
  args: ReadonlyArray<string> = [],
) => registryRead(transaction, (open) => open.execute({ sql, args: [...args] }));

/** The Projects removed from the saved list; their data and registration stay. */
export function readHiddenProjectIds(
  transaction: LocalLibsqlTransaction,
): Effect.Effect<ReadonlySet<string>, RegistryReadFailed> {
  return registryRead(transaction, async (open) => {
    const rows = await open.execute(
      "SELECT project_id AS projectId FROM registration_list_visibility",
    );
    return new Set(decodeRegistryRows(hiddenRowsSchema, rows).map((row) => row.projectId));
  });
}

/** Brings a removed Project back to the saved list. */
export function showProject(transaction: LocalLibsqlTransaction, projectId: string) {
  return Effect.asVoid(
    statement(transaction, "DELETE FROM registration_list_visibility WHERE project_id = ?", [
      projectId,
    ]),
  );
}

function hideProject(transaction: LocalLibsqlTransaction, projectId: ProjectId, clock: UtcClock) {
  return Effect.gen(function* () {
    const records = yield* registryRead(transaction, readProjectRegistrationRecords);
    const record = records.find(({ reservation }) => reservation.projectId === projectId);
    if (record === undefined) return { status: "rejected", code: "PROJECT_NOT_FOUND" } as const;
    if (record.publication === undefined)
      return { status: "rejected", code: "REGISTRATION_INCOMPLETE" } as const;
    yield* statement(
      transaction,
      "INSERT OR IGNORE INTO registration_list_visibility (project_id, hidden_at) VALUES (?, ?)",
      [projectId, clock.now()],
    );
    return { status: "removed", projectId } as const;
  });
}

/**
 * Remove from list (option A). The active-Project guard lives only here, and it runs with the
 * hide inside the coordinator's lifecycle queue: no activation can land between the two.
 */
export function createListRemoval(
  dependencies: Readonly<{
    options: RegistrationDatabaseOptions;
    withHeldProject<Result>(
      operation: (held: ProjectId | undefined) => Promise<Result>,
    ): Promise<Result>;
  }>,
) {
  const hide = (projectId: ProjectId): Effect.Effect<ProjectRegistrationResult> =>
    withRegistryTransaction(dependencies.options, (transaction) =>
      hideProject(transaction, projectId, registrationClock(dependencies.options)),
    ).pipe(
      Effect.catchTag("RegistryReadFailed", (failed) => Effect.succeed(failureOf(failed.failure))),
    );
  return (projectId: ProjectId): Effect.Effect<ProjectRegistrationResult> =>
    Effect.promise(() =>
      dependencies.withHeldProject((held) =>
        held === projectId
          ? Promise.resolve<ProjectRegistrationResult>({
              status: "rejected",
              code: "PROJECT_ACTIVE",
            })
          : Effect.runPromise(hide(projectId)),
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
