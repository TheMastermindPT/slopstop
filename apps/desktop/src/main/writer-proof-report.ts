import { Data, Effect } from "effect";

/** The Writer proof's terminal report could not be written. */
export class WriterProofReportFailed extends Data.TaggedError("WriterProofReportFailed")<{
  readonly message: string;
}> {}

export function writeWriterProofReport(text: string): Effect.Effect<void, WriterProofReportFailed> {
  return Effect.callback<void, WriterProofReportFailed>((resume) => {
    process.stderr.write(text, (error) => {
      resume(
        error
          ? new WriterProofReportFailed({ message: "Writer proof terminal reporting failed." })
          : Effect.void,
      );
    });
  });
}
