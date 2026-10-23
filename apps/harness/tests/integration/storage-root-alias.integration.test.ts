import { execSync } from "node:child_process";
import { cp, symlink } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { createNodeProjectStorageDependencies } from "../../src/storage/project-storage-node-adapters.js";
import {
  createHealthyProjectStorageFixture,
  openRequest,
  payloadOf,
} from "./project-storage-open-fixture.js";
import {
  checkedInMigrationRoot,
  createRequest,
  createStorageRuntimeForRoot,
  createTemporaryApplicationRoot,
  fixedCreationIds,
  projectStorageIntegrationTimeout,
} from "./project-storage-runtime-fixture.js";

/**
 * The Windows 8.3 alias of an existing folder, as `cmd` reports it. A volume without 8.3 names
 * answers the long name itself; that is a failure, never a silent pass.
 */
function shortAlias(directory: string): string {
  // `execSync` runs the line through `cmd.exe` on Windows, where `%~sI` gives the 8.3 spelling.
  const alias = execSync(`for %I in ("${directory}") do @echo %~sI`, { encoding: "utf8" }).trim();
  if (alias.toLowerCase() === directory.toLowerCase()) {
    throw new Error(`No 8.3 alias available for ${directory}.`);
  }
  return alias;
}

async function createProjectStorage(root: string): Promise<void> {
  const runtime = await createStorageRuntimeForRoot(root);
  try {
    await expect(runtime.create(createRequest)).resolves.toMatchObject({
      payload: { status: "created" },
    });
  } finally {
    await runtime.stop();
  }
}

async function openPayload(root: string): Promise<unknown> {
  const runtime = await createStorageRuntimeForRoot(root);
  try {
    return payloadOf(await runtime.open(openRequest));
  } finally {
    await runtime.stop();
  }
}

const openedReadWrite = {
  status: "opened",
  mode: "read-write",
  identity: {
    storageId: fixedCreationIds.storageId,
    generationId: fixedCreationIds.generationId,
    canonicalDatabaseLineageId: fixedCreationIds.canonicalDatabaseLineageId,
    runtimeDatabaseLineageId: fixedCreationIds.runtimeDatabaseLineageId,
  },
};

it.runIf(process.platform === "win32")(
  "opens Storage created through the long root through its 8.3 alias",
  async () => {
    const root = await createHealthyProjectStorageFixture();
    expect(await openPayload(shortAlias(root))).toMatchObject(openedReadWrite);
  },
  projectStorageIntegrationTimeout,
);

it.runIf(process.platform === "win32")(
  "opens Storage created through the 8.3 alias through the long root",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createProjectStorage(shortAlias(root));
    expect(await openPayload(root)).toMatchObject(openedReadWrite);
  },
  projectStorageIntegrationTimeout,
);

it.runIf(process.platform === "win32")(
  "opens Storage created under a missing child of the 8.3 alias through the long root",
  async () => {
    const root = await createTemporaryApplicationRoot();
    await createProjectStorage(path.join(shortAlias(root), "missing-child"));
    expect(await openPayload(path.join(root, "missing-child"))).toMatchObject(openedReadWrite);
  },
  projectStorageIntegrationTimeout,
);

function nodeStorageWithRoot(applicationStorageRoot: string) {
  return createNodeProjectStorageDependencies({
    applicationStorageRoot,
    migrationResourcesRoot: checkedInMigrationRoot,
    applicationVersion: "0.0.0",
  });
}

it("refuses a symbolic-link Storage root before any Storage exists", async () => {
  const target = await createTemporaryApplicationRoot();
  const link = path.join(await createTemporaryApplicationRoot(), "linked-root");
  await symlink(target, link, "junction");
  expect(() => nodeStorageWithRoot(link)).toThrow("Storage root must not be a symbolic link.");
});

it("reports a Storage root that cannot be inspected, never resolving it", () => {
  expect(() => nodeStorageWithRoot("C:\\invalid\0root")).toThrow(
    expect.objectContaining({ code: "ERR_INVALID_ARG_VALUE" }),
  );
});

it(
  "still refuses Storage whose rows name another folder",
  async () => {
    const original = await createHealthyProjectStorageFixture();
    const copy = await createTemporaryApplicationRoot();
    await cp(original, copy, { recursive: true });
    expect(await openPayload(copy)).toEqual({
      status: "broken",
      request: openRequest,
      diagnostic: {
        code: "PROJECT_STORAGE_OWNER_FAILED",
        message: "Registered Project Storage authority is inconsistent.",
      },
    });
  },
  projectStorageIntegrationTimeout,
);
