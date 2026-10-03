// Authoritative canonical resolver for CountryData/BusinessData/MyCountry placeholders across reads, previews, and writes.

import type { Prisma } from "@prisma/client";
import { resolveActiveCountryId } from "~/lib/wiki-os/storage";
import type { WikiAuthContext } from "~/lib/wiki-os/auth";
import { formatNumber, formatCurrency } from "~/lib/utils/format-utils";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";

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

type PlaceholderStatus =
  "resolved" | "not-found" | "missing-context" | "unknown-field" | "malformed";

interface CanonicalPlaceholderResult {
  key: string;
  value: string;
  rawVal: unknown;
  status: PlaceholderStatus;
  metadata?: WikiPlaceholderMetadata;
}

interface RankRow {
  id: string;
  realmId: string;
}

/** A country's rank within its own realm (ruling E-h): an Eurth nation is never ranked against IxWorld. */
function realmRankLabel(sorted: readonly RankRow[], country: RankRow): string | undefined {
  const index = sorted
    .filter((c) => c.realmId === country.realmId)
    .findIndex((c) => c.id === country.id);
  return index !== -1 ? `Ranked #${index + 1} globally` : undefined;
}

/** BusinessData placeholder fields: the point-of-interest metadata key each one reads. */
const BUSINESS_FIELDS: Record<
  string,
  { key: string; label: string; timed?: boolean; format: (v: number | string) => string }
> = {
  revenue: {
    key: "revenue",
    label: "Annual Revenue",
    timed: true,
    format: (v) => formatCurrency(Number(v)),
  },
  employees: {
    key: "employees",
    label: "Employees",
    timed: true,
    format: (v) => Number(v).toLocaleString(),
  },
  sector: { key: "sector", label: "Industry Sector", format: String },
  industry: { key: "sector", label: "Industry Sector", format: String },
  founded: { key: "founded", label: "Year Founded", format: String },
};

type CountryRecord = RankRow & Record<string, any>;
type RankLists = { pop: readonly RankRow[]; gdp: readonly RankRow[] };

const pct = (v: unknown) => (v != null ? `${(Number(v) * 100).toFixed(1)}%` : "N/A");
const str = (v: unknown) => (v != null ? String(v) : "N/A");
const text = (v: unknown) => (v != null && String(v).trim() ? String(v) : "N/A");
const optional = (v: unknown) => (v != null ? String(v) : "");

interface CountryFieldSpec {
  /** Lower-cased field names that resolve to this spec. */
  aliases: string[];
  label: string;
  read: (c: CountryRecord) => unknown;
  format: (v: unknown) => string;
  rank?: keyof RankLists;
}

const COUNTRY_FIELDS: CountryFieldSpec[] = [
  {
    aliases: ["currentpopulation", "population"],
    label: "Population",
    read: (c) => c.currentPopulation,
    format: (v) => formatNumber(Number(v ?? 0)),
    rank: "pop",
  },
  {
    aliases: ["currenttotalgdp", "gdp"],
    label: "Total GDP",
    read: (c) => c.currentTotalGdp,
    format: (v) => formatCurrency(Number(v ?? 0)),
    rank: "gdp",
  },
  {
    aliases: ["currentgdppercapita", "gdppercapita", "gdp_per_capita"],
    label: "GDP per Capita",
    read: (c) =>
      c.currentGdpPerCapita ??
      (c.currentTotalGdp && c.currentPopulation ? c.currentTotalGdp / c.currentPopulation : 0),
    format: (v) => formatCurrency(Number(v ?? 0)),
  },
  {
    aliases: ["adjustedgdpgrowth", "gdpgrowth", "gdp_growth"],
    label: "GDP Growth",
    read: (c) => c.adjustedGdpGrowth ?? 0,
    format: pct,
  },
  {
    aliases: ["unemploymentrate", "unemployment"],
    label: "Unemployment Rate",
    read: (c) => c.unemploymentRate,
    format: pct,
  },
  {
    aliases: ["inflationrate", "inflation"],
    label: "Inflation Rate",
    read: (c) => c.inflationRate,
    format: pct,
  },
  {
    aliases: ["politicalstability", "stability"],
    label: "Political Stability",
    read: (c) => c.politicalStability,
    format: str,
  },
  {
    aliases: ["economictier", "tier"],
    label: "Economic Tier",
    read: (c) => c.economicTier,
    format: str,
  },
  {
    aliases: ["populationtier"],
    label: "Population Tier",
    read: (c) => c.populationTier,
    format: str,
  },
  { aliases: ["leader", "leadername"], label: "Leader", read: (c) => c.leader, format: text },
  {
    aliases: ["governmenttype", "government"],
    label: "Government Type",
    read: (c) => c.governmentType ?? c.nationalIdentity?.governmentType,
    format: text,
  },
  { aliases: ["motto"], label: "Motto", read: (c) => c.nationalIdentity?.motto, format: text },
  {
    aliases: ["capitalcity", "capital"],
    label: "Capital City",
    read: (c) => c.nationalIdentity?.capitalCity,
    format: text,
  },
  {
    aliases: ["currency"],
    label: "Currency",
    read: (c) => c.nationalIdentity?.currency,
    format: text,
  },
  {
    aliases: ["currencysymbol"],
    label: "Currency Symbol",
    read: (c) => c.nationalIdentity?.currencySymbol,
    format: optional,
  },
  {
    aliases: ["land_area", "landarea"],
    label: "Land Area",
    read: (c) => c.landArea,
    format: (v) => `${formatNumber(Number(v ?? 0))} km\u00B2`,
  },
  {
    aliases: ["flag_url", "flagurl", "flag"],
    label: "Flag URL",
    read: (c) => c.flag,
    format: optional,
  },
  { aliases: ["name"], label: "Name", read: (c) => c.name, format: str },
];

const COUNTRY_FIELD_BY_ALIAS = new Map(
  COUNTRY_FIELDS.flatMap((spec) => spec.aliases.map((alias) => [alias, spec] as const))
);

/** Falls back to any raw column on the country or its national identity. */
function readRawCountryField(country: CountryRecord, field: string) {
  if (country[field] !== undefined) {
    const val: unknown = country[field];
    return { val, formatted: typeof val === "number" ? formatNumber(val) : String(val ?? "N/A") };
  }
  const identityVal: unknown = country.nationalIdentity?.[field];
  if (identityVal !== undefined) return { val: identityVal, formatted: str(identityVal) };
  return null;
}

function resolveCountryField(
  placeholder: string,
  country: CountryRecord,
  field: string,
  ranks: RankLists
): CanonicalPlaceholderResult {
  const spec = COUNTRY_FIELD_BY_ALIAS.get(field.toLowerCase());
  let val: unknown = null;
  let formatted = "Unknown Field";
  let label = field;
  let status: PlaceholderStatus = "unknown-field";

  if (spec) {
    val = spec.read(country);
    formatted = spec.format(val);
    label = spec.label;
    status = "resolved";
  } else {
    const raw = readRawCountryField(country, field);
    if (raw) {
      val = raw.val;
      formatted = raw.formatted;
      status = "resolved";
    }
  }

  const numericVal = typeof val === "number" ? val : 0;
  const isGrowth = field.includes("Growth");
  const isGdp = field === "gdp" || field === "currentTotalGdp";

  return {
    key: placeholder,
    value: formatted,
    rawVal: val,
    status,
    metadata: {
      label,
      countryName: country.name,
      growthTrend: isGrowth && numericVal < 0 ? "down" : isGrowth && numericVal > 0 ? "up" : "flat",
      growthRate: isGdp ? `${((country.adjustedGdpGrowth ?? 0) * 100).toFixed(1)}%` : undefined,
      lastCalculated:
        country.lastCalculated instanceof Date
          ? country.lastCalculated.toISOString()
          : new Date().toISOString(),
      detailsUrl: `/countries/${country.id}`,
      comparisonRank: spec?.rank && realmRankLabel(ranks[spec.rank], country),
    },
  };
}

const failure = (
  key: string,
  value: string,
  status: PlaceholderStatus
): CanonicalPlaceholderResult => ({ key, value, rawVal: null, status });

/** The `Name_With_Underscores` segment of a `Kind:Name:field` placeholder, spaced. */
const placeholderName = (p: string) => p.split(":")[1]?.replace(/_/g, " ");

const nameKey = (name: string) => name.toLowerCase();

function resolveBusinessField(
  p: string,
  pois: PoiRecord[],
  countries: CountryRecord[]
): CanonicalPlaceholderResult {
  const companyName = placeholderName(p);
  const field = p.split(":")[2];
  if (!companyName || !field) return failure(p, "Unknown Field", "malformed");

  const poi = pois.find((item) => nameKey(item.name) === nameKey(companyName));
  if (!poi) return failure(p, "Unknown Company", "not-found");

  const spec = BUSINESS_FIELDS[field.toLowerCase()];
  if (!spec) return failure(p, "Unknown Field", "unknown-field");

  // Business figures exist only when recorded on the point of interest; none are derived.
  const recorded = (poi.metadata as Record<string, unknown> | null)?.[spec.key];
  const rawVal =
    typeof recorded === "number" || (typeof recorded === "string" && recorded.trim() !== "")
      ? recorded
      : null;
  if (rawVal === null) return failure(p, "—", "not-found");

  const parentCountry = countries.find((c) => c.id === poi.countryId) || poi.country;
  const lastCalculated =
    parentCountry?.lastCalculated instanceof Date
      ? parentCountry.lastCalculated.toISOString()
      : undefined;
  return {
    key: p,
    value: spec.format(rawVal),
    rawVal,
    status: "resolved",
    metadata: {
      label: spec.label,
      companyName,
      countryName: parentCountry?.name,
      ...(spec.timed && lastCalculated ? { lastCalculated } : {}),
      detailsUrl: `/countries/${poi.countryId}`,
    },
  };
}

type PoiRecord = { name: string; countryId: string; metadata: unknown; country?: any };

export async function resolveWikiPlaceholderValues(
  placeholders: readonly string[],
  db: Prisma.TransactionClient | any,
  activeCountryId?: string
): Promise<CanonicalPlaceholderResult[]> {
  if (placeholders.length === 0) return [];

  const namesFor = (prefix: string) => [
    ...new Set(
      placeholders
        .filter((p) => p.startsWith(prefix))
        .map((p) => placeholderName(p))
        .filter((name): name is string => !!name)
        .map(nameKey)
    ),
  ];
  const countryNames = namesFor("CountryData:");
  const companyNames = namesFor("BusinessData:");

  // Fetch all required countries in a single query
  const countries: CountryRecord[] = await db.country.findMany({
    where: {
      OR: [
        ...(activeCountryId ? [{ id: activeCountryId }] : []),
        // CountryData:<name> names an IxWorld nation — names repeat across realms (ruling E-p).
        ...(countryNames.length > 0
          ? [{ realmId: DEFAULT_REALM_ID, name: { in: countryNames, mode: "insensitive" } }]
          : []),
      ],
    },
    include: { nationalIdentity: true },
  });
  const userCountry = activeCountryId ? countries.find((c) => c.id === activeCountryId) : null;

  // Fetch all POIs for businesses in a single query
  const pois: PoiRecord[] =
    companyNames.length > 0
      ? await db.pointOfInterest.findMany({
          where: { name: { in: companyNames, mode: "insensitive" }, status: "approved" },
          include: { country: true },
        })
      : [];

  // Country rank lists are only needed for gdp/population placeholders
  const hasRankNeed = placeholders.some((p) => /gdp|population/i.test(p));
  const [gdp, pop]: RankRow[][] = hasRankNeed
    ? await Promise.all([
        db.country.findMany({
          select: { id: true, realmId: true, currentTotalGdp: true },
          orderBy: { currentTotalGdp: "desc" },
        }),
        db.country.findMany({
          select: { id: true, realmId: true, currentPopulation: true },
          orderBy: { currentPopulation: "desc" },
        }),
      ])
    : [[], []];
  const ranks: RankLists = { gdp, pop };

  return placeholders.map((p) => {
    if (p.startsWith("MyCountry:")) {
      const field = p.split(":")[1];
      if (!field) return failure(p, "Unknown Field", "malformed");
      if (!userCountry) return failure(p, "No Country Loaded", "missing-context");
      return resolveCountryField(p, userCountry, field, ranks);
    }
    if (p.startsWith("CountryData:")) {
      const cName = placeholderName(p);
      const field = p.split(":")[2];
      if (!cName || !field) return failure(p, "Unknown Field", "malformed");
      const country = countries.find(
        (c) => c.realmId === DEFAULT_REALM_ID && nameKey(c.name) === nameKey(cName)
      );
      if (!country) return failure(p, "Unknown Country", "not-found");
      return resolveCountryField(p, country, field, ranks);
    }
    if (p.startsWith("BusinessData:")) return resolveBusinessField(p, pois, countries);
    return failure(p, "Unknown Field", "malformed");
  });
}

export async function resolveWikiPlaceholdersInternal(
  placeholders: string[],
  ctx: { db: Prisma.TransactionClient | typeof import("~/server/db").db } & WikiAuthContext,
  activeCountryId?: string
): Promise<Record<string, { value: string; rawVal: unknown; metadata?: WikiPlaceholderMetadata }>> {
  const userCountryId = activeCountryId ?? (await resolveActiveCountryId(ctx)) ?? undefined;
  const results = await resolveWikiPlaceholderValues(placeholders, ctx.db, userCountryId);
  return Object.fromEntries(
    results.map(({ key, value, rawVal, metadata }) => [key, { value, rawVal, metadata }])
  );
}
