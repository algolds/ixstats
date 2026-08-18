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
import { getImageUrl, getPageImages } from "~/lib/wiki/bridge";
import { resolveActiveCountryId } from "~/lib/wiki-os/storage";

const wikiSourceSchema = z.enum(["ixwiki", "iiwiki", "althistory"]).default("ixwiki");

export const wikiMediaRouter = createTRPCRouter({
  /**
   * Get image URL for an IxWiki file.
   */
  getImageUrl: publicProcedure
    .input(z.object({ filename: z.string().min(1) }))
    .query(({ input }) => {
      return { url: getImageUrl(input.filename) };
    }),

  /**
   * Search wiki files/images by name prefix.
   * Direct MySQL for ixwiki, HTTP API for iiwiki.
   */
  searchFiles: cachedPublicProcedure
    .input(
      z.object({
        query: z.string().max(200).optional(),
        category: z.string().max(200).optional(),
        limit: z.number().min(1).max(50).default(20),
        fileTypes: z.array(z.string()).optional(), // e.g., ["svg", "png"]
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      let baseUrl = "https://ixwiki.com/api.php";
      if (input.wiki === "iiwiki") {
        baseUrl = "https://iiwiki.com/api.php";
      } else if (input.wiki === "althistory") {
        baseUrl = "https://althistory.fandom.com/api.php";
      }

      let url = "";
      if (input.category) {
        url = `${baseUrl}?action=query&generator=categorymembers&gcmtitle=Category:${encodeURIComponent(input.category.replace(/ /g, "_"))}&gcmtype=file&gcmlimit=${input.limit}&prop=imageinfo&iiprop=url|size|mime&format=json`;
      } else {
        const q = input.query || "";
        url = `${baseUrl}?action=query&list=allimages&aiprefix=${encodeURIComponent(q.replace(/ /g, "_"))}&ailimit=${input.limit}&aiprop=url|size|mime&format=json`;
      }

      const res = await fetch(url, {
        headers: {
          "User-Agent": "IxStats-Builder",
          "Api-User-Agent": "IxStats-Builder",
        },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as any;

      let images: any[] = [];
      if (input.category) {
        const pagesObj = data?.query?.pages ?? {};
        images = Object.values(pagesObj).map((p: any) => {
          const info = p.imageinfo?.[0] ?? {};
          return {
            name: p.title ?? "",
            size: info.size ?? 0,
            width: info.width ?? 0,
            height: info.height ?? 0,
            mime: info.mime ?? "",
            url: info.url ?? "",
          };
        });
      } else {
        images = data?.query?.allimages ?? [];
      }

      return images
        .filter((img: any) => {
          if (!input.fileTypes || input.fileTypes.length === 0) return true;
          const ext = img.name?.split(".")?.pop()?.toLowerCase() ?? "";
          return input.fileTypes.includes(ext);
        })
        .map((img: any) => ({
          name: img.name ?? "",
          size: img.size ?? 0,
          width: img.width ?? 0,
          height: img.height ?? 0,
          mediaType: "",
          mime: img.mime ?? "",
          url: img.url ?? "",
          pageUrl:
            input.wiki === "iiwiki"
              ? `https://iiwiki.com/wiki/File:${encodeURIComponent(img.name ?? "")}`
              : `/wiki/File:${encodeURIComponent(img.name ?? "")}`,
        }));
    }),

  /**
   * Get dynamic list of categories containing files.
   * Direct MySQL for ixwiki, HTTP API for iiwiki.
   */
  getCategories: cachedPublicProcedure
    .input(
      z.object({
        wiki: wikiSourceSchema,
        limit: z.number().int().min(1).max(500).default(500),
      })
    )
    .query(async ({ input }) => {
      const isIiwiki = input.wiki === "iiwiki";

      if (!isIiwiki) {
        try {
          const { getIxWikiPool } = await import("~/lib/wiki/bridge");
          const pool = getIxWikiPool();
          const [rows] = await pool.query<any[]>(
            `
            SELECT cat_title AS name, cat_files AS fileCount
            FROM category
            WHERE cat_files > 0
            ORDER BY cat_files DESC
            LIMIT ?
          `,
            [input.limit]
          );
          return (rows as any[]).map((r) => ({
            name: String(r.name).replace(/_/g, " "),
            fileCount: Number(r.fileCount),
          }));
        } catch (err) {
          console.error("[wikiRouter] Failed to fetch ixwiki categories from DB:", err);
          return [];
        }
      } else {
        try {
          const url = `https://iiwiki.com/api.php?action=query&list=allcategories&aclimit=${input.limit}&acmin=1&acprop=size&format=json&origin=*`;
          const res = await fetch(url, {
            headers: {
              "User-Agent": "IxStats-Builder",
              "Api-User-Agent": "IxStats-Builder",
            },
          });
          if (!res.ok) return [];
          const data = (await res.json()) as any;
          const categories = data?.query?.allcategories ?? [];
          return categories
            .filter((c: any) => c.files > 0)
            .map((c: any) => ({
              name: String(c["*"] || c.title).replace(/_/g, " "),
              fileCount: Number(c.files || 0),
            }));
        } catch (err) {
          console.error("[wikiRouter] Failed to fetch iiwiki categories from API:", err);
          return [];
        }
      }
    }),

  /**
   * Download a wiki file's content as base64 — server-side proxy to avoid CORS.
   * Reads directly from /ixwiki/shared/images/ when possible (same server, instant).
   */
  downloadFile: publicProcedure
    .input(z.object({ filename: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      const fs = await import("fs/promises");
      const crypto = await import("crypto");
      const name = input.filename.replace(/ /g, "_");

      // MediaWiki hash-based path: md5(filename), take first 1 and 2 chars
      const md5 = crypto.createHash("md5").update(name).digest("hex");
      const hashDir1 = md5.substring(0, 1);
      const hashDir2 = md5.substring(0, 2);
      const localPath = `/ixwiki/shared/images/${hashDir1}/${hashDir2}/${name}`;

      try {
        // Try local filesystem first (instant, no HTTP)
        const buffer = await fs.readFile(localPath);
        const ext = name.split(".").pop()?.toLowerCase() ?? "";
        const mime =
          ext === "svg"
            ? "image/svg+xml"
            : ext === "png"
              ? "image/png"
              : "application/octet-stream";

        return {
          filename: name,
          content: buffer.toString("base64"),
          mime,
          size: buffer.length,
          source: "local" as const,
        };
      } catch {
        // Fallback: fetch via HTTP (handles edge cases like redirects)
        try {
          const url = `https://ixwiki.com/wiki/Special:FilePath/${encodeURIComponent(name)}`;
          const res = await fetch(url, {
            headers: { "User-Agent": "IxStats/2.0 (internal)" },
            redirect: "follow",
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buffer = Buffer.from(await res.arrayBuffer());
          const contentType = res.headers.get("content-type") ?? "application/octet-stream";

          return {
            filename: name,
            content: buffer.toString("base64"),
            mime: contentType,
            size: buffer.length,
            source: "http" as const,
          };
        } catch (e) {
          throw new Error(
            `Failed to download ${name}: ${e instanceof Error ? e.message : "Unknown"}`
          );
        }
      }
    }),

  /** Get images from a wiki page with thumbnail URLs. */
  getPageImages: cachedPublicProcedure
    .input(
      z.object({
        title: z.string(),
        limit: z.number().int().min(1).max(50).default(12),
        excludeIcons: z.boolean().default(true),
      })
    )
    .query(async ({ input }) => {
      const excludePatterns = input.excludeIcons
        ? [/Flag_of/i, /Coat_of_arms/i, /Icon/i, /Logo/i, /Pictogram/i]
        : [];
      const images = await getPageImages(input.title, {
        limit: input.limit,
        excludePatterns,
        thumbWidth: 400,
      });
      return images ?? [];
    }),

  /** Get total file counts for a list of categories on a specific wiki. */
  getCategoryTotalCounts: cachedPublicProcedure
    .input(
      z.object({
        categories: z.array(z.string().min(1).max(300)).min(1).max(25),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      let baseUrl = "https://ixwiki.com/api.php";
      if (input.wiki === "iiwiki") {
        baseUrl = "https://iiwiki.com/api.php";
      } else if (input.wiki === "althistory") {
        baseUrl = "https://althistory.fandom.com/api.php";
      }

      const results: Record<string, number> = {};
      const titles = input.categories.map((c) => `Category:${c.replace(/ /g, "_")}`).join("|");
      const url = `${baseUrl}?action=query&prop=categoryinfo&titles=${encodeURIComponent(titles)}&format=json`;

      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "IxStats-Builder",
            "Api-User-Agent": "IxStats-Builder",
          },
        });
        if (!res.ok) return {};
        const data = (await res.json()) as any;
        const pages = data?.query?.pages ?? {};

        for (const page of Object.values(pages) as any[]) {
          const catName = page.title?.replace(/^Category:/, "") ?? "";
          results[catName] = page.categoryinfo?.files ?? 0;
        }
      } catch (e) {
        console.error("[wikiRouter] getCategoryTotalCounts error:", e);
      }

      // Fill in zeros for any missing categories
      for (const cat of input.categories) {
        if (results[cat] === undefined) {
          results[cat] = 0;
        }
      }

      return results;
    }),

  /** Get subcategories of a category on a specific wiki. */
  getSubcategories: cachedPublicProcedure
    .input(
      z.object({
        category: z.string().min(1).max(300),
        limit: z.number().min(1).max(200).default(50),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      let baseUrl = "https://ixwiki.com/api.php";
      if (input.wiki === "iiwiki") {
        baseUrl = "https://iiwiki.com/api.php";
      } else if (input.wiki === "althistory") {
        baseUrl = "https://althistory.fandom.com/api.php";
      }

      const url = `${baseUrl}?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(input.category.replace(/ /g, "_"))}&cmnamespace=14&cmtype=subcat&cmlimit=${input.limit}&format=json`;
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "IxStats-Builder",
            "Api-User-Agent": "IxStats-Builder",
          },
        });
        if (!res.ok) return [];
        const data = (await res.json()) as any;
        return (data?.query?.categorymembers ?? []).map((m: any) =>
          String(m.title).replace(/^Category:/, "")
        );
      } catch {
        return [];
      }
    }),

  /** Autocomplete categories by prefix on a specific wiki. */
  autocompleteCategories: cachedPublicProcedure
    .input(
      z.object({
        prefix: z.string().min(1).max(200),
        limit: z.number().min(1).max(30).default(15),
        wiki: wikiSourceSchema,
      })
    )
    .query(async ({ input }) => {
      let baseUrl = "https://ixwiki.com/api.php";
      if (input.wiki === "iiwiki") {
        baseUrl = "https://iiwiki.com/api.php";
      } else if (input.wiki === "althistory") {
        baseUrl = "https://althistory.fandom.com/api.php";
      }

      const url = `${baseUrl}?action=query&list=allcategories&acprefix=${encodeURIComponent(input.prefix)}&aclimit=${input.limit}&format=json`;
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "IxStats-Builder",
            "Api-User-Agent": "IxStats-Builder",
          },
        });
        if (!res.ok) return [];
        const data = (await res.json()) as any;
        return (data?.query?.allcategories ?? []).map(
          (c: any) => c.category ?? c["*"] ?? c.title ?? ""
        ) as string[];
      } catch {
        return [];
      }
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
