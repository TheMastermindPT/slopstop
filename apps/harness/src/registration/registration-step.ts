import type { ProjectRegistrationResult } from "@slopstop/protocol";
import { Data, Effect } from "effect";

/** A step's owner rejected instead of answering with a result envelope. */
export class RegistrationStepDefect extends Data.TaggedError("RegistrationStepDefect")<{
  readonly cause: unknown;
}> {}

export type RegistrationStepFailure = Extract<
  ProjectRegistrationResult,
  { status: "cancelled" | "broken" | "unavailable" | "rejected" | "pending-recovery" }
>;
type Outcome = Readonly<{ status: string; code?: string; exitCode?: number }>;

export const internalFailure = { status: "broken", code: "INTERNAL_FAILURE" } as const;

// Keeps only the wire fields of an owner failure; detail such as observer triggers or
// request ids stays inside the harness. The flow's boundary decode rejects any code the
// protocol lacks.
export function failureOf(outcome: Outcome): RegistrationStepFailure {
  const failure =
    outcome.code === undefined
      ? { status: outcome.status }
      : outcome.exitCode === undefined
        ? { status: outcome.status, code: outcome.code }
        : { status: outcome.status, code: outcome.code, exitCode: outcome.exitCode };
  return failure as RegistrationStepFailure;
}

/** Calls an existing Promise owner method, keeping its rejection as a typed defect. */
export function step<Value>(operation: () => Promise<Value>) {
  return Effect.tryPromise({
    try: operation,
    catch: (cause) => new RegistrationStepDefect({ cause }),
  });
}
