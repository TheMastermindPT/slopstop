import type { Dirent } from "node:fs";
import { lstat, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import {
  acceptsStrict,
  decodeStrict,
  decodeStrictResult,
  type ProjectId,
  ProjectIdSchema,
  ProjectStorageCreateRequestIdSchema,
  StorageGenerationIdSchema,
} from "@slopstop/protocol";
import { Result } from "effect";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import {
  canonicalDatabaseFilename,
  canonicalWriterLeaseFilename,
  projectStorageManifestFilename,
  runtimeDatabaseFilename,
} from "./project-storage-manifest.js";
import { storageErrorCode } from "./project-storage-node-errors.js";
import type { PriorStateWitnessKind } from "./project-storage-store.js";

export const witnessOrder = [
  "registration-record",
  "location-record",
  "generation-record",
  "project-root",
  "repository-marker",
  "writer-lease",
  "manifest",
  "generation-directory",
  "canonical-database",
  "runtime-database",
  "canonical-wal",
  "canonical-shm",
  "canonical-rollback-journal",
  "runtime-wal",
  "runtime-shm",
  "runtime-rollback-journal",
  "local-snapshot",
  "deletion-tombstone",
  "unfinished-storage-operation",
] as const satisfies readonly PriorStateWitnessKind[];

const reservedFileWitnesses = new Map<string, PriorStateWitnessKind>([
  [".slopstop-repository", "repository-marker"],
  [canonicalWriterLeaseFilename, "writer-lease"],
  [projectStorageManifestFilename, "manifest"],
  [canonicalDatabaseFilename, "canonical-database"],
  [`${canonicalDatabaseFilename}-wal`, "canonical-wal"],
  [`${canonicalDatabaseFilename}-shm`, "canonical-shm"],
  [`${canonicalDatabaseFilename}-journal`, "canonical-rollback-journal"],
  [runtimeDatabaseFilename, "runtime-database"],
  [`${runtimeDatabaseFilename}-wal`, "runtime-wal"],
  [`${runtimeDatabaseFilename}-shm`, "runtime-shm"],
  [`${runtimeDatabaseFilename}-journal`, "runtime-rollback-journal"],
  ["deletion.tombstone", "deletion-tombstone"],
  ["storage-operation.journal", "unfinished-storage-operation"],
]);

const reservedDirectoryWitnesses = new Map<string, PriorStateWitnessKind>([
  ["snapshots", "local-snapshot"],
  ["storage-operations", "unfinished-storage-operation"],
]);

const rootDatabaseWitnessKinds = new Set<PriorStateWitnessKind>([
  "canonical-database",
  "runtime-database",
  "canonical-wal",
  "canonical-shm",
  "canonical-rollback-journal",
  "runtime-wal",
  "runtime-shm",
  "runtime-rollback-journal",
]);

const maximumProjectDirectoryEntries = 256;
const projectRootOnlyWitnessKinds = new Set<PriorStateWitnessKind>([
  "repository-marker",
  "writer-lease",
]);
const maximumGenerationDirectoryEntries = 16;

export type FilesystemWitnessScan = Readonly<{
  kinds: readonly PriorStateWitnessKind[];
  hasStagingGeneration: boolean;
  ordinaryGenerationIds: readonly (typeof StorageGenerationIdSchema.Type)[];
  hasRootDatabaseWitness: boolean;
}>;

type MutableFilesystemWitnessScan = {
  kinds: Set<PriorStateWitnessKind>;
  hasStagingGeneration: boolean;
  ordinaryGenerationIds: (typeof StorageGenerationIdSchema.Type)[];
  hasRootDatabaseWitness: boolean;
};

export async function lstatIfPresent(input: { targetPath: string }) {
  try {
    return await lstat(input.targetPath);
  } catch (error) {
    if (storageErrorCode({ error }) === "ENOENT") return undefined;
    throw error;
  }
}

export async function openingDatabaseIsPresent(databasePath: string): Promise<boolean> {
  const entry = await lstatIfPresent({ targetPath: databasePath });
  if (entry === undefined) return false;
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new ProjectStorageBrokenError("Project Storage database type is invalid.");
  }
  return true;
}

export async function requirePlainEntry(input: {
  entryPath: string;
  message: string;
  kind: "directory" | "file";
}): Promise<void> {
  const entry = await lstatIfPresent({ targetPath: input.entryPath });
  if (entry === undefined) throw new ProjectStorageBrokenError(input.message);
  const expectedKind = input.kind === "directory" ? entry.isDirectory() : entry.isFile();
  const valid = [!entry.isSymbolicLink(), expectedKind].every(Boolean);
  if (!valid) throw new ProjectStorageBrokenError(input.message);
}

function generationFileWitnessKind(input: {
  entry: Dirent;
  deferManifestTypeValidation: boolean;
}): PriorStateWitnessKind {
  const kind = reservedFileWitnesses.get(input.entry.name);
  if (defersManifestTypeValidation(kind, input.deferManifestTypeValidation)) return kind;
  const plainFile = [!input.entry.isSymbolicLink(), input.entry.isFile()].every(Boolean);
  if (!plainFile) {
    throw new ProjectStorageBrokenError("Project Storage generation witness type is invalid.");
  }
  if (kind === undefined) {
    throw new ProjectStorageBrokenError("Project Storage generation contains an unknown witness.");
  }
  if (projectRootOnlyWitnessKinds.has(kind)) {
    throw new ProjectStorageBrokenError("Project Storage generation contains an unknown witness.");
  }
  return kind;
}

function defersManifestTypeValidation(
  kind: PriorStateWitnessKind | undefined,
  deferManifestTypeValidation: boolean,
): kind is "manifest" {
  return deferManifestTypeValidation && kind === "manifest";
}

async function inspectGenerationDirectory(input: {
  directoryPath: string;
  kinds: Set<PriorStateWitnessKind>;
  deferManifestTypeValidation: boolean;
}): Promise<void> {
  await requirePlainEntry({
    entryPath: input.directoryPath,
    message: "Project Storage generation witness type is invalid.",
    kind: "directory",
  });
  const entries = await readdir(input.directoryPath, { withFileTypes: true });
  if (entries.length > maximumGenerationDirectoryEntries) {
    throw new ProjectStorageBrokenError("Project Storage generation witness set is unbounded.");
  }
  for (const entry of entries) {
    input.kinds.add(
      generationFileWitnessKind({
        entry,
        deferManifestTypeValidation: input.deferManifestTypeValidation,
      }),
    );
  }
}

function recordReservedFileWitness(input: {
  entry: Dirent;
  scan: MutableFilesystemWitnessScan;
}): boolean {
  const fileKind = reservedFileWitnesses.get(input.entry.name);
  if (fileKind === undefined) return false;
  if (!input.entry.isFile()) {
    throw new ProjectStorageBrokenError("Project Storage file witness type is invalid.");
  }
  input.scan.kinds.add(fileKind);
  input.scan.hasRootDatabaseWitness = [
    input.scan.hasRootDatabaseWitness,
    rootDatabaseWitnessKinds.has(fileKind),
  ].some(Boolean);
  return true;
}

function recordReservedDirectoryWitness(input: {
  entry: Dirent;
  scan: MutableFilesystemWitnessScan;
}): boolean {
  const directoryKind = reservedDirectoryWitnesses.get(input.entry.name);
  if (directoryKind === undefined) return false;
  if (!input.entry.isDirectory()) {
    throw new ProjectStorageBrokenError("Project Storage directory witness type is invalid.");
  }
  input.scan.kinds.add(directoryKind);
  return true;
}

function recordReservedRootWitness(input: {
  entry: Dirent;
  scan: MutableFilesystemWitnessScan;
}): boolean {
  if (recordReservedFileWitness(input)) return true;
  return recordReservedDirectoryWitness(input);
}

type ParsedGenerationDirectory = Readonly<{
  generationId: typeof StorageGenerationIdSchema.Type;
  isStaging: boolean;
}>;

function parseGenerationDirectory(input: { name: string }): ParsedGenerationDirectory {
  const stagingPrefix = ".staging-";
  const isStaging = input.name.startsWith(stagingPrefix);
  const generationText = isStaging ? input.name.slice(stagingPrefix.length) : input.name;
  const generationId = decodeStrictResult(StorageGenerationIdSchema, generationText);
  if (Result.isFailure(generationId)) {
    throw new ProjectStorageBrokenError("Project Storage root contains an unknown witness.");
  }
  return { generationId: generationId.success, isStaging };
}

function recordGenerationIdentity(input: {
  generation: ParsedGenerationDirectory;
  scan: MutableFilesystemWitnessScan;
}): void {
  if (input.generation.isStaging) {
    input.scan.hasStagingGeneration = true;
  } else {
    input.scan.ordinaryGenerationIds.push(input.generation.generationId);
  }
}

async function recordGenerationRootWitness(input: {
  projectRoot: string;
  entry: Dirent;
  scan: MutableFilesystemWitnessScan;
  deferManifestTypeValidation: boolean;
}): Promise<void> {
  if (!input.entry.isDirectory()) {
    throw new ProjectStorageBrokenError("Project Storage root contains an unknown witness.");
  }
  const generation = parseGenerationDirectory({ name: input.entry.name });
  recordGenerationIdentity({ generation, scan: input.scan });
  input.scan.kinds.add("generation-directory");
  await inspectGenerationDirectory({
    directoryPath: path.join(input.projectRoot, input.entry.name),
    kinds: input.scan.kinds,
    deferManifestTypeValidation: input.deferManifestTypeValidation,
  });
}

async function recordProjectRootEntry(input: {
  projectRoot: string;
  entry: Dirent;
  scan: MutableFilesystemWitnessScan;
  deferManifestTypeValidation: boolean;
}): Promise<void> {
  if (input.entry.isSymbolicLink()) {
    throw new ProjectStorageBrokenError("Project Storage witness must not be a symbolic link.");
  }
  if (recordReservedRootWitness({ entry: input.entry, scan: input.scan })) return;
  await recordGenerationRootWitness(input);
}

function absentFilesystemWitnessScan(): FilesystemWitnessScan {
  return {
    kinds: [],
    hasStagingGeneration: false,
    ordinaryGenerationIds: [],
    hasRootDatabaseWitness: false,
  };
}

function requirePlainProjectRoot(input: { root: Awaited<ReturnType<typeof lstat>> }): void {
  const plainRoot = [!input.root.isSymbolicLink(), input.root.isDirectory()].every(Boolean);
  if (!plainRoot) {
    throw new ProjectStorageBrokenError("Project Storage root witness type is invalid.");
  }
}

function createMutableFilesystemWitnessScan(): MutableFilesystemWitnessScan {
  return {
    kinds: new Set<PriorStateWitnessKind>(["project-root"]),
    hasStagingGeneration: false,
    ordinaryGenerationIds: [],
    hasRootDatabaseWitness: false,
  };
}

function completeFilesystemWitnessScan(input: {
  scan: MutableFilesystemWitnessScan;
}): FilesystemWitnessScan {
  return {
    kinds: witnessOrder.filter((kind) => input.scan.kinds.has(kind)),
    hasStagingGeneration: input.scan.hasStagingGeneration,
    ordinaryGenerationIds: input.scan.ordinaryGenerationIds.sort((left, right) =>
      left.localeCompare(right),
    ),
    hasRootDatabaseWitness: input.scan.hasRootDatabaseWitness,
  };
}

export async function inspectFilesystemWitnesses(input: {
  projectRoot: string;
  deferManifestTypeValidation?: boolean;
}): Promise<FilesystemWitnessScan> {
  const root = await lstatIfPresent({ targetPath: input.projectRoot });
  if (root === undefined) return absentFilesystemWitnessScan();
  requirePlainProjectRoot({ root });
  const scan = createMutableFilesystemWitnessScan();
  const entries = await readdir(input.projectRoot, { withFileTypes: true });
  if (entries.length > maximumProjectDirectoryEntries) {
    throw new ProjectStorageBrokenError("Project Storage witness set is unbounded.");
  }
  for (const entry of entries) {
    await recordProjectRootEntry({
      projectRoot: input.projectRoot,
      entry,
      scan,
      deferManifestTypeValidation: input.deferManifestTypeValidation ?? false,
    });
  }
  return completeFilesystemWitnessScan({ scan });
}

function stagingGenerationText(directoryPath: string): string {
  const directoryName = path.basename(directoryPath);
  return directoryName.startsWith(".staging-") ? directoryName.slice(".staging-".length) : "";
}

const generationFileNames = new Set([
  projectStorageManifestFilename,
  canonicalDatabaseFilename,
  `${canonicalDatabaseFilename}-wal`,
  `${canonicalDatabaseFilename}-shm`,
  `${canonicalDatabaseFilename}-journal`,
  runtimeDatabaseFilename,
  `${runtimeDatabaseFilename}-wal`,
  `${runtimeDatabaseFilename}-shm`,
  `${runtimeDatabaseFilename}-journal`,
]);

function isGenerationShaped(name: string): boolean {
  return [
    acceptsStrict(StorageGenerationIdSchema, name),
    acceptsStrict(StorageGenerationIdSchema, stagingGenerationText(name)),
  ].some(Boolean);
}

/** A plain directory holding only known generation files, each a plain file. */
async function holdsOnlyGenerationFiles(entry: Dirent, directory: string): Promise<boolean> {
  if (entry.isSymbolicLink() || !entry.isDirectory()) return false;
  const files = await readdir(directory, { withFileTypes: true });
  return files.every(
    (file) => generationFileNames.has(file.name) && !file.isSymbolicLink() && file.isFile(),
  );
}

/** A Project's root directory under the (resolved) application storage root. */
export function projectRootPath(applicationStorageRoot: string, projectId: ProjectId): string {
  return path.join(applicationStorageRoot, "projects", decodeStrict(ProjectIdSchema, projectId));
}

/**
 * The only directory names an unfinished upgrade may leave in its Project root, in removal order;
 * its discard proves and removes exactly these.
 */
export function upgradeOutputNames(targetGenerationId: string): readonly [string, string] {
  return [`.staging-${targetGenerationId}`, targetGenerationId];
}

/**
 * Proves an unfinished upgrade's output: the target is no retained generation, every entry of the
 * Project root shaped like a generation in any letter case, other than the retained generations,
 * is exactly `.staging-<target>/` or `<target>/`, and each of those is a plain directory holding
 * only known generation files.
 */
export async function upgradeOutputIsProven(input: {
  projectRoot: string;
  targetGenerationId: string;
  retainedGenerationIds: readonly string[];
}): Promise<boolean> {
  // Backup check: the upgrade chain rule already refuses a target that is a retained source.
  if (input.retainedGenerationIds.includes(input.targetGenerationId)) return false;
  const output = new Set(upgradeOutputNames(input.targetGenerationId));
  for (const entry of await readdir(input.projectRoot, { withFileTypes: true })) {
    // Windows names are case-insensitive: a case variant would resolve to the output's path.
    if (!isGenerationShaped(entry.name.toLowerCase())) continue;
    if (input.retainedGenerationIds.includes(entry.name)) continue;
    if (!output.has(entry.name)) return false;
    const proven = await holdsOnlyGenerationFiles(entry, path.join(input.projectRoot, entry.name));
    if (!proven) return false;
  }
  return true;
}

export function assertStagingPath(input: {
  directoryPath: string;
  applicationStorageRoot: string;
}): void {
  const projectRoot = path.dirname(input.directoryPath);
  const projectsRoot = path.dirname(projectRoot);
  const valid = [
    path.dirname(projectsRoot) === input.applicationStorageRoot,
    path.basename(projectsRoot) === "projects",
    acceptsStrict(ProjectIdSchema, path.basename(projectRoot)),
    acceptsStrict(StorageGenerationIdSchema, stagingGenerationText(input.directoryPath)),
  ].every(Boolean);
  if (!valid) throw new ProjectStorageBrokenError("Project Storage staging path is invalid.");
}

function upgradeDirectoryParent(directoryPath: string): string | undefined {
  const parent = path.dirname(directoryPath);
  if (acceptsStrict(StorageGenerationIdSchema, stagingGenerationText(directoryPath))) return parent;
  const snapshot = [
    path.basename(parent) === "snapshots",
    acceptsStrict(ProjectStorageCreateRequestIdSchema, path.basename(directoryPath)),
  ].every(Boolean);
  return snapshot ? path.dirname(parent) : undefined;
}

/**
 * The Project root an upgrade directory belongs to: exactly `.staging-<uuid>` or
 * `snapshots/<uuid>` beneath `<applicationStorageRoot>/projects/<ProjectId>/`.
 */
export function upgradeDirectoryProjectRoot(input: {
  directoryPath: string;
  applicationStorageRoot: string;
}): string | undefined {
  const projectRoot = upgradeDirectoryParent(path.resolve(input.directoryPath));
  if (projectRoot === undefined) return undefined;
  const projectsRoot = path.dirname(projectRoot);
  const valid = [
    path.dirname(projectsRoot) === path.resolve(input.applicationStorageRoot),
    path.basename(projectsRoot) === "projects",
    acceptsStrict(ProjectIdSchema, path.basename(projectRoot)),
  ].every(Boolean);
  return valid ? projectRoot : undefined;
}

function requirePlainApplicationDatabase(entry: Awaited<ReturnType<typeof lstat>>): void {
  const valid = [!entry.isSymbolicLink(), entry.isFile()].every(Boolean);
  if (!valid) {
    throw new ProjectStorageBrokenError("Project Storage application authority type is invalid.");
  }
}

export async function prepareApplicationDatabase(input: {
  applicationDatabasePath: string;
  applicationStorageRoot: string;
  createIfMissing: boolean;
}): Promise<boolean> {
  const entry = await lstatIfPresent({
    targetPath: input.applicationDatabasePath,
  });
  if (entry !== undefined) {
    requirePlainApplicationDatabase(entry);
    return true;
  }
  if (!input.createIfMissing) return false;
  await mkdir(input.applicationStorageRoot, { recursive: true });
  await requirePlainEntry({
    entryPath: input.applicationStorageRoot,
    message: "Project Storage application root type is invalid.",
    kind: "directory",
  });
  return true;
}
