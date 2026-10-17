/** @jest-environment node */
/** The one rarity engine (cards refresh spec §2.1): one score, a threshold table per source wiki. */
import {
  DEFAULT_RARITY_THRESHOLDS,
  RarityThresholdsSchema,
  qualityScore,
  rarityForScore,
  type ArticleSignals,
} from "~/lib/cards/rarity-engine";

const none: ArticleSignals = {
  length: 0,
  referenceCount: 0,
  inboundLinks: 0,
  categoryCount: 0,
  hasInfobox: false,
  isFeatured: false,
};

describe("qualityScore", () => {
  it("is zero for an empty page", () => {
    expect(qualityScore(none)).toBe(0);
  });

  it("adds length, references, links, infobox and categories", () => {
    // 50,000 chars → 15, 4 refs → 6, 10 links → 4, infobox → 5, 4 categories → 2
    const score = qualityScore({
      ...none,
      length: 50_000,
      referenceCount: 4,
      inboundLinks: 10,
      categoryCount: 4,
      hasInfobox: true,
    });
    expect(score).toBeCloseTo(32);
  });

  it.each<[string, Partial<ArticleSignals>, number]>([
    ["length", { length: 1e6 }, 30],
    ["references", { referenceCount: 100 }, 30],
    ["inbound links", { inboundLinks: 500 }, 20],
    ["categories", { categoryCount: 50 }, 5],
    ["featured", { isFeatured: true }, 20],
  ])("gives %s at most its share", (_signal, signals, share) => {
    expect(qualityScore({ ...none, ...signals })).toBe(share);
  });

  it("is capped at 100", () => {
    expect(
      qualityScore({
        length: 1e6,
        referenceCount: 100,
        inboundLinks: 500,
        categoryCount: 50,
        hasInfobox: true,
        isFeatured: true,
      })
    ).toBe(100);
  });
});

describe("rarityForScore", () => {
  const table = DEFAULT_RARITY_THRESHOLDS.ixwiki;

  it.each([
    [0, "COMMON"],
    [20.9, "COMMON"],
    [21, "UNCOMMON"],
    [41, "RARE"],
    [60.99, "RARE"],
    [61, "ULTRA_RARE"],
    [81, "EPIC"],
    [95.9, "EPIC"],
    [96, "LEGENDARY"],
    [100, "LEGENDARY"],
  ])("score %p is %s (each minimum is inclusive)", (score, rarity) => {
    expect(rarityForScore(score, table)).toBe(rarity);
  });

  it("reads each source's own table", () => {
    const strict = { UNCOMMON: 50, RARE: 60, ULTRA_RARE: 70, EPIC: 80, LEGENDARY: 90 };
    expect(rarityForScore(41, strict)).toBe("COMMON");
  });
});

describe("threshold tables", () => {
  it("starts every source from the IxWiki calibration", () => {
    for (const table of Object.values(DEFAULT_RARITY_THRESHOLDS)) {
      expect(table).toEqual({ UNCOMMON: 21, RARE: 41, ULTRA_RARE: 61, EPIC: 81, LEGENDARY: 96 });
    }
  });

  it("needs rising minimums between 0 and 100", () => {
    const table = DEFAULT_RARITY_THRESHOLDS.ixwiki;
    expect(RarityThresholdsSchema.safeParse(table).success).toBe(true);
    expect(RarityThresholdsSchema.safeParse({ ...table, RARE: 21 }).success).toBe(false);
    expect(RarityThresholdsSchema.safeParse({ ...table, LEGENDARY: 101 }).success).toBe(false);
    expect(RarityThresholdsSchema.safeParse({ ...table, UNCOMMON: -1 }).success).toBe(false);
  });

  it("refuses in sentences the Economy tab can show as they are", () => {
    const table = DEFAULT_RARITY_THRESHOLDS.ixwiki;
    const firstIssue = (value: object) =>
      RarityThresholdsSchema.safeParse(value).error?.issues[0]?.message;
    const range = "Each minimum score must be a number from 0 to 100";
    expect(firstIssue({ ...table, LEGENDARY: 101 })).toBe(range);
    expect(firstIssue({ ...table, UNCOMMON: -1 })).toBe(range);
    expect(firstIssue({ ...table, RARE: Number.NaN })).toBe(range);
    expect(firstIssue({ ...table, RARE: 21 })).toBe(
      "Each rarity needs a higher minimum score than the one below it"
    );
  });
});
