import type { HarnessFailureCode } from "@slopstop/protocol";
import { Match } from "effect";
import type { ProjectRequestFault } from "./harness-request-core.js";

/** What a fault means for a request, before the operation decides its result. */
export type FaultMeaning =
  | Readonly<{ meaning: "not-sent" }>
  | Readonly<{ meaning: "sent-then-lost" }>
  | Readonly<{ meaning: "malformed-reply" }>
  | Readonly<{ meaning: "defect" }>
  | Readonly<{ meaning: "harness"; code: HarnessFailureCode }>;

/**
 * The shared fault table (G25). Not sent: a call after stop or a refused send. Sent, then lost: a
 * disconnect or a stop while pending. A malformed reply is a `protocol` fault, whatever its
 * reason: `invalid-message`, `uncorrelated`, `system-failure` or `undecodable`. A decodable wrong
 * reply, an unbuildable command, a colliding id or a send refused as an invalid message points to
 * a defect.
 */
export function faultMeaning(fault: ProjectRequestFault): FaultMeaning {
  return Match.value(fault).pipe(
    Match.discriminatorsExhaustive("kind")({
      unsent: (): FaultMeaning => ({ meaning: "not-sent" }),
      transport: (): FaultMeaning => ({ meaning: "sent-then-lost" }),
      stopped: (): FaultMeaning => ({ meaning: "sent-then-lost" }),
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
