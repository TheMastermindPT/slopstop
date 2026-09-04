import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  applyPackageSmokeAuthorization,
  PackageSmokeAuthorizationError,
} from "./package-smoke-authorization.js";

const markerFilename = ".slopstop-package-smoke.json";
const authorizationToken = "a".repeat(64);

async function createAuthorizedSmokeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "slopstop-package-smoke-auth-"));
  await writeFile(
    path.join(root, markerFilename),
    JSON.stringify({ version: 1, token: authorizationToken }),
    { flag: "wx" },
  );
  return root;
}

describe("package smoke authorization", () => {
  it("rejects the terminal bootstrap guard before setting userData", async () => {
    const root = await createAuthorizedSmokeRoot();
    try {
      await writeFile(path.join(root, "unexpected"), "witness", { flag: "wx" });
      const setUserDataRoot = vi.fn();

      expect(() =>
        applyPackageSmokeAuthorization(
          { root, token: authorizationToken, scenario: "bootstrap" },
          setUserDataRoot,
        ),
      ).toThrowError(new PackageSmokeAuthorizationError());
      expect(setUserDataRoot).not.toHaveBeenCalled();
      expect(await readdir(root)).not.toContain("storage");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("sets userData exactly once after successful authorization", async () => {
    const root = await createAuthorizedSmokeRoot();
    try {
      const setUserDataRoot = vi.fn();

      expect(
        applyPackageSmokeAuthorization(
          { root, token: authorizationToken, scenario: "bootstrap" },
          setUserDataRoot,
        ),
      ).toEqual({ root, scenario: "bootstrap" });
      expect(setUserDataRoot).toHaveBeenCalledExactlyOnceWith(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
