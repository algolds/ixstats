import { resolveWikiPlaceholdersInternal } from "../../../server/shared/wiki-placeholders";
import { ixstatsTemplateProvider } from "../../../server/shared/ixstats-template-provider";

// Mock DB for template provider
jest.mock("~/server/db", () => ({
  prisma: {
    country: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    pointOfInterest: {
      findFirst: jest.fn(),
    },
  },
}));

describe("wiki-placeholders characterization contract", () => {
  const mockCountry = {
    id: "country_123",
    name: "Aethelgard",
    currentPopulation: 50_000_000,
    currentTotalGdp: 2_500_000_000_000,
    economicTier: "Tier 1",
    leader: "High Chancellor",
    governmentType: "Constitutional Republic",
    landArea: 1_200_000,
    flag: "https://example.com/aethelgard.png",
    nationalIdentity: {
      governmentType: "Constitutional Republic",
      motto: "Per Aspera Ad Astra",
      capitalCity: "Aethelburg",
      currency: "Aethel Mark",
      currencySymbol: "AM",
    },
  };

  const mockPoi = {
    id: "poi_1",
    name: "Aethel Corp",
    category: "Aerospace & Defense",
    metadata: {
      founded: 1984,
      revenue: 450000000,
      employees: 12000,
    },
  };

  describe("internal resolver (resolveWikiPlaceholdersInternal)", () => {
    it("resolves CountryData fields with formatted numbers and currencies", async () => {
      const mockCtx: any = {
        db: {
          country: {
            findMany: jest.fn().mockResolvedValue([mockCountry]),
          },
          pointOfInterest: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        },
      };

      const result = await resolveWikiPlaceholdersInternal(
        [
          "CountryData:Aethelgard:gdp",
          "CountryData:Aethelgard:population",
          "CountryData:Aethelgard:capital",
        ],
        mockCtx,
        "country_123"
      );

      expect(result["CountryData:Aethelgard:gdp"]?.value).toBe("$2.50T");
      expect(result["CountryData:Aethelgard:population"]?.value).toBe("50.00M");
      expect(result["CountryData:Aethelgard:capital"]?.value).toBe("Aethelburg");
    });

    it("resolves BusinessData sector and founded information", async () => {
      const mockCtx: any = {
        db: {
          country: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          pointOfInterest: {
            findMany: jest.fn().mockResolvedValue([mockPoi]),
          },
        },
      };

      const result = await resolveWikiPlaceholdersInternal(
        ["BusinessData:Aethel_Corp:sector", "BusinessData:Aethel_Corp:founded"],
        mockCtx
      );

      expect(result["BusinessData:Aethel_Corp:sector"]?.value).toBe("Aerospace & Defense");
      expect(result["BusinessData:Aethel_Corp:founded"]?.value).toBe("1984");
    });
  });

  describe("host template provider (ixstatsTemplateProvider)", () => {
    it("returns 'Data unavailable' for business revenue and employees in provider", async () => {
      const { prisma } = require("~/server/db");
      prisma.pointOfInterest.findFirst.mockResolvedValue(mockPoi);

      const resolved = await ixstatsTemplateProvider.resolve(
        [
          { category: "BusinessData", entity: "Aethel Corp", field: "revenue", rawKey: "BusinessData:Aethel Corp:revenue" },
          { category: "BusinessData", entity: "Aethel Corp", field: "employees", rawKey: "BusinessData:Aethel Corp:employees" },
          { category: "BusinessData", entity: "Aethel Corp", field: "sector", rawKey: "BusinessData:Aethel Corp:sector" },
        ],
        {}
      );

      expect(resolved.get("BusinessData:Aethel Corp:revenue")?.value).toBe("Data unavailable");
      expect(resolved.get("BusinessData:Aethel Corp:employees")?.value).toBe("Data unavailable");
      expect(resolved.get("BusinessData:Aethel Corp:sector")?.value).toBe("Aerospace & Defense");
    });

    it("resolves country data in provider", async () => {
      const { prisma } = require("~/server/db");
      prisma.country.findFirst.mockResolvedValue(mockCountry);

      const resolved = await ixstatsTemplateProvider.resolve(
        [
          { category: "CountryData", entity: "Aethelgard", field: "gdp", rawKey: "CountryData:Aethelgard:gdp" },
          { category: "CountryData", entity: "Aethelgard", field: "motto", rawKey: "CountryData:Aethelgard:motto" },
        ],
        {}
      );

      expect(resolved.get("CountryData:Aethelgard:gdp")?.value).toBe("$2.50T");
      expect(resolved.get("CountryData:Aethelgard:motto")?.value).toBe("Per Aspera Ad Astra");
    });
  });
});
