// src/server/shared/wiki-placeholders.ts
// Authoritative canonical resolver for CountryData/BusinessData/MyCountry placeholders across reads, previews, and writes.

import type { Prisma } from "@prisma/client";
import { resolveActiveCountryId } from "~/lib/wiki-os/storage";
import type { WikiAuthContext } from "~/lib/wiki-os/auth";
import { formatNumber, formatCurrency } from "~/lib/utils/format-utils";

export interface WikiPlaceholderMetadata {
  label: string;
  countryName?: string;
  companyName?: string;
  growthTrend?: "down" | "up" | "flat";
  growthRate?: string;
  lastCalculated?: string;
  detailsUrl?: string;
  comparisonRank?: string;
}

export type PlaceholderStatus =
  | "resolved"
  | "not-found"
  | "missing-context"
  | "unknown-field"
  | "malformed";

export interface CanonicalPlaceholderResult {
  key: string;
  value: string;
  rawVal: unknown;
  status: PlaceholderStatus;
  metadata?: WikiPlaceholderMetadata;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export async function resolveWikiPlaceholderValues(
  placeholders: readonly string[],
  db: Prisma.TransactionClient | any,
  activeCountryId?: string
): Promise<CanonicalPlaceholderResult[]> {
  if (placeholders.length === 0) return [];

  const countryNames = new Set<string>();
  const companyNames = new Set<string>();

  for (const p of placeholders) {
    if (p.startsWith("CountryData:")) {
      const parts = p.split(":");
      if (parts[1]) countryNames.add(parts[1].replace(/_/g, " ").toLowerCase());
    } else if (p.startsWith("BusinessData:")) {
      const parts = p.split(":");
      if (parts[1]) companyNames.add(parts[1].replace(/_/g, " ").toLowerCase());
    }
  }

  // Fetch all required countries in a single query
  const countries = await db.country.findMany({
    where: {
      OR: [
        ...(activeCountryId ? [{ id: activeCountryId }] : []),
        ...(countryNames.size > 0
          ? [{ name: { in: Array.from(countryNames), mode: "insensitive" } }]
          : []),
      ],
    },
    include: {
      nationalIdentity: true,
    },
  });

  const userCountry = activeCountryId ? countries.find((c: any) => c.id === activeCountryId) : null;

  // Fetch all POIs for businesses in a single query
  const pois =
    companyNames.size > 0
      ? await db.pointOfInterest.findMany({
          where: {
            name: { in: Array.from(companyNames), mode: "insensitive" },
            status: "approved",
          },
          include: {
            country: true,
          },
        })
      : [];

  // Fetch all countries sorted to calculate rank
  let allCountriesSortedGdp: Array<{ id: string; currentTotalGdp: number | null }> = [];
  let allCountriesSortedPop: Array<{ id: string; currentPopulation: number | null }> = [];

  const hasRankNeed = placeholders.some(
    (p) =>
      p.includes("gdp") ||
      p.includes("GDP") ||
      p.includes("population") ||
      p.includes("Population")
  );

  if (hasRankNeed) {
    [allCountriesSortedGdp, allCountriesSortedPop] = await Promise.all([
      db.country.findMany({
        select: { id: true, currentTotalGdp: true },
        orderBy: { currentTotalGdp: "desc" },
      }),
      db.country.findMany({
        select: { id: true, currentPopulation: true },
        orderBy: { currentPopulation: "desc" },
      }),
    ]);
  }

  const results: CanonicalPlaceholderResult[] = [];

  for (const p of placeholders) {
    if (p.startsWith("MyCountry:")) {
      const field = p.split(":")[1];
      if (!field) {
        results.push({ key: p, value: "Unknown Field", rawVal: null, status: "malformed" });
        continue;
      }
      if (!userCountry) {
        results.push({ key: p, value: "No Country Loaded", rawVal: null, status: "missing-context" });
        continue;
      }
      results.push(resolveCountryField(p, userCountry, field));
    } else if (p.startsWith("CountryData:")) {
      const parts = p.split(":");
      const cName = parts[1]?.replace(/_/g, " ");
      const field = parts[2];
      if (!cName || !field) {
        results.push({ key: p, value: "Unknown Field", rawVal: null, status: "malformed" });
        continue;
      }
      const country = countries.find((c: any) => c.name.toLowerCase() === cName.toLowerCase());
      if (!country) {
        results.push({ key: p, value: "Unknown Country", rawVal: null, status: "not-found" });
        continue;
      }
      results.push(resolveCountryField(p, country, field));
    } else if (p.startsWith("BusinessData:")) {
      const parts = p.split(":");
      const companyName = parts[1]?.replace(/_/g, " ");
      const field = parts[2];
      if (!companyName || !field) {
        results.push({ key: p, value: "Unknown Field", rawVal: null, status: "malformed" });
        continue;
      }

      const poi = pois.find((poiItem: any) => poiItem.name.toLowerCase() === companyName.toLowerCase());
      if (!poi) {
        results.push({ key: p, value: "Unknown Company", rawVal: null, status: "not-found" });
        continue;
      }

      const parentCountry =
        countries.find((c: any) => c.id === poi.countryId) || poi.country || {
          name: "Unknown",
          economicTier: "B",
          lastCalculated: new Date(),
          id: poi.countryId,
        };

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

      const fLower = field.toLowerCase();
      const lastCalcStr =
        parentCountry.lastCalculated instanceof Date
          ? parentCountry.lastCalculated.toISOString()
          : new Date().toISOString();

      if (fLower === "revenue") {
        results.push({
          key: p,
          value: formatCurrency(revenueVal),
          rawVal: revenueVal,
          status: "resolved",
          metadata: {
            label: "Annual Revenue",
            companyName,
            countryName: parentCountry.name,
            lastCalculated: lastCalcStr,
            detailsUrl: `/countries/${parentCountry.id}`,
          },
        });
      } else if (fLower === "employees") {
        results.push({
          key: p,
          value: employeesVal.toLocaleString(),
          rawVal: employeesVal,
          status: "resolved",
          metadata: {
            label: "Employees",
            companyName,
            countryName: parentCountry.name,
            lastCalculated: lastCalcStr,
            detailsUrl: `/countries/${parentCountry.id}`,
          },
        });
      } else if (fLower === "sector" || fLower === "industry") {
        results.push({
          key: p,
          value: sectorVal,
          rawVal: sectorVal,
          status: "resolved",
          metadata: {
            label: "Industry Sector",
            companyName,
            countryName: parentCountry.name,
            detailsUrl: `/countries/${parentCountry.id}`,
          },
        });
      } else if (fLower === "founded") {
        results.push({
          key: p,
          value: String(foundedVal),
          rawVal: foundedVal,
          status: "resolved",
          metadata: {
            label: "Year Founded",
            companyName,
            countryName: parentCountry.name,
            detailsUrl: `/countries/${parentCountry.id}`,
          },
        });
      } else {
        results.push({ key: p, value: "Unknown Field", rawVal: null, status: "unknown-field" });
      }
    } else {
      results.push({ key: p, value: "Unknown Field", rawVal: null, status: "malformed" });
    }
  }

  function resolveCountryField(
    placeholder: string,
    country: any,
    field: string
  ): CanonicalPlaceholderResult {
    let val: unknown = null;
    let formattedVal = "";
    let label = field;
    let rank: string | undefined;
    let status: PlaceholderStatus = "resolved";

    const f = field.toLowerCase();

    if (f === "currentpopulation" || f === "population") {
      val = country.currentPopulation;
      formattedVal = formatNumber(Number(val ?? 0));
      label = "Population";
      const rIndex = allCountriesSortedPop.findIndex((c) => c.id === country.id);
      rank = rIndex !== -1 ? `Ranked #${rIndex + 1} globally` : undefined;
    } else if (f === "currenttotalgdp" || f === "gdp") {
      val = country.currentTotalGdp;
      formattedVal = formatCurrency(Number(val ?? 0));
      label = "Total GDP";
      const rIndex = allCountriesSortedGdp.findIndex((c) => c.id === country.id);
      rank = rIndex !== -1 ? `Ranked #${rIndex + 1} globally` : undefined;
    } else if (f === "currentgdppercapita" || f === "gdppercapita" || f === "gdp_per_capita") {
      val =
        country.currentGdpPerCapita ??
        (country.currentTotalGdp && country.currentPopulation
          ? country.currentTotalGdp / country.currentPopulation
          : 0);
      formattedVal = formatCurrency(Number(val ?? 0));
      label = "GDP per Capita";
    } else if (f === "adjustedgdpgrowth" || f === "gdpgrowth" || f === "gdp_growth") {
      val = country.adjustedGdpGrowth ?? 0;
      formattedVal = `${(Number(val) * 100).toFixed(1)}%`;
      label = "GDP Growth";
    } else if (f === "unemploymentrate" || f === "unemployment") {
      val = country.unemploymentRate;
      formattedVal = val != null ? `${(Number(val) * 100).toFixed(1)}%` : "N/A";
      label = "Unemployment Rate";
    } else if (f === "inflationrate" || f === "inflation") {
      val = country.inflationRate;
      formattedVal = val != null ? `${(Number(val) * 100).toFixed(1)}%` : "N/A";
      label = "Inflation Rate";
    } else if (f === "politicalstability" || f === "stability") {
      val = country.politicalStability;
      formattedVal = val != null ? String(val) : "N/A";
      label = "Political Stability";
    } else if (f === "economictier" || f === "tier") {
      val = country.economicTier;
      formattedVal = val != null ? String(val) : "N/A";
      label = "Economic Tier";
    } else if (f === "populationtier") {
      val = country.populationTier;
      formattedVal = val != null ? String(val) : "N/A";
      label = "Population Tier";
    } else if (f === "leader" || f === "leadername") {
      val = country.leader;
      formattedVal = val != null && String(val).trim() ? String(val) : "N/A";
      label = "Leader";
    } else if (f === "governmenttype" || f === "government") {
      val = country.governmentType ?? country.nationalIdentity?.governmentType;
      formattedVal = val != null && String(val).trim() ? String(val) : "N/A";
      label = "Government Type";
    } else if (f === "motto") {
      val = country.nationalIdentity?.motto;
      formattedVal = val != null && String(val).trim() ? String(val) : "N/A";
      label = "Motto";
    } else if (f === "capitalcity" || f === "capital") {
      val = country.nationalIdentity?.capitalCity;
      formattedVal = val != null && String(val).trim() ? String(val) : "N/A";
      label = "Capital City";
    } else if (f === "currency") {
      val = country.nationalIdentity?.currency;
      formattedVal = val != null && String(val).trim() ? String(val) : "N/A";
      label = "Currency";
    } else if (f === "currencysymbol") {
      val = country.nationalIdentity?.currencySymbol;
      formattedVal = val != null ? String(val) : "";
      label = "Currency Symbol";
    } else if (f === "land_area" || f === "landarea") {
      val = country.landArea;
      formattedVal = formatNumber(Number(val ?? 0)) + " km\u00B2";
      label = "Land Area";
    } else if (f === "flag_url" || f === "flagurl" || f === "flag") {
      val = country.flag;
      formattedVal = val != null ? String(val) : "";
      label = "Flag URL";
    } else if (f === "name") {
      val = country.name;
      formattedVal = val != null ? String(val) : "N/A";
      label = "Name";
    } else if ((country as Record<string, unknown>)[field] !== undefined) {
      val = (country as Record<string, unknown>)[field];
      formattedVal = typeof val === "number" ? formatNumber(val) : String(val ?? "N/A");
    } else if (
      country.nationalIdentity &&
      (country.nationalIdentity as Record<string, unknown>)[field] !== undefined
    ) {
      val = (country.nationalIdentity as Record<string, unknown>)[field];
      formattedVal = val != null ? String(val) : "N/A";
    } else {
      formattedVal = "Unknown Field";
      status = "unknown-field";
    }

    const numericVal = typeof val === "number" ? val : 0;
    const lastCalcStr =
      country.lastCalculated instanceof Date
        ? country.lastCalculated.toISOString()
        : new Date().toISOString();

    return {
      key: placeholder,
      value: formattedVal,
      rawVal: val,
      status,
      metadata: {
        label,
        countryName: country.name,
        growthTrend:
          field.includes("Growth") && numericVal < 0
            ? "down"
            : field.includes("Growth") && numericVal > 0
              ? "up"
              : "flat",
        growthRate:
          field === "gdp" || field === "currentTotalGdp"
            ? `${((country.adjustedGdpGrowth ?? 0) * 100).toFixed(1)}%`
            : undefined,
        lastCalculated: lastCalcStr,
        detailsUrl: `/countries/${country.id}`,
        comparisonRank: rank,
      },
    };
  }

  return results;
}

export async function resolveWikiPlaceholdersInternal(
  placeholders: string[],
  ctx: { db: Prisma.TransactionClient | typeof import("~/server/db").db } & WikiAuthContext,
  activeCountryId?: string
): Promise<Record<string, { value: string; rawVal: unknown; metadata?: WikiPlaceholderMetadata }>> {
  let userCountryId = activeCountryId;
  if (!userCountryId) {
    userCountryId = (await resolveActiveCountryId(ctx)) ?? undefined;
  }

  const results = await resolveWikiPlaceholderValues(placeholders, ctx.db, userCountryId);
  const out: Record<string, { value: string; rawVal: unknown; metadata?: WikiPlaceholderMetadata }> = {};
  for (const item of results) {
    out[item.key] = {
      value: item.value,
      rawVal: item.rawVal,
      metadata: item.metadata,
    };
  }
  return out;
}
