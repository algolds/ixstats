/** @jest-environment node */
/**
 * Research §7.5 steps 3–6 and the combat exploit checklist: seeded resolution replays exactly and never rerolls,
 * losses follow Dupuy's verities, surprise needs an unready defender and a quiet attacker, the theatre falls back to
 * the declared profile, intelligence ranges hold the true value, and the preview reads the estimate.
 */
import {
  DAY_MS,
  mobilisedCount,
} from "~/lib/military/model";
import {
  GENERIC_GROUND_EQUIPMENT_RATIO,
  attackerSignalsIntent,
  effectivePower,
  intelSigma,
  mapTerrain,
  oddsView,
  parseDeclaredTerrain,
  previewCampaign,
  resolveEngagement,
  resolveTheatre,
  sizeFactor,
  strengthRange,
  successProbability,
  surpriseLevel,
  surpriseOverDays,
  type MapTheatreFacts,
} from "~/lib/military/combat";
import { landSetup } from "./fixtures";

const SEED = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

describe("seeded resolution", () => {
  it("replays exactly from the stored seed and inputs", () => {
    const setup = landSetup(2, { days: 14, mode: "pvp" });
    const first = resolveEngagement(setup, SEED);
    const replay = resolveEngagement(JSON.parse(JSON.stringify(setup)), SEED);
    expect(replay).toEqual(first);
  });

  it("a different seed gives a different roll (the seed, not the caller, decides)", () => {
    const setup = landSetup(2);
    expect(resolveEngagement(setup, SEED).u).not.toBe(resolveEngagement(setup, `${SEED.slice(1)}0`).u);
  });

  it("winners lose less and the margin sets the band", () => {
    const strong = resolveEngagement(landSetup(6, { days: 10, mode: "pvp" }), SEED);
    const weak = resolveEngagement(landSetup(1 / 6, { days: 10, mode: "pvp" }), SEED);
    expect(strong.margin).toBeGreaterThan(weak.margin);
    expect(strong.attacker.casualties / strong.attacker.engaged).toBeLessThan(
      weak.attacker.casualties / weak.attacker.engaged
    );
  });

  it("ground equipment goes at the armor-weighted ratio and killed are a quarter of casualties", () => {
    const result = resolveEngagement(landSetup(1, { days: 5 }), SEED);
    const land = result.attacker.branches[0]!;
    expect(land.capitalShare).toBeCloseTo(land.lossRate * GENERIC_GROUND_EQUIPMENT_RATIO, 9);
    expect(result.attacker.deaths).toBeCloseTo(result.attacker.casualties * 0.25, 9);
  });

  it("smaller forces take higher daily rates (QJM size bands)", () => {
    expect(sizeFactor(4_000)).toBe(2);
    expect(sizeFactor(15_000)).toBe(1);
    expect(sizeFactor(200_000)).toBe(0.6);
  });

  it("ends by the planned days at the latest, and on the objective day for a breakthrough", () => {
    const result = resolveEngagement(landSetup(20, { days: 10 }), SEED);
    expect(result.days).toBeLessThanOrEqual(10);
    if (result.band === "breakthrough") expect(result.days).toBeLessThanOrEqual(5);
  });
});

describe("surprise (exploit: alert flipping)", () => {
  it("is only possible against a defender whose alert in effect is below Elevated", () => {
    expect(surpriseLevel({ mode: "strike", defenderAlert: "peacetime", attackerSignals: false })).toBe(
      "substantial"
    );
    expect(surpriseLevel({ mode: "strike", defenderAlert: "elevated", attackerSignals: false })).toBe("none");
  });

  it("an attacker that signals loses a step, and lowering its alert just before still signals", () => {
    expect(surpriseLevel({ mode: "strike", defenderAlert: "peacetime", attackerSignals: true })).toBe("minor");
    const now = 100 * DAY_MS;
    const flipped = {
      alertLevel: "peacetime" as const,
      previousAlertLevel: "war" as const,
      alertChangedClockMs: now - DAY_MS,
      mobilisationOrdered: false,
      nowClockMs: now,
    };
    expect(attackerSignalsIntent(flipped)).toBe(true);
    expect(attackerSignalsIntent({ ...flipped, alertChangedClockMs: now - 40 * DAY_MS })).toBe(false);
    expect(attackerSignalsIntent({ ...flipped, previousAlertLevel: "peacetime", mobilisationOrdered: true })).toBe(
      true
    );
  });

  it("decays by a third a day over three days", () => {
    expect(surpriseOverDays("complete", 1)).toBeCloseTo(2.2, 9);
    expect(surpriseOverDays("complete", 3)).toBeCloseTo(1 + 1.2 * 2 / 3, 9);
    expect(surpriseOverDays("complete", 30)).toBeCloseTo(1 + 1.2 * 2 / 30, 9);
  });
});

describe("mobilise, strike, demobilise (exploit)", () => {
  it("reservists called up the day before a strike have barely reported", () => {
    const reported = mobilisedCount({
      order: 100_000,
      orderedClockMs: 0,
      nowClockMs: DAY_MS,
      doctrine: "balanced",
    });
    expect(reported).toBeLessThan(10_000);
  });
});

describe("theatre", () => {
  const facts = (overrides: Partial<MapTheatreFacts> = {}): MapTheatreFacts => ({
    neighbours: true,
    borderKm: 1_000,
    distanceKm: 0,
    elevationAreas: [100, 0, 0, 0, 0, 0, 0, 0, 0],
    climateAreas: {},
    riverKm: 0,
    populationDensity: 0,
    ...overrides,
  });

  it("reads terrain from the sector's elevation zones, climate cover and a river line", () => {
    expect(mapTerrain(facts())!.terrain).toBeCloseTo(1, 9);
    expect(mapTerrain(facts({ elevationAreas: [0, 0, 0, 0, 100] }))!.terrain).toBeCloseTo(1.6, 9);
    expect(mapTerrain(facts({ climateAreas: { Ar: 100 } }))!.terrain).toBeCloseTo(1.2, 9);
    expect(mapTerrain(facts({ riverKm: 300 }))!.riverLine).toBe(false); // rivers crossing, not along
    const river = mapTerrain(facts({ riverKm: 600 }))!;
    expect(river).toEqual({ terrain: 1.2, riverLine: true });
  });

  it("falls back to the defender's declared profile, then the typical mix, when the map has no data", () => {
    const empty = facts({ elevationAreas: [] });
    const declared = resolveTheatre({ map: empty, declared: parseDeclaredTerrain("mountain+river") });
    expect(declared).toMatchObject({ source: "declared", terrain: 1.8, terrainClass: "mountain", neighbours: true });
    expect(resolveTheatre({ map: null, declared: null })).toMatchObject({
      source: "default",
      terrain: 1.3,
      neighbours: false,
      campaign: "overseas",
    });
    expect(resolveTheatre({ map: facts(), declared: parseDeclaredTerrain("mountain") }).source).toBe("map");
  });

  it("front width is the shared border for neighbours", () => {
    expect(resolveTheatre({ map: facts({ borderKm: 2_400 }), declared: null }).frontKm).toBe(2_400);
  });
});

describe("intelligence", () => {
  it("the shown strength range always holds the true value, off-centre", () => {
    for (const u of [0, 0.2, 0.5, 0.77, 0.999]) {
      for (const sigma of [0.05, 0.3, 0.6]) {
        const range = strengthRange(1_000, sigma, u);
        expect(range.low).toBeLessThan(1_000);
        expect(range.high).toBeGreaterThan(1_000);
      }
    }
  });

  it("narrows with R&D, relations and recon", () => {
    const blind = intelSigma({ rdStock: 0, gdp: 1e12, relationStrength: null, recon: false });
    const sharp = intelSigma({ rdStock: 1e12, gdp: 1e12, relationStrength: 100, recon: true });
    expect(blind).toBeCloseTo(0.6, 9);
    expect(sharp).toBeCloseTo(0.6 * 0.6 * 0.7 * 0.5, 9);
  });

  it("the odds range holds the true odds when supply and fortification are as assumed", () => {
    const setup = landSetup(2);
    const truth = successProbability(effectivePower(setup).effectiveRatio);
    for (const u of [0.01, 0.5, 0.99]) {
      const view = oddsView(setup, 0.4, u);
      expect(view.success.low).toBeLessThanOrEqual(truth);
      expect(view.success.high).toBeGreaterThanOrEqual(truth);
    }
  });

  it("the client view carries no true defender strength", () => {
    const setup = landSetup(2);
    const view = oddsView(setup, 0.4, 0.9);
    expect(view.defenderStrength.estimate).not.toBeCloseTo(100_000, 0);
    expect(JSON.stringify(view)).not.toContain("100000");
  });
});

describe("campaign preview", () => {
  it("runs 1,000 seeded simulations reproducibly, with ordered percentiles", () => {
    const input = { setup: landSetup(2, { days: 10, mode: "pvp" as const }), sigma: 0.3, u: 0.4, seedHex: SEED };
    const preview = previewCampaign(input);
    expect(preview.runs).toBe(1_000);
    expect(previewCampaign(input)).toEqual(preview);
    expect(preview.attackerCasualties.p10).toBeLessThanOrEqual(preview.attackerCasualties.p50);
    expect(preview.attackerCasualties.p50).toBeLessThanOrEqual(preview.attackerCasualties.p90);
    expect(preview.objective).toBeGreaterThan(0.4);
    expect(preview.objective).toBeLessThan(0.95);
  });
});
