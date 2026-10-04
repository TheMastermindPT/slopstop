import { Result, type Schema, type SchemaIssue } from "effect";
import { decodeStrictResult, type SchemaIssueLeaf, schemaIssueLeaves } from "./schema-codec.js";

// Test-only detail for asserting rejection paths; boundary diagnostics expose code and path.
export type IssueDetail = Readonly<{
  code: string;
  path: readonly PropertyKey[];
  message?: string;
  keys?: readonly string[];
}>;

export type DecodeWithIssues<T> =
  | Readonly<{ success: true; data: T; error?: undefined }>
  | Readonly<{ success: false; error: Readonly<{ issues: readonly IssueDetail[] }> }>;

function annotatedMessage(annotations: unknown): string | undefined {
  if (typeof annotations !== "object" || annotations === null) return undefined;
  const message: unknown = Reflect.get(annotations, "message");
  return typeof message === "string" ? message : undefined;
}

function leafMessage(issue: SchemaIssue.Issue, leaf: SchemaIssueLeaf): string | undefined {
  if (issue._tag === "InvalidValue") {
    return annotatedMessage(issue.annotations) ?? annotatedMessage(leaf.filter?.annotations);
  }
  if (issue._tag === "InvalidType" && issue.ast._tag === "Declaration") {
    return annotatedMessage(issue.ast.annotations);
  }
  return undefined;
}

function samePath(left: readonly PropertyKey[], right: readonly PropertyKey[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

function issueDetails(error: Schema.SchemaError): IssueDetail[] {
  const details: IssueDetail[] = [];
  for (const leaf of schemaIssueLeaves(error, { expandWholeUnions: true })) {
    if (leaf.code === "unrecognized_keys") {
      const path = leaf.path.slice(0, -1);
      const keys = leaf.path.slice(-1).map(String);
      const index = details.findIndex(
        (detail) => detail.code === "unrecognized_keys" && samePath(detail.path, path),
      );
      const previous = details[index];
      if (previous === undefined) details.push({ code: leaf.code, path, keys });
      else details[index] = { ...previous, keys: [...(previous.keys ?? []), ...keys] };
      continue;
    }
    const message = leafMessage(leaf.issue, leaf);
    details.push(
      message === undefined
        ? { code: leaf.code, path: leaf.path }
        : { code: leaf.code, path: leaf.path, message },
    );
  }
  return details;
}

// Test support: strict decoding with failures projected for path/message assertions.
export function decodeWithIssues<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  value: unknown,
): DecodeWithIssues<S["Type"]> {
  const decoded = decodeStrictResult(schema, value);
  return Result.isSuccess(decoded)
    ? { success: true, data: decoded.success }
    : { success: false, error: { issues: issueDetails(decoded.failure) } };
}
