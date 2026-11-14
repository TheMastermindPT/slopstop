import {
  harnessFailureRows,
  type ProjectConversationReadRequest,
  type ProjectConversationReadResult,
  type ProjectConversationSaveRequest,
  type ProjectConversationSaveResult,
  projectConversationDiagnostics,
} from "@slopstop/protocol";
import type { ProjectRequestFault } from "./harness-request-core.js";
import { faultMeaning } from "./request-fault-meaning.js";

const rows = projectConversationDiagnostics;

/** A read that got no decoded reply: a lost read is `unavailable`; a malformed reply is `broken`. */
export function readConversationFailure(
  request: ProjectConversationReadRequest,
  fault: ProjectRequestFault,
): ProjectConversationReadResult {
  const meaning = faultMeaning(fault);
  if (meaning.meaning === "harness")
    return { status: "broken", request, diagnostic: harnessFailureRows[meaning.code] };
  if (meaning.meaning === "not-sent" || meaning.meaning === "sent-then-lost")
    return { status: "unavailable", request, diagnostic: rows.connectionLost };
  return { status: "broken", request, diagnostic: rows.protocolMessageInvalid };
}

/**
 * A save that got no decoded reply. Once sent, the harness may have committed it, so a lost
 * connection and a malformed reply are `uncertain`; the kept `saveId` lets a later press replay
 * it (G25, G27). A save never sent is `unavailable`.
 */
export function saveConversationFailure(
  request: ProjectConversationSaveRequest,
  fault: ProjectRequestFault,
): ProjectConversationSaveResult {
  const meaning = faultMeaning(fault);
  if (meaning.meaning === "harness")
    return { status: "broken", request, diagnostic: harnessFailureRows[meaning.code] };
  if (meaning.meaning === "not-sent")
    return { status: "unavailable", request, diagnostic: rows.connectionLost };
  if (meaning.meaning === "defect")
    return { status: "broken", request, diagnostic: rows.protocolMessageInvalid };
  return { status: "uncertain", request, diagnostic: rows.saveUnconfirmed };
}
