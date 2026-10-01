import { createHash } from "node:crypto";
import type { BigIntStats } from "node:fs";
import { type FileHandle, lstat, open, stat } from "node:fs/promises";
import path from "node:path";
import { storageErrorCode } from "../storage/project-storage-node-errors.js";
import { observeRepositoryDirectory } from "../storage/repository-identity-observer.js";
import type { composeIdentityQueryValues } from "./git-identity-query-results.js";
import { type IdentityQueryControl, identityQueryInterruption } from "./identity-query-control.js";
import { REGISTRATION_STREAM_BYTE_LIMIT } from "./observer-limits.js";
import {
  type PhysicalIdentity,
  type RepositoryDirectoryObservation,
  type RepositoryPhysicalSnapshot,
  RepositoryPhysicalSnapshotSchema,
  samePhysicalIdentity,
} from "./physical-identity.js";

type PhysicalFailure =
  | Exclude<RepositoryDirectoryObservation, { status: "observed" }>
  | Exclude<ReturnType<typeof identityQueryInterruption>, undefined>
  | Readonly<{
      status: "rejected";
      code: "REPOSITORY_INVALID" | "REPOSITORY_IDENTITY_CHANGED";
    }>;
class PhysicalFault extends Error {
  constructor(readonly result: PhysicalFailure) {
    super("Physical repository observation failed.");
  }
}
const changed = { status: "rejected", code: "REPOSITORY_IDENTITY_CHANGED" } as const;
const invalid = { status: "rejected", code: "REPOSITORY_INVALID" } as const;
const limit = { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" } as const;

function physicalFailure(error: unknown): PhysicalFailure {
  if (error instanceof PhysicalFault) return error.result;
  switch (storageErrorCode({ error })) {
    case "ENOENT":
    case "ENOTDIR":
      return { status: "rejected", code: "REPOSITORY_NOT_FOUND" };
    case "EACCES":
    case "EPERM":
      return { status: "unavailable", code: "REPOSITORY_INACCESSIBLE" };
    default:
      return { status: "broken", code: "INTERNAL_FAILURE" };
  }
}

function requireActive(control: IdentityQueryControl) {
  const stopped = identityQueryInterruption(control);
  if (stopped !== undefined) throw new PhysicalFault(stopped);
}

function fileStamp(value: BigIntStats): string {
  // A transient metadata-change fence, never the directory identity key.
  return [value.dev, value.ino, value.birthtimeNs, value.size, value.mtimeNs, value.ctimeNs].join(
    ":",
  );
}

async function openPointer(location: string, optional: boolean) {
  try {
    return await open(location, "r");
  } catch (error) {
    if (optional && storageErrorCode({ error }) === "ENOENT") return undefined;
    throw error;
  }
}

function requirePointerFile(value: BigIntStats) {
  if (!value.isFile()) throw new PhysicalFault(invalid);
  if (value.size > BigInt(REGISTRATION_STREAM_BYTE_LIMIT)) throw new PhysicalFault(limit);
}

function requireStableRead(before: BigIntStats, after: BigIntStats, bytesRead: number) {
  if (fileStamp(before) !== fileStamp(after)) throw new PhysicalFault(changed);
  if (BigInt(bytesRead) !== after.size) throw new PhysicalFault(changed);
  if (bytesRead > REGISTRATION_STREAM_BYTE_LIMIT) throw new PhysicalFault(limit);
}

async function pointerBytes(file: FileHandle, control: IdentityQueryControl) {
  requireActive(control);
  const before = await file.stat({ bigint: true });
  requirePointerFile(before);
  requireActive(control);
  const bytes = Buffer.alloc(REGISTRATION_STREAM_BYTE_LIMIT + 1);
  const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
  requireActive(control);
  const after = await file.stat({ bigint: true });
  requireStableRead(before, after, bytesRead);
  requireActive(control);
  return { content: bytes.subarray(0, bytesRead), stamp: fileStamp(after) };
}

function pointerText(content: Uint8Array) {
  let value: string;
  try {
    value = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
      .decode(content)
      .replace(/[\r\n]+$/, "");
  } catch {
    throw new PhysicalFault(invalid);
  }
  if (!value || /[\r\n\0]/.test(value)) throw new PhysicalFault(invalid);
  return value;
}

async function pointer(location: string, control: IdentityQueryControl, optional = false) {
  requireActive(control);
  const file = await openPointer(location, optional);
  if (file === undefined) return undefined;
  try {
    const { content, stamp } = await pointerBytes(file, control);
    return {
      value: pointerText(content),
      stamp: `${stamp}:${createHash("sha256").update(content).digest("hex")}`,
    };
  } finally {
    await file.close();
  }
}

async function directoryKey(location: string, control: IdentityQueryControl) {
  requireActive(control);
  const observed = await observeRepositoryDirectory(location);
  requireActive(control);
  if (observed.status !== "observed") throw new PhysicalFault(observed);
  return observed.key;
}

async function markerEntry(marker: string) {
  try {
    return await stat(marker);
  } catch (error) {
    if (storageErrorCode({ error }) === "ENOENT") {
      throw new PhysicalFault({ status: "rejected", code: "OBSERVATION_INVALID" });
    }
    throw error;
  }
}

function gitfileTarget(link: Awaited<ReturnType<typeof pointer>>, worktree: string) {
  if (link === undefined) throw new PhysicalFault(invalid);
  const target = /^gitdir: (.+)$/.exec(link.value)?.[1];
  if (target === undefined) throw new PhysicalFault(invalid);
  return { location: path.resolve(worktree, target), stamp: link.stamp };
}

async function administration(worktree: string, control: IdentityQueryControl) {
  requireActive(control);
  const marker = path.join(worktree, ".git");
  const entry = await markerEntry(marker);
  requireActive(control);
  if (entry.isDirectory()) return { location: marker, stamp: "directory" };
  return gitfileTarget(await pointer(marker, control), worktree);
}

async function capture(worktree: string, control: IdentityQueryControl) {
  try {
    const root = await directoryKey(worktree, control);
    const admin = await administration(worktree, control);
    const gitDirectory = await directoryKey(admin.location, control);
    const common = await pointer(path.join(admin.location, "commondir"), control, true);
    const commonPath =
      common === undefined ? admin.location : path.resolve(admin.location, common.value);
    const commonDirectory = await directoryKey(commonPath, control);
    requireActive(control);
    return {
      status: "captured",
      snapshot: RepositoryPhysicalSnapshotSchema.parse({
        physical: { worktree: root, gitDirectory, commonDirectory },
        metadataFingerprint: createHash("sha256")
          .update(JSON.stringify([admin.stamp, common?.stamp ?? "absent"]))
          .digest("hex"),
      }),
    } as const;
  } catch (error) {
    return physicalFailure(error);
  }
}

async function withinPhysicalDeadline<Result>(
  control: IdentityQueryControl,
  operation: () => Promise<Result>,
) {
  const stopped = identityQueryInterruption(control);
  if (stopped !== undefined) return stopped;
  let abort: () => void = () => undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<PhysicalFailure>((resolve) => {
        abort = () => resolve(identityQueryInterruption(control) ?? { status: "cancelled" });
        control.signal.addEventListener("abort", abort, { once: true });
        if (control.signal.aborted) abort();
      }),
    ]);
  } finally {
    control.signal.removeEventListener("abort", abort);
  }
}

export function captureRepositoryPhysical(worktree: string, control: IdentityQueryControl) {
  return withinPhysicalDeadline(control, () => capture(worktree, control));
}

export async function captureSelectedPhysical(
  worktree: string,
  selected: PhysicalIdentity,
  control: IdentityQueryControl,
) {
  const captured = await captureRepositoryPhysical(worktree, control);
  if (captured.status !== "captured") return captured;
  if (!samePhysicalIdentity(captured.snapshot.physical.worktree, selected)) {
    return { status: "unavailable", code: "REPOSITORY_TRUST_REQUIRED" } as const;
  }
  return captured;
}

async function hasRootMarker(worktree: string, control: IdentityQueryControl) {
  requireActive(control);
  try {
    await lstat(path.join(worktree, ".git"));
    requireActive(control);
    return true;
  } catch (error) {
    requireActive(control);
    if (storageErrorCode({ error }) === "ENOENT") return false;
    throw error;
  }
}

export function discoverSelectedPhysical(
  selection: Readonly<{ directory: string; identity: PhysicalIdentity }>,
  control: IdentityQueryControl,
) {
  const { directory: worktree, identity: selected } = selection;
  return withinPhysicalDeadline(control, async () => {
    try {
      const root = await directoryKey(worktree, control);
      if (!samePhysicalIdentity(root, selected)) {
        return { status: "unavailable", code: "REPOSITORY_TRUST_REQUIRED" } as const;
      }
      if (!(await hasRootMarker(worktree, control))) return { status: "unresolved" } as const;
      return await captureSelectedPhysical(worktree, selected, control);
    } catch (error) {
      return physicalFailure(error);
    }
  });
}

export async function revalidateRepositoryPhysical(
  worktree: string,
  expected: RepositoryPhysicalSnapshot,
  control: IdentityQueryControl,
) {
  const current = await captureRepositoryPhysical(worktree, control);
  if (current.status !== "captured") return current;
  const keys = ["worktree", "gitDirectory", "commonDirectory"] as const;
  if (current.snapshot.metadataFingerprint !== expected.metadataFingerprint) return changed;
  if (
    !keys.every((key) =>
      samePhysicalIdentity(current.snapshot.physical[key], expected.physical[key]),
    )
  )
    return changed;
  return { status: "matched" } as const;
}

export function matchReportedPhysical(
  paths: { worktree: string; gitDirectory: string; commonDirectory: string },
  expected: RepositoryPhysicalSnapshot,
  control: IdentityQueryControl,
) {
  return withinPhysicalDeadline(control, async () => {
    try {
      for (const key of ["worktree", "gitDirectory", "commonDirectory"] as const) {
        const observed = await directoryKey(paths[key], control);
        if (!samePhysicalIdentity(observed, expected.physical[key])) return changed;
      }
      return { status: "matched" } as const;
    } catch (error) {
      return physicalFailure(error);
    }
  });
}

export async function completePhysicalObservation(
  result: Extract<ReturnType<typeof composeIdentityQueryValues>, { status: "identity-observed" }>,
  selection: Readonly<{ directory: string; expected: RepositoryPhysicalSnapshot }>,
  control: IdentityQueryControl,
) {
  const { directory: selectedDirectory, expected } = selection;
  const matched = await matchReportedPhysical(result.paths, expected, control);
  if (matched.status !== "matched") return matched;
  const current = await revalidateRepositoryPhysical(selectedDirectory, expected, control);
  if (current.status !== "matched") return current;
  return { ...result, status: "physically-observed" as const, physical: expected.physical };
}
