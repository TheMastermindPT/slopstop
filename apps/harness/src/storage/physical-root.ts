import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function parentOf(root: string): string {
  const parent = path.dirname(root);
  if (parent === root) throw new Error("Storage root has no existing ancestor.");
  return parent;
}

/**
 * The one canonical spelling of a Storage root: its nearest existing ancestor resolved by the
 * operating system (so a Windows 8.3 alias becomes the long name), plus the missing segments.
 * A symbolic-link root or ancestor is refused, and any failure other than a missing path is
 * thrown as is, never answered with the unresolved path.
 */
export function physicalRoot(root: string): string {
  const missingSegments: string[] = [];
  let cursor = path.resolve(root);
  for (;;) {
    try {
      const entry = lstatSync(cursor);
      if (entry.isSymbolicLink()) {
        throw new Error("Storage root must not be a symbolic link.");
      }
      return path.join(realpathSync.native(cursor), ...missingSegments.reverse());
    } catch (error: unknown) {
      if (!isMissingPathError(error)) throw error;
      missingSegments.push(path.basename(cursor));
      cursor = parentOf(cursor);
    }
  }
}
