import { describe, expect, it } from "vitest";
import { type RenameIo, renameWhenReleased } from "./rename-when-released.js";

function codedError(code: string, attempt: number): Error {
  return Object.assign(new Error(`${code} on attempt ${attempt}.`), { code });
}

/** A fake rename that answers `failure(attempt)` for each call, recording renames and delays. */
function fakeIo(failure: (attempt: number) => Error | undefined) {
  const renames: string[] = [];
  const delays: number[] = [];
  const io: RenameIo = {
    rename: async (from, to) => {
      renames.push(`${from} -> ${to}`);
      const error = failure(renames.length);
      if (error !== undefined) throw error;
    },
    delay: async (ms) => {
      delays.push(ms);
    },
  };
  return { io, renames, delays };
}

describe("renameWhenReleased", () => {
  it.each(["EPERM", "EACCES", "EBUSY"])(
    "renames once Windows releases the files after two %s failures",
    async (code) => {
      const fake = fakeIo((attempt) => (attempt <= 2 ? codedError(code, attempt) : undefined));

      await expect(renameWhenReleased("from", "to", fake.io)).resolves.toBeUndefined();

      expect(fake.renames).toEqual(["from -> to", "from -> to", "from -> to"]);
      expect(fake.delays).toEqual([50, 50]);
    },
  );

  it("rethrows the last EPERM after 10 attempts", async () => {
    const errors = Array.from({ length: 10 }, (_, index) => codedError("EPERM", index + 1));
    // Past the bound, a distinct non-transient failure exposes a loop that never stops.
    const fake = fakeIo((attempt) => errors[attempt - 1] ?? codedError("ENOTSUP", attempt));

    await expect(renameWhenReleased("from", "to", fake.io)).rejects.toBe(errors[9]);

    expect(fake.renames).toHaveLength(10);
    expect(fake.delays).toEqual(Array.from({ length: 9 }, () => 50));
  });

  it("rethrows any other failure at once", async () => {
    const missing = codedError("ENOENT", 1);
    const fake = fakeIo(() => missing);

    await expect(renameWhenReleased("from", "to", fake.io)).rejects.toBe(missing);

    expect(fake.renames).toHaveLength(1);
    expect(fake.delays).toEqual([]);
  });
});
