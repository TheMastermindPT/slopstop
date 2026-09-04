import { expect, it } from "vitest";
import { ProjectStorageBrokenError } from "./project-storage-errors.js";
import { canonicalizeSqliteSchemaExpression } from "./sqlite-schema-expression.js";

const authoritativeExpression = `status = 'active' AND "project_id" IS NOT NULL`;

function equivalentExpressions(): readonly string[] {
  return [
    `  status   =   'active'\nAND   "project_id"   IS   NOT   NULL  `,
    `status /* current lifecycle */ = 'active' -- retained row\nAND "project_id" IS NOT NULL`,
    `status = 'active' and "project_id" is not null`,
    "status = 'active' AND `project_id` IS NOT NULL",
  ];
}

function differentExpressions(): readonly string[] {
  return [
    `status = 'staging' AND "project_id" IS NOT NULL`,
    `status = 'active' OR "project_id" IS NOT NULL`,
    `(status = 'active') AND "project_id" IS NOT NULL`,
    `(status = 'active' AND "project_id") IS NOT NULL`,
    `status <> 'active' AND "project_id" IS NOT NULL`,
  ];
}

function malformedExpressions(): readonly string[] {
  return [
    "",
    "(",
    ")",
    "0x",
    "0x1g",
    "1e",
    "1foo",
    "status = 'active",
    "status = 'active' /* unterminated",
    `status = 'active' AND "project_id IS NOT NULL`,
  ];
}

function captureFailure(expression: string): unknown {
  try {
    canonicalizeSqliteSchemaExpression(expression);
    return undefined;
  } catch (error) {
    return error;
  }
}

it("compares SQLite expressions by conservative token identity", () => {
  const authoritativeTokens = canonicalizeSqliteSchemaExpression(authoritativeExpression);

  for (const equivalent of equivalentExpressions()) {
    expect(canonicalizeSqliteSchemaExpression(equivalent)).toEqual(authoritativeTokens);
  }
  for (const different of differentExpressions()) {
    expect(canonicalizeSqliteSchemaExpression(different)).not.toEqual(authoritativeTokens);
  }
  for (const malformed of malformedExpressions()) {
    const failure = captureFailure(malformed);
    expect(failure).toBeInstanceOf(ProjectStorageBrokenError);
    if (!(failure instanceof ProjectStorageBrokenError)) {
      throw new Error("Expected malformed SQLite expression to fail closed.");
    }
    expect(failure.message).toBe("Database schema expression is invalid.");
  }
});

it("preserves quoted identifier and escaped literal identity", () => {
  expect(
    canonicalizeSqliteSchemaExpression(`[project_id] = "project""label" AND 'it''s' = 'it''s'`),
  ).toEqual([
    'quoted-identifier:"project_id"',
    "operator:=",
    'quoted-identifier:"project\\"label"',
    "keyword:AND",
    "literal:'it''s'",
    "operator:=",
    "literal:'it''s'",
  ]);
});

it("preserves hexadecimal, decimal, exponent, and JSON operator identity", () => {
  expect(
    canonicalizeSqliteSchemaExpression(`0x1Af + .5 - 1.25e+2 + 2E-3 + 3e4 ->> '$.id'`),
  ).toEqual([
    "number:0x1Af",
    "operator:+",
    "number:.5",
    "operator:-",
    "number:1.25e+2",
    "operator:+",
    "number:2E-3",
    "operator:+",
    "number:3e4",
    "operator:->>",
    "literal:'$.id'",
  ]);
});
