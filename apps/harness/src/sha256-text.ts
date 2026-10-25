import { createHash } from "node:crypto";

/** The SHA-256 digest of the text's UTF-8 bytes, as lowercase hex. */
export function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** {@link sha256Hex} for ports that take an asynchronous digest. */
export async function sha256Text(text: string): Promise<string> {
  return sha256Hex(text);
}
