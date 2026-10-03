import { readFile } from "node:fs/promises";
import { Result, Schema } from "effect";
import { lstatIfPresent } from "./project-storage-filesystem-authority.js";
import {
  type ProjectStorageManifestV1,
  parseProjectStorageManifest,
} from "./project-storage-manifest.js";
import { isUnavailableStorageError, storageErrorCode } from "./project-storage-node-errors.js";
import type { ManifestBlockingStatus } from "./project-storage-opening.js";

export type ManifestIdentityAuthority = Readonly<{
  projectId: ProjectStorageManifestV1["projectId"];
  storageId: ProjectStorageManifestV1["storageId"];
  generationId: ProjectStorageManifestV1["generationId"];
  createRequestId: ProjectStorageManifestV1["provenance"]["createRequestId"];
  canonicalDatabaseLineageId: ProjectStorageManifestV1["canonical"]["databaseLineageId"];
  runtimeDatabaseLineageId: ProjectStorageManifestV1["runtime"]["databaseLineageId"];
  createdAt: ProjectStorageManifestV1["createdAt"];
}>;

type OpeningManifestInspection =
  | Readonly<{ status: "blocked"; manifestStatus: ManifestBlockingStatus }>
  | Readonly<{ status: "current"; manifest: ProjectStorageManifestV1 }>;
type ManifestEntryInspection =
  | Extract<OpeningManifestInspection, { status: "blocked" }>
  | Readonly<{ status: "present" }>;
type ManifestSourceInspection =
  | Extract<OpeningManifestInspection, { status: "blocked" }>
  | Readonly<{ status: "read"; source: string }>;

// Reads only the version; the full manifest schema decides every other member.
const manifestVersionSchema = Schema.Struct({
  manifestVersion: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
});

const blocked = (manifestStatus: ManifestBlockingStatus) => ({
  status: "blocked" as const,
  manifestStatus,
});

export function manifestIdentityMatches(input: {
  manifest: ProjectStorageManifestV1;
  authority: ManifestIdentityAuthority;
}): boolean {
  return [
    input.manifest.projectId === input.authority.projectId,
    input.manifest.storageId === input.authority.storageId,
    input.manifest.generationId === input.authority.generationId,
    input.manifest.provenance.createRequestId === input.authority.createRequestId,
    input.manifest.canonical.databaseLineageId === input.authority.canonicalDatabaseLineageId,
    input.manifest.runtime.databaseLineageId === input.authority.runtimeDatabaseLineageId,
    input.manifest.createdAt === input.authority.createdAt,
  ].every(Boolean);
}

async function inspectManifestEntry(manifestPath: string): Promise<ManifestEntryInspection> {
  try {
    const entry = await lstatIfPresent({ targetPath: manifestPath });
    if (entry === undefined) return blocked("missing");
    if (entry.isSymbolicLink() || !entry.isFile()) return blocked("broken");
    return { status: "present" };
  } catch (error) {
    return blocked(isUnavailableStorageError({ error }) ? "unavailable" : "corrupt");
  }
}

async function readManifestSource(manifestPath: string): Promise<ManifestSourceInspection> {
  try {
    return { status: "read", source: await readFile(manifestPath, "utf8") };
  } catch (error) {
    if (storageErrorCode({ error }) === "ENOENT") return blocked("missing");
    return blocked(isUnavailableStorageError({ error }) ? "unavailable" : "corrupt");
  }
}

function parseOpeningManifest(source: string): OpeningManifestInspection {
  let json: unknown;
  try {
    json = JSON.parse(source);
  } catch {
    return blocked("corrupt");
  }
  const version = Schema.decodeUnknownResult(manifestVersionSchema)(json);
  if (Result.isFailure(version)) return blocked("corrupt");
  if (version.success.manifestVersion > 1) return blocked("unsupported-newer");
  if (version.success.manifestVersion !== 1) return blocked("corrupt");
  try {
    return { status: "current", manifest: parseProjectStorageManifest(source) };
  } catch {
    return blocked("corrupt");
  }
}

export async function inspectOpeningManifest(input: {
  manifestPath: string;
  authority: ManifestIdentityAuthority;
}): Promise<OpeningManifestInspection> {
  const entry = await inspectManifestEntry(input.manifestPath);
  if (entry.status === "blocked") return entry;
  const source = await readManifestSource(input.manifestPath);
  if (source.status === "blocked") return source;
  const parsed = parseOpeningManifest(source.source);
  if (parsed.status === "blocked") return parsed;
  if (!manifestIdentityMatches({ manifest: parsed.manifest, authority: input.authority })) {
    return blocked("identity-conflict");
  }
  return parsed;
}
