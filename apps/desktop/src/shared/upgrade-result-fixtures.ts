import {
  decodeStrictResult,
  type ProjectUpgradeRequest,
  type ProjectUpgradeResult,
  ProjectUpgradeResultSchema,
  type projectUpgradeDiagnostics,
} from "@slopstop/protocol";
import { Result } from "effect";

type Row = (typeof projectUpgradeDiagnostics)[keyof typeof projectUpgradeDiagnostics];
const failureStatuses = ["refused", "failed", "rejected", "unavailable", "broken"] as const;

/**
 * Test support: the one upgrade result whose status schema accepts this row, so tests derive
 * each row's status from the protocol instead of keeping their own copy.
 */
export function upgradeResultForRow(
  request: ProjectUpgradeRequest,
  row: Row,
): ProjectUpgradeResult {
  for (const status of failureStatuses) {
    const decoded = decodeStrictResult(ProjectUpgradeResultSchema, {
      status,
      request,
      diagnostic: row,
    });
    if (Result.isSuccess(decoded)) return decoded.success;
  }
  throw new Error(`No upgrade status accepts ${row.code}`);
}
