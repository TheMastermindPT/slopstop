import { decodeStrict, ProjectIdSchema } from "@slopstop/protocol";
import { Cause, Effect, Exit, Option } from "effect";
import { expect, it } from "vitest";
import type { LocalLibsqlClient } from "./local-libsql-worker-client.js";
import {
  ProjectStorageApplicationClientInitializationError,
  ProjectStorageBrokenError,
  ProjectStorageUnavailableError,
} from "./project-storage-errors.js";
import { createNodeRegistryOperations } from "./project-storage-node-registry.js";

const unused = (): never => {
  throw new Error("Not used by the registry witnesses.");
};

/** Registry operations whose application client lookup rejects with `error`. */
function registryRejectingWith(error: unknown) {
  return createNodeRegistryOperations({
    existingApplicationClient: () => Promise.reject(error),
    mutableApplicationClient: unused,
    requireApplicationAuthority: unused,
    prepareCreate: unused,
    projectRootFor: unused,
    clock: { now: unused },
    failures: { checkpoint: unused },
    databases: { createCanonical: unused, createRuntime: unused, verifySealed: unused },
    options: {},
  });
}

const projectId = decodeStrict(ProjectIdSchema, "00000000-0000-4000-8000-000000000020");

it.each([
  { name: "broken", error: new ProjectStorageBrokenError("broken"), kept: true },
  {
    name: "client initialization",
    error: new ProjectStorageApplicationClientInitializationError("initialization"),
    kept: true,
  },
  { name: "unavailable", error: new ProjectStorageUnavailableError("unavailable"), kept: true },
  { name: "plain error", error: new Error("plain"), kept: false },
])(
  "keeps a typed storage failure and leaves anything else a defect: $name",
  async ({ error, kept }) => {
    const exit = await Effect.runPromiseExit(
      registryRejectingWith(error).registryWitnesses(projectId, "/unused"),
    );
    expect(Option.getOrUndefined(Exit.findErrorOption(exit))).toBe(kept ? error : undefined);
    expect(Exit.hasFails(exit)).toBe(kept);
    expect(Exit.hasDies(exit)).toBe(!kept);
    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe(error);
  },
);

it("keeps a typed storage failure from the synchronous witness step", async () => {
  const registration: (string | null)[] = [
    "00000000-0000-4000-8000-000000000030",
    projectId,
    null,
    null,
    "2026-10-18T12:00:00.000Z",
    null,
  ];
  const registrationColumns = [
    "storageId",
    "projectId",
    "activeGenerationId",
    "activeLocationId",
    "createdAt",
    "activatedAt",
  ];
  // Two registrations for one Project: the synchronous uniqueness check rejects them.
  const client: LocalLibsqlClient = {
    execute: async (statement) => {
      const sql = typeof statement === "string" ? statement : statement.sql;
      const rows = sql.includes("FROM storage_registrations") ? [registration, registration] : [];
      return { columns: registrationColumns, rows, rowsAffected: 0, lastInsertRowid: null };
    },
    transaction: unused,
    close: unused,
  };
  const operations = createNodeRegistryOperations({
    existingApplicationClient: async () => client,
    mutableApplicationClient: unused,
    requireApplicationAuthority: async () => undefined,
    prepareCreate: unused,
    projectRootFor: unused,
    clock: { now: unused },
    failures: { checkpoint: unused },
    databases: { createCanonical: unused, createRuntime: unused, verifySealed: unused },
    options: {},
  });
  const exit = await Effect.runPromiseExit(operations.registryWitnesses(projectId, "/unused"));
  expect(Exit.hasFails(exit)).toBe(true);
  expect(Exit.hasDies(exit)).toBe(false);
  const failure = Exit.isFailure(exit) && Cause.squash(exit.cause);
  expect(failure).toBeInstanceOf(ProjectStorageBrokenError);
  expect(failure).toMatchObject({
    message: "Project Storage registry witness authority is invalid.",
  });
});
