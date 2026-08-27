import {
  resolveWikiPlaceholderValues,
  resolveWikiPlaceholdersInternal,
} from "~/server/shared/wiki-placeholders";
import { ixstatsTemplateProvider } from "~/server/shared/ixstats-template-provider";

describe("Plan 160: Canonical WikiOS Placeholder Resolver", () => {
  const fixedDate = new Date("2026-06-01T12:00:00Z");

  const mockCountry = {
    id: "c-1",
    name: "Sanctuary",
    currentPopulation: 50000000,
    currentTotalGdp: 2500000000000,
    currentGdpPerCapita: 50000,
    adjustedGdpGrowth: 0.035,
    unemploymentRate: 0.042,
    inflationRate: 0.021,
    politicalStability: "High",
    economicTier: "A",
    populationTier: "Medium",
    leader: "Archon Valerius",
    governmentType: "Constitutional Republic",
    landArea: 650000,
    flag: "https://ixwiki.com/flag.png",
    lastCalculated: fixedDate,
    nationalIdentity: {
      motto: "Per Aspera Ad Astra",
      capitalCity: "Aethelgard",
      currency: "Solar",
      currencySymbol: "§",
      governmentType: "Republic",
    },
  };

  const mockZeroCountry = {
    id: "c-zero",
    name: "ZeroLand",
    currentPopulation: 0,
    currentTotalGdp: 0,
    currentGdpPerCapita: 0,
    adjustedGdpGrowth: 0,
    unemploymentRate: 0,
    inflationRate: 0,
    politicalStability: "Low",
    economicTier: "C",
    lastCalculated: fixedDate,
    nationalIdentity: null,
  };

  const mockPoi = {
    id: "poi-1",
    name: "Aether Dynamics",
    category: "Technology",
    countryId: "c-1",
    country: mockCountry,
  };

  function createMockDb(options?: { countryFindManySpy?: jest.Mock }) {
    const countryFindMany =
      options?.countryFindManySpy ??
      jest.fn().mockImplementation(async ({ where }: any) => {
        const results = [];
        if (where?.OR) {
          for (const clause of where.OR) {
            if (clause.id === "c-1") results.push(mockCountry);
            if (clause.id === "c-zero") results.push(mockZeroCountry);
            if (clause.name?.in) {
              for (const n of clause.name.in) {
                if (n.toLowerCase() === "sanctuary") results.push(mockCountry);
                if (n.toLowerCase() === "zeroland") results.push(mockZeroCountry);
              }
            }
          }
        }
        return results;
      });

    return {
      country: {
        findMany: countryFindMany,
      },
      pointOfInterest: {
        findMany: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where?.name?.in?.includes("aether dynamics")) {
            return [mockPoi];
          }
          return [];
        }),
      },
    };
  }

  it("1. Resolves MyCountry with activeCountryId", async () => {
    const db = createMockDb();
    const results = await resolveWikiPlaceholderValues(["MyCountry:population"], db, "c-1");

    expect(results).toHaveLength(1);
    expect(results[0].value).toBe("50.0M");
    expect(results[0].status).toBe("resolved");
    expect(results[0].metadata?.countryName).toBe("Sanctuary");
  });

  it("2. Returns 'No Country Loaded' when MyCountry is requested without activeCountryId", async () => {
    const db = createMockDb();
    const results = await resolveWikiPlaceholderValues(["MyCountry:population"], db, undefined);

    expect(results).toHaveLength(1);
    expect(results[0].value).toBe("No Country Loaded");
    expect(results[0].status).toBe("missing-context");
    expect(results[0].rawVal).toBeNull();
  });

  it("3. Resolves named CountryData with case-insensitivity and underscore replacement", async () => {
    const db = createMockDb();
    const results = await resolveWikiPlaceholderValues(["CountryData:Sanctuary:gdp"], db);

    expect(results).toHaveLength(1);
    expect(results[0].value).toBe("$2.5T");
    expect(results[0].status).toBe("resolved");
  });

  it("4. Returns 'Unknown Country' when country is not found", async () => {
    const db = createMockDb();
    const results = await resolveWikiPlaceholderValues(["CountryData:NonExistentCountry:gdp"], db);

    expect(results).toHaveLength(1);
    expect(results[0].value).toBe("Unknown Country");
    expect(results[0].status).toBe("not-found");
  });

  it("5. Returns 'Unknown Company' when business is not found", async () => {
    const db = createMockDb();
    const results = await resolveWikiPlaceholderValues(["BusinessData:PhantomCorp:revenue"], db);

    expect(results).toHaveLength(1);
    expect(results[0].value).toBe("Unknown Company");
    expect(results[0].status).toBe("not-found");
  });

  it("6. Resolves business revenue, employees, sector, and founded", async () => {
    const db = createMockDb();
    const results = await resolveWikiPlaceholderValues(
      [
        "BusinessData:Aether_Dynamics:revenue",
        "BusinessData:Aether_Dynamics:employees",
        "BusinessData:Aether_Dynamics:sector",
        "BusinessData:Aether_Dynamics:founded",
      ],
      db
    );

    expect(results).toHaveLength(4);
    expect(results[0].value).toContain("$");
    expect(results[1].value).toBeDefined();
    expect(results[2].value).toBeDefined();
    expect(results[3].value).toMatch(/^\d{4}$/);
    expect(results[0].status).toBe("resolved");
  });

  it("7. Handles numeric zero values correctly without converting to N/A", async () => {
    const db = createMockDb();
    const results = await resolveWikiPlaceholderValues(
      [
        "CountryData:ZeroLand:population",
        "CountryData:ZeroLand:gdp",
        "CountryData:ZeroLand:gdpGrowth",
      ],
      db
    );

    expect(results[0].value).toBe("0");
    expect(results[1].value).toBe("$0");
    expect(results[2].value).toBe("0.0%");
  });

  it("8. Resolves national identity fields (motto, capital, currency, symbol)", async () => {
    const db = createMockDb();
    const results = await resolveWikiPlaceholderValues(
      [
        "CountryData:Sanctuary:motto",
        "CountryData:Sanctuary:capital",
        "CountryData:Sanctuary:currency",
        "CountryData:Sanctuary:currencySymbol",
      ],
      db
    );

    expect(results[0].value).toBe("Per Aspera Ad Astra");
    expect(results[1].value).toBe("Aethelgard");
    expect(results[2].value).toBe("Solar");
    expect(results[3].value).toBe("§");
  });

  it("9. Returns 'Unknown Field' for unsupported fields", async () => {
    const db = createMockDb();
    const results = await resolveWikiPlaceholderValues(
      ["CountryData:Sanctuary:nonExistentField"],
      db
    );

    expect(results[0].value).toBe("Unknown Field");
    expect(results[0].status).toBe("unknown-field");
  });

  it("10. Provides metadata with detailsUrl and lastCalculated", async () => {
    const db = createMockDb();
    const results = await resolveWikiPlaceholderValues(["CountryData:Sanctuary:gdp"], db);

    expect(results[0].metadata?.detailsUrl).toBe("/countries/c-1");
    expect(results[0].metadata?.lastCalculated).toBe("2026-06-01T12:00:00.000Z");
  });

  it("11. Provides API adapter backward compatibility via resolveWikiPlaceholdersInternal", async () => {
    const db = createMockDb();
    const apiResult = await resolveWikiPlaceholdersInternal(
      ["CountryData:Sanctuary:population"],
      { db } as any,
      "c-1"
    );

    expect(apiResult["CountryData:Sanctuary:population"]).toBeDefined();
    expect(apiResult["CountryData:Sanctuary:population"].value).toBe("50.0M");
  });

  it("12. Provides template provider adapter via ixstatsTemplateProvider", async () => {
    expect(ixstatsTemplateProvider.canHandle("countrydata")).toBe(true);
    expect(ixstatsTemplateProvider.canHandle("mycountry")).toBe(true);
    expect(ixstatsTemplateProvider.canHandle("businessdata")).toBe(true);
    expect(ixstatsTemplateProvider.canHandle("other")).toBe(false);
  });

  it("13. Batches repeated keys into a single database query", async () => {
    const findManySpy = jest.fn().mockImplementation(async ({ where }: any) => {
      if (where?.OR) return [mockCountry];
      return [];
    });
    const db = {
      country: { findMany: findManySpy },
      pointOfInterest: { findMany: jest.fn().mockResolvedValue([]) },
    };

    await resolveWikiPlaceholderValues(
      [
        "CountryData:Sanctuary:population",
        "CountryData:Sanctuary:gdp",
        "CountryData:Sanctuary:leader",
      ],
      db
    );

    const entityQueryCalls = findManySpy.mock.calls.filter(([args]) => args?.where?.OR);
    expect(entityQueryCalls).toHaveLength(1);
  });
});
