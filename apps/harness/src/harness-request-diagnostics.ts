import {
  type HarnessRequestBoundary,
  harnessRequestBoundaryAnswers,
  harnessRequestFailureCode,
  harnessRequestFailureMessage,
} from "@slopstop/protocol";
import { summarizeHarnessFailure } from "./process-fatal-diagnostics.js";

/** The one logger call a request-failure line needs: Pino's `warn` with a message. */
export type RequestFailureLogger = Readonly<{ warn(fields: object, message: string): void }>;

/** Reports the failure a request boundary answered with a fixed code; it never throws. */
export type HarnessRequestDiagnostics = Readonly<{
  requestFailed(boundary: HarnessRequestBoundary, failure: unknown): void;
}>;

/**
 * Writes one redacted request-failure line per boundary failure: the boundary, the code it
 * answered and the failure summary. The failure's message, cause and stack are never read, and
 * a logger that throws is ignored, so logging can never change an answer.
 */
export function createHarnessRequestDiagnostics(
  logger: RequestFailureLogger,
): HarnessRequestDiagnostics {
  return {
    requestFailed: (boundary, failure) => {
      try {
        logger.warn(
          {
            code: harnessRequestFailureCode,
            boundary,
            answered: harnessRequestBoundaryAnswers[boundary],
            ...summarizeHarnessFailure(failure),
          },
          harnessRequestFailureMessage,
        );
      } catch {
        // A failed log write must not turn into a second failure at the boundary.
      }
    },
  };
}
