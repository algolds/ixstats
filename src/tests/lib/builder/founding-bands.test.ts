/**
 * Founding size and wealth bands: every figure falls in its own band, the helpers agree at the
 * boundaries, and the copy follows the house rules (sentence case, no em dashes).
 */
import {
  POPULATION_BANDS,
  WEALTH_BANDS,
  bandForGdpPerCapita,
  bandForPopulation,
  figureForPopulationBand,
  figureForWealthBand,
} from "~/lib/builder/founding-bands";

describe("founding bands", () => {
  it("has four population bands and four wealth bands", () => {
    expect(POPULATION_BANDS.map((b) => b.id)).toEqual(["small", "medium", "large", "very-large"]);
    expect(WEALTH_BANDS.map((b) => b.id)).toEqual([
      "developing",
      "emerging",
      "wealthy",
      "very-wealthy",
    ]);
  });

  it.each(POPULATION_BANDS.map((b) => [b.id, b] as const))(
    "population band %s contains its representative figure",
    (id, band) => {
      expect(figureForPopulationBand(id)).toBe(band.figure);
      expect(bandForPopulation(band.figure)).toBe(id);
      expect(band.figure).toBeGreaterThanOrEqual(band.range.min);
      if (band.range.max !== null) expect(band.figure).toBeLessThan(band.range.max);
    }
  );

  it.each(WEALTH_BANDS.map((b) => [b.id, b] as const))(
    "wealth band %s contains its representative figure",
    (id, band) => {
      expect(figureForWealthBand(id)).toBe(band.figure);
      expect(bandForGdpPerCapita(band.figure)).toBe(id);
      expect(band.figure).toBeGreaterThanOrEqual(band.range.min);
      if (band.range.max !== null) expect(band.figure).toBeLessThan(band.range.max);
    }
  );

  it("splits population at 5, 50 and 200 million", () => {
    expect(bandForPopulation(4_999_999)).toBe("small");
    expect(bandForPopulation(5_000_000)).toBe("medium");
    expect(bandForPopulation(49_999_999)).toBe("medium");
    expect(bandForPopulation(50_000_000)).toBe("large");
    expect(bandForPopulation(200_000_000)).toBe("very-large");
    expect(bandForPopulation(2_000_000_000)).toBe("very-large");
  });

  it("handles zero, negative and non-finite input", () => {
    expect(bandForPopulation(0)).toBe("small");
    expect(bandForPopulation(-1)).toBe("small");
    expect(bandForPopulation(Number.NaN)).toBe("small");
    expect(bandForGdpPerCapita(Number.NaN)).toBe("developing");
    expect(bandForGdpPerCapita(Number.POSITIVE_INFINITY)).toBe("very-wealthy");
  });

  it("bands are contiguous", () => {
    for (const bands of [POPULATION_BANDS, WEALTH_BANDS]) {
      bands.slice(1).forEach((band, i) => expect(band.range.min).toBe(bands[i]!.range.max));
      expect(bands[bands.length - 1]!.range.max).toBeNull();
    }
  });

  it("copy is sentence case with no em dashes", () => {
    for (const band of [...POPULATION_BANDS, ...WEALTH_BANDS]) {
      for (const text of [band.label, band.hint]) {
        expect(text).not.toMatch(/—/);
        expect(text.charAt(0)).toBe(text.charAt(0).toUpperCase());
        expect(text.slice(1)).toBe(text.slice(1).toLowerCase());
      }
    }
    expect(WEALTH_BANDS.find((b) => b.id === "wealthy")!.hint).toBe("Most people own a car");
  });
});
