import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256Hex, sha256Text } from "./sha256-text.js";

const abc = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("SHA-256 text", () => {
  it("digests text as lowercase SHA-256 hex", async () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe(abc);
    expect(sha256Hex("é")).toBe(
      createHash("sha256").update(Buffer.from("é", "utf8")).digest("hex"),
    );
    await expect(sha256Text("abc")).resolves.toBe(abc);
  });
});
