import "./registration-peer-loader.mjs";

// A separate process that runs one Storage upgrade and stops at a checkpoint until it is killed.
// It builds its own dependencies with the same fixed ids as the upgrade fixture's first attempt.
const { createNodeProjectStorageDependencies } = await import(
  "../../src/storage/project-storage-node-adapters.ts"
);
const { createProjectStorageOwner } = await import("../../src/storage/project-storage-store.ts");
const {
  CanonicalDatabaseLineageIdSchema,
  decodeStrict,
  ProjectIdSchema,
  ProjectStorageCreateRequestIdSchema,
  RuntimeDatabaseLineageIdSchema,
  StorageGenerationIdSchema,
  StorageIdSchema,
} = await import("@slopstop/protocol");

const [root, migrations, checkpoint] = process.argv.slice(2);
const id = (suffix) => `00000000-0000-4000-8000-${suffix}`;
const clock = ["2026-10-05T10:00:00.000Z", "2026-10-05T10:00:01.000Z"];
process.on("message", () => undefined);

const owner = createProjectStorageOwner(
  createNodeProjectStorageDependencies({
    applicationStorageRoot: root,
    migrationResourcesRoot: migrations,
    applicationVersion: "0.0.0",
    ids: {
      storageId: () => decodeStrict(StorageIdSchema, id("000000000012")),
      locationId: () => id("000000000013"),
      generationId: () => decodeStrict(StorageGenerationIdSchema, id("000000000024")),
      canonicalLineageId: () => decodeStrict(CanonicalDatabaseLineageIdSchema, id("000000000015")),
      runtimeLineageId: () => decodeStrict(RuntimeDatabaseLineageIdSchema, id("000000000016")),
      upgradeId: () => decodeStrict(ProjectStorageCreateRequestIdSchema, id("0000000000a1")),
    },
    clock: {
      now: () => {
        const next = clock.shift();
        if (next === undefined) throw new Error("Unexpected Storage clock read in the peer.");
        return next;
      },
    },
    failures: {
      checkpoint: async (point) => {
        if (point !== checkpoint) return;
        process.send({ kind: "checkpoint", point });
        await new Promise(() => undefined);
      },
    },
  }),
);

try {
  const outcome = await owner.upgrade({
    projectId: decodeStrict(ProjectIdSchema, id("000000000010")),
  });
  process.send({ kind: "unexpected-result", outcome });
} catch (error) {
  process.send({ kind: "failed", message: String(error) });
}
