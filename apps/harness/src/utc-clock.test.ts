import { decodeStrict, UtcInstantSchema } from "@slopstop/protocol";
import { describe, expect, it } from "vitest";
import { systemUtcClock } from "./utc-clock.js";

describe("UTC clock", () => {
  it("answers the current time as a UTC instant", () => {
    const before = Date.now();
    const now = systemUtcClock.now();
    const after = Date.now();
    expect(decodeStrict(UtcInstantSchema, now)).toBe(now);
    expect(Date.parse(now)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(now)).toBeLessThanOrEqual(after);
  });
});
