import { describe, expect, it } from "vitest";
import {
  decodeGitIdentityBooleans,
  decodeGitIdentityPaths,
  decodeIdentityQueryOutput,
} from "./git-identity-query-results.js";

function exited(stdout: string | Uint8Array, exitCode = 0, stderr = new Uint8Array()) {
  return {
    status: "exited",
    exitCode,
    stdout: typeof stdout === "string" ? new TextEncoder().encode(stdout) : stdout,
    stderr,
  };
}

const invalid = { status: "rejected", code: "OBSERVATION_INVALID" };
const limit = { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" };

describe("settled Git identity output envelopes", () => {
  it.each([
    ["non-exited status", { status: "cleanup-unconfirmed" }],
    ["noninteger exit code", { exitCode: 0.5 }],
    ["non-byte stdout", { stdout: "true\n" }],
    ["non-byte stderr", { stderr: [] }],
    ["extra envelope field", { unexpected: "private-canary" }],
  ] as const)("rejects %s through both public decoders", (_name, fields) => {
    expect(
      decodeGitIdentityBooleans([
        { ...exited("true\n"), ...fields },
        exited("false\n"),
        exited("false\n"),
      ]),
    ).toEqual(invalid);
    expect(
      decodeGitIdentityPaths(
        [{ ...exited("/work\n"), ...fields }, exited("/admin\n"), exited("/common\n")],
        "linux",
      ),
    ).toEqual(invalid);
  });
});

describe("settled Git identity boolean results", () => {
  it("allows path queries only after the exact working-tree boolean triple", () => {
    expect(
      decodeGitIdentityBooleans([exited("true\n"), exited("false\r\n"), exited("false\n")]),
    ).toEqual({ status: "working-tree" });
  });

  it.each([
    ["false\n", "true\n", "true\n", "BARE_REPOSITORY"],
    ["false\n", "false\n", "false\n", "NOT_WORKING_TREE"],
    ["true\n", "false\n", "true\n", "NOT_WORKING_TREE"],
  ])("classifies booleans %s %s %s before any path query", (inside, bare, admin, code) => {
    expect(decodeGitIdentityBooleans([exited(inside), exited(bare), exited(admin)])).toEqual({
      status: "rejected",
      code,
    });
  });

  it.each(["TRUE\n", " true\n", "true \n", "true", "true\n\n", "true\0\n", "\uFEFFtrue\n"])(
    "rejects malformed boolean output %j",
    (text) => {
      expect(
        decodeGitIdentityBooleans([exited(text), exited("false\n"), exited("false\n")]),
      ).toEqual(invalid);
    },
  );

  it("rejects invalid UTF-8 and incomplete or extra query results", () => {
    const good = [exited("true\n"), exited("false\n"), exited("false\n")];
    expect(
      decodeGitIdentityBooleans([exited(new Uint8Array([0xff, 10])), ...good.slice(1)]),
    ).toEqual(invalid);
    expect(decodeGitIdentityBooleans(good.slice(0, 2))).toEqual(invalid);
    expect(decodeGitIdentityBooleans([...good, exited("false\n")])).toEqual(invalid);
  });

  it("prioritizes bounded stream overflow then exit status over malformed stdout", () => {
    const bad = exited(new Uint8Array([0xff, 10]), 128);
    const rest = [exited("false\n"), exited("false\n")];
    expect(decodeGitIdentityBooleans([bad, ...rest])).toEqual({
      status: "unavailable",
      code: "GIT_QUERY_FAILED",
      exitCode: 128,
    });
    expect(decodeGitIdentityBooleans([{ ...bad, stderr: new Uint8Array(8193) }, ...rest])).toEqual(
      limit,
    );
    expect(decodeGitIdentityBooleans([{ ...bad, stdout: new Uint8Array(8193) }, ...rest])).toEqual(
      limit,
    );
    expect(decodeGitIdentityBooleans([exited("true\n", 0, new Uint8Array(8192)), ...rest])).toEqual(
      { status: "working-tree" },
    );
  });
});

describe("settled Git identity path results", () => {
  it.each([
    ["linux", "/work/ espaço ", "/admin/worktrees/one", "/admin/common"],
    ["win32", "C:/work/ espaço ", "C:\\admin\\worktrees\\one", "C:/admin/common"],
    [
      "win32",
      "\\\\example.invalid\\share\\work espaço ",
      "\\\\example.invalid\\share\\admin\\worktrees\\one",
      "\\\\example.invalid\\share\\admin\\common",
    ],
  ] as const)(
    "preserves three distinct absolute %s paths and meaningful spaces",
    (platform, worktree, gitDirectory, commonDirectory) => {
      expect(
        decodeGitIdentityPaths(
          [exited(`${worktree}\n`), exited(`${gitDirectory}\r\n`), exited(`${commonDirectory}\n`)],
          platform,
        ),
      ).toEqual({ status: "decoded", paths: { worktree, gitDirectory, commonDirectory } });
    },
  );

  it.each([
    "relative\n",
    "/work",
    "/work\nextra\n",
    "/work\n\n",
    "/work\rmore\n",
    "/work\0\n",
    "\uFEFF/work\n",
    '"/work"\n',
  ])("rejects malformed path output %j", (text) => {
    expect(
      decodeGitIdentityPaths([exited("/work\n"), exited(text), exited("/common\n")], "linux"),
    ).toEqual(invalid);
  });

  it.each(["C:relative\n", "\\root-relative\n", "/root-relative\n"])(
    "rejects ambiguous Windows path %j",
    (text) => {
      expect(
        decodeGitIdentityPaths(
          [exited(text), exited("C:/admin\n"), exited("C:/common\n")],
          "win32",
        ),
      ).toEqual(invalid);
    },
  );

  it("checks the byte ceiling without trimming or character-count substitution", () => {
    const worktree = `/${"é".repeat(4095)}`;
    const rest = [exited("/admin\n"), exited("/common\n")];
    expect(decodeGitIdentityPaths([exited(`${worktree}\n`), ...rest], "linux")).toEqual({
      status: "decoded",
      paths: { worktree, gitDirectory: "/admin", commonDirectory: "/common" },
    });
    expect(decodeGitIdentityPaths([exited(`${worktree}a\n`), ...rest], "linux")).toEqual(limit);
  });

  it("rejects invalid path encoding and returns only numeric exit metadata on Git failure", () => {
    const rest = [exited("/admin\n"), exited("/common\n")];
    expect(
      decodeGitIdentityPaths([exited(new Uint8Array([47, 0xff, 10])), ...rest], "linux"),
    ).toEqual(invalid);
    expect(
      decodeGitIdentityPaths(
        [exited("malformed", 7, new TextEncoder().encode("private-canary")), ...rest],
        "linux",
      ),
    ).toEqual({
      status: "unavailable",
      code: "GIT_QUERY_FAILED",
      exitCode: 7,
    });
  });
});

describe("single identity query output (B3: one case per limit)", () => {
  const atLimit = new Uint8Array(8192).fill(0x61);
  const overLimit = new Uint8Array(8193).fill(0x61);

  it("bounds one query's streams at the shared byte limit before exit status", () => {
    expect(decodeIdentityQueryOutput("show-toplevel", exited(overLimit, 128), "win32")).toEqual(
      limit,
    );
    expect(
      decodeIdentityQueryOutput("bare-repository", exited("false\n", 0, overLimit), "win32"),
    ).toEqual(limit);
    expect(
      decodeIdentityQueryOutput("bare-repository", exited("false\n", 0, atLimit), "win32"),
    ).toEqual({ status: "query-observed", value: false });
  });
});
