/**
 * Wiki Importer Router
 *
 * Handles importing country data from MediaWiki infobox templates
 * Supports multiple wiki sources: IIWiki, IxWiki, AltHistoryWiki
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { parseInfoboxTemplate, mapInfoboxToIxStats } from "~/lib/wiki-infobox-mapper";
import { getArticleWikitext, type WikiSource as BridgeWikiSource } from "~/lib/wiki-bridge";

/**
 * Wiki source configuration (name mapping only — fetching delegated to WikiBridge)
 */
const WIKI_SOURCE_NAMES = {
  iiwiki: { name: "IIWiki", priority: 1 },
  ixwiki: { name: "IxWiki", priority: 2 },
  althist: { name: "Alternative History Wiki", priority: 3 },
} as const;

type WikiSource = keyof typeof WIKI_SOURCE_NAMES;

/** Map local source keys to WikiBridge-supported sources. */
function toBridgeSource(source: WikiSource): BridgeWikiSource | null {
  if (source === "ixwiki" || source === "iiwiki") return source;
  // althistory is now supported by WikiBridge (HTTP-only fetching)
  if (source === "althist") return "althistory";
  return null;
}

function getWikiUrl(source: WikiSource, pageName: string): string {
  const slug = encodeURIComponent(pageName.replace(/ /g, "_"));
  if (source === "iiwiki") return `https://iiwiki.com/wiki/${slug}`;
  if (source === "ixwiki") return `/w/${slug}`;
  return `https://althistory.fandom.com/wiki/${slug}`;
}

/**
 * Fetch page from a specific wiki source via WikiBridge.
 * Falls back to direct HTTP for unsupported sources (althist).
 */
async function fetchFromWikiSource(pageName: string, source: WikiSource) {
  const bridgeSource = toBridgeSource(source);

  if (bridgeSource) {
    // Use WikiBridge (direct MySQL for ixwiki, HTTP for iiwiki)
    const article = await getArticleWikitext(pageName, bridgeSource);
    if (!article) return null;

    return {
      source,
      sourceName: WIKI_SOURCE_NAMES[source].name,
      pageName,
      pageId: article.pageId,
      wikitext: article.wikitext,
      hasInfobox:
        article.wikitext.includes("{{Infobox country") ||
        article.wikitext.includes("{{Infobox Country"),
      url: getWikiUrl(source, pageName),
    };
  }

  // Fallback: althist uses direct HTTP (not in WikiBridge)
  const apiUrl = "https://althistory.fandom.com/api.php";
  const response = await fetch(
    `${apiUrl}?action=query&titles=${encodeURIComponent(pageName)}&prop=revisions&rvprop=content&format=json`,
    {
      headers: { "User-Agent": "IxStats-Builder", Accept: "application/json" },
    }
  );
  if (!response.ok)
    throw new Error(`HTTP ${response.status} from ${WIKI_SOURCE_NAMES[source].name}`);
  const data = await response.json();
  const pages = data.query?.pages;
  if (!pages || Object.keys(pages).length === 0) return null;
  const page = Object.values(pages)[0];
  if (!page || typeof page !== "object") return null;
  const pageObj = page as Record<string, unknown>;
  if (pageObj.missing !== undefined || parseInt(String(pageObj.pageid ?? "-1")) < 0) return null;
  const revisions = pageObj.revisions as Array<Record<string, unknown>> | undefined;
  const wikitext = revisions?.[0]?.["*"] as string | undefined;
  if (!wikitext) return null;

  return {
    source,
    sourceName: WIKI_SOURCE_NAMES[source].name,
    pageName,
    pageId: pageObj.pageid,
    wikitext,
    hasInfobox: wikitext.includes("{{Infobox country") || wikitext.includes("{{Infobox Country"),
    url: getWikiUrl(source, pageName),
  };
}

/**
 * Search for page across all wiki sources
 */
async function searchAcrossWikis(pageName: string, preferredSource?: WikiSource) {
  const sources: WikiSource[] = preferredSource
    ? [
        preferredSource,
        ...(Object.keys(WIKI_SOURCE_NAMES).filter((s) => s !== preferredSource) as WikiSource[]),
      ]
    : (Object.keys(WIKI_SOURCE_NAMES) as WikiSource[]).sort(
        (a, b) => WIKI_SOURCE_NAMES[a].priority - WIKI_SOURCE_NAMES[b].priority
      );

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const data = await fetchFromWikiSource(pageName, source);
      return { source, data };
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.data) {
      return result.value.data;
    }
  }

  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));

  throw new Error(
    `Page "${pageName}" not found in any wiki source. Tried: ${sources.map((s) => WIKI_SOURCE_NAMES[s].name).join(", ")}${errors.length > 0 ? `. Errors: ${errors.join("; ")}` : ""}`
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
      try {
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
      } catch (e) {
        throw new Error(
          `Failed to parse wikitext: ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }),

  /**
   * Import country data from wiki infobox - COMPREHENSIVE VERSION
   * Creates full country with all 9 database tables like the builder
   */
  importCountry: protectedProcedure
    .input(
      z.object({
        wikitext: z.string(),
        countryId: z.string().optional(),
        createNew: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const parsedData = parseInfoboxTemplate(input.wikitext);
      const mappedData = mapInfoboxToIxStats(parsedData);

      if (!mappedData.name) {
        throw new Error("Could not extract country name from infobox");
      }

      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Validate mapped data ranges before database write
      const population = mappedData.currentPopulation || mappedData.baselinePopulation || 10000000;
      if (population < 0 || population > 1e10) {
        throw new Error("Invalid population value from wiki data");
      }
      const landArea = mappedData.landArea || 100000;
      if (landArea < 0 || landArea > 1e8) {
        throw new Error("Invalid land area value from wiki data");
      }

      // Check if updating or creating
      if (input.countryId) {
        // Wrap update path in transaction for atomicity
        try {
          const result = await (ctx.db as any).$transaction(async (tx: any) => {
            const country = await tx.country.update({
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

            if (mappedData.nationalIdentity) {
              await tx.nationalIdentity.upsert({
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

            return country;
          });

          return {
            success: true,
            countryId: result.id,
            countryName: result.name,
            action: "updated",
          };
        } catch (err) {
          console.error(
            `[wikiImporter] importCountry update failed for user ${userId}, country ${input.countryId}:`,
            err
          );
          throw new Error(
            `Failed to update country: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      } else if (input.createNew) {
        // Import helper functions
        const { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } =
          await import("~/types/ixstats");

        // Calculate derived values from wiki data
        const population =
          mappedData.currentPopulation || mappedData.baselinePopulation || 10000000;
        const gdpPerCapita = 25000;
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

        // Check for slug collision before attempting create
        const existingSlug = await ctx.db.country.findUnique({ where: { slug } });
        if (existingSlug) {
          throw new Error(
            `A country with slug "${slug}" already exists. Use the update flow instead.`
          );
        }

        // Use transaction to create country and all related records atomically
        try {
          const result = await (ctx.db as any).$transaction(async (tx: any) => {
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
            if (
              mappedData.nationalIdentity &&
              Object.keys(mappedData.nationalIdentity).length > 0
            ) {
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
            `[wikiImporter] Country created successfully: ${result.name} (ID: ${result.id})`
          );
          return {
            success: true,
            countryId: result.id,
            countryName: result.name,
            action: "created",
            message: `Successfully imported ${result.name} from wiki with complete database structure`,
          };
        } catch (err) {
          console.error(`[wikiImporter] importCountry create failed for user ${userId}:`, err);
          if (err instanceof Error && err.message.includes("Unique constraint")) {
            throw new Error(
              `A country with slug "${slug}" already exists. Use the update flow instead.`
            );
          }
          throw new Error(
            `Failed to import country: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
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
      const { searchPages } = await import("~/lib/wiki-bridge");
      const sources: WikiSource[] = ["iiwiki", "ixwiki", "althist"];
      const results = await Promise.allSettled(
        sources.map(async (source) => {
          const bridgeSource = toBridgeSource(source);
          if (bridgeSource) {
            const searchResults = await searchPages(input.searchTerm, 5, bridgeSource);
            if (searchResults.length > 0) {
              return {
                source,
                sourceName: WIKI_SOURCE_NAMES[source].name,
                results: searchResults.map((r) => ({
                  title: r.title,
                  url: getWikiUrl(source, r.title),
                })),
              };
            }
          } else {
            const apiUrl = "https://althistory.fandom.com/api.php";
            const response = await fetch(
              `${apiUrl}?action=opensearch&search=${encodeURIComponent(input.searchTerm)}&limit=5&format=json`,
              { headers: { "User-Agent": "IxStats-Builder" } }
            );
            if (response.ok) {
              const data = await response.json();
              const [, titles, , urls] = data;
              if (titles && titles.length > 0) {
                return {
                  source,
                  sourceName: WIKI_SOURCE_NAMES[source].name,
                  results: titles.map((title: string, idx: number) => ({
                    title,
                    url: urls[idx],
                  })),
                };
              }
            }
          }
          return null;
        })
      );

      return results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<unknown>).value)
        .filter((v): v is NonNullable<typeof v> => v !== null);
    }),

  /**
   * Deep import — full article extraction with semantic analysis and IxWorld matching.
   *
   * Goes beyond infobox parsing: extracts sections, prose, lists, tables, and
   * uses semantic keyword matching to identify economy, government, demographics,
   * geography, military, and history data from the full article.
   */
  deepImport: publicProcedure
    .input(
      z.object({
        pageName: z.string().min(1),
        site: z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Dynamic imports to keep the module lightweight when not used
      const { extractWikiContent } = await import("~/lib/wiki-content-extractor");
      const { analyzeWikiContent } = await import("~/lib/wiki-content-analyzer");
      const { matchToIxWorld } = await import("~/lib/wiki-ixworld-mapper");

      // 1. Fetch full wikitext via WikiBridge
      const bridgeSource = input.site as BridgeWikiSource;
      const article = await getArticleWikitext(input.pageName, bridgeSource);
      if (!article) {
        // Fallback: try fetchFromWikiSource for althist
        const fallback = await fetchFromWikiSource(
          input.pageName,
          input.site === "althistory" ? "althist" : (input.site as WikiSource)
        );
        if (!fallback) {
          return { success: false, error: `Page "${input.pageName}" not found on ${input.site}` };
        }

        // Process fallback wikitext
        const extracted = extractWikiContent(input.pageName, fallback.wikitext);
        const analyzed = analyzeWikiContent(extracted);

        // Run infobox mapper for compatibility
        let infoboxMapped = {};
        try {
          const parsedInfobox = parseInfoboxTemplate(fallback.wikitext);
          infoboxMapped = mapInfoboxToIxStats(parsedInfobox);
        } catch (e) {
          console.warn("[deepImport] infobox parsing failed:", e);
        }

        // IxWorld matching
        let ixworldMatch = null;
        try {
          ixworldMatch = await matchToIxWorld(
            extracted.coordinates,
            input.pageName,
            ctx.db as any,
            analyzed.borders?.value
          );
        } catch (e) {
          console.warn("[deepImport] IxWorld matching failed:", e);
        }

        return {
          success: true,
          extracted: {
            title: extracted.title,
            intro: extracted.intro,
            sectionCount: extracted.sections.length,
            sections: extracted.sections.map((s) => ({ level: s.level, title: s.title })),
            categories: extracted.categories,
            coordinates: extracted.coordinates,
            imageCount: extracted.images.length,
            tableCount: extracted.tables.length,
          },
          analyzed,
          infoboxMapped,
          ixworldMatch,
          sourceUrl: fallback.url,
        };
      }

      // 2. Run full extraction
      const extracted = extractWikiContent(input.pageName, article.wikitext);

      // 3. Run semantic analyzer
      const analyzed = analyzeWikiContent(extracted);

      // 4. Run infobox mapper for compatibility with existing builder
      let infoboxMapped = {};
      try {
        const parsedInfobox = parseInfoboxTemplate(article.wikitext);
        infoboxMapped = mapInfoboxToIxStats(parsedInfobox);
      } catch (e) {
        console.warn("[deepImport] infobox parsing failed:", e);
      }

      // 5. IxWorld geographic matching
      let ixworldMatch = null;
      try {
        ixworldMatch = await matchToIxWorld(
          extracted.coordinates,
          input.pageName,
          ctx.db as any,
          analyzed.borders?.value
        );
      } catch (e) {
        console.warn("[deepImport] IxWorld matching failed:", e);
      }

      return {
        success: true,
        extracted: {
          title: extracted.title,
          intro: extracted.intro,
          sectionCount: extracted.sections.length,
          sections: extracted.sections.map((s) => ({ level: s.level, title: s.title })),
          categories: extracted.categories,
          coordinates: extracted.coordinates,
          imageCount: extracted.images.length,
          tableCount: extracted.tables.length,
        },
        analyzed,
        infoboxMapped,
        ixworldMatch,
        sourceUrl: getWikiUrl(
          input.site === "althistory" ? "althist" : (input.site as WikiSource),
          input.pageName
        ),
      };
    }),

  /**
   * Get available wiki sources
   */
  getWikiSources: publicProcedure.query(() => {
    return Object.entries(WIKI_SOURCE_NAMES).map(([key, config]) => ({
      id: key,
      name: config.name,
      priority: config.priority,
    }));
  }),
});
