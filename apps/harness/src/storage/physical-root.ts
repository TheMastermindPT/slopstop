import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { Data, Effect, Result } from "effect";

/** Why a Storage root has no canonical spelling. */
export type StorageRootRefusal = "symbolic-link" | "no-existing-ancestor" | "inspection-failed";

const refusalMessages: Readonly<Record<StorageRootRefusal, string>> = {
  "symbolic-link": "Root must not be a symbolic link.",
  "no-existing-ancestor": "Root has no existing ancestor.",
  "inspection-failed": "Root could not be inspected.",
};

/** A Storage root that cannot be canonicalized; never answered with the unresolved path. */
export class StorageRootCanonicalizationError extends Data.TaggedError(
  "StorageRootCanonicalizationError",
)<{
  readonly message: string;
  readonly reason: StorageRootRefusal;
  readonly cause?: unknown;
}> {
  constructor(reason: StorageRootRefusal, cause?: unknown) {
    super({ message: refusalMessages[reason], reason, ...(cause === undefined ? {} : { cause }) });
  }
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function canonicalizationError(error: unknown): StorageRootCanonicalizationError {
  return error instanceof StorageRootCanonicalizationError
    ? error
    : new StorageRootCanonicalizationError("inspection-failed", error);
}

function parentOf(root: string): string {
  const parent = path.dirname(root);
  if (parent === root) throw new StorageRootCanonicalizationError("no-existing-ancestor");
  return parent;
}

function resolvePhysicalRoot(root: string): string {
  const missingSegments: string[] = [];
  let cursor = path.resolve(root);
  for (;;) {
    try {
      if (lstatSync(cursor).isSymbolicLink()) {
        throw new StorageRootCanonicalizationError("symbolic-link");
      }
      return path.join(realpathSync.native(cursor), ...missingSegments.reverse());
    } catch (error: unknown) {
      if (!isMissingPathError(error)) throw error;
      missingSegments.push(path.basename(cursor));
      cursor = parentOf(cursor);
    }
  }
}

/**
 * The one canonical spelling of a Storage root, for synchronous edges: the nearest existing
 * entry resolved by the operating system plus the missing segments. Every spelling the system
 * resolves to the same folder (a Windows 8.3 alias, another letter case, a path through a link
 * above that entry) gives the same answer. A link at the nearest existing entry is refused, and
 * any inspection failure other than a missing path is a refusal.
 */
export function physicalRootResult(
  root: string,
): Result.Result<string, StorageRootCanonicalizationError> {
  try {
    return Result.succeed(resolvePhysicalRoot(root));
  } catch (error: unknown) {
    return Result.fail(canonicalizationError(error));
  }
}

/** {@link physicalRootResult} as an Effect, with the refusal on the typed error channel. */
export function physicalRoot(
  root: string,
): Effect.Effect<string, StorageRootCanonicalizationError> {
  return Effect.try({ try: () => resolvePhysicalRoot(root), catch: canonicalizationError });
}

/**
 * {@link physicalRootResult} for the synchronous factories that predate Effect: the refusal is
 * thrown as the tagged error, so their callers' failure mapping can tell it apart.
 */
export function requirePhysicalRoot(root: string): string {
  const result = physicalRootResult(root);
  if (Result.isFailure(result)) throw result.failure;
  return result.success;
}
