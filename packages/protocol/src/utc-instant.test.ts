import { describe, expect, it } from "vitest";
import { decodeWithIssues } from "./decode-with-issues.test-support.js";
import {
  acceptsStrict,
  CanonicalSettlementTimeSchema,
  normalizedUtc,
  UtcInstantSchema,
} from "./index.js";

describe("UTC instant", () => {
  it.each([
    ["seconds", "2026-10-03T12:00:00Z", []],
    ["milliseconds", "2026-10-03T12:00:00.123Z", []],
    ["microseconds", "2026-10-03T12:00:00.123456Z", []],
    [
      "minute only",
      "2026-10-03T12:00Z",
      [{ code: "custom", path: [], message: "UTC instant must include seconds." }],
    ],
    [
      "offset",
      "2026-10-03T12:00:00+01:00",
      [{ code: "custom", path: [], message: "UTC instant must end in Z." }],
    ],
    ["impossible date", "2023-02-29T00:00:00Z", [{ code: "invalid_format", path: [] }]],
    ["hour 24", "2026-10-03T24:00:00Z", [{ code: "invalid_format", path: [] }]],
    ["space separator", "2026-10-03 12:00:00Z", [{ code: "invalid_format", path: [] }]],
  ])("accepts only UTC instants with seconds (%s)", (_name, value, issues) => {
    expect(decodeWithIssues(UtcInstantSchema, value).error?.issues ?? []).toEqual(issues);
  });

  it.each([
    "2026-10-03T12:00:00Z",
    "2026-10-03T12:00:00.123Z",
    "2026-10-03T12:00:00.123456Z",
    "2024-02-29T00:00:00Z",
    "2026-10-03T12:00Z",
    "2026-10-03T12:00:00+01:00",
    "2023-02-29T00:00:00Z",
    "2026-10-03T12:00:00z",
    "2026-10-03T24:00:00Z",
    "2026-10-03 12:00:00Z",
  ])("accepts the same instants as the settlement time (%s)", (value) => {
    expect(acceptsStrict(UtcInstantSchema, value)).toBe(
      acceptsStrict(CanonicalSettlementTimeSchema, value),
    );
  });

  it("normalizes only trailing fraction zeros", () => {
    expect(normalizedUtc("2026-10-03T12:01:00Z")).toBe(normalizedUtc("2026-10-03T12:01:00.000Z"));
    expect(normalizedUtc("2026-10-03T12:01:00.0001Z")).not.toBe(
      normalizedUtc("2026-10-03T12:01:00.0002Z"),
    );
  });
});
