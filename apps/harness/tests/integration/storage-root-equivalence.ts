import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Every file under `root` by relative path, with its SHA-256. */
export async function rootFiles(root: string): Promise<Record<string, string>> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files: Record<string, string> = {};
  for (const entry of entries.filter((candidate) => candidate.isFile())) {
    const file = path.join(entry.parentPath, entry.name);
    const digest = createHash("sha256")
      .update(await readFile(file))
      .digest("hex");
    files[path.relative(root, file).split(path.sep).join("/")] = digest;
  }
  return files;
}

function sortedRows(database: DatabaseSync, sql: string): string[] {
  return database
    .prepare(sql)
    .all()
    .map((row) =>
      JSON.stringify(row, (_key, value: unknown) =>
        typeof value === "bigint" ? `${value}n` : value,
      ),
    )
    .sort();
}

/** The schema and the rows of every table of one SQLite file, read-only and order-free. */
export function databaseContents(file: string) {
  const database = new DatabaseSync(file, { readOnly: true });
  try {
    const schema = sortedRows(database, "SELECT type, name, tbl_name, sql FROM sqlite_master");
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => String(row["name"]));
    const rows = Object.fromEntries(
      tables.map((table) => [table, sortedRows(database, `SELECT * FROM "${table}"`)]),
    );
    return { schema, rows };
  } finally {
    database.close();
  }
}
