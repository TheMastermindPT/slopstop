import { StringDecoder } from "node:string_decoder";
import {
  decodeStrictResult,
  HarnessUpgradeLogLineSchema,
  harnessUpgradeLogEvents,
} from "@slopstop/protocol";
import { Result } from "effect";
import type { Logger } from "pino";

/** The longest harness output line kept while waiting for its newline. */
const harnessLogLineLimit = 16 * 1024;

const upgradeEvents: ReadonlySet<string> = new Set(Object.values(harnessUpgradeLogEvents));

type LineLogger = Pick<Logger, "info" | "warn">;

/** A JSON object line that names a harness upgrade event, with that event. */
function upgradeLineOf(line: string): Readonly<{ event: string; value: object }> | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const event: unknown = Reflect.get(value, "event");
  return typeof event === "string" && upgradeEvents.has(event) ? { event, value } : undefined;
}

function forwardLine(logger: LineLogger, attempt: number, line: string): void {
  const upgrade = upgradeLineOf(line);
  if (upgrade === undefined) return;
  const { event } = upgrade;
  const decoded = decodeStrictResult(HarnessUpgradeLogLineSchema, upgrade.value);
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

/**
 * Splits harness stdout into lines and forwards only valid upgrade log lines to the desktop
 * log. A line longer than `harnessLogLineLimit` is dropped up to its newline; a partial line
 * left at exit is reported once.
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
