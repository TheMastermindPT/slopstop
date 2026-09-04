import type { HarnessSessionSendResult } from "./harness-session.js";

export function harnessSendFailureMessage(
  result: Exclude<HarnessSessionSendResult, { ok: true }>,
): string {
  switch (result.error.code) {
    case "HARNESS_SESSION_UNAVAILABLE":
      return "Harness session is unavailable.";
    case "HARNESS_SESSION_MESSAGE_INVALID":
      return "Desktop created an invalid harness message.";
    case "HARNESS_SESSION_SEND_FAILED":
      return "Harness session send failed.";
  }
}
