import { createHash, randomBytes, randomUUID } from "node:crypto";
import { decodeStrict, ProjectActivationIdSchema } from "@slopstop/protocol";
import {
  type ActiveProjectCoordinatorDependencies,
  createActiveProjectCoordinator,
} from "./active-project-coordinator.js";
import { createCanonicalCommandRegistry } from "./canonical-command-registry.js";
import {
  createCanonicalCommandRepositoryFactory,
  WriterCapabilityTokenSchema,
} from "./storage/canonical-command-repository.js";
import { createNodeCanonicalWriterLeaseFactory } from "./storage/canonical-writer-lease.js";
import { createWorkerLocalLibsqlClient } from "./storage/local-libsql-worker-client.js";

const currentTime = () => new Date().toISOString();

/**
 * The coordinator over Node writer leases and repositories, with random ids and the wall
 * clock; the caller supplies its Storage and any target and session validation.
 */
export function createNodeActiveProjectCoordinator(
  input: Pick<
    ActiveProjectCoordinatorDependencies,
    "storage" | "validateTarget" | "validateSession"
  >,
) {
  return createActiveProjectCoordinator({
    ...input,
    leases: createNodeCanonicalWriterLeaseFactory(),
    repositories: createCanonicalCommandRepositoryFactory({
      registry: createCanonicalCommandRegistry([]),
      createReceiptId: randomUUID,
      createEventId: randomUUID,
      now: currentTime,
      openClient: (databasePath) => createWorkerLocalLibsqlClient(databasePath, "generation"),
      sha256Text: async (text) => createHash("sha256").update(text).digest("hex"),
      createHandoffId: randomUUID,
      createRecoveryRecordId: randomUUID,
    }),
    createActivationId: () => decodeStrict(ProjectActivationIdSchema, randomUUID()),
    createWriterToken: () =>
      decodeStrict(WriterCapabilityTokenSchema, randomBytes(32).toString("hex")),
    now: currentTime,
  });
}
