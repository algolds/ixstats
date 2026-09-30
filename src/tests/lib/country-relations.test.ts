import {
  economicRelationsOf,
  finiteOrNull,
  savedTariffRate,
} from "~/lib/economy/country-relations";

describe("economicRelationsOf", () => {
  it("returns the relation rows present on the country record", () => {
    const relations = economicRelationsOf({
      economicProfile: { economicComplexity: 61 },
      laborMarket: null,
      incomeDistribution: { top10PercentWealth: 38 },
    });
    expect(relations.economicProfile?.economicComplexity).toBe(61);
    expect(relations.laborMarket).toBeNull();
    expect(relations.fiscalSystem).toBeNull();
    expect(relations.incomeDistribution?.top10PercentWealth).toBe(38);
  });

  it("returns empty relations when there is no country", () => {
    expect(economicRelationsOf(undefined)).toEqual({
      economicProfile: null,
      laborMarket: null,
      fiscalSystem: null,
      incomeDistribution: null,
    });
  });
});

describe("finiteOrNull", () => {
  it("keeps zero and rejects missing or non-finite values", () => {
    expect(finiteOrNull(0)).toBe(0);
    expect(finiteOrNull(4.5)).toBe(4.5);
    expect(finiteOrNull(null)).toBeNull();
    expect(finiteOrNull(undefined)).toBeNull();
    expect(finiteOrNull(Number.NaN)).toBeNull();
    expect(finiteOrNull("12")).toBeNull();
  });
});

describe("savedTariffRate", () => {
  it("reads the tariff rate the Fiscal Policy tab saves", () => {
    expect(savedTariffRate('{"tariffRate":6.5,"capitalGainsRate":15}')).toBe(6.5);
    expect(savedTariffRate('{"tariffRate":0}')).toBe(0);
    expect(savedTariffRate('[{"type":"alcohol","rate":20},{"type":"tariff","rate":3.5}]')).toBe(
      3.5
    );
  });

  it("returns null when no tariff rate is saved", () => {
    expect(savedTariffRate(null)).toBeNull();
    expect(savedTariffRate("")).toBeNull();
    expect(savedTariffRate('{"capitalGainsRate":15}')).toBeNull();
    expect(savedTariffRate("not json")).toBeNull();
    expect(savedTariffRate('[{"type":"alcohol","rate":20}]')).toBeNull();
  });
});
