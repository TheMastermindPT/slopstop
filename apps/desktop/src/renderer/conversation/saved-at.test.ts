import { describe, expect, it } from "vitest";
import { savedAtLabel } from "./saved-at.js";

describe("savedAtLabel", () => {
  it.each([
    ["2026-10-10T12:00:00Z", "2026-10-10T13:02:00Z", "Europe/Lisbon", "14:02"],
    ["2026-10-10T12:00:00Z", "2026-10-09T23:30:00Z", "Europe/Lisbon", "00:30"],
    ["2026-10-10T12:00:00Z", "2026-10-09T13:02:00Z", "Europe/Lisbon", "9 Oct, 14:02"],
    // Same day of the month, another month: still an earlier date (round 1 T9). CLDR's en-GB
    // short form of September is "Sept".
    ["2026-10-10T12:00:00Z", "2026-09-10T13:02:00Z", "Europe/Lisbon", "10 Sept, 14:02"],
    ["2026-10-10T12:00:00Z", "2025-12-31T23:30:00Z", "Europe/Lisbon", "31 Dec 2025, 23:30"],
    ["2027-01-01T00:10:00Z", "2026-12-31T23:59:00Z", "Europe/Lisbon", "31 Dec 2026, 23:59"],
    ["2026-12-31T15:30:00Z", "2026-12-31T14:30:00Z", "Asia/Tokyo", "31 Dec 2026, 23:30"],
  ])("at %s, a message saved at %s in %s reads %s", (now, savedAt, timeZone, label) => {
    expect(savedAtLabel(savedAt, new Date(now), timeZone)).toBe(label);
  });
});
