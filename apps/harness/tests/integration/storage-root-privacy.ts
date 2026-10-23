import { realpathSync } from "node:fs";
import { expect } from "vitest";

/**
 * Asserts that `text` names `root` in none of its spellings: the one the test passed, the
 * physical one Storage records (they differ under a Windows 8.3 alias), each raw and
 * JSON-escaped (a Windows path inside `JSON.stringify` output has doubled backslashes).
 */
export function expectNoRootSpelling(text: string, root: string): void {
  for (const spelling of new Set([root, realpathSync.native(root)])) {
    expect(text).not.toContain(spelling);
    expect(text).not.toContain(JSON.stringify(spelling).slice(1, -1));
  }
}
