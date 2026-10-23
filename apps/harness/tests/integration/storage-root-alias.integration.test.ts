import { execSync } from "node:child_process";
import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import { applicationDatabaseFor } from "../../src/registration/registry-database.js";
import {
  acquireApplicationDatabaseAuthority,
  createApplicationDatabaseAuthority,
} from "../../src/storage/application-database-authority.js";
import { StorageRootCanonicalizationError } from "../../src/storage/physical-root.js";
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

const homeRoots: string[] = [];

afterEach(async () => {
  const roots = homeRoots.splice(0);
  for (const root of roots) await rm(root, { recursive: true, force: true, maxRetries: 10 });
});

/**
 * A new application root under the home folder. The alias rows use it because the system volume
 * keeps 8.3 names, while a CI temp volume may not.
 */
async function homeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.homedir(), "slopstop-alias-root-"));
  homeRoots.push(root);
  return root;
}

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
    const root = await homeRoot();
    await createProjectStorage(root);
    expect(await openPayload(shortAlias(root))).toMatchObject(openedReadWrite);
  },
  projectStorageIntegrationTimeout,
);

it.runIf(process.platform === "win32")(
  "opens Storage created through the 8.3 alias through the long root",
  async () => {
    const root = await homeRoot();
    await createProjectStorage(shortAlias(root));
    expect(await openPayload(root)).toMatchObject(openedReadWrite);
  },
  projectStorageIntegrationTimeout,
);

it.runIf(process.platform === "win32")(
  "opens Storage created under a missing child of the 8.3 alias through the long root",
  async () => {
    const root = await homeRoot();
    await createProjectStorage(path.join(shortAlias(root), "missing-child"));
    expect(await openPayload(path.join(root, "missing-child"))).toMatchObject(openedReadWrite);
  },
  projectStorageIntegrationTimeout,
);

function authorityFor(applicationStorageRoot: string) {
  return createApplicationDatabaseAuthority({
    applicationStorageRoot,
    migrationResourcesRoot: checkedInMigrationRoot,
  });
}

function registryJoin(applicationStorageRoot: string, authorityRoot: string) {
  const applicationDatabase = authorityFor(authorityRoot);
  const joined = applicationDatabaseFor({
    applicationStorageRoot,
    migrationResourcesRoot: checkedInMigrationRoot,
    applicationDatabase,
  });
  return { applicationDatabase, joined };
}

it.runIf(process.platform === "win32")(
  "joins the registry to an authority of the same folder in either spelling",
  async () => {
    const root = await homeRoot();
    const alias = shortAlias(root);
    for (const [registryRoot, authorityRoot] of [
      [root, alias],
      [alias, root],
    ] as const) {
      const { applicationDatabase, joined } = registryJoin(registryRoot, authorityRoot);
      expect(joined).toBe(applicationDatabase);
    }
  },
);

it("still refuses to join the registry to an authority of another folder", async () => {
  const root = await createTemporaryApplicationRoot();
  const other = await createTemporaryApplicationRoot();
  expect(() => registryJoin(root, other)).toThrow(
    "Application database authority belongs to another installation root.",
  );
});

function nodeStorageWithRoot(applicationStorageRoot: string) {
  return createNodeProjectStorageDependencies({
    applicationStorageRoot,
    migrationResourcesRoot: checkedInMigrationRoot,
    applicationVersion: "0.0.0",
  });
}

async function linkedRoot(): Promise<string> {
  const target = await createTemporaryApplicationRoot();
  const link = path.join(await createTemporaryApplicationRoot(), "linked-root");
  await symlink(target, link, "junction");
  return link;
}

const linkRefusal = {
  _tag: "StorageRootCanonicalizationError",
  reason: "symbolic-link",
  message: "Root must not be a symbolic link.",
};

it("refuses a symbolic-link Storage root before any Storage exists", async () => {
  const link = await linkedRoot();
  expect(() => nodeStorageWithRoot(link)).toThrow(expect.objectContaining(linkRefusal));
});

it("fails the authority acquire on its typed channel for a symbolic-link root", async () => {
  const link = await linkedRoot();
  const refusal = await Effect.runPromise(
    Effect.scoped(
      Effect.flip(
        acquireApplicationDatabaseAuthority({
          applicationStorageRoot: link,
          migrationResourcesRoot: checkedInMigrationRoot,
        }),
      ),
    ),
  );
  expect(refusal).toBeInstanceOf(StorageRootCanonicalizationError);
  expect(refusal).toMatchObject(linkRefusal);
});

it("reports a Storage root that cannot be inspected, never resolving it", () => {
  expect(() => nodeStorageWithRoot("C:\\invalid\0root")).toThrow(
    expect.objectContaining({
      _tag: "StorageRootCanonicalizationError",
      reason: "inspection-failed",
      cause: expect.objectContaining({ code: "ERR_INVALID_ARG_VALUE" }),
    }),
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
