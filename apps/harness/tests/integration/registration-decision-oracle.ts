import path from "node:path";
import { DatabaseSync } from "node:sqlite";

type DecisionTable = "registration_identity_consents" | "registration_repository_trust";

export const preservedDecisionTimestamp = "2001-02-03T04:05:06.000Z";

// Independent SQLite reader: no production row parser or consent owner is reused.
export function readDecisionRows(applicationRoot: string, table: DecisionTable) {
  const database = new DatabaseSync(path.join(applicationRoot, "application.db"), {
    readOnly: true,
  });
  try {
    return database.prepare(`SELECT * FROM ${table} ORDER BY 1`).all();
  } finally {
    database.close();
  }
}

// A past sentinel makes an accidental new Date() rewrite observable even in the same millisecond.
export function pinDecisionTimestamp(applicationRoot: string, table: DecisionTable) {
  const database = new DatabaseSync(path.join(applicationRoot, "application.db"));
  try {
    database.prepare(`UPDATE ${table} SET decided_at = ?`).run(preservedDecisionTimestamp);
  } finally {
    database.close();
  }
  return readDecisionRows(applicationRoot, table);
}
