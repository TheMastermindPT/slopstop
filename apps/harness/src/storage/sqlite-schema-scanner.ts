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

function scanIdentifier(input: {
  source: string;
  index: number;
  depth: number;
}): SqliteSchemaToken | undefined {
  const character = input.source.charAt(input.index);
  const position = { start: input.index, depth: input.depth };
  if (quotedIdentifierOpenings.has(character)) {
    const identifier = readSqliteQuotedIdentifier({ source: input.source, start: input.index });
    return {
      kind: "identifier",
      value: identifier.value,
      quoted: true,
      ...position,
      end: identifier.end,
    };
  }
  if (!isIdentifierStart({ character })) return undefined;
  let end = input.index + 1;
  while (isIdentifierPart({ character: input.source.charAt(end) })) end += 1;
  const value = input.source.slice(input.index, end);
  return { kind: "identifier", value, quoted: false, ...position, end };
}

const depthChange: Readonly<Record<string, number>> = { "(": 1, ")": -1, ";": 0 };

function scanPunctuation(input: {
  character: string;
  index: number;
  depth: number;
}): Readonly<{ token: SqliteSchemaToken; depth: number }> | undefined {
  const change = depthChange[input.character];
  if (change === undefined) return undefined;
  const depth = input.depth + change;
  if (depth < 0) return invalidSchema();
  const token: SqliteSchemaToken = {
    kind: "punctuation",
    value: input.character,
    quoted: false,
    start: input.index,
    end: input.index + 1,
    depth: Math.min(input.depth, depth),
  };
  return { token, depth };
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
    const identifier = scanIdentifier({ source: input.source, index, depth });
    if (identifier !== undefined) {
      tokens.push(identifier);
      index = identifier.end;
      continue;
    }
    const punctuation = scanPunctuation({ character, index, depth });
    if (punctuation !== undefined) {
      tokens.push(punctuation.token);
      depth = punctuation.depth;
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
