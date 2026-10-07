/**
 * The diff of one source sync run, computed without touching the database: which nations to create (from the
 * source, or from roster pages the source does not list), which figures change on which nations, which borders
 * and alliances to write, which nations the source no longer lists, and every case left to staff. A dry run
 * stores this plan; an applied run executes it (src/server/modules/realms/realms.source-apply.ts).
 *
 * Precedence for a new nation's figures: the source's figures, then the wiki infobox (read at apply time), then
 * the baseline defaults. A claimed nation's figures change only when `updateClaimedStats` is on; a field staff
 * pinned on a nation never changes.
 */
import type { SourceFeature, SourceNation, SourceSnapshot } from "./adapters/types";
import type {
  AllianceType,
  ContinentMap,
  RealmSyncOptions,
  RealmSyncOverrides,
  SyncField,
} from "./config";
import {
  matchSourceNations,
  normalizeNationName,
  rosterOnlyPages,
  type MatchCandidate,
  type MatchablePage,
} from "./matching";

export interface PlanCountry {
  id: string;
  name: string;
  ownerUserId: string | null;
  externalSourceKey: string | null;
  wikiPageTitle: string | null;
  baselinePopulation: number;
  baselineGdpPerCapita: number;
  landArea: number | null;
  continent: string | null;
  capital: string | null;
  officialName: string | null;
}

export interface PlanFeature {
  featureId: string;
  countryId: string | null;
  sourceHash: string | null;
}

export interface PlanAlliance {
  id: string;
  name: string;
  shortName: string | null;
  color: string;
  type: string;
  externalSourceKey: string | null;
  activeMemberIds: string[];
}

export interface PlanInput {
  snapshot: SourceSnapshot;
  countries: readonly PlanCountry[];
  rosterPages: readonly MatchablePage[];
  features: readonly PlanFeature[];
  alliances: readonly PlanAlliance[];
  /** Political features already linked to each country (any feature id), to avoid giving a nation two regions. */
  linkedFeatureByCountry: Readonly<Record<string, string>>;
  options: RealmSyncOptions;
  overrides: RealmSyncOverrides;
  continentMap: ContinentMap;
  /** The realm wiki (a WikiOS source id) the nations' page titles are on; null when the source names none. */
  wikiSource: string | null;
}

/** A nation the plan creates, or an existing one, as later steps refer to it. */
export type NationRef = { countryId: string } | { newName: string };

export interface PlannedNation {
  name: string;
  /** The source key; null for a roster page the source does not list. */
  key: string | null;
  from: "source" | "roster";
  wikiTitle: string | null;
  officialName: string | null;
  capital: string | null;
  population: number | null;
  gdpPerCapita: number | null;
  landArea: number | null;
  continent: string | null;
  /** Read the wiki infobox at apply time for what the source lacks, and for flag, arms, leader and identity. */
  readInfobox: boolean;
}

export interface FieldChange {
  field: SyncField;
  from: string | number | null;
  to: string | number;
}

export interface PlannedUpdate {
  countryId: string;
  name: string;
  key: string;
  claimed: boolean;
  /** Store the source key on the country (it was matched by name or by hand). */
  bindKey: boolean;
  changes: FieldChange[];
}

export interface PlannedFeature {
  key: string;
  nation: NationRef | null;
  geometry: SourceFeature["geometry"];
  areaKm2: number | null;
  sourceHash: string;
  /** "create": new feature; "update": geometry changed; "link": unchanged geometry, newly linked. */
  action: "create" | "update" | "link";
  /** Stated land area wins: the traced area is written to the nation only when it has none. */
  setLandArea: boolean;
}

export interface PlannedAlliance {
  key: string;
  allianceId: string | null;
  name: string;
  shortName: string | null;
  color: string | null;
  type: AllianceType | null;
  /** Fields that change on an existing alliance. */
  changes: string[];
  addMembers: { nation: NationRef; name: string }[];
  /** Active members the source does not list: reported, never removed. */
  notInSource: string[];
}

export interface UnmatchedEntry {
  key: string;
  name: string;
  reason: string;
  candidates: MatchCandidate[];
}

export interface SyncPlan {
  creates: PlannedNation[];
  updates: PlannedUpdate[];
  /** Claimed nations whose figures differ from the source but are left alone (`updateClaimedStats` off). */
  skippedClaimed: { countryId: string; name: string; fields: SyncField[] }[];
  /** Nations with fields staff pinned, which the source would have changed. */
  locked: { countryId: string; name: string; fields: SyncField[] }[];
  features: PlannedFeature[];
  featuresUnchanged: number;
  alliances: PlannedAlliance[];
  unknownMembers: { organization: string; member: string; reason: string }[];
  missing: { countryId: string; name: string; key: string }[];
  unmatched: UnmatchedEntry[];
  excluded: string[];
  warnings: string[];
  counts: {
    sourceNations: number;
    matched: number;
    create: number;
    update: number;
    features: number;
    alliances: number;
    unmatched: number;
    missing: number;
  };
}

/** A short stable fingerprint of a geometry (FNV-1a over its JSON), to tell a changed border from an unchanged one. */
export function geometryHash(geometry: unknown): string {
  const text = JSON.stringify(geometry);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16).padStart(8, "0")}:${text.length}`;
}

const sameNumber = (a: number | null, b: number) =>
  a !== null && Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 1e-9;

/** What the source says each sync field should be for one nation (nulls are "the source does not say"). */
function sourceValues(
  nation: SourceNation,
  feature: SourceFeature | undefined,
  continent: string | null
): Record<Exclude<SyncField, "borders">, string | number | null> {
  return {
    population: nation.population,
    gdpPerCapita: nation.gdpPerCapita,
    landArea: nation.landArea ?? feature?.areaKm2 ?? null,
    capital: nation.capital,
    officialName: nation.officialName,
    continent,
  };
}

function currentValues(country: PlanCountry): Record<Exclude<SyncField, "borders">, string | number | null> {
  return {
    population: country.baselinePopulation,
    gdpPerCapita: country.baselineGdpPerCapita,
    landArea: country.landArea,
    capital: country.capital,
    officialName: country.officialName,
    continent: country.continent,
  };
}

function diffFields(
  wanted: ReturnType<typeof sourceValues>,
  current: ReturnType<typeof currentValues>,
  applyContinents: boolean
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of Object.keys(wanted) as Array<keyof typeof wanted>) {
    const to = wanted[field];
    if (to === null || (field === "continent" && !applyContinents)) continue;
    const from = current[field];
    const same = typeof to === "number" ? sameNumber(from as number | null, to) : from === to;
    if (!same) changes.push({ field, from, to });
  }
  return changes;
}

export function planSourceSync(input: PlanInput): SyncPlan {
  const { snapshot, options, overrides, continentMap } = input;
  const warnings = [...snapshot.warnings];
  const nationOverrides = overrides.nations;
  const featureByKey = new Map(snapshot.features.map((f) => [f.key, f]));
  const countryById = new Map(input.countries.map((c) => [c.id, c]));
  const matches = matchSourceNations(snapshot.nations, input.countries, input.rosterPages, nationOverrides);
  const usedNames = new Set(input.countries.map((c) => c.name));
  const refByKey = new Map<string, NationRef>();
  const plan: SyncPlan = {
    creates: [],
    updates: [],
    skippedClaimed: [],
    locked: [],
    features: [],
    featuresUnchanged: 0,
    alliances: [],
    unknownMembers: [],
    missing: [],
    unmatched: [],
    excluded: [],
    warnings,
    counts: { sourceNations: snapshot.nations.length, matched: 0, create: 0, update: 0, features: 0, alliances: 0, unmatched: 0, missing: 0 },
  };
  const continentOf = (key: string) => continentMap[key]?.trim() || null;
  const readInfobox = (title: string | null) => options.useWikiInfobox && !!title && !!input.wikiSource;

  for (const nation of snapshot.nations) {
    const match = matches.get(nation.key)!;
    const lockedFields = new Set(nationOverrides[nation.key]?.lockedFields ?? []);
    if (match.kind === "excluded") {
      plan.excluded.push(nation.key);
      continue;
    }
    if (match.kind === "ambiguous") {
      plan.unmatched.push({ key: nation.key, name: nation.displayName, reason: match.reason, candidates: match.candidates });
      continue;
    }
    if (match.kind === "country") {
      plan.counts.matched++;
      const country = countryById.get(match.countryId)!;
      refByKey.set(nation.key, { countryId: country.id });
      const claimed = country.ownerUserId !== null;
      const wanted = sourceValues(nation, featureByKey.get(nation.key), continentOf(nation.key));
      const all = diffFields(wanted, currentValues(country), options.applyContinents);
      const pinned = all.filter((c) => lockedFields.has(c.field));
      const free = all.filter((c) => !lockedFields.has(c.field));
      const allowed = claimed ? options.updateClaimedStats : options.updateUnclaimedStats;
      if (pinned.length > 0)
        plan.locked.push({ countryId: country.id, name: country.name, fields: pinned.map((c) => c.field) });
      if (!allowed && free.length > 0)
        plan.skippedClaimed.push({ countryId: country.id, name: country.name, fields: free.map((c) => c.field) });
      const changes = allowed ? free : [];
      const bindKey = country.externalSourceKey !== nation.key;
      if (changes.length > 0 || bindKey)
        plan.updates.push({ countryId: country.id, name: country.name, key: nation.key, claimed, bindKey, changes });
      continue;
    }
    // A new nation: named after its roster page when one matched, else the source's display name.
    const name = match.kind === "page" ? match.pageTitle : nation.displayName;
    if (!options.addNewNations) {
      plan.unmatched.push({ key: nation.key, name, reason: "New in the source; adding new nations is off", candidates: [] });
      continue;
    }
    if (usedNames.has(name)) {
      plan.unmatched.push({
        key: nation.key,
        name,
        reason: `A nation named "${name}" already exists but is matched to another source entry`,
        candidates: input.countries.filter((c) => c.name === name).map((c) => ({ countryId: c.id, name: c.name })),
      });
      continue;
    }
    usedNames.add(name);
    const wikiTitle = match.kind === "page" ? match.pageTitle : nation.wikiTitle;
    const wanted = sourceValues(nation, featureByKey.get(nation.key), options.applyContinents ? continentOf(nation.key) : null);
    plan.creates.push({
      name,
      key: nation.key,
      from: "source",
      wikiTitle,
      officialName: wanted.officialName as string | null,
      capital: wanted.capital as string | null,
      population: wanted.population as number | null,
      gdpPerCapita: wanted.gdpPerCapita as number | null,
      landArea: wanted.landArea as number | null,
      continent: wanted.continent as string | null,
      readInfobox: readInfobox(wikiTitle),
    });
    refByKey.set(nation.key, { newName: name });
  }

  if (options.addRosterNations) {
    for (const page of rosterOnlyPages(input.rosterPages, input.countries, matches)) {
      if (usedNames.has(page.title)) continue;
      usedNames.add(page.title);
      plan.creates.push({
        name: page.title,
        key: null,
        from: "roster",
        wikiTitle: page.title,
        officialName: null,
        capital: null,
        population: null,
        gdpPerCapita: null,
        landArea: null,
        continent: null,
        readInfobox: readInfobox(page.title),
      });
    }
  }

  if (options.updateBorders) planFeatures(input, plan, refByKey);
  if (options.syncAlliances) planAlliances(input, plan, refByKey);

  if (options.missingNations === "flag") {
    const listed = new Set(snapshot.nations.map((n) => n.key));
    for (const country of input.countries) {
      const key = country.externalSourceKey;
      if (key && !listed.has(key) && !nationOverrides[key]?.exclude)
        plan.missing.push({ countryId: country.id, name: country.name, key });
    }
  }

  plan.counts = {
    ...plan.counts,
    create: plan.creates.length,
    update: plan.updates.filter((u) => u.changes.length > 0).length,
    features: plan.features.length,
    alliances: plan.alliances.length,
    unmatched: plan.unmatched.length,
    missing: plan.missing.length,
  };
  return plan;
}

function planFeatures(input: PlanInput, plan: SyncPlan, refByKey: Map<string, NationRef>): void {
  const existing = new Map(input.features.map((f) => [f.featureId, f]));
  const sourceKeys = new Map(input.snapshot.nations.map((n) => [n.key, n]));
  for (const feature of input.snapshot.features) {
    const override = input.overrides.nations[feature.key];
    if (override?.exclude || override?.lockedFields?.includes("borders")) continue;
    const nation = refByKey.get(feature.key) ?? null;
    const current = existing.get(feature.key);
    const hash = geometryHash(feature.geometry);
    const targetId = nation && "countryId" in nation ? nation.countryId : null;
    // Never take a region another nation holds, nor give a nation a second region.
    const otherRegion = targetId ? input.linkedFeatureByCountry[targetId] : undefined;
    const linkable = !!nation && (!current?.countryId || current.countryId === targetId) && (!otherRegion || otherRegion === feature.key);
    const link = linkable ? nation : null;
    if (nation && !linkable)
      plan.warnings.push(
        `Border ${feature.key}: not linked (${current?.countryId && current.countryId !== targetId ? "the region is linked to another nation" : `the nation already has region ${otherRegion}`})`
      );
    if (!nation && !sourceKeys.has(feature.key))
      plan.warnings.push(`Border ${feature.key}: no nation of that key in the source; imported unlinked`);
    const newlyLinked = !!link && !current?.countryId;
    const action = !current ? "create" : current.sourceHash !== hash ? "update" : newlyLinked ? "link" : null;
    if (!action) {
      plan.featuresUnchanged++;
      continue;
    }
    const stated = sourceKeys.get(feature.key)?.landArea ?? null;
    const locked = override?.lockedFields?.includes("landArea") ?? false;
    plan.features.push({
      key: feature.key,
      nation: link,
      geometry: feature.geometry,
      areaKm2: feature.areaKm2,
      sourceHash: hash,
      action,
      setLandArea: stated === null && feature.areaKm2 !== null && !locked,
    });
  }
}

function planAlliances(input: PlanInput, plan: SyncPlan, refByKey: Map<string, NationRef>): void {
  const byKey = new Map(input.alliances.filter((a) => a.externalSourceKey).map((a) => [a.externalSourceKey!, a]));
  const byName = new Map(input.alliances.map((a) => [normalizeNationName(a.name), a]));
  const countryName = new Map(input.countries.map((c) => [c.id, c.name]));
  const known = new Set(input.snapshot.nations.map((n) => n.key));
  for (const org of input.snapshot.organizations) {
    const override = input.overrides.organizations[org.key];
    if (override?.exclude) continue;
    const existing = byKey.get(org.key) ?? byName.get(normalizeNationName(org.name)) ?? null;
    const memberIds = new Set(existing?.activeMemberIds ?? []);
    const addMembers: PlannedAlliance["addMembers"] = [];
    const listedIds = new Set<string>();
    for (const member of org.members) {
      const ref = refByKey.get(member);
      if (!ref) {
        plan.unknownMembers.push({
          organization: org.name,
          member,
          reason: known.has(member) ? "That nation is excluded or unmatched" : "No nation of that key in the source",
        });
        continue;
      }
      if ("countryId" in ref) {
        listedIds.add(ref.countryId);
        if (memberIds.has(ref.countryId)) continue;
      }
      addMembers.push({ nation: ref, name: "countryId" in ref ? (countryName.get(ref.countryId) ?? member) : ref.newName });
    }
    const changes: string[] = [];
    if (existing) {
      if (existing.name !== org.name) changes.push("name");
      if ((existing.shortName ?? null) !== org.shortName && org.shortName) changes.push("shortName");
      if (org.color && existing.color.toLowerCase() !== org.color) changes.push("color");
      if (override?.type && existing.type !== override.type) changes.push("type");
      if (existing.externalSourceKey !== org.key) changes.push("key");
    }
    const notInSource = [...memberIds].filter((id) => !listedIds.has(id)).map((id) => countryName.get(id) ?? id);
    if (existing && changes.length === 0 && addMembers.length === 0 && notInSource.length === 0) continue;
    plan.alliances.push({
      key: org.key,
      allianceId: existing?.id ?? null,
      name: org.name,
      shortName: org.shortName,
      color: org.color,
      // A new alliance takes staff's type, else the name rules'; an existing one changes only by staff's choice.
      type: existing ? (override?.type ?? null) : (override?.type ?? org.suggestedType),
      changes,
      addMembers,
      notInSource,
    });
  }
}
