import {
  invalidSqliteSchemaExpression,
  readSqliteQuotedIdentifier,
  skipSqliteSingleQuotedString,
} from "./sqlite-schema-lexing.js";

const quotedIdentifierOpenings = new Set(['"', "`", "["]);

export type SqliteSchemaToken = Readonly<{
  kind: "identifier" | "punctuation";
  value: string;
  quoted: boolean;
  start: number;
  end: number;
  depth: number;
}>;

function invalidSchema(): never {
  return invalidSqliteSchemaExpression();
}

function isIdentifierStart(input: { character: string }): boolean {
  return /[A-Za-z_]/u.test(input.character);
}

function isIdentifierPart(input: { character: string }): boolean {
  return /[A-Za-z0-9_$]/u.test(input.character);
}

function skipComment(input: { source: string; start: number }): number | undefined {
  const marker = input.source.slice(input.start, input.start + 2);
  if (marker === "--") {
    const newline = input.source.indexOf("\n", input.start + 2);
    return newline < 0 ? input.source.length : newline + 1;
  }
  if (marker !== "/*") return undefined;
  const end = input.source.indexOf("*/", input.start + 2);
  return end < 0 ? invalidSchema() : end + 2;
}

function skipQuotedOrComment(input: { source: string; index: number }): number | undefined {
  const character = input.source.charAt(input.index);
  if (character === "'") {
    return skipSqliteSingleQuotedString({ source: input.source, start: input.index });
  }
  if (quotedIdentifierOpenings.has(character)) {
    return readSqliteQuotedIdentifier({ source: input.source, start: input.index }).end;
  }
  return skipComment({ source: input.source, start: input.index });
}

export function scanSqliteSchemaTokens(input: { source: string }): readonly SqliteSchemaToken[] {
  const tokens: SqliteSchemaToken[] = [];
  let depth = 0;
  let index = 0;
  while (index < input.source.length) {
    const character = input.source.charAt(index);
    const afterComment = skipComment({ source: input.source, start: index });
    if (afterComment !== undefined) {
      index = afterComment;
      continue;
    }
    if (character === "'") {
      index = skipSqliteSingleQuotedString({ source: input.source, start: index });
      continue;
    }
    if (quotedIdentifierOpenings.has(character)) {
      const identifier = readSqliteQuotedIdentifier({ source: input.source, start: index });
      tokens.push({
        kind: "identifier",
        value: identifier.value,
        quoted: true,
        start: index,
        end: identifier.end,
        depth,
      });
      index = identifier.end;
      continue;
    }
    if (isIdentifierStart({ character })) {
      let end = index + 1;
      while (isIdentifierPart({ character: input.source.charAt(end) })) end += 1;
      tokens.push({
        kind: "identifier",
        value: input.source.slice(index, end),
        quoted: false,
        start: index,
        end,
        depth,
      });
      index = end;
      continue;
    }
    if (character === "(") {
      tokens.push({
        kind: "punctuation",
        value: character,
        quoted: false,
        start: index,
        end: index + 1,
        depth,
      });
      depth += 1;
      index += 1;
      continue;
    }
    if (character === ")") {
      if (depth === 0) return invalidSchema();
      depth -= 1;
      tokens.push({
        kind: "punctuation",
        value: character,
        quoted: false,
        start: index,
        end: index + 1,
        depth,
      });
      index += 1;
      continue;
    }
    index += 1;
  }
  if (depth !== 0) return invalidSchema();
  return tokens;
}

export function readBalancedSqliteExpression(input: {
  source: string;
  bodyStart: number;
}): Readonly<{ expression: string; end: number }> {
  let depth = 1;
  let index = input.bodyStart;
  while (index < input.source.length) {
    const skipped = skipQuotedOrComment({ source: input.source, index });
    if (skipped !== undefined) {
      index = skipped;
      continue;
    }
    const character = input.source.charAt(index);
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth === 0) {
      return { expression: input.source.slice(input.bodyStart, index), end: index + 1 };
    }
    index += 1;
  }
  return invalidSchema();
}

export function isUnquotedSqliteKeyword(input: {
  token: SqliteSchemaToken;
  keyword: string;
}): boolean {
  return (
    input.token.kind === "identifier" &&
    !input.token.quoted &&
    input.token.value.toLowerCase() === input.keyword.toLowerCase()
  );
}
