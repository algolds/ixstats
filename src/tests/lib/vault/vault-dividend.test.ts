/** @jest-environment node */
import type { Prisma } from "@prisma/client";
import { describe, it, expect } from "@jest/globals";
import {
  DIVIDEND,
  computeDividend,
  dividendKey,
  parseDividendMetadata,
  type DividendInputs,
  type DividendLine,
} from "~/lib/vault/vault-dividend";

const ZERO: DividendInputs = {
  deckValue: 0,
  wikiScore: 0,
  posts: 0,
  packsOpened: 0,
  tradesCompleted: 0,
  listingsSold: 0,
  streakDays: 0,
  yieldBoost: 0,
};

const amountOf = (lines: DividendLine[], key: DividendLine["key"]) =>
  lines.find((l) => l.key === key)?.amount;

describe("computeDividend", () => {
  it("pays nothing and lists no line for an empty day", () => {
    expect(computeDividend(ZERO)).toEqual({ total: 0, lines: [] });
  });

  it("pays an interest-only user 0.25% of the deck", () => {
    const r = computeDividend({ ...ZERO, deckValue: 2000 });
    expect(r.total).toBe(5);
    expect(r.lines.map((l) => l.key)).toEqual(["interest"]);
    expect(r.lines[0]?.detail).toEqual({ deckValue: 2000, rate: DIVIDEND.INTEREST_RATE });
  });

  it("caps interest at 25 and rounds below it", () => {
    expect(computeDividend({ ...ZERO, deckValue: 1_000_000 }).total).toBe(DIVIDEND.INTEREST_CAP);
    expect(computeDividend({ ...ZERO, deckValue: 1000 }).total).toBe(3); // 2.5 rounds up
    expect(computeDividend({ ...ZERO, deckValue: 100 }).lines).toEqual([]); // 0.25 rounds to 0
  });

  it("pays wiki at one credit per 80 points, floored, capped at 30", () => {
    expect(amountOf(computeDividend({ ...ZERO, wikiScore: 239 }).lines, "wiki")).toBe(2);
    expect(amountOf(computeDividend({ ...ZERO, wikiScore: 79 }).lines, "wiki")).toBeUndefined();
    expect(amountOf(computeDividend({ ...ZERO, wikiScore: 100_000 }).lines, "wiki")).toBe(
      DIVIDEND.WIKI_CAP
    );
  });

  it("pays posts at 2 each, capped at 20", () => {
    expect(amountOf(computeDividend({ ...ZERO, posts: 4 }).lines, "posts")).toBe(8);
    expect(amountOf(computeDividend({ ...ZERO, posts: 99 }).lines, "posts")).toBe(
      DIVIDEND.POST_CAP
    );
  });

  it("pays cards at 2 per pack, 5 per trade and 3 per sale, capped at 20", () => {
    const r = computeDividend({ ...ZERO, packsOpened: 1, tradesCompleted: 1, listingsSold: 1 });
    expect(amountOf(r.lines, "cards")).toBe(10);
    expect(r.lines.find((l) => l.key === "cards")?.detail).toEqual({
      packs: 1,
      trades: 1,
      sold: 1,
    });
    expect(amountOf(computeDividend({ ...ZERO, packsOpened: 50 }).lines, "cards")).toBe(
      DIVIDEND.CARDS_CAP
    );
  });

  it.each([
    [0, 0],
    [5, 8], // activity 30: 30 x 0.05 x 5 = 7.5 -> 8
    [10, 15],
    [30, 15], // capped at 10 days
  ])("streak of %i days adds %i on 30 activity credits", (streakDays, expected) => {
    // 30 activity credits: posts 10 -> 20, trades 2 -> 10 (cards)
    const r = computeDividend({ ...ZERO, posts: 10, tradesCompleted: 2, streakDays });
    expect(amountOf(r.lines, "streak") ?? 0).toBe(expected);
    expect(r.total).toBe(30 + expected);
  });

  it("gives interest no streak: the multiplier applies to activity only", () => {
    const r = computeDividend({ ...ZERO, deckValue: 4000, streakDays: 10 });
    expect(r.total).toBe(10);
    expect(r.lines.map((l) => l.key)).toEqual(["interest"]);
  });

  it("boosts the subtotal by the owned upgrades", () => {
    // interest 10 + posts 20 = 30; boost 0.1 -> 3
    const r = computeDividend({ ...ZERO, deckValue: 4000, posts: 10, yieldBoost: 0.1 });
    expect(amountOf(r.lines, "boost")).toBe(3);
    expect(r.total).toBe(33);
    expect(r.lines.find((l) => l.key === "boost")?.detail).toEqual({
      subtotal: 30,
      yieldBoost: 0.1,
    });
  });

  it("caps the total at 150 after the boost", () => {
    const r = computeDividend({
      deckValue: 1_000_000,
      wikiScore: 100_000,
      posts: 99,
      packsOpened: 50,
      tradesCompleted: 9,
      listingsSold: 9,
      streakDays: 30,
      yieldBoost: 0.5,
    });
    // 25 interest + 70 activity + streak round(70 x 0.5) = 35 -> 130; boost 65 -> 195
    expect(r.total).toBe(DIVIDEND.TOTAL_CAP);
    expect(r.lines.reduce((sum, l) => sum + l.amount, 0)).toBeGreaterThan(DIVIDEND.TOTAL_CAP);
  });

  it("omits zero-amount lines", () => {
    const r = computeDividend({ ...ZERO, posts: 1 });
    expect(r.lines.map((l) => l.key)).toEqual(["posts"]);
  });

  it("has no set-completion part", () => {
    expect(DIVIDEND).not.toHaveProperty("SET_BONUS");
    expect(DIVIDEND).not.toHaveProperty("SET_CAP");
  });
});

describe("dividendKey", () => {
  it("keys one payout per user per day", () => {
    expect(dividendKey("u1", "2026-10-20")).toBe("dividend:u1:2026-10-20");
  });
});

describe("parseDividendMetadata", () => {
  const inputs: DividendInputs = { ...ZERO, deckValue: 2000, posts: 2, streakDays: 3 };
  const result = computeDividend(inputs);
  const meta = { day: "2026-10-20", lines: result.lines, inputs };

  it("round-trips an object", () => {
    // `meta` is plain JSON, but its interface types carry no index signature, so it is not a Prisma.JsonObject
    expect(parseDividendMetadata(meta as unknown as Prisma.JsonObject)).toEqual(meta);
  });

  it("reads the JSON string the ledger stores", () => {
    expect(parseDividendMetadata(JSON.stringify(meta))).toEqual(meta);
  });

  it("returns null for anything else", () => {
    expect(parseDividendMetadata(null)).toBeNull();
    expect(parseDividendMetadata("not json")).toBeNull();
    expect(parseDividendMetadata({ day: "2026-10-20" })).toBeNull();
    expect(parseDividendMetadata(JSON.stringify({ ...meta, lines: [{ key: "sets" }] }))).toBeNull();
  });
});
