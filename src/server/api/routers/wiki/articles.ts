/**
 * wiki.ts — Unified tRPC router for all wiki data access.
 *
 * Single entry point for all wiki operations across IxStats + IxWorld.
 * Uses WikiBridge internally: direct MySQL for ixwiki, HTTP for iiwiki.
 *
 * Replaces scattered wiki endpoints in geo.ts, countries.ts, wikiImporter.ts.
 */

import { z } from "zod/v4";
import { createTRPCRouter, cachedPublicProcedure } from "~/server/api/trpc";
import { resolveActiveCountryId } from "~/lib/wiki-os/storage";
import {
  getArticleIntro,
  getArticleWikitext,
  searchPages,
  getInfobox,
  getPageSections,
  getCoordinates,
  searchWithFallback,
  type WikiSource,
} from "~/lib/wiki/bridge";

const wikiSourceSchema = z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki");

export const wikiArticlesRouter = createTRPCRouter({
  /**
   * Search wiki pages by title prefix.
   * Uses direct MySQL for ixwiki (~30ms), HTTP API for iiwiki (~400ms).
   */
  searchPages: cachedPublicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(10),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      return searchPages(input.query, input.limit, input.wiki as WikiSource);
    }),

  /**
   * Search with automatic fallback: ixwiki first, then iiwiki.
   */
  searchWithFallback: cachedPublicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      return searchWithFallback(input.query, input.limit);
    }),

  /**
   * Get article intro (first paragraph, plaintext).
   * Parsed from wikitext — no PHP template processing.
   */
  getIntro: cachedPublicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      return getArticleIntro(input.title, input.wiki as WikiSource);
    }),

  /**
   * Get raw article wikitext.
   */
  getWikitext: cachedPublicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      const article = await getArticleWikitext(input.title, input.wiki as WikiSource);
      if (!article) return null;
      // Don't return full wikitext to client — just metadata
      return {
        title: article.title,
        pageId: article.pageId,
        length: article.length,
        hasInfobox: article.wikitext.includes("{{Infobox"),
      };
    }),

  /**
   * Parse and return infobox fields from an article.
   */
  getInfobox: cachedPublicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      const result = await getInfobox(input.title, input.wiki as WikiSource);
      if (!result) return null;
      return {
        templateName: result.templateName,
        fields: result.fields.map((f) => ({
          key: f.key,
          value: f.value,
        })),
      };
    }),

  /**
   * Get article section headings (TOC).
   */
  getSections: cachedPublicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      return getPageSections(input.title, input.wiki as WikiSource);
    }),

  /**
   * Get coordinates from article wikitext ({{coord}} template).
   */
  getCoordinates: cachedPublicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      return getCoordinates(input.title, input.wiki as WikiSource);
    }),

  /**
   * Get content of a specific section from a wiki article.
   * Returns the raw wikitext between section headings.
   */
  getSectionContent: cachedPublicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        section: z.string().min(1), // Section heading to extract (case-insensitive partial match)
        source: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      const article = await getArticleWikitext(input.title, input.source);
      if (!article) return null;

      // Find the section by heading
      const lines = article.wikitext.split("\n");
      let capturing = false;
      let sectionLevel = 0;
      const content: string[] = [];
      const sectionLower = input.section.toLowerCase();

      for (const line of lines) {
        const headingMatch = line.match(/^(={2,})\s*(.+?)\s*={2,}$/);
        if (headingMatch) {
          const level = headingMatch[1]!.length;
          const title = headingMatch[2]!.trim().toLowerCase();

          if (capturing) {
            // Stop if we hit a heading at same or higher level
            if (level <= sectionLevel) break;
          }

          if (title.includes(sectionLower)) {
            capturing = true;
            sectionLevel = level;
            continue;
          }
        }

        if (capturing) {
          content.push(line);
        }
      }

      if (content.length === 0) return null;

      // Extract any file references from the section content
      const fileRefs: string[] = [];
      const filePattern = /\[\[(?:File|Image):([^\]|]+)/gi;
      const fullContent = content.join("\n");
      let match;
      while ((match = filePattern.exec(fullContent)) !== null) {
        fileRefs.push(match[1]!.trim());
      }

      return {
        content: fullContent.trim(),
        fileReferences: fileRefs,
        lineCount: content.length,
      };
    }),
});

export async function resolveWikiPlaceholdersInternal(
  placeholders: string[],
  ctx: any,
  activeCountryId?: string
): Promise<Record<string, { value: string; rawVal: any; metadata?: any }>> {
  let userCountryId = activeCountryId;
  if (!userCountryId) {
    userCountryId = (await resolveActiveCountryId(ctx)) ?? undefined;
  }

  // Collect all country names, company names to resolve
  const countryNames = new Set<string>();
  const companyNames = new Set<string>();

  for (const p of placeholders) {
    if (p.startsWith("CountryData:")) {
      const parts = p.split(":");
      if (parts[1]) countryNames.add(parts[1].replace(/_/g, " "));
    } else if (p.startsWith("BusinessData:")) {
      const parts = p.split(":");
      if (parts[1]) companyNames.add(parts[1].replace(/_/g, " "));
    }
  }

  // Fetch all countries
  const countries = await ctx.db.country.findMany({
    where: {
      OR: [
        ...(userCountryId ? [{ id: userCountryId }] : []),
        ...(countryNames.size > 0 ? [{ name: { in: Array.from(countryNames) } }] : []),
      ],
    },
    include: {
      nationalIdentity: true,
    },
  });

  const userCountry = userCountryId ? countries.find((c: any) => c.id === userCountryId) : null;

  // Fetch all POIs for businesses
  const pois =
    companyNames.size > 0
      ? await ctx.db.pointOfInterest.findMany({
          where: {
            name: { in: Array.from(companyNames) },
            status: "approved",
          },
          include: {
            country: true,
          },
        })
      : [];

  // Fetch all countries sorted to calculate rank
  const allCountriesSortedGdp = await ctx.db.country.findMany({
    select: { id: true, currentTotalGdp: true },
    orderBy: { currentTotalGdp: "desc" },
  });
  const allCountriesSortedPop = await ctx.db.country.findMany({
    select: { id: true, currentPopulation: true },
    orderBy: { currentPopulation: "desc" },
  });

  const results: Record<string, { value: string; rawVal: any; metadata?: any }> = {};

  function formatNumber(n: number, isCurrency = false): string {
    const absVal = Math.abs(n);
    let formatted = "";
    if (absVal >= 1_000_000_000_000) {
      formatted = `${(n / 1_000_000_000_000).toFixed(2)}T`;
    } else if (absVal >= 1_000_000_000) {
      formatted = `${(n / 1_000_000_000).toFixed(2)}B`;
    } else if (absVal >= 1_000_000) {
      formatted = `${(n / 1_000_000).toFixed(2)}M`;
    } else if (absVal >= 1_000) {
      formatted = `${(n / 1_000).toFixed(1)}K`;
    } else {
      formatted = n.toLocaleString();
    }
    return isCurrency ? `$${formatted}` : formatted;
  }

  function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  }

  for (const p of placeholders) {
    if (p.startsWith("MyCountry:")) {
      const field = p.split(":")[1];
      if (!field) continue;
      if (!userCountry) {
        results[p] = { value: "No Country Loaded", rawVal: null };
        continue;
      }
      resolveCountryField(p, userCountry, field);
    } else if (p.startsWith("CountryData:")) {
      const parts = p.split(":");
      const cName = parts[1]?.replace(/_/g, " ");
      const field = parts[2];
      if (!cName || !field) continue;
      const country = countries.find((c: any) => c.name.toLowerCase() === cName.toLowerCase());
      if (!country) {
        results[p] = { value: "Unknown Country", rawVal: null };
        continue;
      }
      resolveCountryField(p, country, field);
    } else if (p.startsWith("BusinessData:")) {
      const parts = p.split(":");
      const companyName = parts[1]?.replace(/_/g, " ");
      const field = parts[2];
      if (!companyName || !field) continue;

      const poi = pois.find((poi: any) => poi.name.toLowerCase() === companyName.toLowerCase());
      if (!poi) {
        results[p] = { value: "Unknown Company", rawVal: null };
        continue;
      }

      const parentCountry = countries.find((c: any) => c.id === poi.countryId) || poi.country;
      const hash = hashCode(companyName);
      let tierScale = 1.0;
      if (parentCountry.economicTier === "S") tierScale = 2.5;
      else if (parentCountry.economicTier === "A") tierScale = 1.5;
      else if (parentCountry.economicTier === "B") tierScale = 1.0;
      else if (parentCountry.economicTier === "C") tierScale = 0.6;
      else tierScale = 0.3;

      const baseRevenue = 50_000_000 + (hash % 95) * 50_000_000;
      const revenueVal = baseRevenue * tierScale;
      const employeesVal = Math.round((200 + (hash % 48) * 100) * tierScale);
      const sectors = [
        "Manufacturing",
        "Technology",
        "Finance",
        "Energy",
        "Logistics",
        "Consumer Goods",
        "Heavy Industry",
      ];
      const sectorVal = sectors[hash % sectors.length]!;
      const foundedVal = 1950 + (hash % 76);

      if (field === "revenue") {
        results[p] = {
          value: formatNumber(revenueVal, true),
          rawVal: revenueVal,
          metadata: {
            label: "Annual Revenue",
            companyName,
            countryName: parentCountry.name,
            lastCalculated: parentCountry.lastCalculated.toISOString(),
            detailsUrl: `/countries/${parentCountry.id}`,
          },
        };
      } else if (field === "employees") {
        results[p] = {
          value: employeesVal.toLocaleString(),
          rawVal: employeesVal,
          metadata: {
            label: "Employees",
            companyName,
            countryName: parentCountry.name,
            lastCalculated: parentCountry.lastCalculated.toISOString(),
            detailsUrl: `/countries/${parentCountry.id}`,
          },
        };
      } else if (field === "sector") {
        results[p] = {
          value: sectorVal,
          rawVal: sectorVal,
          metadata: {
            label: "Industry Sector",
            companyName,
            countryName: parentCountry.name,
            detailsUrl: `/countries/${parentCountry.id}`,
          },
        };
      } else if (field === "founded") {
        results[p] = {
          value: String(foundedVal),
          rawVal: foundedVal,
          metadata: {
            label: "Year Founded",
            companyName,
            countryName: parentCountry.name,
            detailsUrl: `/countries/${parentCountry.id}`,
          },
        };
      } else {
        results[p] = { value: "Unknown Field", rawVal: null };
      }
    }
  }

  function resolveCountryField(placeholder: string, country: any, field: string) {
    let val: any = null;
    let formattedVal = "";
    let label = field;
    let rank: string | undefined;

    if (field === "currentPopulation" || field === "population") {
      val = country.currentPopulation;
      formattedVal = formatNumber(val);
      label = "Population";
      const rIndex = allCountriesSortedPop.findIndex((c: any) => c.id === country.id);
      rank = rIndex !== -1 ? `Ranked #${rIndex + 1} globally` : undefined;
    } else if (field === "currentTotalGdp" || field === "gdp") {
      val = country.currentTotalGdp;
      formattedVal = formatNumber(val, true);
      label = "Total GDP";
      const rIndex = allCountriesSortedGdp.findIndex((c: any) => c.id === country.id);
      rank = rIndex !== -1 ? `Ranked #${rIndex + 1} globally` : undefined;
    } else if (field === "currentGdpPerCapita" || field === "gdpPerCapita") {
      val = country.currentGdpPerCapita;
      formattedVal = formatNumber(val, true);
      label = "GDP per Capita";
    } else if (field === "adjustedGdpGrowth" || field === "gdpGrowth") {
      val = country.adjustedGdpGrowth;
      formattedVal = `${(val * 100).toFixed(1)}%`;
      label = "GDP Growth";
    } else if (field === "unemploymentRate" || field === "unemployment") {
      val = country.unemploymentRate;
      formattedVal = val !== null ? `${(val * 100).toFixed(1)}%` : "N/A";
      label = "Unemployment Rate";
    } else if (field === "inflationRate" || field === "inflation") {
      val = country.inflationRate;
      formattedVal = val !== null ? `${(val * 100).toFixed(1)}%` : "N/A";
      label = "Inflation Rate";
    } else if (field === "politicalStability" || field === "stability") {
      val = country.politicalStability;
      formattedVal = String(val || "N/A");
      label = "Political Stability";
    } else if (field === "economicTier" || field === "tier") {
      val = country.economicTier;
      formattedVal = String(val);
      label = "Economic Tier";
    } else if (field === "leader") {
      val = country.leader;
      formattedVal = String(val || "N/A");
      label = "Leader";
    } else if (field === "governmentType" || field === "government") {
      val = country.governmentType;
      formattedVal = String(val || "N/A");
      label = "Government Type";
    } else if (field === "motto") {
      val = country.nationalIdentity?.motto;
      formattedVal = String(val || "N/A");
      label = "Motto";
    } else if (field === "capitalCity" || field === "capital") {
      val = country.nationalIdentity?.capitalCity;
      formattedVal = String(val || "N/A");
      label = "Capital City";
    } else if (field === "currency") {
      val = country.nationalIdentity?.currency;
      formattedVal = String(val || "N/A");
      label = "Currency";
    } else if (field === "currencySymbol") {
      val = country.nationalIdentity?.currencySymbol;
      formattedVal = String(val || "");
      label = "Currency Symbol";
    } else if ((country as any)[field] !== undefined) {
      val = (country as any)[field];
      formattedVal = typeof val === "number" ? formatNumber(val) : String(val);
    } else if (country.nationalIdentity && (country.nationalIdentity as any)[field] !== undefined) {
      val = (country.nationalIdentity as any)[field];
      formattedVal = String(val || "N/A");
    } else {
      formattedVal = "N/A";
    }

    results[placeholder] = {
      value: formattedVal,
      rawVal: val,
      metadata: {
        label,
        countryName: country.name,
        growthTrend:
          field.includes("Growth") && val < 0
            ? "down"
            : field.includes("Growth") && val > 0
              ? "up"
              : "flat",
        growthRate:
          field === "gdp" || field === "currentTotalGdp"
            ? `${(country.adjustedGdpGrowth * 100).toFixed(1)}%`
            : undefined,
        lastCalculated: country.lastCalculated.toISOString(),
        detailsUrl: `/countries/${country.id}`,
        comparisonRank: rank,
      },
    };
  }

  return results;
}
