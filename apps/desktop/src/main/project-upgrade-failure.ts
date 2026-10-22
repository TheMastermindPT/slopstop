import {
  type ProjectUpgradeRequest,
  type ProjectUpgradeResult,
  projectUpgradeDiagnostics,
} from "@slopstop/protocol";
import { Match } from "effect";
import type { ProjectRequestFault } from "./harness-request-core.js";

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
      unsent: () => connectionLost(request),
      stopped: () => connectionLost(request),
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
