type FatalValueKind =
  | "error"
  | "string"
  | "number"
  | "boolean"
  | "bigint"
  | "symbol"
  | "function"
  | "object"
  | "null"
  | "undefined";

type FatalMetadata = Readonly<{
  code: "HARNESS_UNCAUGHT_EXCEPTION" | "HARNESS_UNHANDLED_REJECTION";
  valueKind: FatalValueKind;
}>;

type HarnessFatalHandlerOptions = Readonly<{
  fatal(metadata: FatalMetadata, message: string): void;
  exit(code: 1): void;
}>;

function valueKind(value: unknown): FatalValueKind {
  if (value instanceof Error) {
    return "error";
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

export function createHarnessFatalHandlers(options: HarnessFatalHandlerOptions) {
  return {
    uncaughtException(value: unknown): void {
      options.fatal(
        { code: "HARNESS_UNCAUGHT_EXCEPTION", valueKind: valueKind(value) },
        "Harness encountered an uncaught exception.",
      );
      options.exit(1);
    },
    unhandledRejection(value: unknown): void {
      options.fatal(
        { code: "HARNESS_UNHANDLED_REJECTION", valueKind: valueKind(value) },
        "Harness encountered an unhandled rejection.",
      );
      options.exit(1);
    },
  };
}
