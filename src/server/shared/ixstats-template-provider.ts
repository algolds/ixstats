// src/server/shared/ixstats-template-provider.ts
// IxStats host-app template data provider for WikiOS (Workstream C4).
// Resolves CountryData, MyCountry, and BusinessData from IxStats Prisma database.

import { prisma } from "~/server/db";
import type {
  TemplateDataProvider,
  TemplateKey,
  ResolvedTemplate,
  ResolveOptions,
} from "~/lib/wiki-os/template-resolver";
import type { Country, NationalIdentity, PointOfInterest } from "@prisma/client";

type CountryWithIdentity = Country & { nationalIdentity: NationalIdentity | null };

function fmtNum(n: number): string {
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString("en-US");
}

function fmtCurrency(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${n.toLocaleString("en-US")}`;
}

function resolveCountryField(country: CountryWithIdentity, field: string): string {
  const f = field.toLowerCase();
  if (f === "population") return fmtNum(country.currentPopulation ?? 0);
  if (f === "gdp") return fmtCurrency(country.currentTotalGdp ?? 0);
  if (f === "gdp_per_capita" || f === "gdppercapita")
    return fmtCurrency(
      country.currentTotalGdp && country.currentPopulation
        ? country.currentTotalGdp / country.currentPopulation
        : 0
    );
  if (f === "tier" || f === "economictier") return country.economicTier ?? "N/A";
  if (f === "leader" || f === "leadername") return country.leader ?? "N/A";
  if (f === "government" || f === "governmenttype")
    return country.governmentType ?? country.nationalIdentity?.governmentType ?? "N/A";
  if (f === "motto") return country.nationalIdentity?.motto ?? "N/A";
  if (f === "capital" || f === "capitalcity")
    return country.nationalIdentity?.capitalCity ?? "N/A";
  if (f === "currency") return country.nationalIdentity?.currency ?? "N/A";
  if (f === "currencysymbol") return country.nationalIdentity?.currencySymbol ?? "N/A";
  if (f === "land_area" || f === "landarea") return fmtNum(country.landArea ?? 0) + " km\u00B2";
  if (f === "name") return country.name ?? "N/A";
  if (f === "flag_url" || f === "flagurl" || f === "flag") return country.flag ?? "";

  // Try direct property access as fallback
  const record = country as unknown as Record<string, unknown>;
  if (record[f] != null) {
    const v = record[f];
    if (typeof v === "number") return fmtNum(v);
    return String(v);
  }
  return "N/A";
}

function resolveBusinessField(poi: PointOfInterest, field: string): string {
  const f = field.toLowerCase();
  if (f === "revenue") return "Data unavailable";
  if (f === "employees") return "Data unavailable";
  if (f === "sector" || f === "industry") return poi.category ?? "N/A";
  if (f === "founded") {
    const meta = poi.metadata as Record<string, unknown> | null;
    return meta?.founded ? String(meta.founded) : "N/A";
  }
  return "N/A";
}

export const ixstatsTemplateProvider: TemplateDataProvider = {
  name: "ixstats-game-data",
  canHandle(category: string): boolean {
    const cat = category.toLowerCase();
    return cat === "mycountry" || cat === "countrydata" || cat === "businessdata";
  },
  async resolve(
    keys: readonly TemplateKey[],
    opts: ResolveOptions = {}
  ): Promise<Map<string, ResolvedTemplate>> {
    const results = new Map<string, ResolvedTemplate>();
    if (keys.length === 0) return results;

    const myCountryKeys = keys.filter((k) => k.category === "mycountry");
    const countryKeys = keys.filter((k) => k.category === "countrydata");
    const businessKeys = keys.filter((k) => k.category === "businessdata");

    const countryNames = new Set(countryKeys.map((k) => k.target).filter(Boolean));
    const businessNames = new Set(businessKeys.map((k) => k.target).filter(Boolean));

    const [userCountry, countries, pois] = await Promise.all([
      opts.activeCountryId
        ? prisma.country.findUnique({
            where: { id: opts.activeCountryId },
            include: { nationalIdentity: true },
          })
        : null,
      countryNames.size > 0
        ? prisma.country.findMany({
            where: { name: { in: Array.from(countryNames) } },
            include: { nationalIdentity: true },
          })
        : [],
      businessNames.size > 0
        ? prisma.pointOfInterest.findMany({
            where: { name: { in: Array.from(businessNames) }, status: "approved" },
          })
        : [],
    ]);

    for (const key of myCountryKeys) {
      if (userCountry) {
        const value = resolveCountryField(userCountry, key.field);
        results.set(key.key, { key: key.key, value });
      } else {
        results.set(key.key, { key: key.key, value: "\u2014" });
      }
    }

    const countryMap = new Map(countries.map((c) => [c.name.toLowerCase(), c]));
    for (const key of countryKeys) {
      const country = countryMap.get(key.target.toLowerCase());
      if (country) {
        const value = resolveCountryField(country, key.field);
        results.set(key.key, { key: key.key, value });
      } else {
        results.set(key.key, { key: key.key, value: "N/A" });
      }
    }

    const businessMap = new Map(pois.map((p) => [p.name.toLowerCase(), p]));
    for (const key of businessKeys) {
      const poi = businessMap.get(key.target.toLowerCase());
      if (poi) {
        const value = resolveBusinessField(poi, key.field);
        results.set(key.key, { key: key.key, value });
      } else {
        results.set(key.key, { key: key.key, value: "N/A" });
      }
    }

    return results;
  },
};
