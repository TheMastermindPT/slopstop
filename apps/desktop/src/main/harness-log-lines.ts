import { StringDecoder } from "node:string_decoder";
import {
  decodeStrictResult,
  HarnessFatalLogLineSchema,
  HarnessReconciliationFailureLogLineSchema,
  HarnessRequestFailureLogLineSchema,
  HarnessUpgradeLogLineSchema,
  harnessFatalCodes,
  harnessReconciliationFailureCode,
  harnessRequestFailureCode,
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
 * A harness line the desktop decodes: a JSON object naming a known upgrade event, a level-60
 * line naming a known fatal code, or a level-40 request-failure or reconciliation line. Its
 * echoed name is already in a closed vocabulary.
 */
type CandidateLine =
  | Readonly<{ kind: "upgrade"; event: string; value: object }>
  | Readonly<{ kind: "fatal"; fatalCode: string; value: object }>
  | Readonly<{ kind: "request"; value: object }>
  | Readonly<{ kind: "reconciliation"; value: object }>;

/** The level-40 harness codes, each with the candidate kind its lines are decoded as. */
const warningKinds: ReadonlyMap<unknown, "request" | "reconciliation"> = new Map([
  [harnessRequestFailureCode, "request"],
  [harnessReconciliationFailureCode, "reconciliation"],
]);

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
  const level: unknown = Reflect.get(value, "level");
  if (fatalCode !== undefined)
    return level === 60 ? { kind: "fatal", fatalCode, value } : undefined;
  const warningKind = warningKinds.get(Reflect.get(value, "code"));
  return warningKind !== undefined && level === 40 ? { kind: warningKind, value } : undefined;
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

function forwardRequestFailure(logger: LineLogger, attempt: number, value: object) {
  const decoded = decodeStrictResult(HarnessRequestFailureLogLineSchema, value);
  if (Result.isFailure(decoded)) {
    logger.warn(
      { code: "HARNESS_LOG_LINE_INVALID", attempt, requestCode: harnessRequestFailureCode },
      "Harness request failure log line rejected.",
    );
    return;
  }
  const { level: _level, time, service: _service, msg: _msg, ...fields } = decoded.success;
  logger.warn(
    { source: "harness", attempt, ...fields, harnessTime: new Date(time).toISOString() },
    "Harness request failure.",
  );
}

function forwardReconciliationFailure(logger: LineLogger, attempt: number, value: object) {
  const decoded = decodeStrictResult(HarnessReconciliationFailureLogLineSchema, value);
  if (Result.isFailure(decoded)) {
    logger.warn(
      {
        code: "HARNESS_LOG_LINE_INVALID",
        attempt,
        reconciliationCode: harnessReconciliationFailureCode,
      },
      "Harness reconciliation log line rejected.",
    );
    return;
  }
  const { code, time } = decoded.success;
  logger.warn(
    { source: "harness", attempt, code, harnessTime: new Date(time).toISOString() },
    "Harness registration reconciliation failure.",
  );
}

function forwardLine(logger: LineLogger, attempt: number, line: string): void {
  const candidate = candidateOf(line);
  if (candidate === undefined) return;
  switch (candidate.kind) {
    case "upgrade":
      forwardUpgrade(logger, attempt, candidate);
      return;
    case "fatal":
      forwardFatal(logger, attempt, candidate);
      return;
    case "request":
      forwardRequestFailure(logger, attempt, candidate.value);
      return;
    case "reconciliation":
      forwardReconciliationFailure(logger, attempt, candidate.value);
      return;
  }
}

/**
 * Splits harness stdout into lines and forwards only valid upgrade, fatal, request-failure and
 * reconciliation log lines to the desktop log. A line longer than `harnessLogLineLimit` is
 * dropped up to its newline; a partial line left at exit is reported once.
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
