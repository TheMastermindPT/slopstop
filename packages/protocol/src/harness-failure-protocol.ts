import { Schema } from "effect";

export const HarnessFailureCodeSchema = Schema.Literals([
  "PROTOCOL_MESSAGE_INVALID",
  "PROTOCOL_VERSION_UNSUPPORTED",
  "HARNESS_INTERNAL_FAILURE",
]);
export type HarnessFailureCode = typeof HarnessFailureCodeSchema.Type;

/** The one message each harness failure code is sent with. */
export const harnessFailureMessages = {
  PROTOCOL_MESSAGE_INVALID: "Harness received an invalid protocol message.",
  PROTOCOL_VERSION_UNSUPPORTED: "Desktop and harness protocol versions are incompatible.",
  HARNESS_INTERNAL_FAILURE: "Harness failed while handling a message.",
} as const satisfies Record<HarnessFailureCode, string>;
