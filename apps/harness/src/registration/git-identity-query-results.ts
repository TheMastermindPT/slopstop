import { z } from "zod";
import type { IdentityQueryKind } from "./identity-query-child.js";
import { REGISTRATION_STREAM_BYTE_LIMIT } from "./observer-limits.js";

// Call only after the execution owner has proved exit, both EOFs and tree cleanup.
// Decoding never supplies execution, consent or physical identity authority.
const settledOutput = z.strictObject({
  status: z.literal("exited"),
  exitCode: z.int(),
  stdout: z.instanceof(Uint8Array),
  stderr: z.instanceof(Uint8Array),
});
const outputTriple = z.tuple([settledOutput, settledOutput, settledOutput]);
const booleanLine = z.enum(["true", "false"]);
const booleanTriple = z.tuple([booleanLine, booleanLine, booleanLine]);
const lineTriple = z.tuple([z.string(), z.string(), z.string()]);
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
  const parsed = outputTriple.safeParse(outputs);
  if (!parsed.success) return invalid;
  if (
    parsed.data.some(
      (output) =>
        output.stdout.byteLength > REGISTRATION_STREAM_BYTE_LIMIT ||
        output.stderr.byteLength > REGISTRATION_STREAM_BYTE_LIMIT,
    )
  ) {
    return { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" } as const;
  }
  const failed = parsed.data.find((output) => output.exitCode !== 0);
  if (failed !== undefined) {
    return { status: "unavailable", code: "GIT_QUERY_FAILED", exitCode: failed.exitCode } as const;
  }
  const lines = lineTriple.safeParse(parsed.data.map((output) => singleLine(output.stdout)));
  if (!lines.success) return invalid;
  return { status: "decoded", lines: lines.data } as const;
}

// Order: --is-inside-work-tree, --is-bare-repository, --is-inside-git-dir.
// Only working-tree permits the execution owner to proceed to the three path queries.
export function decodeGitIdentityBooleans(outputs: unknown) {
  const decoded = decodeTriple(outputs);
  if (decoded.status !== "decoded") return decoded;
  const parsed = booleanTriple.safeParse(decoded.lines);
  if (!parsed.success) return invalid;
  return classifyIdentityBooleanValues(parsed.data.map((value) => value === "true"));
}

export function classifyIdentityBooleanValues(values: unknown) {
  const parsed = z.tuple([z.boolean(), z.boolean(), z.boolean()]).safeParse(values);
  if (!parsed.success) return invalid;
  const [inside, bare, admin] = parsed.data;
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
  const parsed = settledOutput.safeParse(output);
  if (!parsed.success) return invalid;
  if (
    parsed.data.stdout.byteLength > REGISTRATION_STREAM_BYTE_LIMIT ||
    parsed.data.stderr.byteLength > REGISTRATION_STREAM_BYTE_LIMIT
  ) {
    return { status: "unavailable", code: "OBSERVATION_LIMIT_EXCEEDED" } as const;
  }
  if (parsed.data.exitCode !== 0)
    return {
      status: "unavailable",
      code: "GIT_QUERY_FAILED",
      exitCode: parsed.data.exitCode,
    } as const;
  const line = singleLine(parsed.data.stdout);
  if (line === undefined) return invalid;
  return { status: "decoded", line } as const;
}

export function decodeInsideWorkTreeOutput(output: unknown) {
  const decoded = decodeSingleOutput(output);
  if (decoded.status !== "decoded") return decoded;
  const line = booleanLine.safeParse(decoded.line);
  if (!line.success) return invalid;
  return { status: "query-observed", insideWorkTree: line.data === "true" } as const;
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
    const parsed = booleanLine.safeParse(decoded.line);
    if (!parsed.success) return invalid;
    return { status: "query-observed", value: parsed.data === "true" } as const;
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
  const paths = z
    .strictObject({ worktree: z.string(), gitDirectory: z.string(), commonDirectory: z.string() })
    .safeParse({
      worktree: values.get("show-toplevel"),
      gitDirectory: values.get("absolute-git-dir"),
      commonDirectory: values.get("git-common-dir"),
    });
  if (!paths.success) return invalid;
  return {
    status: "identity-observed",
    phaseId,
    booleans: { insideWorkTree: true, bareRepository: false, insideGitDirectory: false },
    paths: paths.data,
  } as const;
}
