import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * A new folder named `prefix` plus random characters under `tmpdir()/opencode`. The parent is
 * created first, so no run depends on another file or another tool having created it.
 */
export async function temporaryRoot(prefix: string): Promise<string> {
  const parent = path.join(tmpdir(), "opencode");
  await mkdir(parent, { recursive: true });
  return mkdtemp(path.join(parent, prefix));
}
