import { acceptsStrict, decodeStrictResult } from "@slopstop/protocol";
import { Result, Schema } from "effect";
import type { IdentityQueryKind } from "./identity-query-child.js";
import { REGISTRATION_STREAM_BYTE_LIMIT } from "./observer-limits.js";

// Call only after the execution owner has proved exit, both EOFs and tree cleanup.
// Decoding never supplies execution, consent or physical identity authority.
const BytesSchema = Schema.declare(
  (value: unknown): value is Uint8Array => value instanceof Uint8Array,
);
const settledOutput = Schema.Struct({
  status: Schema.Literal("exited"),
  exitCode: Schema.Number.check(Schema.isInt()),
  stdout: BytesSchema,
  stderr: BytesSchema,
});
const outputTriple = Schema.Tuple([settledOutput, settledOutput, settledOutput]);
const booleanLine = Schema.Literals(["true", "false"]);
const booleanTriple = Schema.Tuple([booleanLine, booleanLine, booleanLine]);
const lineTriple = Schema.Tuple([Schema.String, Schema.String, Schema.String]);
const booleanValueTriple = Schema.Tuple([Schema.Boolean, Schema.Boolean, Schema.Boolean]);
const identityPathsSchema = Schema.Struct({
  worktree: Schema.String,
  gitDirectory: Schema.String,
  commonDirectory: Schema.String,
});
const invalid = { status: "rejected", code: "OBSERVATION_INVALID" } as const;

function singleLine(bytes: Uint8Array): string | undefined {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return undefined;
  }
  return /^([^\r\n\0]+)\r?\n$/.exec(text)?.[1];
}

function decodeTriple(outputs: unknown) {
  const parsed = decodeStrictResult(outputTriple, outputs);
  if (Result.isFailure(parsed)) return invalid;
  if (
    parsed.success.some(
      (output) =>
        output.stdout.byteLength > REGISTRATION_STREAM_BYTE_LIMIT ||
        output.stderr.byteLength > REGISTRATION_STREAM_BYTE_LIMIT,
    )
  ) {
    return { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" } as const;
  }
  const failed = parsed.success.find((output) => output.exitCode !== 0);
  if (failed !== undefined) {
    return { status: "unavailable", code: "GIT_QUERY_FAILED", exitCode: failed.exitCode } as const;
  }
  const lines = decodeStrictResult(
    lineTriple,
    parsed.success.map((output) => singleLine(output.stdout)),
  );
  if (Result.isFailure(lines)) return invalid;
  return { status: "decoded", lines: lines.success } as const;
}

// Order: --is-inside-work-tree, --is-bare-repository, --is-inside-git-dir.
// Only working-tree permits the execution owner to proceed to the three path queries.
export function decodeGitIdentityBooleans(outputs: unknown) {
  const decoded = decodeTriple(outputs);
  if (decoded.status !== "decoded") return decoded;
  const parsed = decodeStrictResult(booleanTriple, decoded.lines);
  if (Result.isFailure(parsed)) return invalid;
  return classifyIdentityBooleanValues(parsed.success.map((value) => value === "true"));
}

export function classifyIdentityBooleanValues(values: unknown) {
  const parsed = decodeStrictResult(booleanValueTriple, values);
  if (Result.isFailure(parsed)) return invalid;
  const [inside, bare, admin] = parsed.success;
  if (bare) return { status: "rejected", code: "BARE_REPOSITORY" } as const;
  if (!inside || admin) {
    return { status: "rejected", code: "NOT_WORKING_TREE" } as const;
  }
  return { status: "working-tree" } as const;
}

function isAbsolutePath(value: string, platform: "win32" | "linux"): boolean {
  if (platform === "linux") return value.startsWith("/");
  return /^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/][^\\/]+)/.test(value);
}

// Order: --path-format=absolute --show-toplevel, --absolute-git-dir,
// --path-format=absolute --git-common-dir. These installation-private paths
// still require physical identity/locality checks; decoded is never prepared.
export function decodeGitIdentityPaths(outputs: unknown, platform: "win32" | "linux") {
  const decoded = decodeTriple(outputs);
  if (decoded.status !== "decoded") return decoded;
  if (!decoded.lines.every((value) => isAbsolutePath(value, platform))) return invalid;
  const [worktree, gitDirectory, commonDirectory] = decoded.lines;
  return { status: "decoded", paths: { worktree, gitDirectory, commonDirectory } } as const;
}

export type GitIdentityBooleanResult = ReturnType<typeof decodeGitIdentityBooleans>;
export type GitIdentityPathResult = ReturnType<typeof decodeGitIdentityPaths>;

// The first query alone cannot classify bare/admin scope; it is not a phase result.
function decodeSingleOutput(output: unknown) {
  const parsed = decodeStrictResult(settledOutput, output);
  if (Result.isFailure(parsed)) return invalid;
  const settled = parsed.success;
  if (
    settled.stdout.byteLength > REGISTRATION_STREAM_BYTE_LIMIT ||
    settled.stderr.byteLength > REGISTRATION_STREAM_BYTE_LIMIT
  ) {
    return { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" } as const;
  }
  if (settled.exitCode !== 0)
    return {
      status: "unavailable",
      code: "GIT_QUERY_FAILED",
      exitCode: settled.exitCode,
    } as const;
  const line = singleLine(settled.stdout);
  if (line === undefined) return invalid;
  return { status: "decoded", line } as const;
}

export function decodeInsideWorkTreeOutput(output: unknown) {
  const decoded = decodeSingleOutput(output);
  if (decoded.status !== "decoded") return decoded;
  if (!acceptsStrict(booleanLine, decoded.line)) return invalid;
  return { status: "query-observed", insideWorkTree: decoded.line === "true" } as const;
}

export function decodeIdentityQueryOutput(
  query: IdentityQueryKind,
  output: unknown,
  platform: "win32" | "linux",
) {
  if (query === "inside-work-tree") return decodeInsideWorkTreeOutput(output);
  const decoded = decodeSingleOutput(output);
  if (decoded.status !== "decoded") return decoded;
  if (query === "bare-repository" || query === "inside-git-dir") {
    if (!acceptsStrict(booleanLine, decoded.line)) return invalid;
    return { status: "query-observed", value: decoded.line === "true" } as const;
  }
  if (!isAbsolutePath(decoded.line, platform)) return invalid;
  return { status: "query-observed", value: decoded.line } as const;
}

export function composeIdentityQueryValues(
  phaseId: string,
  values: ReadonlyMap<IdentityQueryKind, boolean | string>,
) {
  const booleans = classifyIdentityBooleanValues([
    values.get("inside-work-tree"),
    values.get("bare-repository"),
    values.get("inside-git-dir"),
  ]);
  if (booleans.status !== "working-tree") return booleans;
  const paths = decodeStrictResult(identityPathsSchema, {
    worktree: values.get("show-toplevel"),
    gitDirectory: values.get("absolute-git-dir"),
    commonDirectory: values.get("git-common-dir"),
  });
  if (Result.isFailure(paths)) return invalid;
  return {
    status: "identity-observed",
    phaseId,
    booleans: { insideWorkTree: true, bareRepository: false, insideGitDirectory: false },
    paths: paths.success,
  } as const;
}
