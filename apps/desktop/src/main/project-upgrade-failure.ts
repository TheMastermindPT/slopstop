import {
  harnessFailureRows,
  type ProjectUpgradeRequest,
  type ProjectUpgradeResult,
  projectUpgradeDiagnostics,
} from "@slopstop/protocol";
import type { ProjectRequestFault } from "./harness-request-core.js";
import { faultMeaning } from "./request-fault-meaning.js";

const rows = projectUpgradeDiagnostics;
const connectionLost = (request: ProjectUpgradeRequest): ProjectUpgradeResult => ({
  status: "unavailable",
  request,
  diagnostic: rows.connectionLost,
});
const protocolInvalid = (request: ProjectUpgradeRequest): ProjectUpgradeResult => ({
  status: "broken",
  request,
  diagnostic: rows.protocolMessageInvalid,
});

/**
 * The one upgrade result for a request that got no decoded reply. Only a request never sent, or
 * sent and then lost to a dropped or stopped connection, is `unavailable`; a harness failure keeps
 * its code, and every other fault is an invalid protocol message.
 */
export function projectUpgradeFailure(
  request: ProjectUpgradeRequest,
  fault: ProjectRequestFault,
): ProjectUpgradeResult {
  const meaning = faultMeaning(fault);
  if (meaning.meaning === "harness")
    return { status: "broken", request, diagnostic: harnessFailureRows[meaning.code] };
  if (meaning.meaning === "not-sent" || meaning.meaning === "sent-then-lost")
    return connectionLost(request);
  return protocolInvalid(request);
}
