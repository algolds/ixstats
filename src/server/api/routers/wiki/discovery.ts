/**
 * wiki.ts — Unified tRPC router for all wiki data access.
 *
 * Single entry point for all wiki operations across IxStats + IxWorld.
 * Uses WikiBridge internally: direct MySQL for ixwiki, HTTP for iiwiki.
 *
 * Replaces scattered wiki endpoints in geo.ts, countries.ts, wikiImporter.ts.
 */

import { z } from "zod/v4";
import { createTRPCRouter, cachedPublicProcedure, publicProcedure } from "~/server/api/trpc";
import { getArticleWikitext, getRecentChanges } from "~/lib/wiki-bridge";

const wikiSourceSchema = z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki");

export const wikiDiscoveryRouter = createTRPCRouter({
  /**
   * Get recent changes from IxWiki (direct MySQL).
   */
  getRecentChanges: cachedPublicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(20),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return getRecentChanges(input?.limit ?? 20);
    }),

  /**
   * Get a forum thread preview by thread ID.
   * Uses XenForo API (same server at forum.ixwiki.com).
   */
  getForumThreadPreview: cachedPublicProcedure
    .input(z.object({ threadId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const { getXfApiKey, getXfApiUrl } = await import("~/server/modules/forum");
      const apiKey = getXfApiKey();
      if (!apiKey) return null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${getXfApiUrl()}/threads/${input.threadId}/`, {
          headers: { "XF-Api-Key": apiKey },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) return null;
        const data = (await res.json()) as {
          thread: {
            thread_id: number;
            title: string;
            username: string;
            post_date: number;
            reply_count: number;
            view_count: number;
            Forum?: { title: string };
            first_post?: { message: string };
          };
        };

        const t = data.thread;
        // Strip BBCode from first post for excerpt
        const rawExcerpt = t.first_post?.message ?? "";
        const excerpt = rawExcerpt
          .replace(/\[\/?\w+(?:=[^\]]*)?]/g, "")
          .replace(/<[^>]+>/g, "")
          .trim()
          .substring(0, 300);

        return {
          threadId: t.thread_id,
          title: t.title,
          author: t.username,
          timestamp: new Date(t.post_date * 1000).toISOString(),
          replyCount: t.reply_count,
          viewCount: t.view_count,
          forumName: t.Forum?.title,
          excerpt,
        };
      } catch {
        return null;
      }
    }),

  /**
   * Intelligent province map finder — scans a country's wiki page for
   * administrative division info and related SVG/PNG map files.
   */
  findProvinceMaps: cachedPublicProcedure
    .input(
      z.object({
        countryName: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const article = await getArticleWikitext(input.countryName, "ixwiki");
      if (!article) {
        return { sections: [], files: [], infoboxData: null };
      }
      const wikitext = article.wikitext;

      // 1. Find administrative division-related sections
      const sectionKeywords = [
        "administrative division",
        "provinces",
        "subdivisions",
        "regions",
        "states",
        "departments",
        "counties",
        "governorates",
        "oblasts",
        "prefectures",
        "cantons",
        "territories",
        "districts",
        "municipalities",
      ];

      const lines = wikitext.split("\n");
      const matchedSections: Array<{ title: string; level: number; lineIndex: number }> = [];

      for (let i = 0; i < lines.length; i++) {
        const headingMatch = lines[i]!.match(/^(={2,})\s*(.+?)\s*={2,}$/);
        if (headingMatch) {
          const title = headingMatch[2]!.trim();
          const titleLower = title.toLowerCase();
          if (sectionKeywords.some((kw) => titleLower.includes(kw))) {
            matchedSections.push({
              title,
              level: headingMatch[1]!.length,
              lineIndex: i,
            });
          }
        }
      }

      // 2. Extract ALL file references from the article
      const filePattern = /\[\[(?:File|Image):([^\]|]+)/gi;
      const allFiles: string[] = [];
      let fileMatch;
      while ((fileMatch = filePattern.exec(wikitext)) !== null) {
        allFiles.push(fileMatch[1]!.trim());
      }

      // 3. Score and rank map files by likelihood of being a province map
      const provinceKeywords = [
        "province",
        "region",
        "admin",
        "division",
        "subdivision",
        "territory",
        "state",
        "department",
        "district",
        "vector",
        "political",
        "label",
      ];
      const negativeKeywords = [
        "topo",
        "climate",
        "elevation",
        "terrain",
        "relief",
        "satellite",
        "photo",
        "flag",
        "coat",
        "emblem",
        "seal",
        "logo",
        "icon",
        "banner",
        "locator",
        "inset",
        "overview",
        "highway",
        "hiway",
        "road",
        "rail",
        "city",
        "cities",
      ];

      type ScoredFile = { name: string; score: number };
      const scoredFiles: ScoredFile[] = allFiles
        .filter((f) => {
          const lower = f.toLowerCase();
          return lower.endsWith(".svg") || lower.endsWith(".png");
        })
        .map((f) => {
          const lower = f.toLowerCase();
          let score = 0;
          // SVG preferred over PNG (vector = province boundaries)
          if (lower.endsWith(".svg")) score += 5;
          // Province keywords boost
          for (const kw of provinceKeywords) {
            if (lower.includes(kw)) score += 10;
          }
          // Generic "map" is weaker signal
          if (lower.includes("map")) score += 3;
          // Negative keywords penalize
          for (const kw of negativeKeywords) {
            if (lower.includes(kw)) score -= 15;
          }
          return { name: f, score };
        })
        .sort((a, b) => b.score - a.score);

      const mapFiles = scoredFiles.filter((f) => f.score > 0).map((f) => f.name);
      const svgFiles = scoredFiles
        .filter((f) => f.score <= 0 && f.name.toLowerCase().endsWith(".svg"))
        .map((f) => f.name);

      // 4. Extract infobox data about divisions
      const infoboxData: Record<string, string> = {};
      const infoboxFields = [
        "subdivisions",
        "admin_divisions",
        "provinces",
        "regions",
        "states",
        "number_of_provinces",
      ];
      for (const field of infoboxFields) {
        const fieldMatch = wikitext.match(
          new RegExp(`\\|\\s*${field}\\s*=\\s*(.+?)(?=\\n\\||\\n\\}\\})`, "i")
        );
        if (fieldMatch) {
          infoboxData[field] = fieldMatch[1]!.trim();
        }
      }

      return {
        sections: matchedSections.map((s) => s.title),
        files: [...mapFiles, ...svgFiles].slice(0, 20),
        allImageFiles: allFiles.filter(
          (f) => f.toLowerCase().endsWith(".svg") || f.toLowerCase().endsWith(".png")
        ),
        infoboxData: Object.keys(infoboxData).length > 0 ? infoboxData : null,
      };
    }),

  /** Get all approved cities and POIs in a country for coordinates picking */
  getCountryMapMarkers: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const cities = await ctx.db.city.findMany({
        where: {
          countryId: input.countryId,
          status: "approved",
        },
        select: {
          id: true,
          name: true,
          coordinates: true,
          isNationalCapital: true,
          population: true,
        },
        orderBy: {
          population: "desc",
        },
      });

      const pois = await ctx.db.pointOfInterest.findMany({
        where: {
          countryId: input.countryId,
          status: "approved",
        },
        select: {
          id: true,
          name: true,
          coordinates: true,
          category: true,
        },
        orderBy: {
          name: "asc",
        },
      });

      return {
        cities: cities.map((c) => ({
          id: c.id,
          name: c.name,
          coordinates: c.coordinates as [number, number],
          type: c.isNationalCapital ? "capital" : "city",
        })),
        pois: pois.map((p) => ({
          id: p.id,
          name: p.name,
          coordinates: p.coordinates as [number, number],
          type: p.category,
        })),
      };
    }),
});

export async function resolveWikiPlaceholdersInternal(
  placeholders: string[],
  ctx: any,
  activeCountryId?: string
): Promise<Record<string, { value: string; rawVal: any; metadata?: any }>> {
  let userCountryId = activeCountryId;
  if (!userCountryId && ctx.auth?.userId) {
    const user = await ctx.db.user.findFirst({
      where: { clerkUserId: ctx.auth.userId },
      select: { countryId: true },
    });
    if (user?.countryId) {
      userCountryId = user.countryId;
    }
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
