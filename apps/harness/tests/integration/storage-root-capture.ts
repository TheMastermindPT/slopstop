import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * A normalised picture of an application root: every registry row, every manifest under
 * `projects/`, and the directory listing. Run unchanged at the capture revision and in the
 * fidelity test, so both sides are read the same way.
 */
export type StorageRootCapture = Readonly<{
  registry: Record<string, unknown[]>;
  manifests: Record<string, unknown>;
  listing: readonly string[];
}>;

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gu;
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;
const sizeKeys = new Set(["sizeBytes", "size_bytes"]);

function registryRows(databasePath: string): Record<string, unknown[]> {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const tables = database
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => String(row["name"]));
    return Object.fromEntries(
      tables.map((table) => {
        const columns = database.prepare(`PRAGMA table_info(${table})`).all();
        const order = columns.map((_, index) => index + 1).join(", ");
        return [table, database.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all()];
      }),
    );
  } finally {
    database.close();
  }
}

async function projectEntries(root: string) {
  const projects = path.join(root, "projects");
  const entries = await readdir(projects, { recursive: true, withFileTypes: true });
  return entries
    .map((entry) => {
      const absolute = path.join(entry.parentPath, entry.name);
      const relative = path.relative(projects, absolute).split(path.sep).join("/");
      return { absolute, relative, directory: entry.isDirectory() };
    })
    .sort((left, right) => left.relative.localeCompare(right.relative));
}

function isSize(key: string | undefined, value: unknown): boolean {
  return typeof value === "number" && sizeKeys.has(key ?? "");
}

/** Replaces ids by first-appearance ordinals and erases the root, times, digests and sizes. */
function normaliser(root: string) {
  const ordinals = new Map<string, string>();
  const id = (value: string) => {
    const known = ordinals.get(value);
    if (known !== undefined) return known;
    const next = `<id-${ordinals.size + 1}>`;
    ordinals.set(value, next);
    return next;
  };
  const text = (value: string): string => {
    if (instantPattern.test(value)) return "<instant>";
    if (sha256Pattern.test(value)) return "<sha256>";
    const rooted = value.startsWith(root)
      ? `<root>${value.slice(root.length).split(path.sep).join("/")}`
      : value;
    return rooted.replace(uuidPattern, id);
  };
  const walk = (value: unknown, key?: string): unknown => {
    if (isSize(key, value)) return "<size>";
    if (typeof value === "string") return text(value);
    if (Array.isArray(value)) return value.map((item) => walk(item));
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([entryKey, entry]) => [text(entryKey), walk(entry, entryKey)]),
      );
    }
    return value;
  };
  return { text, walk };
}

export async function captureStorageRoot(root: string): Promise<StorageRootCapture> {
  const entries = await projectEntries(root);
  const { text, walk } = normaliser(root);
  const registry = walk(registryRows(path.join(root, "application.db"))) as Record<
    string,
    unknown[]
  >;
  const manifests: Record<string, unknown> = {};
  for (const entry of entries) {
    if (entry.directory || !entry.relative.endsWith(".json")) continue;
    manifests[text(entry.relative)] = walk(JSON.parse(await readFile(entry.absolute, "utf8")));
  }
  const listing = entries.map((entry) => `${text(entry.relative)}${entry.directory ? "/" : ""}`);
  return { registry, manifests, listing };
}

type CaptureLine =
  | readonly ["registry", string, unknown[]]
  | readonly ["manifests", string, unknown]
  | readonly ["listing", readonly string[]];

/** JSON Lines, one registry table, manifest or listing per line, in capture order. */
export function serializeStorageRootCapture(capture: StorageRootCapture): string {
  const lines: CaptureLine[] = [
    ...Object.entries(capture.registry).map(([table, rows]) => ["registry", table, rows] as const),
    ...Object.entries(capture.manifests).map(
      ([file, value]) => ["manifests", file, value] as const,
    ),
    ["listing", capture.listing],
  ];
  return `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`;
}
