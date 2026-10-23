import { existsSync, realpathSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll } from "vitest";
import { createTemporaryApplicationRoot } from "./project-storage-runtime-fixture.js";
import { step94 } from "./trace-94.js";

/**
 * Storage root templates for one test file (#94): the first use of a key builds a real root,
 * and every use answers a fresh whole-root copy of it. A failed build fails every use of its key.
 */
const templates = new Map<string, Promise<string>>();

afterAll(async () => {
  const roots = await Promise.allSettled(templates.values());
  templates.clear();
  for (const root of roots)
    if (root.status === "fulfilled")
      await rm(root.value, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
});

async function buildTemplate(build: (root: string) => Promise<void>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-root-template-"));
  try {
    await build(root);
  } catch (error) {
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }).catch(
      (cleanup: unknown) => {
        throw new AggregateError([error, cleanup], "A template build failed and its root remains.");
      },
    );
    throw error;
  }
  return root;
}

/** A fresh temporary application root holding a copy of the template built for `key`. */
export async function copyFromTemplate(
  key: string,
  build: (root: string) => Promise<void>,
): Promise<string> {
  let template = templates.get(key);
  if (template === undefined) {
    template = buildTemplate(build);
    templates.set(key, template);
  }
  const source = await template;
  const root = await createTemporaryApplicationRoot();
  await step94("template.copy", () => cp(source, root, { recursive: true }));
  relocateStorageLocations(source, root);
  return root;
}

/**
 * Points a copied root's Storage locations at the copy. Storage records each location under the
 * physical (long) spelling of its root, so this writes what a real create in `to` would have written;
 * `canonical-database-template.integration.test.ts` proves the copy then equals a real create.
 */
function relocateStorageLocations(from: string, to: string): void {
  const file = path.join(to, "application.db");
  if (!existsSync(file))
    throw new Error("A copied Storage root has no application.db to relocate.");
  const database = new DatabaseSync(file);
  try {
    const update = database.prepare(
      "UPDATE storage_locations SET normalized_path = ? WHERE location_id = ?",
    );
    const rows = database.prepare("SELECT location_id, normalized_path FROM storage_locations");
    for (const row of rows.all()) {
      const relative = path.relative(realpathSync.native(from), String(row["normalized_path"]));
      if (relative.startsWith("..") || path.isAbsolute(relative))
        throw new Error("A template Storage location lies outside its root.");
      update.run(path.resolve(realpathSync.native(to), relative), String(row["location_id"]));
    }
  } finally {
    database.close();
  }
}
