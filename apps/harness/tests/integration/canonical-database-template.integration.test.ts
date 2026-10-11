import path from "node:path";
import { decodeStrict, ProjectIdSchema } from "@slopstop/protocol";
import { expect, it } from "vitest";
import {
  buildCanonicalCommandDatabase,
  canonicalCommandProjectId,
  createCanonicalCommandDatabase,
} from "./canonical-command-database-fixture.js";
import { payloadOf } from "./project-storage-open-fixture.js";
import {
  createStorageRuntimeForRoot,
  createTemporaryApplicationRoot,
} from "./project-storage-runtime-fixture.js";
import { databaseContents, rootFiles } from "./storage-root-equivalence.js";

/** A real canonical root and a template copy for the same `extended` choice (#94). */
async function realAndCopy(extended: boolean) {
  const real = await createTemporaryApplicationRoot();
  await buildCanonicalCommandDatabase(real, { extended, projectId: canonicalCommandProjectId });
  const copy = path.resolve(
    await createCanonicalCommandDatabase(extended, canonicalCommandProjectId),
    "../../../..",
  );
  return { real, copy };
}

/** `contents` with its own root path replaced by a token, so two roots compare by content. */
function rootFree(contents: ReturnType<typeof databaseContents>, root: string) {
  const escaped = JSON.stringify(root).slice(1, -1);
  const free = (rows: readonly string[]) => rows.map((row) => row.split(escaped).join("<root>"));
  const rows = Object.entries(contents.rows).map(([table, values]) => [table, free(values)]);
  return { schema: free(contents.schema), rows: Object.fromEntries(rows) };
}

async function openPayload(root: string) {
  const storage = await createStorageRuntimeForRoot(root, {
    clockNow: () => "2026-09-05T12:00:00.000Z",
  });
  try {
    const projectId = decodeStrict(ProjectIdSchema, canonicalCommandProjectId);
    return payloadOf(await storage.open({ projectId }));
  } finally {
    await storage.stop();
  }
}

it.each([true, false])(
  "a canonical template copy holds the same files, schemas and rows as a real create (extended %s)",
  async (extended) => {
    const { real, copy } = await realAndCopy(extended);
    const [realFiles, copiedFiles] = await Promise.all([rootFiles(real), rootFiles(copy)]);

    expect(Object.keys(copiedFiles).sort()).toEqual(Object.keys(realFiles).sort());
    // Byte-equal except application.db, whose one Storage location row names its own root.
    for (const [file, digest] of Object.entries(realFiles))
      if (file !== "application.db")
        expect({ file, digest: copiedFiles[file] }).toEqual({ file, digest });
    const databases = Object.keys(realFiles).filter((file) => file.endsWith(".db"));
    expect(databases.length).toBeGreaterThan(0);
    for (const database of databases)
      expect(rootFree(databaseContents(path.join(copy, database)), copy)).toEqual(
        rootFree(databaseContents(path.join(real, database)), real),
      );
  },
);

it.each([true, false])(
  "a canonical template copy opens through the real Storage runtime like a real create (extended %s)",
  async (extended) => {
    const { real, copy } = await realAndCopy(extended);

    const copied = await openPayload(copy);

    expect(copied).toEqual(await openPayload(real));
    // The extra conformance table is not Storage schema, so only the plain database opens.
    if (!extended) expect(copied).toMatchObject({ status: "opened", mode: "read-write" });
  },
);
