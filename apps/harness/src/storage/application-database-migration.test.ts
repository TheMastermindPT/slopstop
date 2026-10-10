import { describe, expect, it } from "vitest";
import { orderUpgradeChain, receiptGenerationResolves } from "./application-database-migration.js";

const link = (source: string, target: string, sourceCreateRequestId: string) => ({
  sourceGenerationId: source,
  targetGenerationId: target,
  sourceCreateRequestId,
});

/** A chain of two from generation g1 (created by request r1) to the active generation g3. */
const chain =
  orderUpgradeChain({
    links: [link("g2", "g3", "u1"), link("g1", "g2", "r1")],
    activeGenerationId: "g3",
    presentGenerationIds: new Set(["g3"]),
  }) ?? [];

describe("receiptGenerationResolves", () => {
  it("resolves the chain root's source created by the receipt's request", () => {
    expect(chain.map((entry) => entry.sourceGenerationId)).toEqual(["g1", "g2"]);
    expect(receiptGenerationResolves(chain, { generationId: "g1", createRequestId: "r1" })).toBe(
      true,
    );
  });

  it.each([
    { name: "a different create request", receipt: { generationId: "g1", createRequestId: "r2" } },
    {
      name: "a generation that is not the root's source",
      receipt: { generationId: "g2", createRequestId: "r1" },
    },
    { name: "the active generation", receipt: { generationId: "g3", createRequestId: "r1" } },
  ])("refuses $name", ({ receipt }) => {
    expect(receiptGenerationResolves(chain, receipt)).toBe(false);
  });

  it("refuses every receipt when the Storage has no upgrade chain", () => {
    expect(receiptGenerationResolves([], { generationId: "g1", createRequestId: "r1" })).toBe(
      false,
    );
  });
});

describe("orderUpgradeChain", () => {
  it("refuses two links into one generation, which would otherwise walk a cycle forever", () => {
    expect(
      orderUpgradeChain({
        links: [
          link("g1", "g2", "r1"),
          link("g2", "g3", "u1"),
          link("x", "g3", "u2"),
          link("g3", "x", "u3"),
        ],
        activeGenerationId: "g3",
        presentGenerationIds: new Set(["g3"]),
      }),
    ).toBeUndefined();
  });
});
