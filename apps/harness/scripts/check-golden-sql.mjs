import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Fixed raw S2 blobs from 37e3f83a9b0ce1868d8b896b9f9b0a9cdfe3f2e2.
// The reference has a terminal LF; the migration does not. Never normalize either.
const goldenFiles = [
  {
    path: "apps/harness/drizzle/canonical/0001_canonical_project_writer.sql",
    sha256: "d1abcf781ec35e969baaf50aac2695d22c8b8c7f01bffc03fa5fbf54ad06edfc",
  },
  {
    path: "apps/harness/tests/fixtures/canonical-project-writer-generation-2.sql",
    sha256: "56bc8d7b40285618d64dbae88dbe7cf94f38f4f83e905f8add62f4d74b4b5ca2",
  },
];

function checkFileIdentity(absolute, fileSystem, identities) {
  try {
    const metadata = fileSystem.lstatSync(absolute, { bigint: true });
    if (metadata.isSymbolicLink()) return "GOLDEN_SQL_SYMLINK";
    if (!metadata.isFile()) return "GOLDEN_SQL_NOT_REGULAR";
    const identity = `${metadata.dev}:${metadata.ino}`;
    if (metadata.nlink !== 1n || identities.has(identity)) return "GOLDEN_SQL_ALIAS";
    if (fileSystem.realpathSync(absolute) !== absolute) return "GOLDEN_SQL_ALIAS";
    identities.add(identity);
    return undefined;
  } catch (error) {
    return error.code === "ENOENT" ? "GOLDEN_SQL_MISSING" : "GOLDEN_SQL_METADATA_ERROR";
  }
}

function checkFileHash(absolute, expected, fileSystem) {
  try {
    const actual = createHash("sha256").update(fileSystem.readFileSync(absolute)).digest("hex");
    return actual === expected ? undefined : "GOLDEN_SQL_HASH_MISMATCH";
  } catch {
    return "GOLDEN_SQL_READ_ERROR";
  }
}

export function checkGoldenSql({
  root = process.cwd(),
  fileSystem = { lstatSync, readFileSync, realpathSync },
} = {}) {
  const identities = new Set();
  for (const file of goldenFiles) {
    const absolute = resolve(root, file.path);
    const code =
      checkFileIdentity(absolute, fileSystem, identities) ??
      checkFileHash(absolute, file.sha256, fileSystem);
    if (code) return { ok: false, code, path: file.path };
  }
  return { ok: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = checkGoldenSql();
  if (result.ok) {
    process.stdout.write("Golden SQL verified: 2 independent pinned files.\n");
  } else {
    process.stderr.write(`${result.code}: ${result.path}\n`);
    process.exitCode = 1;
  }
}
