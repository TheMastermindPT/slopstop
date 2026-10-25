import { decodeStrict, UtcInstantSchema } from "@slopstop/protocol";

/** A source of the current time as a UTC instant. */
export type UtcClock = Readonly<{ now(): string }>;

/** The harness's only wall-clock read. */
export const systemUtcClock: UtcClock = {
  now: () => decodeStrict(UtcInstantSchema, new Date().toISOString()),
};
