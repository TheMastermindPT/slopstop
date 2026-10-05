import { mkdir, mkdtemp, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
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

async function withAuthorizedSmokeRoot(check: (root: string) => Promise<void>): Promise<void> {
  const root = await createAuthorizedSmokeRoot();
  try {
    await check(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function expectRejectedAuthorization(input: Parameters<typeof applyPackageSmokeAuthorization>[0]) {
  const setUserDataRoot = vi.fn();
  expect(() => applyPackageSmokeAuthorization(input, setUserDataRoot)).toThrowError(
    new PackageSmokeAuthorizationError(),
  );
  expect(setUserDataRoot).not.toHaveBeenCalled();
}

function isSymlinkPermissionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (!("code" in error)) return false;
  return error.code === "EPERM";
}

describe.each(["bootstrap", "writer-proof", "registration"])(
  "%s retained authorization boundary",
  (scenario) => {
    it.each([
      { token: undefined },
      { token: "" },
      { token: "not-a-token" },
      { token: "b".repeat(64) },
      { token: "A".repeat(64) },
      { token: "a".repeat(63) },
      { token: "a".repeat(65) },
      { root: undefined },
      { root: "" },
      { root: "relative-root" },
      { scenario: undefined },
      { scenario: "" },
      { scenario: "invalid" },
      { scenario: ` ${scenario}` },
      { scenario: `${scenario} ` },
      { scenario: scenario.toUpperCase() },
    ])("rejects invalid input %j before userData", async (override) => {
      await withAuthorizedSmokeRoot(async (root) => {
        expectRejectedAuthorization({ root, token: authorizationToken, scenario, ...override });
        expect(await readdir(root)).toEqual([markerFilename]);
      });
    });

    it.each([
      "{not-json",
      "null",
      "[]",
      "{}",
      JSON.stringify({ version: 2, token: authorizationToken }),
      JSON.stringify({ version: "1", token: authorizationToken }),
      JSON.stringify({ version: 1, token: authorizationToken, extra: true }),
      JSON.stringify({ version: 1 }),
      JSON.stringify({ version: 1, token: "not-a-token" }),
      JSON.stringify({ version: 1, token: "b".repeat(64) }),
    ])("rejects invalid marker bytes %s before userData", async (marker) => {
      await withAuthorizedSmokeRoot(async (root) => {
        await writeFile(path.join(root, markerFilename), marker);
        expectRejectedAuthorization({ root, token: authorizationToken, scenario });
        expect(await readdir(root)).toEqual([markerFilename]);
      });
    });

    it("rejects missing and non-directory roots before userData", async () => {
      await withAuthorizedSmokeRoot(async (root) => {
        for (const invalidRoot of [path.join(root, "absent"), path.join(root, markerFilename)]) {
          expectRejectedAuthorization({ root: invalidRoot, token: authorizationToken, scenario });
        }
        expect(await readdir(root)).toEqual([markerFilename]);
      });
    });

    it("rejects missing and nonregular markers before userData", async () => {
      await withAuthorizedSmokeRoot(async (root) => {
        const marker = path.join(root, markerFilename);
        await unlink(marker);
        expectRejectedAuthorization({ root, token: authorizationToken, scenario });
        expect(await readdir(root)).toEqual([]);
        await mkdir(marker);
        expectRejectedAuthorization({ root, token: authorizationToken, scenario });
        expect(await readdir(root)).toEqual([markerFilename]);
      });
    });

    it("rejects a symlink root before userData", async () => {
      await withAuthorizedSmokeRoot(async (root) => {
        const link = path.join(root, "root-link");
        await symlink(root, link, process.platform === "win32" ? "junction" : "dir");
        expectRejectedAuthorization({ root: link, token: authorizationToken, scenario });
        expect(await readdir(root)).toEqual([markerFilename, "root-link"]);
      });
    });

    it("rejects a symlink marker before userData", async (context) => {
      await withAuthorizedSmokeRoot(async (root) => {
        const marker = path.join(root, markerFilename);
        const target = path.join(root, "marker-target.json");
        await writeFile(target, JSON.stringify({ version: 1, token: authorizationToken }));
        await unlink(marker);
        try {
          await symlink(target, marker, "file");
        } catch (error) {
          if (isSymlinkPermissionError(error)) {
            context.skip(true, "File symlink creation denied by this host (EPERM).");
          }
          throw error;
        }
        expectRejectedAuthorization({ root, token: authorizationToken, scenario });
        expect(await readdir(root)).toEqual([markerFilename, "marker-target.json"]);
      });
    });
  },
);

describe("package smoke authorization", () => {
  it("authorizes writer proof on the existing root without repeating the bootstrap-only guard", async () => {
    await withAuthorizedSmokeRoot(async (root) => {
      await mkdir(path.join(root, "storage"));
      const setUserDataRoot = vi.fn();

      expect(
        applyPackageSmokeAuthorization(
          { root, token: authorizationToken, scenario: "writer-proof" },
          setUserDataRoot,
        ),
      ).toEqual({ root, scenario: "writer-proof" });
      expect(setUserDataRoot).toHaveBeenCalledExactlyOnceWith(root);
      expect(await readdir(root)).toEqual([markerFilename, "storage"]);
      expect(await readdir(path.join(root, "storage"))).toEqual([]);
    });
  });

  it.each([
    {
      scenario: "writer-proof",
      name: "admits writer proof only through authorized private package composition",
    },
    { scenario: "bootstrap", name: "sets userData exactly once after successful authorization" },
  ])("$name", async ({ scenario }) => {
    await withAuthorizedSmokeRoot(async (root) => {
      const setUserDataRoot = vi.fn();

      expect(
        applyPackageSmokeAuthorization(
          { root, token: authorizationToken, scenario },
          setUserDataRoot,
        ),
      ).toEqual({ root, scenario });
      expect(setUserDataRoot).toHaveBeenCalledExactlyOnceWith(root);
      expect(await readdir(root)).toEqual([markerFilename]);
    });
  });

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
});

describe("registration package smoke root", () => {
  async function withRegistrationRoot(check: (root: string) => Promise<void>) {
    await withAuthorizedSmokeRoot(async (root) => {
      await mkdir(path.join(root, "repository"));
      await check(root);
    });
  }

  it("authorizes exactly the marker and a plain repository directory", async () => {
    await withRegistrationRoot(async (root) => {
      const setUserDataRoot = vi.fn();
      expect(
        applyPackageSmokeAuthorization(
          { root, token: authorizationToken, scenario: "registration" },
          setUserDataRoot,
        ),
      ).toEqual({ root, scenario: "registration" });
      expect(setUserDataRoot).toHaveBeenCalledWith(root);
    });
  });

  it("rejects a root without the repository directory", async () => {
    await withAuthorizedSmokeRoot(async (root) => {
      expectRejectedAuthorization({ root, token: authorizationToken, scenario: "registration" });
    });
  });

  it("rejects an extra entry beside the repository", async () => {
    await withRegistrationRoot(async (root) => {
      await writeFile(path.join(root, "extra"), "");
      expectRejectedAuthorization({ root, token: authorizationToken, scenario: "registration" });
    });
  });

  it("rejects a repository that is a file or a junction", async () => {
    await withAuthorizedSmokeRoot(async (root) => {
      const repository = path.join(root, "repository");
      await writeFile(repository, "");
      expectRejectedAuthorization({ root, token: authorizationToken, scenario: "registration" });
      await unlink(repository);
      const target = await mkdtemp(path.join(os.tmpdir(), "slopstop-package-smoke-target-"));
      try {
        await symlink(target, repository, process.platform === "win32" ? "junction" : "dir");
        expectRejectedAuthorization({ root, token: authorizationToken, scenario: "registration" });
      } finally {
        await unlink(repository);
        await rm(target, { recursive: true, force: true });
      }
    });
  });
});
