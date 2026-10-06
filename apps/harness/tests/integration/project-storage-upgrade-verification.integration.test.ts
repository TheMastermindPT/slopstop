import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it } from "vitest";
import { withDatabase } from "../../src/storage/local-libsql-worker-client.js";
import { tableFingerprints } from "../../src/storage/project-storage-upgrade-verification.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function databaseWithBlob(value: Uint8Array): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-upgrade-fingerprint-"));
  roots.push(root);
  const databasePath = path.join(root, "values.db");
  const database = new DatabaseSync(databasePath);
  try {
    database.exec("CREATE TABLE stored_values (id INTEGER PRIMARY KEY, value)");
    database.prepare("INSERT INTO stored_values (id, value) VALUES (1, ?)").run(value);
  } finally {
    database.close();
  }
  return databasePath;
}

async function fingerprintsOf(databasePath: string) {
  return withDatabase(databasePath, { readOnly: true }, (client) =>
    tableFingerprints(client, new Set()),
  );
}

it("fingerprints rows that differ only in a BLOB value", async () => {
  const first = await fingerprintsOf(await databaseWithBlob(Uint8Array.of(1, 2, 3)));
  const second = await fingerprintsOf(await databaseWithBlob(Uint8Array.of(1, 2, 4)));
  const same = await fingerprintsOf(await databaseWithBlob(Uint8Array.of(1, 2, 3)));
  expect(first["stored_values"]).not.toBe(second["stored_values"]);
  expect(first).toEqual(same);
});
