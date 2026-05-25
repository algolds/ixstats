/**
 * data-authority.ts — Per-field data authority resolution.
 *
 * Determines which system (wiki, stats, user, admin) is authoritative
 * for each data field. When conflicts arise between wiki infobox data
 * and stats engine calculations, this resolver determines which wins.
 *
 * Default for IxWorld: wiki is lore authority (government, capital, etc),
 * stats engine is simulation authority (population, GDP, growth rates).
 * Configurable per-world via WorldConfig.dataAuthority JSON field.
 */

export type AuthoritySource = "wiki" | "stats" | "user" | "admin";

export interface AuthorityConfig {
  /** Per-field authority mapping */
  fields: Record<string, AuthoritySource>;
  /** Default authority when a field isn't explicitly mapped */
  defaultAuthority: AuthoritySource;
}

/** IxWorld default: wiki for lore, stats for simulation, user for cosmetics */
export const IXWORLD_AUTHORITY: AuthorityConfig = {
  defaultAuthority: "wiki",
  fields: {
    // Wiki-authoritative (lore — humans write these)
    official_name: "wiki",
    government_type: "wiki",
    leader_name: "wiki",
    leader_title: "wiki",
    capital: "wiki",
    largest_city: "wiki",
    currency: "wiki",
    official_languages: "wiki",
    founded: "wiki",
    national_motto: "wiki",
    national_anthem: "wiki",
    religion: "wiki",
    ethnic_groups: "wiki",
    demonym: "wiki",

    // Stats-authoritative (simulation — engine computes these)
    population: "stats",
    current_population: "stats",
    gdp_per_capita: "stats",
    gdp_nominal: "stats",
    gdp_growth: "stats",
    unemployment_rate: "stats",
    inflation_rate: "stats",
    trade_balance: "stats",
    labor_force: "stats",
    economic_vitality: "stats",
    infrastructure_rating: "stats",
    population_growth_rate: "stats",
    life_expectancy: "stats",
    literacy_rate: "stats",
    urbanization: "stats",

    // User-authoritative (player choices — users set these)
    flag: "user",
    coat_of_arms: "user",
    national_colors: "user",

    // Admin-authoritative (system owner only)
    area_km2: "admin",
    coastline_km: "admin",
    continent: "admin",
    region: "admin",
    economic_tier: "admin",
  },
};

/**
 * Get the authoritative source for a given field.
 */
export function getAuthority(
  field: string,
  config: AuthorityConfig = IXWORLD_AUTHORITY
): AuthoritySource {
  // Normalize field name: "GDP_nominal" → "gdp_nominal"
  const normalized = field.toLowerCase().replace(/[\s-]/g, "_");
  return config.fields[normalized] ?? config.defaultAuthority;
}

/**
 * Check if a given source can override a field's current value.
 * Higher authority sources can override lower ones.
 * admin > stats > wiki > user
 */
export function canOverride(
  field: string,
  source: AuthoritySource,
  config: AuthorityConfig = IXWORLD_AUTHORITY
): boolean {
  const authority = getAuthority(field, config);

  // Same source can always write
  if (source === authority) return true;

  // Admin can override anything
  if (source === "admin") return true;

  // Stats can override wiki and user (simulation trumps manual entry)
  if (source === "stats" && (authority === "wiki" || authority === "user")) return false;

  // Wiki cannot override stats
  if (source === "wiki" && authority === "stats") return false;

  // User can only write user-authoritative fields
  if (source === "user" && authority !== "user") return false;

  return source === authority;
}

/**
 * Build an AuthorityConfig from a WorldConfig.dataAuthority JSON value.
 * Falls back to IXWORLD_AUTHORITY for any unmapped fields.
 */
export function buildAuthorityConfig(
  worldConfigData: Record<string, string> | null | undefined
): AuthorityConfig {
  if (!worldConfigData) return IXWORLD_AUTHORITY;

  const fields: Record<string, AuthoritySource> = { ...IXWORLD_AUTHORITY.fields };

  for (const [key, value] of Object.entries(worldConfigData)) {
    if (["wiki", "stats", "user", "admin"].includes(value)) {
      fields[key.toLowerCase().replace(/[\s-]/g, "_")] = value as AuthoritySource;
    }
  }

  return {
    defaultAuthority:
      (worldConfigData["_default"] as AuthoritySource) ?? IXWORLD_AUTHORITY.defaultAuthority,
    fields,
  };
}

/**
 * Given a set of field diffs between wiki and stats, determine which
 * changes should be applied and which should be flagged as conflicts.
 */
export interface SyncDiff {
  field: string;
  wikiValue: unknown;
  statsValue: unknown;
  authority: AuthoritySource;
  action: "apply_wiki" | "apply_stats" | "conflict" | "skip";
}

export function resolveSyncDiffs(
  diffs: Array<{ field: string; wikiValue: unknown; statsValue: unknown }>,
  config: AuthorityConfig = IXWORLD_AUTHORITY
): SyncDiff[] {
  return diffs.map((diff) => {
    const authority = getAuthority(diff.field, config);

    let action: SyncDiff["action"];
    if (authority === "wiki") {
      action = "apply_wiki"; // wiki value wins
    } else if (authority === "stats") {
      action = "apply_stats"; // stats value wins
    } else if (authority === "admin") {
      action = "conflict"; // admin must resolve manually
    } else {
      action = "skip"; // user fields not synced
    }

    return { ...diff, authority, action };
  });
}
