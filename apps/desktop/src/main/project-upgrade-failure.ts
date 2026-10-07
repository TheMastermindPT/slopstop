import {
  type ProjectUpgradeRequest,
  type ProjectUpgradeResult,
  projectUpgradeDiagnostics,
} from "@slopstop/protocol";
import { Match } from "effect";
import type { PendingFailure } from "./harness-pending-request.js";
import type { HarnessSessionSendResult } from "./harness-session.js";

type SendErrorCode = Extract<HarnessSessionSendResult, { ok: false }>["error"]["code"];

/**
 * Why a bridge request ended without a decoded reply: a pending failure, a refused send, or a
 * fault the bridge itself detected (an invalid command, a colliding id, or a mismatched reply).
 */
export type ProjectRequestFault =
  | PendingFailure
  | Readonly<{ kind: "send"; code: SendErrorCode }>
  | Readonly<{ kind: "desktop" }>;

const rows = projectUpgradeDiagnostics;
const harnessRows = {
  HARNESS_INTERNAL_FAILURE: rows.harnessInternalFailure,
  PROTOCOL_MESSAGE_INVALID: rows.protocolMessageInvalid,
  PROTOCOL_VERSION_UNSUPPORTED: rows.protocolVersionUnsupported,
} as const;

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
 * The one upgrade result for a request that got no decoded reply. Only a lost or stopped
 * connection is `unavailable`; a harness failure keeps its code, and every other fault is an
 * invalid protocol message.
 */
export function projectUpgradeFailure(
  request: ProjectUpgradeRequest,
  fault: ProjectRequestFault,
): ProjectUpgradeResult {
  return Match.value(fault).pipe(
    Match.discriminatorsExhaustive("kind")({
      transport: () => connectionLost(request),
      protocol: () => protocolInvalid(request),
      desktop: () => protocolInvalid(request),
      harness: ({ code }): ProjectUpgradeResult => ({
        status: "broken",
        request,
        diagnostic: harnessRows[code],
      }),
      send: ({ code }) =>
        code === "HARNESS_SESSION_MESSAGE_INVALID"
          ? protocolInvalid(request)
          : connectionLost(request),
    }),
  );
}
