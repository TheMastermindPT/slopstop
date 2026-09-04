import { sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export function domainIdentityCheck(column: AnySQLiteColumn) {
  return sql`
    length(${column}) = 36
    and ${column} = lower(${column})
    and substr(${column}, 1, 8) not glob '*[^0-9a-f]*'
    and substr(${column}, 9, 1) = '-'
    and substr(${column}, 10, 4) not glob '*[^0-9a-f]*'
    and substr(${column}, 14, 1) = '-'
    and substr(${column}, 15, 1) glob '[1-8]'
    and substr(${column}, 16, 3) not glob '*[^0-9a-f]*'
    and substr(${column}, 19, 1) = '-'
    and substr(${column}, 20, 1) glob '[89ab]'
    and substr(${column}, 21, 3) not glob '*[^0-9a-f]*'
    and substr(${column}, 24, 1) = '-'
    and substr(${column}, 25, 12) not glob '*[^0-9a-f]*'
  `;
}
