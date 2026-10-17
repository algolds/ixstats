/** @jest-environment node */
/**
 * The contract curation's filter review and the Library's bulk hide share: a change acts on exactly the cards the
 * admin's read counted, as of a read that has happened, and at most MAX_FILTER_REVIEW of them.
 */
import { cardCount, MAX_FILTER_REVIEW } from "~/lib/cards/curation-limits";
import { assertBulkRead, assertBulkRecountTx } from "~/server/modules/cards/cards.bulk";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const words = { list: "The Library's", verb: "Hide or unhide" };

describe("assertBulkRead", () => {
  it("takes a read that has happened, up to the cap", () => {
    expect(() =>
      assertBulkRead({ asOf: new Date(), expected: MAX_FILTER_REVIEW }, words)
    ).not.toThrow();
  });

  it("refuses a read dated after now", () => {
    expect(() =>
      assertBulkRead({ asOf: new Date(Date.now() + 60_000), expected: 1 }, words)
    ).toThrow(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message: "The Library's read time is in the future. Reload and try again.",
      })
    );
  });

  it("refuses a count above the cap", () => {
    expect(() =>
      assertBulkRead({ asOf: new Date(), expected: MAX_FILTER_REVIEW + 1 }, words)
    ).toThrow(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message: "Hide or unhide at most 2,000 cards at once. Narrow the filter.",
      })
    );
  });
});

describe("assertBulkRecountTx", () => {
  const where = { reviewState: "PENDING" } as const;

  it("passes when the cards matching now are as many as the read counted", async () => {
    const tx = createMockPrisma();
    tx.card.count.mockResolvedValue(7);
    await expect(
      assertBulkRecountTx(tx as never, where, 7, () => "changed")
    ).resolves.toBeUndefined();
    expect(tx.card.count).toHaveBeenCalledWith({ where });
  });

  it("refuses with the caller's message for the count it found", async () => {
    const tx = createMockPrisma();
    tx.card.count.mockResolvedValue(9);
    await expect(
      assertBulkRecountTx(tx as never, where, 7, (matching) => `${matching} match now`)
    ).rejects.toMatchObject({ code: "CONFLICT", message: "9 match now" });
  });
});

describe("cardCount", () => {
  it("counts cards as the bulk changes word them", () => {
    expect(cardCount(1)).toBe("1 card");
    expect(cardCount(0)).toBe("0 cards");
    expect(cardCount(2000)).toBe("2,000 cards");
  });
});
