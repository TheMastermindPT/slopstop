/** The calendar day of an instant in a time zone, as numbers. */
function localDay(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return { year: part("year"), month: part("month"), day: part("day") };
}

const dayKey = (day: ReturnType<typeof localDay>) => `${day.year}-${day.month}-${day.day}`;

/**
 * A message's saved time in 24-hour en-GB form, in the given time zone: "14:02" today,
 * "9 Oct, 14:02" earlier this year, "9 Oct 2025, 14:02" in another year. Today and the year are
 * the local ones, never UTC's.
 */
export function savedAtLabel(savedAt: string, now: Date, timeZone: string): string {
  const saved = new Date(savedAt);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(saved);
  const savedDay = localDay(saved, timeZone);
  const today = localDay(now, timeZone);
  if (dayKey(savedDay) === dayKey(today)) return time;
  const sameYear = savedDay.year === today.year;
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(saved);
  return `${date}, ${time}`;
}
