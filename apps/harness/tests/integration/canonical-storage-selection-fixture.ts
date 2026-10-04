import {
  decodeStrict,
  type ProjectStorageOpenRequest,
  ProjectStorageOpenResultSchema,
} from "@slopstop/protocol";
import { fixedCreationIds } from "./project-storage-runtime-fixture.js";

export function openedCanonicalStorageResult(request: ProjectStorageOpenRequest) {
  return decodeStrict(ProjectStorageOpenResultSchema, {
    status: "opened",
    request,
    mode: "read-write",
    identity: {
      storageId: fixedCreationIds.storageId,
      generationId: fixedCreationIds.generationId,
      canonicalDatabaseLineageId: fixedCreationIds.canonicalDatabaseLineageId,
      runtimeDatabaseLineageId: fixedCreationIds.runtimeDatabaseLineageId,
    },
    canonicalHealth: { status: "healthy" },
    runtimeHealth: { status: "healthy" },
  });
}
