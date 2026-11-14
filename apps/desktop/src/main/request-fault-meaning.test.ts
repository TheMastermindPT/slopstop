import { harnessFailureMessages } from "@slopstop/protocol";
import { describe, expect, it } from "vitest";
import type { ProjectRequestFault } from "./harness-request-core.js";
import { type FaultMeaning, faultMeaning } from "./request-fault-meaning.js";

const harnessFault = (code: keyof typeof harnessFailureMessages): ProjectRequestFault => ({
  kind: "harness",
  code,
  message: harnessFailureMessages[code],
});

const rows: readonly (readonly [string, ProjectRequestFault, FaultMeaning])[] = [
  ["a call after stop", { kind: "unsent" }, { meaning: "not-sent" }],
  ["a disconnect", { kind: "transport" }, { meaning: "sent-then-lost" }],
  ["a stop while pending", { kind: "stopped" }, { meaning: "sent-then-lost" }],
  ...(["invalid-message", "uncorrelated", "system-failure", "undecodable"] as const).map(
    (reason) =>
      [
        `a protocol ${reason}`,
        { kind: "protocol", reason },
        { meaning: "malformed-reply" },
      ] as const,
  ),
  ...(
    ["invalid-command", "identity-collision", "mismatched-event", "mismatched-echo"] as const
  ).map(
    (reason) =>
      [`a desktop ${reason}`, { kind: "desktop", reason }, { meaning: "defect" }] as const,
  ),
  ...(
    [
      "HARNESS_INTERNAL_FAILURE",
      "PROTOCOL_MESSAGE_INVALID",
      "PROTOCOL_VERSION_UNSUPPORTED",
    ] as const
  ).map((code) => [`a harness ${code}`, harnessFault(code), { meaning: "harness", code }] as const),
  [
    "a send refused as an invalid message",
    { kind: "send", code: "HARNESS_SESSION_MESSAGE_INVALID" },
    { meaning: "defect" },
  ],
  [
    "a send to an unavailable session",
    { kind: "send", code: "HARNESS_SESSION_UNAVAILABLE" },
    { meaning: "not-sent" },
  ],
  [
    "a send that fails",
    { kind: "send", code: "HARNESS_SESSION_SEND_FAILED" },
    { meaning: "not-sent" },
  ],
];

describe("request fault meaning", () => {
  it.each(rows)("gives %s its one meaning", (_name, fault, meaning) => {
    expect(faultMeaning(fault)).toEqual(meaning);
  });
});
