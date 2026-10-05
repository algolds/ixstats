/**
 * Economy guard: buy -> open -> junk must never mint credits.
 * Computes the expected junk value of every seeded pack from its odds and price, at the
 * default junk rate and at the admin ceiling, so a future re-price or odds change that
 * reopens the arbitrage fails here.
 */
import packs from "../../../prisma/seeds/data/card-packs.json";
import {
  CARD_VALUATION_DEFAULTS,
  JUNK_RATE_MAX,
  expectedPackJunkValue,
} from "~/lib/cards/valuation";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { PackType } from "~/lib/cards/enums";

type SeedPack = (typeof packs)[number];
const cases = packs.map((p: SeedPack) => [p.id, p] as const);

describe("pack junk expected value", () => {
  it("covers all 20 seeded packs", () => {
    expect(packs).toHaveLength(20);
  });

  it("seeds only valid PackType values", () => {
    const valid: readonly string[] = Object.values(PackType);
    expect(packs.filter((p: SeedPack) => !valid.includes(p.packType))).toEqual([]);
  });

  it.each(cases)("%s: junk EV is clearly below the price at the default rate", (_id, pack) => {
    const ev = expectedPackJunkValue(pack, CARD_VALUATION_DEFAULTS);
    expect(ev).toBeLessThan(pack.priceCredits * 0.5);
  });

  it.each(cases)("%s: junk EV stays below the price even at the admin ceiling", (_id, pack) => {
    const cfg = { ...CARD_VALUATION_DEFAULTS, junkRate: JUNK_RATE_MAX };
    const ev = expectedPackJunkValue(pack, cfg);
    expect(ev).toBeLessThan(pack.priceCredits * 0.85);
  });

  it("would have flagged the old junkRate of 1.0 on the entry packs", () => {
    const cfg = { ...CARD_VALUATION_DEFAULTS, junkRate: 1.0 };
    const s1 = packs.find((p: SeedPack) => p.id === "pack_s1_recruit")!;
    expect(expectedPackJunkValue(s1, cfg)).toBeGreaterThan(s1.priceCredits);
  });

  it("clamps a stored junkRate above the ceiling", async () => {
    const db = createMockPrisma();
    db.systemConfig.findMany.mockResolvedValue([{ key: "card_valuation_junk_rate", value: "1.0" }]);
    // Load a fresh copy so the module's 60s config cache is empty
    jest.resetModules();
    const fresh = await import("~/lib/cards/valuation");
    const cfg = await fresh.getValuationConfig(db as never);
    expect(cfg.junkRate).toBe(JUNK_RATE_MAX);
  });
});
