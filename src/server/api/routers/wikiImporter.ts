/**
 * Wiki Importer Router
 *
 * Handles importing country data from MediaWiki infobox templates
 * Supports multiple wiki sources: IIWiki, IxWiki, AltHistoryWiki
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { parseInfoboxTemplate, mapInfoboxToIxStats } from "~/lib/wiki-infobox-mapper";

/**
 * Wiki source configuration
 */
const WIKI_SOURCES = {
  iiwiki: {
    name: "IIWiki",
    apiUrl: "https://iiwiki.com/mediawiki/api.php",
    priority: 1,
  },
  ixwiki: {
    name: "IxWiki",
    apiUrl: "https://ixwiki.com/mediawiki/api.php",
    priority: 2,
  },
  althist: {
    name: "Alternative History Wiki",
    apiUrl: "https://althistory.fandom.com/api.php",
    priority: 3,
  },
} as const;

type WikiSource = keyof typeof WIKI_SOURCES;

/**
 * Fetch page from a specific wiki source
 */
async function fetchFromWikiSource(pageName: string, source: WikiSource) {
  const wikiConfig = WIKI_SOURCES[source];

  const response = await fetch(
    `${wikiConfig.apiUrl}?action=query&titles=${encodeURIComponent(pageName)}&prop=revisions&rvprop=content&format=json`,
    {
      headers: {
        "User-Agent": "IxStats-WikiImporter/1.0",
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${wikiConfig.name}`);
  }

  const data = await response.json();
  const pages = data.query?.pages;

  if (!pages) {
    return null;
  }

  const page = Object.values(pages)[0] as any;

  // Check if page exists (missing pages have negative IDs)
  if (page.missing !== undefined || parseInt(page.pageid) < 0) {
    return null;
  }

  const wikitext = page.revisions?.[0]?.["*"];

  if (!wikitext) {
    return null;
  }

  return {
    source: source,
    sourceName: wikiConfig.name,
    pageName: pageName,
    pageId: page.pageid,
    wikitext,
    hasInfobox: wikitext.includes("{{Infobox country") || wikitext.includes("{{Infobox Country"),
    url:
      source === "iiwiki"
        ? `https://iiwiki.com/wiki/${encodeURIComponent(pageName.replace(/ /g, "_"))}`
        : source === "ixwiki"
          ? `https://ixwiki.com/wiki/${encodeURIComponent(pageName.replace(/ /g, "_"))}`
          : `https://althistory.fandom.com/wiki/${encodeURIComponent(pageName.replace(/ /g, "_"))}`,
  };
}

/**
 * Search for page across all wiki sources
 */
async function searchAcrossWikis(pageName: string, preferredSource?: WikiSource) {
  const sources: WikiSource[] = preferredSource
    ? [
        preferredSource,
        ...(Object.keys(WIKI_SOURCES).filter((s) => s !== preferredSource) as WikiSource[]),
      ]
    : (Object.keys(WIKI_SOURCES) as WikiSource[]).sort(
        (a, b) => WIKI_SOURCES[a].priority - WIKI_SOURCES[b].priority
      );

  const results: Array<{ source: WikiSource; success: boolean; data?: any; error?: string }> = [];

  for (const source of sources) {
    try {
      const data = await fetchFromWikiSource(pageName, source);
      if (data) {
        results.push({ source, success: true, data });
        return data; // Return first successful result
      } else {
        results.push({ source, success: false, error: "Page not found" });
      }
    } catch (error) {
      results.push({
        source,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // No successful results
  throw new Error(
    `Page "${pageName}" not found in any wiki source. Tried: ${sources.map((s) => WIKI_SOURCES[s].name).join(", ")}`
  );
}

export const wikiImporterRouter = createTRPCRouter({
  /**
   * Parse wiki infobox text and preview mapped data
   */
  previewImport: publicProcedure
    .input(
      z.object({
        wikitext: z.string(),
      })
    )
    .query(({ input }) => {
      const parsedData = parseInfoboxTemplate(input.wikitext);
      const mappedData = mapInfoboxToIxStats(parsedData);

      return {
        parsed: parsedData,
        mapped: mappedData,
        fieldCount: Object.keys(parsedData).length,
        mappedFieldCount: Object.keys(mappedData).filter(
          (k) => mappedData[k as keyof typeof mappedData]
        ).length,
      };
    }),

  /**
   * Import country data from wiki infobox - COMPREHENSIVE VERSION
   * Creates full country with all 9 database tables like the builder
   */
  importCountry: protectedProcedure
    .input(
      z.object({
        wikitext: z.string(),
        countryId: z.string().optional(), // If updating existing country
        createNew: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const parsedData = parseInfoboxTemplate(input.wikitext);
      const mappedData = mapInfoboxToIxStats(parsedData);

      if (!mappedData.name) {
        throw new Error("Could not extract country name from infobox");
      }

      // Get user ID from context
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Check if updating or creating
      if (input.countryId) {
        // Update existing country
        const country = await ctx.db.country.update({
          where: { id: input.countryId },
          data: {
            name: mappedData.name,
            slug: mappedData.slug,
            continent: mappedData.continent,
            region: mappedData.region,
            landArea: mappedData.landArea,
            areaSqMi: mappedData.areaSqMi,
            currentPopulation: mappedData.currentPopulation,
            baselinePopulation: mappedData.baselinePopulation,
            populationDensity: mappedData.populationDensity,
            religion: mappedData.religion,
            leader: mappedData.leader,
            flag: mappedData.flag,
            coatOfArms: mappedData.coatOfArms,
          },
        });

        // Update or create national identity
        if (mappedData.nationalIdentity) {
          await ctx.db.nationalIdentity.upsert({
            where: { countryId: input.countryId },
            create: {
              countryId: input.countryId,
              ...mappedData.nationalIdentity,
            },
            update: {
              ...mappedData.nationalIdentity,
              updatedAt: new Date(),
            },
          });
        }

        return {
          success: true,
          countryId: country.id,
          countryName: country.name,
          action: "updated",
        };
      } else if (input.createNew) {
        // Import helper functions
        const { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } = await import(
          "~/types/ixstats"
        );

        // Calculate derived values from wiki data
        const population =
          mappedData.currentPopulation || mappedData.baselinePopulation || 10000000;
        const gdpPerCapita = 25000; // Default if not in wiki data
        const nominalGDP = population * gdpPerCapita;
        const totalGdp = nominalGDP;

        // Create slug
        const slug =
          mappedData.slug ||
          mappedData.name
            .toLowerCase()
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

        // Use transaction to create country and all related records atomically
        const result = await ctx.db.$transaction(async (tx) => {
          // Create the country with ALL fields (same as builder)
          const country = await tx.country.create({
            data: {
              name: mappedData.name || "Unknown",
              slug: slug,
              continent: mappedData.continent || "Unknown",
              region: mappedData.region || "Unknown",
              governmentType: mappedData.nationalIdentity?.governmentType || "Republic",
              religion: mappedData.religion || "Secular",
              leader: mappedData.leader || "Unknown",
              flag: mappedData.flag || undefined,
              coatOfArms: mappedData.coatOfArms || undefined,
              landArea: mappedData.landArea || 100000,
              areaSqMi: mappedData.areaSqMi || 38610,

              // Baseline values (from wiki or defaults)
              baselinePopulation: population,
              baselineGdpPerCapita: gdpPerCapita,
              baselineDate: new Date(),

              // Current values (same as baseline at creation)
              currentPopulation: population,
              currentGdpPerCapita: gdpPerCapita,
              currentTotalGdp: totalGdp,

              // Growth rates (defaults - can be customized in builder later)
              maxGdpGrowthRate: 0.05,
              adjustedGdpGrowth: 0.03,
              populationGrowthRate: 0.01,
              actualGdpGrowth: 0.03,
              localGrowthFactor: 1.0,

              // Tiers
              economicTier: getEconomicTierFromGdpPerCapita(gdpPerCapita),
              populationTier: getPopulationTierFromPopulation(population),

              // Core Economic Indicators (defaults)
              nominalGDP: nominalGDP,
              realGDPGrowthRate: 3.0,
              inflationRate: 2.0,
              currencyExchangeRate: 1.0,

              // Labor & Employment (defaults)
              laborForceParticipationRate: 65,
              employmentRate: 95,
              unemploymentRate: 5,
              totalWorkforce: Math.round(population * 0.65),
              averageWorkweekHours: 40,
              minimumWage: Math.round(gdpPerCapita * 0.02),
              averageAnnualIncome: Math.round(gdpPerCapita * 0.8),

              // Fiscal System (defaults)
              taxRevenueGDPPercent: 20,
              governmentRevenueTotal: nominalGDP * 0.2,
              taxRevenuePerCapita: (nominalGDP * 0.2) / population,
              governmentBudgetGDPPercent: 22,
              budgetDeficitSurplus: 0,
              internalDebtGDPPercent: 45,
              externalDebtGDPPercent: 25,
              totalDebtGDPRatio: 70,
              debtPerCapita: (nominalGDP * 0.7) / population,
              interestRates: 3.5,
              debtServiceCosts: nominalGDP * 0.7 * 0.035,

              // Income & Wealth (defaults)
              povertyRate: 15,
              incomeInequalityGini: 0.38,
              socialMobilityIndex: 60,

              // Government Spending (defaults)
              totalGovernmentSpending: nominalGDP * 0.22,
              spendingGDPPercent: 22,
              spendingPerCapita: (nominalGDP * 0.22) / population,

              // Demographics (defaults)
              lifeExpectancy: 78.5,
              urbanPopulationPercent: 65,
              ruralPopulationPercent: 35,
              literacyRate: 95,

              // Calculate density if we have land area
              populationDensity: mappedData.landArea
                ? population / mappedData.landArea
                : mappedData.populationDensity,
              gdpDensity: mappedData.landArea ? totalGdp / mappedData.landArea : undefined,

              lastCalculated: new Date(),
            },
          });

          // Create National Identity record with wiki data
          if (mappedData.nationalIdentity && Object.keys(mappedData.nationalIdentity).length > 0) {
            await tx.nationalIdentity.create({
              data: {
                countryId: country.id,
                countryName: mappedData.nationalIdentity.countryName || mappedData.name,
                officialName: mappedData.nationalIdentity.officialName,
                governmentType: mappedData.nationalIdentity.governmentType,
                motto: mappedData.nationalIdentity.motto,
                mottoNative: mappedData.nationalIdentity.mottoNative,
                capitalCity: mappedData.nationalIdentity.capitalCity,
                largestCity: mappedData.nationalIdentity.largestCity,
                demonym: mappedData.nationalIdentity.demonym,
                currency: mappedData.nationalIdentity.currency,
                currencySymbol: mappedData.nationalIdentity.currencySymbol,
                officialLanguages: mappedData.nationalIdentity.officialLanguages,
                nationalLanguage: mappedData.nationalIdentity.nationalLanguage,
                nationalAnthem: mappedData.nationalIdentity.nationalAnthem,
                nationalDay: mappedData.nationalIdentity.nationalDay,
                callingCode: mappedData.nationalIdentity.callingCode,
                internetTLD: mappedData.nationalIdentity.internetTLD,
                drivingSide: mappedData.nationalIdentity.drivingSide,
                timeZone: mappedData.nationalIdentity.timeZone,
                isoCode: mappedData.nationalIdentity.isoCode,
                coordinatesLatitude: mappedData.nationalIdentity.coordinatesLatitude,
                coordinatesLongitude: mappedData.nationalIdentity.coordinatesLongitude,
              },
            });
          } else {
            // Create minimal national identity
            await tx.nationalIdentity.create({
              data: {
                countryId: country.id,
                countryName: mappedData.name,
              },
            });
          }

          // Create Demographics record (defaults)
          await tx.demographics.create({
            data: {
              countryId: country.id,
              ageDistribution: JSON.stringify([
                { group: "0-15", percent: 20, color: "#4299E1" },
                { group: "16-64", percent: 65, color: "#48BB78" },
                { group: "65+", percent: 15, color: "#F56565" },
              ]),
              // Removed lifeExpectancy - not in schema
              // Removed urbanRatio - not in schema
              // Removed ruralRatio - not in schema
              educationLevels: JSON.stringify([
                { level: "No Formal Education", percent: 5, color: "#F56565" },
                { level: "Primary Education", percent: 15, color: "#ECC94B" },
                { level: "Secondary Education", percent: 55, color: "#48BB78" },
                { level: "Higher Education", percent: 25, color: "#4299E1" },
              ]),
              // Removed literacyRate - not in schema
              populationGrowthProjection: 0.5,
            },
          });

          // Create Fiscal System record (defaults)
          await tx.fiscalSystem.create({
            data: {
              countryId: country.id,
              personalIncomeTaxRates: "22", // Changed from incomeTaxRate
              corporateTaxRates: "25", // Changed from corporateTaxRate
              salesTaxRate: 10,
              // Removed progressiveTaxation - not in schema
              // Removed balancedBudgetRule - not in schema
              // Removed debtCeiling - not in schema
              // Removed antiAvoidance - not in schema
            },
          });

          // Create Labor Market record (defaults)
          await tx.laborMarket.create({
            data: {
              countryId: country.id,
              // Removed totalWorkforce - moved to Country model
              // Removed laborForceParticipationRate - moved to Country model
              // Removed employmentRate - moved to Country model
              // Removed unemploymentRate - moved to Country model
              // Removed averageWorkweekHours - moved to Country model
              // Removed minimumWage - moved to Country model
              // Removed averageAnnualIncome - moved to Country model
              // Removed laborProtections - not in schema
              employmentBySector: JSON.stringify([
                { sector: "Agriculture", percent: 5 },
                { sector: "Industry", percent: 30 },
                { sector: "Services", percent: 65 },
              ]),
              youthUnemploymentRate: 8,
              femaleParticipationRate: 60,
            },
          });

          // Create Income Distribution record (defaults)
          await tx.incomeDistribution.create({
            data: {
              countryId: country.id,
              // Removed giniCoefficient - not in schema
              // Removed povertyRate - not in schema
              // Removed socialMobilityIndex - not in schema
              economicClasses: JSON.stringify([
                {
                  name: "Upper Class",
                  populationPercent: 5,
                  wealthPercent: 40,
                  averageIncome: gdpPerCapita * 5,
                  color: "#4C51BF",
                },
                {
                  name: "Upper Middle Class",
                  populationPercent: 15,
                  wealthPercent: 30,
                  averageIncome: gdpPerCapita * 2,
                  color: "#4299E1",
                },
                {
                  name: "Middle Class",
                  populationPercent: 30,
                  wealthPercent: 20,
                  averageIncome: gdpPerCapita,
                  color: "#48BB78",
                },
                {
                  name: "Lower Middle Class",
                  populationPercent: 30,
                  wealthPercent: 8,
                  averageIncome: gdpPerCapita * 0.5,
                  color: "#ECC94B",
                },
                {
                  name: "Lower Class",
                  populationPercent: 20,
                  wealthPercent: 2,
                  averageIncome: gdpPerCapita * 0.2,
                  color: "#F56565",
                },
              ]),
              top10PercentWealth: 40,
              bottom50PercentWealth: 10,
              middleClassPercent: 30,
            },
          });

          // Create Government Budget record (defaults)
          const totalSpending = nominalGDP * 0.22;
          await tx.governmentBudget.create({
            data: {
              countryId: country.id,
              // Removed totalBudget - not in schema
              // Removed individual spending fields - not in schema
              spendingCategories: JSON.stringify([
                { category: "Defense", amount: totalSpending * 0.15 },
                { category: "Education", amount: totalSpending * 0.18 },
                { category: "Healthcare", amount: totalSpending * 0.22 },
                { category: "Infrastructure", amount: totalSpending * 0.12 },
                { category: "Social Security", amount: totalSpending * 0.2 },
                { category: "Other", amount: totalSpending * 0.13 },
              ]),
              spendingEfficiency: 0.85,
              publicInvestmentRate: 0.12,
              socialSpendingPercent: 0.2,
              // Removed performanceBasedBudgeting - not in schema
              // Removed greenInvestmentPriority - not in schema
              // Removed digitalGovernmentInitiative - not in schema
            },
          });

          // Create initial historical data point
          await tx.historicalDataPoint.create({
            data: {
              countryId: country.id,
              ixTimeTimestamp: new Date(),
              population: population,
              gdpPerCapita: gdpPerCapita,
              totalGdp: totalGdp,
              populationGrowthRate: 0.5,
              gdpGrowthRate: 3.0,
              landArea: mappedData.landArea || 100000,
              populationDensity: mappedData.landArea
                ? population / mappedData.landArea
                : mappedData.populationDensity,
              gdpDensity: mappedData.landArea ? totalGdp / mappedData.landArea : undefined,
            },
          });

          // Link user to country
          await tx.user.update({
            where: { clerkUserId: userId },
            data: { countryId: country.id },
          });

          return country;
        });

        console.log(
          `✅ Wiki Import: Country created successfully from infobox: ${result.name} (ID: ${result.id})`
        );
        return {
          success: true,
          countryId: result.id,
          countryName: result.name,
          action: "created",
          message: `Successfully imported ${result.name} from wiki with complete database structure (9 tables created)`,
        };
      }

      throw new Error("Must specify countryId for update or createNew=true");
    }),

  /**
   * Fetch wiki page from multiple wiki sources (auto-detect)
   */
  fetchFromWiki: publicProcedure
    .input(
      z.object({
        pageName: z.string(),
        preferredSource: z.enum(["iiwiki", "ixwiki", "althist"]).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const result = await searchAcrossWikis(input.pageName, input.preferredSource);
        return result;
      } catch (error) {
        throw new Error(
          `Failed to fetch wiki page: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Search for a country across all wiki sources
   */
  searchAllWikis: publicProcedure
    .input(
      z.object({
        searchTerm: z.string().min(2),
      })
    )
    .query(async ({ input }) => {
      const sources: WikiSource[] = ["iiwiki", "ixwiki", "althist"];
      const results = [];

      for (const source of sources) {
        try {
          const wikiConfig = WIKI_SOURCES[source];
          const response = await fetch(
            `${wikiConfig.apiUrl}?action=opensearch&search=${encodeURIComponent(input.searchTerm)}&limit=5&format=json`,
            {
              headers: {
                "User-Agent": "IxStats-WikiImporter/1.0",
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            const [, titles, , urls] = data;

            if (titles && titles.length > 0) {
              results.push({
                source,
                sourceName: wikiConfig.name,
                results: titles.map((title: string, idx: number) => ({
                  title,
                  url: urls[idx],
                })),
              });
            }
          }
        } catch (error) {
          console.error(`Failed to search ${source}:`, error);
        }
      }

      return results;
    }),

  /**
   * Get available wiki sources
   */
  getWikiSources: publicProcedure.query(() => {
    return Object.entries(WIKI_SOURCES).map(([key, config]) => ({
      id: key,
      name: config.name,
      apiUrl: config.apiUrl,
      priority: config.priority,
    }));
  }),
});
