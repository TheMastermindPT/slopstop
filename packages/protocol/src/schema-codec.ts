import type { SchemaAST, SchemaIssue } from "effect";
import { Result, Schema, SchemaTransformation } from "effect";

// Shallow-freezes this schema's decoded value. Nested schemas freeze only when they opt in.
export function frozenOutput<S extends Schema.Top & { readonly DecodingServices: never }>(
  schema: S,
) {
  return schema.pipe(
    Schema.decodeTo(
      Schema.declare<S["Type"]>(
        (value: unknown): value is S["Type"] => typeof value === "object" && value !== null,
      ),
      SchemaTransformation.transform<S["Type"], S["Type"]>({
        decode: (value) => Object.freeze(value),
        encode: (value) => value,
      }),
    ),
  );
}

// Process boundaries reject undeclared keys at every nesting level.
export const strictParseOptions = {
  errors: "all",
  onExcessProperty: "error",
} as const satisfies SchemaAST.ParseOptions;

type StrictDecoder = Schema.ConstraintDecoder<unknown>;

export function decodeStrict<S extends StrictDecoder>(schema: S, input: unknown): S["Type"] {
  return Schema.decodeUnknownSync(schema, strictParseOptions)(input);
}

export function decodeStrictResult<S extends StrictDecoder>(
  schema: S,
  input: unknown,
): Result.Result<S["Type"], Schema.SchemaError> {
  return Schema.decodeUnknownResult(schema, strictParseOptions)(input);
}

export function acceptsStrict<S extends StrictDecoder>(schema: S, input: unknown): boolean {
  return Result.isSuccess(decodeStrictResult(schema, input));
}

const datePattern =
  "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))";
const hourMinutePattern = "(?:[01]\\d|2[0-3]):[0-5]\\d";
const offsetPattern = "[+-](?:[01]\\d|2[0-3]):[0-5]\\d";

type DateTimeTextOptions = Readonly<{ offset?: boolean; precision?: number }>;

// RFC 3339 instants stay strings across processes; nothing converts them to Date.
export function dateTimeTextSchema(options: DateTimeTextOptions = {}) {
  const time =
    options.precision === undefined
      ? `${hourMinutePattern}(?::[0-5]\\d(?:\\.\\d+)?)?`
      : `${hourMinutePattern}:[0-5]\\d\\.\\d{${options.precision}}`;
  const zone = options.offset === true ? `(?:Z|${offsetPattern})` : "Z";
  return Schema.String.check(
    Schema.isPattern(new RegExp(`^${datePattern}T(?:${time}${zone})$`, "u"), {
      expected: "an RFC 3339 date-time",
    }),
  );
}

const uuidPattern =
  /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/u;

export const UuidTextSchema = Schema.String.check(
  Schema.isPattern(uuidPattern, { expected: "a UUID" }),
);

export const NonEmptyTextSchema = Schema.String.check(Schema.isMinLength(1));

// A plain object without members. An empty Struct would accept any non-nullish value.
export const EmptyObjectSchema = Schema.Record(Schema.String, Schema.Never);

// Decodes to the trimmed text, then requires at least one character.
export const TrimmedNonEmptyTextSchema = Schema.Trim.check(Schema.isMinLength(1));

export const NonBlankTextSchema = Schema.String.check(
  Schema.makeFilter((value: string) => value.trim().length > 0, {
    expected: "a non-blank string",
  }),
);

// Unions whose failures are reported as one whole-union issue instead of narrowing to a member.
const wholeUnionReports = new WeakSet<SchemaAST.AST>();

export function wholeUnion<const Members extends ReadonlyArray<Schema.Top>>(members: Members) {
  const union = Schema.Union(members);
  wholeUnionReports.add(union.ast);
  return union;
}

export type SchemaIssueSummary = Readonly<{ code: string; path: readonly PropertyKey[] }>;

// One failed leaf with its project issue code. Unrecognized keys keep the key as the last
// path segment here; summaries report them at the owning object.
export type SchemaIssueLeaf = Readonly<{
  code: string;
  path: readonly PropertyKey[];
  issue: SchemaIssue.Issue;
  filter: SchemaAST.Filter<unknown> | undefined;
}>;

const filterCodes: readonly (readonly [string, string])[] = [
  ["effect/schema/isPattern", "invalid_format"],
  ["effect/schema/isInt", "invalid_type"],
  ["effect/schema/isMinLength", "too_small"],
  ["effect/schema/isGreaterThan", "too_small"],
  ["effect/schema/isMaxLength", "too_big"],
  ["effect/schema/isLessThan", "too_big"],
];

function filterCode(filter: SchemaAST.Filter<unknown>): string {
  const representation: unknown = Reflect.get(filter.annotations ?? {}, "representation");
  const id =
    typeof representation === "object" && representation !== null
      ? Reflect.get(representation, "id")
      : undefined;
  if (typeof id !== "string") return "custom";
  return filterCodes.find(([prefix]) => id.startsWith(prefix))?.[1] ?? "custom";
}

type FixedLeafTag = Exclude<SchemaIssue.Leaf["_tag"], "InvalidValue" | "InvalidType">;

const fixedLeafCodes: Readonly<Record<FixedLeafTag, string>> = {
  MissingKey: "invalid_type",
  UnexpectedKey: "unrecognized_keys",
  OneOf: "invalid_union",
  Forbidden: "custom",
};

function invalidTypeCode(issue: Extract<SchemaIssue.Leaf, { _tag: "InvalidType" }>): string {
  if (issue.ast._tag === "Literal") return "invalid_value";
  return issue.ast._tag === "Declaration" ? "custom" : "invalid_type";
}

function leafCode(issue: SchemaIssue.Leaf, filter: SchemaAST.Filter<unknown> | undefined): string {
  if (issue._tag === "InvalidValue") {
    return filter === undefined ? "invalid_value" : filterCode(filter);
  }
  if (issue._tag === "InvalidType") return invalidTypeCode(issue);
  return fixedLeafCodes[issue._tag];
}

type WalkOptions = Readonly<{ expandWholeUnions: boolean }>;
type WalkPosition = Readonly<{
  path: readonly PropertyKey[];
  filter: SchemaAST.Filter<unknown> | undefined;
}>;
type WalkContext = Readonly<{ options: WalkOptions; leaves: SchemaIssueLeaf[] }>;
type AnyOfIssue = Extract<SchemaIssue.Issue, { _tag: "AnyOf" }>;

function report(code: string, issue: SchemaIssue.Issue, at: WalkPosition, context: WalkContext) {
  context.leaves.push({ code, path: at.path, issue, filter: at.filter });
}

// A whole union stays one issue unless expansion is requested and it has members.
function reportsWholeUnion(issue: AnyOfIssue, options: WalkOptions): boolean {
  if (!wholeUnionReports.has(issue.ast)) return false;
  return !options.expandWholeUnions || issue.issues.length === 0;
}

function expandsUnionMembers(issue: AnyOfIssue): boolean {
  return wholeUnionReports.has(issue.ast) || issue.issues.length === 1;
}

function walkAnyOf(issue: AnyOfIssue, at: WalkPosition, context: WalkContext): void {
  if (reportsWholeUnion(issue, context.options)) {
    report("invalid_union", issue, at, context);
    return;
  }
  if (expandsUnionMembers(issue)) {
    for (const member of issue.issues) walk(member, at, context);
    return;
  }
  const literals = issue.ast.types.every((member) => member._tag === "Literal");
  report(literals ? "invalid_value" : "invalid_union", issue, at, context);
}

function walk(issue: SchemaIssue.Issue, at: WalkPosition, context: WalkContext): void {
  switch (issue._tag) {
    case "Pointer":
      walk(issue.issue, { ...at, path: [...at.path, ...issue.path] }, context);
      return;
    case "Composite":
      for (const child of issue.issues) walk(child, at, context);
      return;
    case "Filter":
      walk(issue.issue, { ...at, filter: issue.filter }, context);
      return;
    case "Encoding":
      walk(issue.issue, at, context);
      return;
    case "AnyOf":
      walkAnyOf(issue, at, context);
      return;
    default:
      report(leafCode(issue, at.filter), issue, at, context);
  }
}

// Expanding whole unions exposes member leaves; boundary summaries keep the union-level issue.
export function schemaIssueLeaves(
  error: Schema.SchemaError,
  options: WalkOptions = { expandWholeUnions: false },
): SchemaIssueLeaf[] {
  const leaves: SchemaIssueLeaf[] = [];
  walk(error.issue, { path: [], filter: undefined }, { options, leaves });
  return leaves;
}

// Stable project-owned issue vocabulary for boundary diagnostics: code and path only.
export function summarizeSchemaError(error: Schema.SchemaError): SchemaIssueSummary[] {
  const summaries: SchemaIssueSummary[] = [];
  for (const leaf of schemaIssueLeaves(error)) {
    const path = leaf.code === "unrecognized_keys" ? leaf.path.slice(0, -1) : leaf.path;
    const duplicate =
      leaf.code === "unrecognized_keys" &&
      summaries.some(
        (other) =>
          other.code === "unrecognized_keys" &&
          other.path.length === path.length &&
          other.path.every((key, index) => key === path[index]),
      );
    if (!duplicate) summaries.push({ code: leaf.code, path });
  }
  return summaries;
}
