import {
  type HarnessFailureCode,
  type ProjectConversationReadRequest,
  type ProjectConversationReadResult,
  type ProjectConversationSaveRequest,
  type ProjectConversationSaveResult,
  projectConversationDiagnostics,
} from "@slopstop/protocol";
import { Match } from "effect";
import type { ProjectRequestFault } from "./project-upgrade-failure.js";

const rows = projectConversationDiagnostics;
const harnessRows = {
  HARNESS_INTERNAL_FAILURE: rows.harnessInternalFailure,
  PROTOCOL_MESSAGE_INVALID: rows.protocolMessageInvalid,
  PROTOCOL_VERSION_UNSUPPORTED: rows.protocolVersionUnsupported,
} as const;

/** What a fault means for a conversation request, before the operation decides its result. */
type FaultMeaning =
  | Readonly<{ meaning: "not-sent" }>
  | Readonly<{ meaning: "sent-then-lost" }>
  | Readonly<{ meaning: "malformed-reply" }>
  | Readonly<{ meaning: "defect" }>
  | Readonly<{ meaning: "harness"; code: HarnessFailureCode }>;

/**
 * The shared fault table (G25). Not sent: a call after stop or a refused send. Sent, then lost: a
 * disconnect or a stop while pending. A malformed reply arrives as a session protocol error. A
 * decodable wrong reply, an unbuildable command, a colliding id or a send refused as an invalid
 * message points to a defect.
 */
function faultMeaning(fault: ProjectRequestFault): FaultMeaning {
  return Match.value(fault).pipe(
    Match.discriminatorsExhaustive("kind")({
      unsent: (): FaultMeaning => ({ meaning: "not-sent" }),
      transport: (): FaultMeaning => ({ meaning: "sent-then-lost" }),
      protocol: (): FaultMeaning => ({ meaning: "malformed-reply" }),
      desktop: (): FaultMeaning => ({ meaning: "defect" }),
      harness: ({ code }): FaultMeaning => ({ meaning: "harness", code }),
      send: ({ code }): FaultMeaning =>
        code === "HARNESS_SESSION_MESSAGE_INVALID"
          ? { meaning: "defect" }
          : { meaning: "not-sent" },
    }),
  );
}

/** A read that got no decoded reply: a lost read is `unavailable`; a malformed reply is `broken`. */
export function readConversationFailure(
  request: ProjectConversationReadRequest,
  fault: ProjectRequestFault,
): ProjectConversationReadResult {
  const meaning = faultMeaning(fault);
  if (meaning.meaning === "harness")
    return { status: "broken", request, diagnostic: harnessRows[meaning.code] };
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
    return { status: "broken", request, diagnostic: harnessRows[meaning.code] };
  if (meaning.meaning === "not-sent")
    return { status: "unavailable", request, diagnostic: rows.connectionLost };
  if (meaning.meaning === "defect")
    return { status: "broken", request, diagnostic: rows.protocolMessageInvalid };
  return { status: "uncertain", request, diagnostic: rows.saveUnconfirmed };
}
