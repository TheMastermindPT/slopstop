import { expect, it } from "vitest";
import * as identifiers from "./project-storage-identifiers.js";

it("accepts only safe canonical ordering values", () => {
  for (const name of ["isWriterGeneration", "isProjectSequence", "isCanonicalEventOrdinal"]) {
    const guard: unknown = Reflect.get(identifiers, name);
    expect(typeof guard, name).toBe("function");
    if (typeof guard !== "function") throw new Error(`Missing canonical ordering guard: ${name}`);

    const ordinal = name === "isCanonicalEventOrdinal";
    for (const value of [1, 9007199254740991]) expect(guard(value)).toBe(true);
    expect(guard(0)).toBe(ordinal);
    for (const value of [-1, 0.5, NaN, Infinity, 9007199254740992]) {
      expect(guard(value)).toBe(false);
    }
  }
});
