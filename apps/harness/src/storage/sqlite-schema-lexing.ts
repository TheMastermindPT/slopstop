import { ProjectStorageBrokenError } from "./project-storage-errors.js";

type SourceCursor = Readonly<{ source: string; start: number }>;

export function invalidSqliteSchemaExpression(): never {
  throw new ProjectStorageBrokenError("Database schema expression is invalid.");
}

export function skipSqliteSingleQuotedString(input: SourceCursor): number {
  let index = input.start + 1;
  while (index < input.source.length) {
    if (input.source.charAt(index) !== "'") {
      index += 1;
      continue;
    }
    if (input.source.charAt(index + 1) === "'") {
      index += 2;
      continue;
    }
    return index + 1;
  }
  return invalidSqliteSchemaExpression();
}

export function readSqliteQuotedIdentifier(
  input: SourceCursor,
): Readonly<{ value: string; end: number }> {
  const opening = input.source.charAt(input.start);
  const closing = opening === "[" ? "]" : opening;
  let value = "";
  let index = input.start + 1;
  while (index < input.source.length) {
    const character = input.source.charAt(index);
    if (character !== closing) {
      value += character;
      index += 1;
      continue;
    }
    if (opening !== "[" && input.source.charAt(index + 1) === closing) {
      value += closing;
      index += 2;
      continue;
    }
    return { value, end: index + 1 };
  }
  return invalidSqliteSchemaExpression();
}
