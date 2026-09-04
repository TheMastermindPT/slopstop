import {
  invalidSqliteSchemaExpression,
  readSqliteQuotedIdentifier,
  skipSqliteSingleQuotedString,
} from "./sqlite-schema-lexing.js";

const sqliteKeywords = new Set([
  "abort",
  "action",
  "add",
  "after",
  "all",
  "alter",
  "analyze",
  "and",
  "as",
  "asc",
  "attach",
  "autoincrement",
  "before",
  "begin",
  "between",
  "by",
  "cascade",
  "case",
  "cast",
  "check",
  "collate",
  "column",
  "commit",
  "conflict",
  "constraint",
  "create",
  "cross",
  "current",
  "current_date",
  "current_time",
  "current_timestamp",
  "database",
  "default",
  "deferrable",
  "deferred",
  "delete",
  "desc",
  "detach",
  "distinct",
  "do",
  "drop",
  "each",
  "else",
  "end",
  "escape",
  "except",
  "exclude",
  "exclusive",
  "exists",
  "explain",
  "fail",
  "filter",
  "first",
  "following",
  "for",
  "foreign",
  "from",
  "full",
  "generated",
  "glob",
  "group",
  "groups",
  "having",
  "if",
  "ignore",
  "immediate",
  "in",
  "index",
  "indexed",
  "initially",
  "inner",
  "insert",
  "instead",
  "intersect",
  "into",
  "is",
  "isnull",
  "join",
  "key",
  "last",
  "left",
  "like",
  "limit",
  "match",
  "materialized",
  "natural",
  "no",
  "not",
  "nothing",
  "notnull",
  "null",
  "nulls",
  "of",
  "offset",
  "on",
  "or",
  "order",
  "others",
  "outer",
  "over",
  "partition",
  "plan",
  "pragma",
  "preceding",
  "primary",
  "query",
  "raise",
  "range",
  "recursive",
  "references",
  "regexp",
  "reindex",
  "release",
  "rename",
  "replace",
  "restrict",
  "right",
  "rollback",
  "row",
  "rows",
  "savepoint",
  "select",
  "set",
  "table",
  "temp",
  "temporary",
  "then",
  "ties",
  "to",
  "transaction",
  "trigger",
  "unbounded",
  "union",
  "unique",
  "update",
  "using",
  "vacuum",
  "values",
  "view",
  "virtual",
  "when",
  "where",
  "window",
  "with",
  "without",
]);

const twoCharacterOperators = new Set(["||", "<<", ">>", "<=", ">=", "==", "!=", "<>", "->"]);
const singleCharacterOperators = new Set(["=", "<", ">", "+", "-", "*", "/", "%", "&", "|", "~"]);
const punctuation = new Set(["(", ")", ",", "."]);
const whitespace = new Set([" ", "\t", "\n", "\v", "\f", "\r"]);
const lineBreaks = new Set(["\n", "\r"]);

type SourceCursor = Readonly<{ source: string; start: number }>;

function invalidExpression(): never {
  return invalidSqliteSchemaExpression();
}

function isWhitespace(input: { character: string }): boolean {
  return whitespace.has(input.character);
}

function isIdentifierStart(input: { character: string }): boolean {
  return /[A-Za-z_]/u.test(input.character);
}

function isIdentifierPart(input: { character: string }): boolean {
  return /[A-Za-z0-9_$]/u.test(input.character);
}

function isDecimalDigit(input: { character: string }): boolean {
  return input.character >= "0" && input.character <= "9";
}

function isHexadecimalDigit(input: { character: string }): boolean {
  return isDecimalDigit(input) || /[A-Fa-f]/u.test(input.character);
}

function readQuotedIdentifier(input: SourceCursor): Readonly<{ token: string; next: number }> {
  const identifier = readSqliteQuotedIdentifier(input);
  return {
    token: `quoted-identifier:${JSON.stringify(identifier.value)}`,
    next: identifier.end,
  };
}

function readStringLiteral(input: SourceCursor): Readonly<{ token: string; next: number }> {
  const next = skipSqliteSingleQuotedString(input);
  return {
    token: `literal:${input.source.slice(input.start, next)}`,
    next,
  };
}

function readHexadecimalNumber(input: SourceCursor): Readonly<{ token: string; next: number }> {
  let index = input.start + 2;
  const digitsStart = index;
  while (isHexadecimalDigit({ character: input.source.charAt(index) })) index += 1;
  if (index === digitsStart) return invalidExpression();
  if (isIdentifierPart({ character: input.source.charAt(index) })) return invalidExpression();
  return { token: `number:${input.source.slice(input.start, index)}`, next: index };
}

function readDecimalMantissa(input: SourceCursor): number {
  let index = input.start;
  while (isDecimalDigit({ character: input.source.charAt(index) })) index += 1;
  if (input.source.charAt(index) !== ".") return index;
  index += 1;
  while (isDecimalDigit({ character: input.source.charAt(index) })) index += 1;
  return index;
}

function readDecimalExponent(input: SourceCursor): number {
  let index = input.start + 1;
  if (input.source.charAt(index) === "+" || input.source.charAt(index) === "-") {
    index += 1;
  }
  const exponentStart = index;
  while (isDecimalDigit({ character: input.source.charAt(index) })) index += 1;
  return index === exponentStart ? invalidExpression() : index;
}

function readNumber(input: SourceCursor): Readonly<{ token: string; next: number }> {
  if (
    input.source.charAt(input.start) === "0" &&
    input.source.charAt(input.start + 1).toLowerCase() === "x"
  ) {
    return readHexadecimalNumber(input);
  }
  let index = readDecimalMantissa(input);
  if (input.source.charAt(index).toLowerCase() === "e") {
    index = readDecimalExponent({ source: input.source, start: index });
  }
  if (isIdentifierPart({ character: input.source.charAt(index) })) return invalidExpression();

  return { token: `number:${input.source.slice(input.start, index)}`, next: index };
}

function skipComment(input: SourceCursor): number | undefined {
  const pair = input.source.slice(input.start, input.start + 2);
  if (pair === "--") {
    let index = input.start + 2;
    while (index < input.source.length) {
      if (lineBreaks.has(input.source.charAt(index))) return index;
      index += 1;
    }
    return index;
  }
  if (pair !== "/*") return undefined;

  const closing = input.source.indexOf("*/", input.start + 2);
  if (closing < 0) return invalidExpression();
  return closing + 2;
}

export function canonicalizeSqliteSchemaExpression(source: string): readonly string[] {
  const tokens: string[] = [];
  let parenthesisDepth = 0;
  let index = 0;

  while (index < source.length) {
    const character = source.charAt(index);
    if (isWhitespace({ character })) {
      index += 1;
      continue;
    }

    const afterComment = skipComment({ source, start: index });
    if (afterComment !== undefined) {
      index = afterComment;
      continue;
    }

    if (character === "'") {
      const literal = readStringLiteral({ source, start: index });
      tokens.push(literal.token);
      index = literal.next;
      continue;
    }

    if (character === '"' || character === "`" || character === "[") {
      const identifier = readQuotedIdentifier({ source, start: index });
      tokens.push(identifier.token);
      index = identifier.next;
      continue;
    }

    if (
      isDecimalDigit({ character }) ||
      (character === "." && isDecimalDigit({ character: source.charAt(index + 1) }))
    ) {
      const number = readNumber({ source, start: index });
      tokens.push(number.token);
      index = number.next;
      continue;
    }

    if (isIdentifierStart({ character })) {
      let next = index + 1;
      while (isIdentifierPart({ character: source.charAt(next) })) next += 1;
      const identifier = source.slice(index, next);
      const normalized = identifier.toLowerCase();
      tokens.push(
        sqliteKeywords.has(normalized)
          ? `keyword:${normalized.toUpperCase()}`
          : `identifier:${identifier}`,
      );
      index = next;
      continue;
    }

    const threeCharacters = source.slice(index, index + 3);
    if (threeCharacters === "->>") {
      tokens.push(`operator:${threeCharacters}`);
      index += 3;
      continue;
    }

    const twoCharacters = source.slice(index, index + 2);
    if (twoCharacterOperators.has(twoCharacters)) {
      tokens.push(`operator:${twoCharacters}`);
      index += 2;
      continue;
    }
    if (singleCharacterOperators.has(character)) {
      tokens.push(`operator:${character}`);
      index += 1;
      continue;
    }
    if (punctuation.has(character)) {
      if (character === "(") parenthesisDepth += 1;
      if (character === ")") {
        if (parenthesisDepth === 0) return invalidExpression();
        parenthesisDepth -= 1;
      }
      tokens.push(`punctuation:${character}`);
      index += 1;
      continue;
    }

    return invalidExpression();
  }

  if (tokens.length === 0 || parenthesisDepth !== 0) return invalidExpression();
  return tokens;
}
