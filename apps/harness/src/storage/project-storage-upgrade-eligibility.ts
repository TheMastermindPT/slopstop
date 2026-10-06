import {
  isUnquotedSqliteKeyword,
  type SqliteSchemaToken,
  scanSqliteSchemaTokens,
} from "./sqlite-schema-scanner.js";

export type UpgradeEligibility = Readonly<
  { status: "eligible" } | { status: "unsupported" } | { status: "empty" }
>;

type Statement = readonly SqliteSchemaToken[];

const reservedNamePrefix = "__new_";

function splitStatements(tokens: readonly SqliteSchemaToken[]): readonly Statement[] {
  const statements: Statement[] = [];
  let current: SqliteSchemaToken[] = [];
  for (const token of tokens) {
    if (token.kind === "punctuation" && token.value === ";") {
      if (current.length > 0) statements.push(current);
      current = [];
      continue;
    }
    current.push(token);
  }
  if (current.length > 0) statements.push(current);
  return statements;
}

function isKeyword(token: SqliteSchemaToken | undefined, keyword: string): boolean {
  return token !== undefined && isUnquotedSqliteKeyword({ token, keyword });
}

function isObjectName(token: SqliteSchemaToken | undefined): boolean {
  if (token?.kind !== "identifier") return false;
  if (token.value.startsWith(reservedNamePrefix)) return false;
  return token.quoted || !isKeyword(token, "if");
}

function isCreateTable(statement: Statement): boolean {
  const opening = statement[3];
  return (
    isKeyword(statement[1], "table") &&
    isObjectName(statement[2]) &&
    opening?.kind === "punctuation" &&
    opening.value === "("
  );
}

function isCreateIndex(statement: Statement): boolean {
  const offset = isKeyword(statement[1], "unique") ? 1 : 0;
  return (
    isKeyword(statement[1 + offset], "index") &&
    isObjectName(statement[2 + offset]) &&
    isKeyword(statement[3 + offset], "on")
  );
}

function isAdditiveStatement(statement: Statement): boolean {
  if (!isKeyword(statement[0], "create")) return false;
  return isCreateTable(statement) || isCreateIndex(statement);
}

/**
 * Classifies pending migration statements for an automatic staged upgrade.
 *
 * @remarks
 * Only plain `CREATE TABLE <name> (` and `CREATE [UNIQUE] INDEX <name> ON` statements are
 * additive. A schema text the scanner cannot read throws `ProjectStorageBrokenError`.
 */
export function classifyUpgradeStatements(statements: readonly string[]): UpgradeEligibility {
  const parsed = statements.flatMap((source) =>
    splitStatements(scanSqliteSchemaTokens({ source })),
  );
  if (parsed.length === 0) return { status: "empty" };
  return parsed.every(isAdditiveStatement) ? { status: "eligible" } : { status: "unsupported" };
}
