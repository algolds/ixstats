/**
 * A realm's source sync configuration (RealmSourceSync): what a run may change, how often it runs, the continent
 * table and staff overrides per source key. Client-safe (the admin panel and the founder's Manage section edit it).
 * Nothing here names a realm or a source: those values live in each realm's row, filled once from a preset.
 */
import { z } from "zod";

/** Where a source's files are read from. Only public GitHub repositories (raw.githubusercontent.com) today. */
export const SOURCE_PROVIDERS = ["github"] as const;
export type SourceProvider = (typeof SOURCE_PROVIDERS)[number];

/** The alliance types the diplomacy system knows (Alliance.type). */
export const ALLIANCE_TYPES = ["military", "economic", "political", "regional"] as const;
export type AllianceType = (typeof ALLIANCE_TYPES)[number];

/** Schedule choices the settings offer; any whole number of hours from 1 to MAX_SYNC_INTERVAL_HOURS also works. */
export const SYNC_INTERVAL_PRESETS = [
  { hours: 6, label: "Every 6 hours" },
  { hours: 12, label: "Every 12 hours" },
  { hours: 24, label: "Daily" },
  { hours: 168, label: "Weekly" },
] as const;
export const MAX_SYNC_INTERVAL_HOURS = 24 * 90;

/** GitHub `owner/repo`: GitHub's own character rules, never "." or ".." as a part. */
export const repoSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/(?!\.\.?$)[A-Za-z0-9._-]{1,100}$/,
    "Use owner/repo (letters, digits, hyphens, dots, underscores)"
  );

/** A branch, tag or commit: no "..", no leading or trailing slash, no spaces. */
export const refSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._/-]+$/, "Letters, digits, dots, hyphens, underscores and slashes only")
  .refine((ref) => !ref.includes("..") && !ref.startsWith("/") && !ref.endsWith("/"), "Not a valid ref");

/** A file path inside the repository: relative, no "..", no backslashes or control characters. */
export const repoPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine(
    (path) =>
      !path.startsWith("/") &&
      !path.includes("\\") &&
      // oxlint-disable-next-line no-control-regex -- refusing control characters is the point
      !/[\u0000-\u001f\u007f]/.test(path) &&
      path.split("/").every((part) => part !== "" && part !== "." && part !== ".."),
    "Use a relative path inside the repository (no .., no leading slash)"
  );

/** A nation or organisation key in a source (nations.js keys, organisation ids). */
export const sourceKeySchema = z
  .string()
  .min(1)
  .max(120)
  // oxlint-disable-next-line no-control-regex -- keys become feature ids and URLs
  .refine((key) => !/[\u0000-\u001f\u007f]/.test(key), "No control characters");

/** A continent: free text, as the realm names it. Blank means unknown. */
export const continentNameSchema = z.string().trim().max(100);

/**
 * What a run may change. Each field falls back to its default on a bad stored value, so an old or hand-edited
 * row never stops a run.
 */
export const realmSyncOptionsSchema = z.object({
  /** Create unclaimed nations for source entries no country matches. */
  addNewNations: z.boolean().default(true).catch(true),
  /** Create unclaimed nations for the realm's roster pages (lore index nations) the source does not list. */
  addRosterNations: z.boolean().default(true).catch(true),
  /** New nations take what the source lacks (and flag, arms, leader, identity) from their wiki page's infobox. */
  useWikiInfobox: z.boolean().default(true).catch(true),
  /** Keep unclaimed nations' population, GDP per capita, land area, capital and official name in step. */
  updateUnclaimedStats: z.boolean().default(true).catch(true),
  /** Also overwrite claimed nations' figures (players' own numbers). Off by default. */
  updateClaimedStats: z.boolean().default(false).catch(false),
  /** Import the source's borders into the realm's map and link them to their nations. */
  updateBorders: z.boolean().default(true).catch(true),
  /** Create the source's organisations as realm alliances and add their member nations. */
  syncAlliances: z.boolean().default(true).catch(true),
  /** Set nations' continents from the realm's continent table. */
  applyContinents: z.boolean().default(true).catch(true),
  /** Nations the source no longer lists: "flag" lists them in the run summary; "ignore" says nothing. Never deleted. */
  missingNations: z.enum(["ignore", "flag"]).default("flag").catch("flag"),
});
export type RealmSyncOptions = z.infer<typeof realmSyncOptionsSchema>;

export const DEFAULT_SYNC_OPTIONS: RealmSyncOptions = realmSyncOptionsSchema.parse({});

/** The fields a run writes per nation, each of which staff can pin on a nation so the sync never overwrites it. */
export const SYNC_FIELDS = [
  "population",
  "gdpPerCapita",
  "landArea",
  "capital",
  "officialName",
  "continent",
  "borders",
] as const;
export type SyncField = (typeof SYNC_FIELDS)[number];

export const SYNC_FIELD_LABELS: Record<SyncField, string> = {
  population: "Population",
  gdpPerCapita: "GDP per capita",
  landArea: "Land area",
  capital: "Capital",
  officialName: "Official name",
  continent: "Continent",
  borders: "Borders",
};

/** Staff decisions for one source nation. */
export const nationOverrideSchema = z.object({
  /** Never create, match or update anything from this key. */
  exclude: z.boolean().optional(),
  /** Match this key to this country of the realm (a manual match), whatever the names say. */
  countryId: z.string().min(1).max(100).optional(),
  /** Fields the sync never overwrites on this nation. */
  lockedFields: z.array(z.enum(SYNC_FIELDS)).max(SYNC_FIELDS.length).optional(),
});
export type NationOverride = z.infer<typeof nationOverrideSchema>;

/** Staff decisions for one source organisation. */
export const organizationOverrideSchema = z.object({
  exclude: z.boolean().optional(),
  /** The alliance type staff chose; wins over the name rules. */
  type: z.enum(ALLIANCE_TYPES).optional(),
});
export type OrganizationOverride = z.infer<typeof organizationOverrideSchema>;

export const realmSyncOverridesSchema = z.object({
  nations: z.record(sourceKeySchema, nationOverrideSchema).default({}).catch({}),
  organizations: z.record(sourceKeySchema, organizationOverrideSchema).default({}).catch({}),
});
export type RealmSyncOverrides = z.infer<typeof realmSyncOverridesSchema>;

/** Source nation key → continent. Blank continents are dropped (unknown). */
export const continentMapSchema = z
  .record(sourceKeySchema, continentNameSchema)
  .transform((map) =>
    Object.fromEntries(Object.entries(map).filter(([, continent]) => continent.length > 0))
  );
export type ContinentMap = Record<string, string>;

/** Read a stored JSON column with its schema; a value that does not parse gives the empty default. */
export function readOverrides(json: unknown): RealmSyncOverrides {
  const parsed = realmSyncOverridesSchema.safeParse(json ?? {});
  return parsed.success ? parsed.data : { nations: {}, organizations: {} };
}

export function readOptions(json: unknown): RealmSyncOptions {
  const parsed = realmSyncOptionsSchema.safeParse(json ?? {});
  return parsed.success ? parsed.data : DEFAULT_SYNC_OPTIONS;
}

export function readContinentMap(json: unknown): ContinentMap {
  const parsed = continentMapSchema.safeParse(json ?? {});
  return parsed.success ? parsed.data : {};
}

/** The hours between scheduled runs: null (manual only) or 1 to MAX_SYNC_INTERVAL_HOURS. */
export const intervalHoursSchema = z.number().int().min(1).max(MAX_SYNC_INTERVAL_HOURS).nullable();
