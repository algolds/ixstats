/**
 * The diff of one source sync run, computed without touching the database: which nations to create (from the
 * source, or from roster pages the source does not list), which figures change on which nations, which borders
 * and alliances to write, which nations the source no longer lists, which unclaimed nations' infoboxes to read
 * again, and every case left to staff. A dry run stores this plan; an applied run executes it
 * (src/server/modules/realms/realms.source-apply.ts).
 *
 * Precedence for a new nation's figures: the source's figures, then the wiki infobox (read at apply time), then
 * the baseline defaults; a figure the source marks as from a secondary source ranks below the infobox and never
 * changes an existing nation. A claimed nation's figures change only when `updateClaimedStats` is on; a field
 * staff pinned on a nation never changes. A source entry's wiki link is kept only when it names one of the realm's
 * own pages (a claim on a nation with a wiki page can be approved for that page's creator).
 */
import type {
  SourceFeature,
  SourceFigureField,
  SourceNation,
  SourceSnapshot,
} from "./adapters/types";
import type {
  AllianceType,
  ContinentMap,
  RealmSyncOptions,
  RealmSyncOverrides,
  SyncField,
} from "./config";
import {
  matchSourceNations,
  nearNationName,
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
  wikiSource: string | null;
  wikiPageTitle: string | null;
  baselinePopulation: number;
  baselineGdpPerCapita: number;
  landArea: number | null;
  continent: string | null;
  capital: string | null;
  officialName: string | null;
  /** The nation's wiki infobox should be read again (`infoboxNeedsRead`). */
  infoboxEmpty: boolean;
}

/**
 * Whether an unclaimed nation's wiki infobox should be read again: it has no flag, whether the read never landed
 * or left it out (a partial read). A re-read fills only empty fields.
 */
export function infoboxNeedsRead(nation: { flag: string | null }): boolean {
  return !nation.flag?.trim();
}

export interface PlanFeature {
  featureId: string;
  countryId: string | null;
  sourceHash: string | null;
  /** The fill colour stored on the feature, compared with the source nation's colour. */
  fill: string | null;
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
  /** Every page title of the realm's index on its wiki (RealmPage, any kind): the only wiki links a nation keeps. */
  realmPageTitles: readonly string[];
  /** Where the source's wiki links redirect on the wiki (link title -> target), when they were looked up. */
  wikiRedirects?: Readonly<Record<string, string>>;
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
  /** Figures from the source's secondary source: the infobox wins over them (absent on runs stored before). */
  secondary?: SourceFigureField[];
}

/** An unclaimed nation whose wiki infobox never filled it (the read failed or timed out): read it again. */
export interface PlannedRefill {
  countryId: string;
  name: string;
  wikiTitle: string;
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
  /** The nation's colour in the source, stored as the border's fill (the map's political colouring reads it). */
  fill: string | null;
  /**
   * "create": new feature; "update": geometry changed; "link": unchanged geometry, newly linked; "recolour":
   * unchanged geometry, the source colour changed.
   */
  action: "create" | "update" | "link" | "recolour";
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
  /** Unclaimed nations whose wiki infobox is read again on apply, filling only what is empty. */
  refills: PlannedRefill[];
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

/** MediaWiki's spelling of a title: spaces for underscores, first letter upper case. */
function titleKey(title: string): string {
  const text = title.normalize("NFC").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * What the source says each sync field should be for one nation (nulls are "the source does not say"). Fields in
 * `skip` (secondary-source figures on an existing nation) say nothing, and a skipped land area takes no traced area.
 */
function sourceValues(
  nation: SourceNation,
  feature: SourceFeature | undefined,
  continent: string | null,
  skip: ReadonlySet<SourceFigureField> = new Set()
): Record<Exclude<SyncField, "borders">, string | number | null> {
  const value = <T>(field: SourceFigureField, v: T) => (skip.has(field) ? null : v);
  return {
    population: value("population", nation.population),
    gdpPerCapita: value("gdpPerCapita", nation.gdpPerCapita),
    landArea: value("landArea", nation.landArea ?? feature?.areaKm2 ?? null),
    capital: value("capital", nation.capital),
    officialName: value("officialName", nation.officialName),
    continent,
  };
}

function currentValues(
  country: PlanCountry
): Record<Exclude<SyncField, "borders">, string | number | null> {
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

/** What the per-nation steps share while one plan is built. */
interface PlanState {
  input: PlanInput;
  plan: SyncPlan;
  refByKey: Map<string, NationRef>;
  usedNames: Set<string>;
  featureByKey: ReadonlyMap<string, SourceFeature>;
  /** The realm's page titles by their MediaWiki spelling. */
  realmTitles: ReadonlyMap<string, string>;
  /** How many nations (source entries and existing countries) land on each realm page, by its key. */
  landings: ReadonlyMap<string, number>;
}

/** The realm page a link lands on, directly or through its redirect, by MediaWiki spelling. */
function landingKey(
  input: PlanInput,
  realmTitles: ReadonlyMap<string, string>,
  link: string
): string | null {
  if (realmTitles.has(titleKey(link))) return titleKey(link);
  const target = input.wikiRedirects?.[link];
  return target && realmTitles.has(titleKey(target)) ? titleKey(target) : null;
}

function countLandings(input: PlanInput, realmTitles: ReadonlyMap<string, string>) {
  const keys = [
    ...input.snapshot.nations.map((n) =>
      n.wikiTitle ? landingKey(input, realmTitles, n.wikiTitle) : null
    ),
    ...input.countries.map((c) => (c.wikiPageTitle ? titleKey(c.wikiPageTitle) : null)),
  ];
  const landings = new Map<string, number>();
  for (const key of keys) if (key) landings.set(key, (landings.get(key) ?? 0) + 1);
  return landings;
}

const continentOf = (input: PlanInput, key: string) => input.continentMap[key]?.trim() || null;
const readInfobox = (input: PlanInput, title: string | null) =>
  input.options.useWikiInfobox && !!title && !!input.wikiSource;

/** A source entry matched to an existing nation: its figure changes, as far as the options and pins allow. */
function planMatched(state: PlanState, nation: SourceNation, country: PlanCountry): void {
  const { input, plan } = state;
  const lockedFields = new Set(input.overrides.nations[nation.key]?.lockedFields ?? []);
  plan.counts.matched++;
  state.refByKey.set(nation.key, { countryId: country.id });
  const claimed = country.ownerUserId !== null;
  const wanted = sourceValues(
    nation,
    state.featureByKey.get(nation.key),
    continentOf(input, nation.key),
    new Set(nation.secondary)
  );
  const all = diffFields(wanted, currentValues(country), input.options.applyContinents);
  const pinned = all.filter((c) => lockedFields.has(c.field));
  const free = all.filter((c) => !lockedFields.has(c.field));
  const allowed = claimed ? input.options.updateClaimedStats : input.options.updateUnclaimedStats;
  if (pinned.length > 0)
    plan.locked.push({
      countryId: country.id,
      name: country.name,
      fields: pinned.map((c) => c.field),
    });
  if (!allowed && free.length > 0)
    plan.skippedClaimed.push({
      countryId: country.id,
      name: country.name,
      fields: free.map((c) => c.field),
    });
  const changes = allowed ? free : [];
  const bindKey = country.externalSourceKey !== nation.key;
  if (changes.length > 0 || bindKey)
    plan.updates.push({
      countryId: country.id,
      name: country.name,
      key: nation.key,
      claimed,
      bindKey,
      changes,
    });
}

/**
 * The entry's wiki link when it names one of the realm's pages (that page's own spelling), else null and a warning.
 * A redirect is followed only to a page no other nation lands on: "Deseti" redirecting to "Orioni" is a region
 * folded into Orioni, and taking Orioni's page would hand Deseti to Orioni's author.
 */
function realmWikiTitle(state: PlanState, nation: SourceNation): string | null {
  if (!nation.wikiTitle) return null;
  const direct = state.realmTitles.get(titleKey(nation.wikiTitle));
  if (direct) return direct;
  const target = state.input.wikiRedirects?.[nation.wikiTitle];
  const title = target ? state.realmTitles.get(titleKey(target)) : undefined;
  if (title && state.landings.get(titleKey(title)) === 1) return title;
  if (title) {
    state.plan.warnings.push(
      `${nation.key}: its wiki link "${nation.wikiTitle}" redirects to "${title}", a page another nation lands on; created without a wiki page, so a claim on it goes to manual review`
    );
    return null;
  }
  state.plan.warnings.push(
    `${nation.key}: its wiki link "${nation.wikiTitle}" is not one of the realm's pages; created without a wiki page, so a claim on it goes to manual review`
  );
  return null;
}

/** A source entry no nation matched: a new unclaimed nation, named after its roster page when one matched. */
function planNew(state: PlanState, nation: SourceNation, pageTitle: string | null): void {
  const { input, plan } = state;
  const name = pageTitle ?? nation.displayName;
  if (!input.options.addNewNations) {
    plan.unmatched.push({
      key: nation.key,
      name,
      reason: "New in the source; adding new nations is off",
      candidates: [],
    });
    return;
  }
  if (state.usedNames.has(name)) {
    plan.unmatched.push({
      key: nation.key,
      name,
      reason: `A nation named "${name}" already exists but is matched to another source entry`,
      candidates: input.countries
        .filter((c) => c.name === name)
        .map((c) => ({ countryId: c.id, name: c.name })),
    });
    return;
  }
  state.usedNames.add(name);
  const wikiTitle = pageTitle ?? realmWikiTitle(state, nation);
  const continent = input.options.applyContinents ? continentOf(input, nation.key) : null;
  const wanted = sourceValues(nation, state.featureByKey.get(nation.key), continent);
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
    readInfobox: readInfobox(input, wikiTitle),
    secondary: nation.secondary,
  });
  state.refByKey.set(nation.key, { newName: name });
}

/**
 * Roster pages the source does not list become nations, except one whose name looks like a nation already
 * planned or existing under another spelling ("Ymutztlaclan-Mizlanuzco" and the map's "Ymutz Mizlan"): that one
 * is held back with a warning instead of making two nations of one. A claim on its page still creates it.
 */
function planRosterNations(state: PlanState, matches: ReturnType<typeof matchSourceNations>): void {
  const { input, plan } = state;
  const known = [...plan.creates.map((c) => c.name), ...input.countries.map((c) => c.name)];
  // A page a planned nation already carries (its map link redirects there) is that nation.
  const linked = new Set(plan.creates.flatMap((c) => (c.wikiTitle ? [titleKey(c.wikiTitle)] : [])));
  for (const page of rosterOnlyPages(input.rosterPages, input.countries, matches)) {
    if (state.usedNames.has(page.title) || linked.has(titleKey(page.title))) continue;
    const near = known.find((name) => nearNationName(page.title, name));
    if (near) {
      plan.warnings.push(
        `Roster page "${page.title}" may be "${near}" spelled another way: not created. If it is a different nation, a claim on its page creates it`
      );
      continue;
    }
    state.usedNames.add(page.title);
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
      readInfobox: readInfobox(input, page.title),
    });
  }
}

/** Unclaimed nations on the realm's wiki whose infobox never filled them: read again on apply. */
function planRefills(state: PlanState): void {
  const { input, plan } = state;
  if (!input.options.useWikiInfobox || !input.wikiSource) return;
  for (const country of input.countries) {
    const key = country.externalSourceKey;
    const title = country.wikiPageTitle
      ? state.realmTitles.get(titleKey(country.wikiPageTitle))
      : undefined;
    if (country.ownerUserId !== null || !country.infoboxEmpty || !title) continue;
    if (country.wikiSource !== input.wikiSource || (key && input.overrides.nations[key]?.exclude))
      continue;
    plan.refills.push({ countryId: country.id, name: country.name, wikiTitle: title });
  }
}

export function planSourceSync(input: PlanInput): SyncPlan {
  const { snapshot, options } = input;
  const countryById = new Map(input.countries.map((c) => [c.id, c]));
  const matches = matchSourceNations(
    snapshot.nations,
    input.countries,
    input.rosterPages,
    input.overrides.nations
  );
  const plan: SyncPlan = {
    creates: [],
    updates: [],
    skippedClaimed: [],
    locked: [],
    refills: [],
    features: [],
    featuresUnchanged: 0,
    alliances: [],
    unknownMembers: [],
    missing: [],
    unmatched: [],
    excluded: [],
    warnings: [...snapshot.warnings],
    counts: {
      sourceNations: snapshot.nations.length,
      matched: 0,
      create: 0,
      update: 0,
      features: 0,
      alliances: 0,
      unmatched: 0,
      missing: 0,
    },
  };
  const titles = [...input.realmPageTitles, ...input.rosterPages.map((p) => p.title)];
  const realmTitles = new Map(titles.map((t) => [titleKey(t), t]));
  const state: PlanState = {
    input,
    plan,
    refByKey: new Map(),
    usedNames: new Set(input.countries.map((c) => c.name)),
    featureByKey: new Map(snapshot.features.map((f) => [f.key, f])),
    realmTitles,
    landings: countLandings(input, realmTitles),
  };

  for (const nation of snapshot.nations) {
    const match = matches.get(nation.key)!;
    if (match.kind === "excluded") plan.excluded.push(nation.key);
    else if (match.kind === "ambiguous")
      plan.unmatched.push({
        key: nation.key,
        name: nation.displayName,
        reason: match.reason,
        candidates: match.candidates,
      });
    else if (match.kind === "country")
      planMatched(state, nation, countryById.get(match.countryId)!);
    else planNew(state, nation, match.kind === "page" ? match.pageTitle : null);
  }

  if (options.addRosterNations) planRosterNations(state, matches);
  planRefills(state);
  if (options.updateBorders) planFeatures(input, plan, state.refByKey);
  if (options.syncAlliances) planAlliances(input, plan, state.refByKey);

  if (options.missingNations === "flag") {
    const listed = new Set(snapshot.nations.map((n) => n.key));
    for (const country of input.countries) {
      const key = country.externalSourceKey;
      if (key && !listed.has(key) && !input.overrides.nations[key]?.exclude)
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

/** What to do with a source border given the stored one: nothing (null) when it is written as it stands. */
function featureAction(
  current: PlanFeature | undefined,
  hash: string,
  newlyLinked: boolean,
  fill: string | null
): PlannedFeature["action"] | null {
  if (!current) return "create";
  if (current.sourceHash !== hash) return "update";
  if (newlyLinked) return "link";
  return current.fill !== fill ? "recolour" : null;
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
    const linkable =
      !!nation &&
      (!current?.countryId || current.countryId === targetId) &&
      (!otherRegion || otherRegion === feature.key);
    const link = linkable ? nation : null;
    if (nation && !linkable)
      plan.warnings.push(
        `Border ${feature.key}: not linked (${current?.countryId && current.countryId !== targetId ? "the region is linked to another nation" : `the nation already has region ${otherRegion}`})`
      );
    if (!nation && !sourceKeys.has(feature.key))
      plan.warnings.push(
        `Border ${feature.key}: no nation of that key in the source; imported unlinked`
      );
    const fill = sourceKeys.get(feature.key)?.color ?? null;
    const action = featureAction(current, hash, !!link && !current?.countryId, fill);
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
      fill,
      action,
      setLandArea: stated === null && feature.areaKm2 !== null && !locked,
    });
  }
}

function planAlliances(input: PlanInput, plan: SyncPlan, refByKey: Map<string, NationRef>): void {
  const byKey = new Map(
    input.alliances.filter((a) => a.externalSourceKey).map((a) => [a.externalSourceKey!, a])
  );
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
          reason: known.has(member)
            ? "That nation is excluded or unmatched"
            : "No nation of that key in the source",
        });
        continue;
      }
      if ("countryId" in ref) {
        listedIds.add(ref.countryId);
        if (memberIds.has(ref.countryId)) continue;
      }
      addMembers.push({
        nation: ref,
        name: "countryId" in ref ? (countryName.get(ref.countryId) ?? member) : ref.newName,
      });
    }
    const changes: string[] = [];
    if (existing) {
      if (existing.name !== org.name) changes.push("name");
      if ((existing.shortName ?? null) !== org.shortName && org.shortName)
        changes.push("shortName");
      if (org.color && existing.color.toLowerCase() !== org.color) changes.push("color");
      if (override?.type && existing.type !== override.type) changes.push("type");
      if (existing.externalSourceKey !== org.key) changes.push("key");
    }
    const notInSource = [...memberIds]
      .filter((id) => !listedIds.has(id))
      .map((id) => countryName.get(id) ?? id);
    if (existing && changes.length === 0 && addMembers.length === 0 && notInSource.length === 0)
      continue;
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
