import {
  decodeStrict,
  type InitialRepositoryBinding,
  InitialRepositoryBindingSchema,
} from "@slopstop/protocol";
import type { LocalLibsqlClient, LocalLibsqlTransaction } from "./local-libsql-worker-client.js";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import { withWriteTransaction } from "./project-storage-transaction.js";

export async function seedInitialRepositoryBinding(
  client: LocalLibsqlClient,
  creation: { projectId: string; createRequestId: string; createdAt: string },
  input: InitialRepositoryBinding,
) {
  const seed = decodeStrict(InitialRepositoryBindingSchema, input);
  if (seed.projectId !== creation.projectId || seed.createRequestId !== creation.createRequestId)
    throw new ProjectStorageBrokenError("Initial repository binding scope does not agree.");
  await withWriteTransaction(client, async (transaction) => {
    await transaction.execute({
      sql: "INSERT INTO repository_bindings (project_id, binding_id, revision, registration_request_id, created_at) VALUES (?, ?, 0, ?, ?)",
      args: [
        seed.projectId,
        seed.repositoryBindingId,
        seed.registrationRequestId,
        creation.createdAt,
      ],
    });
    await transaction.execute({
      sql: "INSERT INTO project_workspaces (project_id, workspace_id, binding_id, created_at) VALUES (?, ?, ?, ?)",
      args: [seed.projectId, seed.workspaceId, seed.repositoryBindingId, creation.createdAt],
    });
    await verifyInitialRepositoryBinding(transaction, seed);
  });
}

export async function verifyInitialRepositoryBinding(
  client: Pick<LocalLibsqlTransaction, "execute">,
  seed: InitialRepositoryBinding,
) {
  const result = await client.execute({
    sql: "SELECT b.binding_id, b.revision, b.registration_request_id, w.workspace_id FROM repository_bindings b JOIN project_workspaces w ON w.project_id = b.project_id AND w.binding_id = b.binding_id WHERE b.project_id = ?",
    args: [seed.projectId],
  });
  if (
    JSON.stringify(result.rows) !==
    JSON.stringify([[seed.repositoryBindingId, 0, seed.registrationRequestId, seed.workspaceId]])
  )
    throw new ProjectStorageBrokenError("Initial repository binding does not agree.");
}
