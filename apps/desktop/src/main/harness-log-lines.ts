import { StringDecoder } from "node:string_decoder";
import {
  decodeStrictResult,
  HarnessFatalLogLineSchema,
  HarnessUpgradeLogLineSchema,
  harnessFatalCodes,
  harnessUpgradeLogEvents,
} from "@slopstop/protocol";
import { Result } from "effect";
import type { Logger } from "pino";

/** The longest harness output line kept while waiting for its newline. */
const harnessLogLineLimit = 16 * 1024;

const upgradeEvents: ReadonlySet<string> = new Set(Object.values(harnessUpgradeLogEvents));
const fatalCodes: ReadonlySet<string> = new Set(harnessFatalCodes);

type LineLogger = Pick<Logger, "info" | "warn" | "error">;

/**
 * A harness line the desktop decodes: a JSON object naming a known upgrade event, or a
 * level-60 line naming a known fatal code. Its echoed name is already in a closed vocabulary.
 */
type CandidateLine =
  | Readonly<{ kind: "upgrade"; event: string; value: object }>
  | Readonly<{ kind: "fatal"; fatalCode: string; value: object }>;

function jsonObjectOf(line: string): object | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  return typeof value === "object" && value !== null ? value : undefined;
}

/** `value[key]` when it is one of `known`. */
function knownField(value: object, key: "event" | "code", known: ReadonlySet<string>) {
  const field: unknown = Reflect.get(value, key);
  return typeof field === "string" && known.has(field) ? field : undefined;
}

function candidateOf(line: string): CandidateLine | undefined {
  const value = jsonObjectOf(line);
  if (value === undefined) return undefined;
  const event = knownField(value, "event", upgradeEvents);
  if (event !== undefined) return { kind: "upgrade", event, value };
  const fatalCode = knownField(value, "code", fatalCodes);
  const isFatal = fatalCode !== undefined && Reflect.get(value, "level") === 60;
  return isFatal ? { kind: "fatal", fatalCode, value } : undefined;
}

type UpgradeCandidate = Extract<CandidateLine, { kind: "upgrade" }>;
type FatalCandidate = Extract<CandidateLine, { kind: "fatal" }>;

function forwardUpgrade(logger: LineLogger, attempt: number, { event, value }: UpgradeCandidate) {
  const decoded = decodeStrictResult(HarnessUpgradeLogLineSchema, value);
  if (Result.isFailure(decoded)) {
    logger.warn(
      { code: "HARNESS_LOG_LINE_INVALID", attempt, event },
      "Harness upgrade log line rejected.",
    );
    return;
  }
  const { level, time, service: _service, ...fields } = decoded.success;
  const entry = { source: "harness", ...fields, harnessTime: new Date(time).toISOString() };
  if (level === 30) logger.info(entry, "Harness upgrade event.");
  else logger.warn(entry, "Harness upgrade event.");
}

function forwardFatal(logger: LineLogger, attempt: number, { fatalCode, value }: FatalCandidate) {
  const decoded = decodeStrictResult(HarnessFatalLogLineSchema, value);
  if (Result.isFailure(decoded)) {
    logger.warn(
      { code: "HARNESS_LOG_LINE_INVALID", attempt, fatalCode },
      "Harness fatal log line rejected.",
    );
    return;
  }
  // `source` keeps a forwarded code apart from the desktop's own diagnostic of the same code.
  const { level: _level, time, service: _service, msg: _msg, ...fields } = decoded.success;
  logger.error(
    { source: "harness", attempt, ...fields, harnessTime: new Date(time).toISOString() },
    "Harness fatal event.",
  );
}

function forwardLine(logger: LineLogger, attempt: number, line: string): void {
  const candidate = candidateOf(line);
  if (candidate?.kind === "upgrade") forwardUpgrade(logger, attempt, candidate);
  else if (candidate?.kind === "fatal") forwardFatal(logger, attempt, candidate);
}

/**
 * Splits harness stdout into lines and forwards only valid upgrade and fatal log lines to the
 * desktop log. A line longer than `harnessLogLineLimit` is dropped up to its newline; a partial
 * line left at exit is reported once.
 */
export function createHarnessLogLineForwarder(logger: LineLogger, attempt: number) {
  // Characters split across chunks are joined before any line is cut.
  const decoder = new StringDecoder("utf8");
  let buffered = "";
  // Set while the rest of an overlong line, already reported, is skipped up to its newline.
  let dropping = false;
  const tooLong = () =>
    logger.warn({ code: "HARNESS_LOG_LINE_TOO_LONG", attempt }, "Harness output line dropped.");
  const completeLine = (line: string): void => {
    if (dropping) dropping = false;
    else if (Buffer.byteLength(line) > harnessLogLineLimit) tooLong();
    else forwardLine(logger, attempt, line);
  };
  return {
    push(chunk: Buffer): void {
      const lines = (buffered + decoder.write(chunk)).split("\n");
      const rest = lines.pop() ?? "";
      for (const line of lines) completeLine(line);
      buffered = "";
      if (dropping) return;
      if (Buffer.byteLength(rest) > harnessLogLineLimit) {
        dropping = true;
        tooLong();
        return;
      }
      buffered = rest;
    },
    end(): void {
      const rest = buffered + decoder.end();
      buffered = "";
      if (rest !== "" && !dropping) {
        logger.warn(
          { code: "HARNESS_LOG_LINE_INCOMPLETE", attempt },
          "Harness output line incomplete.",
        );
      }
    },
  };
}
