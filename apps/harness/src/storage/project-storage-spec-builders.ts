/** Shapes and expression builders shared by the declared database specs. */

export type ColumnSpec = Readonly<{
  table: string;
  cid: number;
  name: string;
  type: string;
  notNull: 0 | 1;
  defaultValue: string | null;
  primaryKey: number;
  hidden: number;
}>;

export type NamedCheckSpec = Readonly<{
  table: string;
  name: string;
  expression: string;
}>;

export type NamedIndexSpec = Readonly<{
  table: string;
  name: string;
  unique: boolean;
  partial: boolean;
  columns: readonly string[];
  predicate: string | null;
}>;

export type ForeignKeySpec = Readonly<{
  table: string;
  columns: readonly string[];
  referencedTable: string;
  referencedColumns: readonly string[];
  onUpdate: "NO ACTION" | "RESTRICT";
  onDelete: "NO ACTION" | "RESTRICT";
  match: "NONE";
}>;

export type ColumnDefinition = readonly [
  name: string,
  type: "integer" | "text",
  notNull: 0 | 1,
  primaryKey: number,
  defaultValue?: string | null,
  hidden?: number,
];

export type TableDefinition = Readonly<{ table: string; definitions: readonly ColumnDefinition[] }>;

export function tableColumns(input: TableDefinition): readonly ColumnSpec[] {
  const { table, definitions } = input;
  return definitions.map(
    ([name, type, notNull, primaryKey, defaultValue = null, hidden = 0], cid) => ({
      table,
      cid,
      name,
      type: type.toUpperCase(),
      notNull,
      defaultValue,
      primaryKey,
      hidden,
    }),
  );
}

export function column(reference: Pick<ColumnSpec, "table" | "name">): string {
  return `"${reference.table}"."${reference.name}"`;
}

export function namedCheck(table: string, name: string, expression: string): NamedCheckSpec {
  return { table, name, expression };
}

export function identityExpression(reference: Pick<ColumnSpec, "table" | "name">): string {
  const value = column(reference);
  return `
    length(${value}) = 36
    and ${value} = lower(${value})
    and substr(${value}, 1, 8) not glob '*[^0-9a-f]*'
    and substr(${value}, 9, 1) = '-'
    and substr(${value}, 10, 4) not glob '*[^0-9a-f]*'
    and substr(${value}, 14, 1) = '-'
    and substr(${value}, 15, 1) glob '[1-8]'
    and substr(${value}, 16, 3) not glob '*[^0-9a-f]*'
    and substr(${value}, 19, 1) = '-'
    and substr(${value}, 20, 1) glob '[89ab]'
    and substr(${value}, 21, 3) not glob '*[^0-9a-f]*'
    and substr(${value}, 24, 1) = '-'
    and substr(${value}, 25, 12) not glob '*[^0-9a-f]*'
  `;
}

export function identityCheck(
  input: Readonly<{ table: string; name: string; columnName: string }>,
): NamedCheckSpec {
  const { table, name, columnName } = input;
  return namedCheck(table, name, identityExpression({ table, name: columnName }));
}

export function nonemptyTextExpression(reference: Pick<ColumnSpec, "table" | "name">): string {
  return `length(trim(${column(reference)})) > 0`;
}

export function sha256Expression(reference: Pick<ColumnSpec, "table" | "name">): string {
  const value = column(reference);
  return `length(${value}) = 64 and ${value} = lower(${value}) and ${value} not glob '*[^0-9a-f]*'`;
}

export function nonnegativeSafeIntegerExpression(
  reference: Pick<ColumnSpec, "table" | "name">,
): string {
  const value = column(reference);
  return `typeof(${value}) = 'integer' and ${value} >= 0 and ${value} <= 9007199254740991`;
}

export function positiveSafeIntegerExpression(
  reference: Pick<ColumnSpec, "table" | "name">,
): string {
  const value = column(reference);
  return `typeof(${value}) = 'integer' and ${value} > 0 and ${value} <= 9007199254740991`;
}
