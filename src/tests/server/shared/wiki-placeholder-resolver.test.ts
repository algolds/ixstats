import {
  resolveWikiPlaceholderValues
} from "~/server/shared/wiki-placeholders";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";

describe("Plan 160: Canonical WikiOS Placeholder Resolver", () => {
  const fixedDate = new Date("2026-06-01T12:00:00Z");

  const mockCountry = {
    id: "c-1",
    name: "Sanctuary",
    realmId: DEFAULT_REALM_ID,
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
    realmId: DEFAULT_REALM_ID,
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
    metadata: { revenue: 2_500_000, employees: 1200, sector: "Technology", founded: 1987 },
  };

  const mockUnrecordedPoi = { ...mockPoi, id: "poi-2", name: "Blank Works", metadata: null };

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
          const names: string[] = (where?.name?.in ?? []).map((n: string) => n.toLowerCase());
          return [
            ...(names.includes("aether dynamics") ? [mockPoi] : []),
            ...(names.includes("blank works") ? [mockUnrecordedPoi] : []),
          ];
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
  it("6b. Never invents business figures that are not recorded", async () => {
    const db = createMockDb();
    const results = await resolveWikiPlaceholderValues(
      ["BusinessData:Blank_Works:revenue", "BusinessData:Blank_Works:employees"],
      db
    );

    expect(results.map((r) => r.value)).toEqual(["—", "—"]);
    expect(results.every((r) => r.status === "not-found" && r.rawVal === null)).toBe(true);
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
});
