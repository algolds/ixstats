"use client";

/**
 * useCountryProfileLayer — the one data layer behind the country profile (`/countries/[slug]`,
 * `CountryDocument`). It fans out the public read queries in parallel and assembles a single
 * model — identity, vitals, land, state, world, chronicle and a small owner layer.
 *
 * Rules (docs: src/app/countries/README.md, "Country profile"):
 * - Real data only. A missing source yields `null`/`[]`; views show an EmptyState or omit the
 *   section. Nothing here invents a figure.
 * - Public record only, enforced on the server. Directives and issue outcomes come from
 *   `countries.getPublicRecord` (enacted directives, resolved issues, public fields), readable
 *   signed out. Drafts and open-issue counts exist only in `owner`, which is `null` unless the
 *   signed-in viewer owns this country (the owner's own `intent.getTree` is only fetched then).
 */

import { useMemo } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { clockTimeAt } from "~/lib/realms/nation-time";
import type { RealmClockReader } from "~/lib/realms/realm-clock";
import { claimableNation } from "~/lib/realms/claimable-nation";
import { resolveImageUrl } from "~/lib/wiki-os/transformers/image-url";
import { parseWikiSource, type WikiSource } from "~/lib/wiki-os/config";
import type { CountryWithEconomicData } from "~/components/mycountry/shared/primitives/CountryDataProvider";
import { formatCensusValue } from "~/lib/format/census";
import {
  buildChronicle,
  countOwnerDirectives,
  realNumber,
  splitCanonFeed,
  yearlySeries,
  type ChronicleEntry,
  type FoundingEvent,
  type PublicDirective,
  type PublicIssueOutcome,
} from "../_utils/profileLayer";

const STATIC = { staleTime: 10 * 60_000, retry: false, refetchOnWindowFocus: false } as const;
const WIKI = {
  staleTime: 24 * 60 * 60_000,
  gcTime: 48 * 60 * 60_000,
  retry: false,
  refetchOnWindowFocus: false,
} as const;
const MAP = {
  staleTime: 30 * 60_000,
  gcTime: 2 * 60 * 60_000,
  retry: false,
  refetchOnWindowFocus: false,
} as const;

export type ProfileIdentity = ReturnType<typeof buildIdentity>;
export type ProfileVitals = ReturnType<typeof buildVitals>;
export type ProfileLand = ReturnType<typeof toLand>;

export interface ProfileState {
  government: {
    name: string;
    type: string;
    headOfState: string | null;
    headOfGovernment: string | null;
    legislature: string | null;
    executive: string | null;
    judiciary: string | null;
    departments: string[];
  } | null;
  election: {
    lastName: string | null;
    lastIxTime: number | null;
    turnout: number | null;
    results: { partyName: string; color: string; votePercentage: number; seatsWon: number }[];
    upcomingName: string | null;
    upcomingIxTime: number | null;
    totalSeats: number;
  } | null;
  isLoading: boolean;
}

export interface ProfileWorld {
  /** World Census, ranked within the nation's realm; `percentile` as the census computes it. */
  rankings: {
    category: string;
    rank: number;
    total: number;
    value: string;
    percentile: number | null;
  }[];
  relations: {
    id: string;
    countryId: string;
    name: string;
    flagUrl: string | null;
    relationship: string;
    strength: number;
    treaties: string[];
  }[];
  embassies: {
    id: string;
    countryName: string;
    countrySlug: string | null;
    flagUrl: string | null;
    role: "host" | "guest";
    status: string;
    level: number | null;
  }[];
  isLoading: boolean;
}

export interface ProfileOwnerLayer {
  activeIssues: number | null;
  urgentIssues: number | null;
  draftDirectives: number;
  directivesInForce: number;
}

export interface CountryProfileLayer {
  countryId: string;
  slug: string;
  identity: ProfileIdentity;
  vitals: ProfileVitals;
  land: ProfileLand;
  state: ProfileState;
  world: ProfileWorld;
  chronicle: ChronicleEntry[];
  /** Null unless the signed-in viewer owns this country. */
  owner: ProfileOwnerLayer | null;
  /** The country's realm clock: every in-world date on the profile reads in its calendar. */
  clock: RealmClockReader;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type Infobox = NonNullable<RouterOutputs["wikiCache"]["getCountryProfile"]>["infobox"];

function infoboxLeaders(infobox: Infobox): { title: string; name: string }[] {
  if (!infobox) return [];
  const leaders: { title: string; name: string }[] = [];
  const pairs = [
    [infobox.leader_title1, infobox.leader_name1],
    [infobox.leader_title2, infobox.leader_name2],
    [infobox.leader_title3, infobox.leader_name3],
    [infobox.leader_title4, infobox.leader_name4],
  ] as const;
  for (const [title, name] of pairs) {
    const t = str(title);
    const n = str(name);
    if (t && n) leaders.push({ title: t, name: n });
  }
  return leaders;
}

function infoboxFounding(infobox: Infobox): FoundingEvent[] {
  if (!infobox) return [];
  const events: FoundingEvent[] = [];
  const pairs = [
    [infobox.established_event1, infobox.established_date1],
    [infobox.established_event2, infobox.established_date2],
    [infobox.established_event3, infobox.established_date3],
  ] as const;
  for (const [event, date] of pairs) {
    const e = str(event);
    const d = str(date);
    if (e && d) events.push({ event: e, date: d });
  }
  // Infoboxes with more than three establishment rows keep them in the raw map.
  const raw = infobox.rawInfobox ?? {};
  for (let n = 4; n <= 10; n++) {
    const e = str(raw[`established_event${n}`]);
    const d = str(raw[`established_date${n}`]);
    if (e && d) events.push({ event: e, date: d });
  }
  const independence = str(infobox.independence_date);
  if (independence && !events.some((ev) => ev.date === independence)) {
    events.push({ event: "Independence", date: independence });
  }
  return events;
}

type GeoBundle = RouterOutputs["countryGeo"]["getCountryGeoBundle"];

// The bundle is typed loosely (`db: any` in lib/country-geo), so rows are read defensively.
type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);

/** A story pin's `[lng, lat]` (stored as Json), or null when it is not a pair of numbers. */
function lngLat(value: unknown): [number, number] | null {
  return Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number"
    ? [value[0], value[1]]
    : null;
}

function toLand(bundle: GeoBundle | undefined, isLoading: boolean) {
  const cities = rows(bundle?.cities).map((c) => ({
    id: String(c.id),
    name: String(c.name),
    population: realNumber(c.population),
    isCapital: c.isNationalCapital === true,
    isPort: c.isPort === true,
    coordinates: lngLat(c.coordinates),
    subdivisionId: str(c.subdivisionId),
  }));
  const capital = cities.find((c) => c.isCapital) ?? null;
  const geoProfile = (bundle?.geoProfile ?? null) as Row | null;
  return {
    hasGeometry: !!bundle?.geometry,
    areaSqKm: realNumber(bundle?.areaSqKm),
    capital: capital ? { name: capital.name, population: capital.population } : null,
    cities,
    subdivisions: rows(bundle?.subdivisions)
      .map((s) => ({
        id: String(s.id),
        name: String(s.name),
        type: String(s.type ?? "Region"),
        population: realNumber(s.population),
        capital: str(s.capital),
      }))
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0)),
    storyPins: rows(bundle?.storyPins).map((p) => ({
      id: String(p.id),
      title: String(p.title),
      category: String(p.category ?? "story"),
      year: typeof p.ixTimeYear === "number" ? p.ixTimeYear : null,
      eraLabel: str(p.eraLabel),
      excerpt: str(p.content)?.slice(0, 220) ?? null,
      coordinates: lngLat(p.coordinates),
    })),
    neighbors: rows(bundle?.neighbors).map((n) => ({
      name: String(n.displayName ?? n.featureId),
      countryId: str(n.countryId),
    })),
    profile: geoProfile
      ? {
          coastlineKm: realNumber(geoProfile.coastlineKm),
          isLandlocked: geoProfile.isLandlocked === true,
          isIsland: geoProfile.isIsland === true,
          dominantClimate: str(geoProfile.dominantClimate),
          dominantElevation: str(geoProfile.dominantElevation),
          arableLandPercent: realNumber(geoProfile.arableLandPercent),
        }
      : null,
    isLoading,
  };
}

type Loose = Record<string, any>;
type Output<R extends keyof RouterOutputs, P extends keyof RouterOutputs[R]> = NonNullable<
  RouterOutputs[R][P]
>;

const firstStr = (...values: unknown[]) => values.map(str).find(Boolean) ?? null;

function buildIdentity(
  c: Loose,
  infobox: Infobox | null,
  flagUrl: string | null,
  imageSource: WikiSource
) {
  const own = (c.nationalIdentity ?? {}) as Record<string, unknown>;
  const ib: Partial<NonNullable<Infobox>> = infobox ?? {};
  const coatFile = firstStr(ib.image_coat, ib.coat_of_arms);
  const { realm, owner } = c;
  return {
    name: String(c.name).replace(/_/g, " "),
    officialName: firstStr(own.officialName, ib.conventional_long_name, ib.official_name),
    motto: firstStr(own.motto, ib.motto, ib.national_motto),
    anthem: firstStr(own.nationalAnthem, ib.national_anthem),
    demonym: firstStr(own.demonym, ib.demonym),
    capital: firstStr(own.capitalCity, ib.capital),
    languages: firstStr(own.officialLanguages, ib.official_languages),
    currency: firstStr(own.currency, ib.currency),
    governmentType: firstStr(own.governmentType, c.governmentType, ib.government_type),
    leaders: infoboxLeaders(infobox),
    continent: str(c.continent),
    region: str(c.region),
    realm:
      str(realm?.name) && str(realm?.slug)
        ? {
            name: String(realm.name),
            slug: String(realm.slug),
            logoUrl: firstStr(realm.emblemUrl, realm.thumbnail),
          }
        : null,
    flagUrl,
    coatOfArmsUrl:
      str(c.coatOfArms) ?? (coatFile ? (resolveImageUrl(coatFile, imageSource) ?? null) : null),
    sovereign: owner
      ? {
          username: firstStr(owner.handle, owner.forumUsername),
          roleName: firstStr(owner.role?.displayName, owner.role?.name),
          avatarUrl: str(owner.avatarUrl),
          role: firstStr(owner.clerkRole, owner.role?.name),
        }
      : null,
    claim: claimableNation(c),
  };
}

function buildVitals(c: Loose) {
  const zero = { allowZero: true };
  return {
    population: realNumber(c.currentPopulation),
    populationGrowth: realNumber(c.populationGrowthRate, zero),
    gdpTotal: realNumber(c.currentTotalGdp),
    gdpPerCapita: realNumber(c.currentGdpPerCapita),
    gdpGrowth: realNumber(c.adjustedGdpGrowth, zero),
    economicTier: str(c.economicTier),
    populationTier: str(c.populationTier),
    landArea: realNumber(c.landArea),
    density: realNumber(c.populationDensity),
    unemployment: realNumber(c.unemploymentRate, zero),
    inflation: realNumber(c.inflationRate, zero),
    lifeExpectancy: realNumber(c.lifeExpectancy),
    literacy: realNumber(c.literacyRate),
    urbanShare: realNumber(c.urbanPopulationPercent),
    gini: realNumber(c.incomeInequalityGini),
    povertyRate: realNumber(c.povertyRate),
    debtToGdp: realNumber(c.totalDebtGDPRatio),
    taxRevenueShare: realNumber(c.taxRevenueGDPPercent),
    publicApproval: realNumber(c.publicApproval),
    stabilityScore: realNumber(c.stabilityMetrics?.stabilityScore),
    history: yearlySeries(c.historical),
  };
}

function buildGovernment(
  gov: RouterOutputs["government"]["getByCountryId"] | undefined
): ProfileState["government"] {
  if (!gov) return null;
  return {
    name: gov.governmentName,
    type: gov.governmentType,
    headOfState: str(gov.headOfState),
    headOfGovernment: str(gov.headOfGovernment),
    legislature: str(gov.legislatureName),
    executive: str(gov.executiveName),
    judiciary: str(gov.judicialName),
    departments: (gov.departments ?? []).map((d) => d.name).slice(0, 12),
  };
}

type ElectionResultRow = NonNullable<ProfileState["election"]>["results"][number];

/** Results are per candidate, so a party fielding several candidates appears more than once. */
export function resultsByParty(
  candidates: readonly (ElectionResultRow & { partyId: string })[]
): ElectionResultRow[] {
  const parties = new Map<string, ElectionResultRow>();
  for (const { partyId, partyName, color, votePercentage, seatsWon } of candidates) {
    const p = parties.get(partyId);
    if (p) {
      p.votePercentage += votePercentage;
      p.seatsWon += seatsWon;
    } else parties.set(partyId, { partyName, color, votePercentage, seatsWon });
  }
  return [...parties.values()].sort((a, b) => b.seatsWon - a.seatsWon);
}

function buildElection(
  status: Output<"elections", "getElectionStatus"> | undefined
): ProfileState["election"] {
  if (!status || !(status.lastElection || status.upcoming)) return null;
  const { lastElection: last, upcoming } = status;
  return {
    lastName: last?.name ?? null,
    lastIxTime: last?.scheduledIxTime ?? null,
    turnout: realNumber(last?.turnout),
    results: resultsByParty(last?.results ?? []),
    upcomingName: upcoming?.name ?? null,
    upcomingIxTime: upcoming?.scheduledIxTime ?? null,
    totalSeats: status.totalSeats,
  };
}

function buildOwner(
  isOwner: boolean,
  intents: Parameters<typeof countOwnerDirectives>[0],
  pending: Output<"nationalIssues", "getPendingCount"> | undefined
): ProfileOwnerLayer | null {
  if (!isOwner) return null;
  const counts = countOwnerDirectives(intents);
  return {
    activeIssues: pending?.total ?? null,
    urgentIssues: pending?.urgent ?? null,
    draftDirectives: counts.drafts,
    directivesInForce: counts.active,
  };
}

function buildWorld(
  rankings: Output<"mycountry", "getRankings"> | undefined,
  relations: Output<"diplomaticCore", "getRelationships"> | undefined,
  embassies: Output<"diplomaticEmbassies", "getEmbassies"> | undefined,
  isLoading: boolean
): ProfileWorld {
  return {
    rankings: (rankings ?? []).map((r) => ({
      category: r.category,
      rank: r.global.position,
      total: r.global.total,
      value: formatCensusValue(r),
      percentile: realNumber(r.percentile, { allowZero: true }),
    })),
    relations: (relations ?? []).map((r) => ({
      id: r.id,
      countryId: r.targetCountryId,
      name: r.targetCountryName,
      flagUrl: r.targetCountryFlag ?? null,
      relationship: String(r.relationship),
      strength: r.strength,
      treaties: Array.isArray(r.treaties) ? r.treaties.map(String) : [],
    })),
    embassies: (embassies ?? [])
      .filter((e) => e.status !== "closed")
      .map((e) => ({
        id: e.id,
        countryName: e.country,
        countrySlug: e.countrySlug,
        flagUrl: e.countryFlag,
        role: e.role,
        status: e.status,
        level: typeof e.level === "number" ? e.level : null,
      })),
    isLoading,
  };
}

interface UseCountryProfileLayerOptions {
  country: CountryWithEconomicData | null | undefined;
  /** Resolved flag (country.flag or the flag service). */
  flagUrl: string | null;
  /** The signed-in viewer owns this country (reveals the owner layer). */
  isOwner: boolean;
  /** The country's realm clock (`CountryDataProvider`). */
  clock: RealmClockReader;
}

export function useCountryProfileLayer({
  country,
  flagUrl,
  isOwner,
  clock,
}: UseCountryProfileLayerOptions): CountryProfileLayer | null {
  // `getByIdWithEconomicData` returns `any`; narrow the fields this layer reads.
  const c = country as Loose | null | undefined;
  const countryId: string = c?.id ?? "";
  const enabled = !!countryId;
  const wikiSource = parseWikiSource(str(c?.wikiSource));
  const articleTitle = str(c?.wikiPageTitle) ?? (c?.name ? String(c.name).replace(/_/g, " ") : "");

  // The infobox: identity and founding dates. The Lore tab reads the article itself (LoreReader).
  const wikiProfile = api.wikiCache.getCountryProfile.useQuery(
    { countryName: articleTitle, wikiSource },
    { enabled: !!articleTitle, ...WIKI }
  );
  // Land, state and world. The public record is server-filtered (enacted directives, resolved
  // issues) and readable signed out.
  const byCountry = { countryId };
  const geo = api.countryGeo.getCountryGeoBundle.useQuery(byCountry, { enabled, ...MAP });
  const record = api.countries.getPublicRecord.useQuery(byCountry, { enabled, ...STATIC });
  const canon = api.mycountry.getCanonFeed.useQuery(
    { countryId, limit: 40 },
    { enabled, ...STATIC }
  );
  const government = api.government.getByCountryId.useQuery(
    { countryId, budgetYearsLimit: 1, revenueSourcesLimit: 1 },
    { enabled, ...STATIC }
  );
  const election = api.elections.getElectionStatus.useQuery(byCountry, { enabled, ...STATIC });
  const rankings = api.mycountry.getRankings.useQuery(byCountry, { enabled, ...STATIC });
  const relations = api.diplomaticCore.getRelationships.useQuery(byCountry, {
    enabled,
    ...STATIC,
  });
  const embassies = api.diplomaticEmbassies.getEmbassies.useQuery(byCountry, {
    enabled,
    ...STATIC,
  });

  // The owner layer: the owner's full directive tree and open-issue counts.
  const ownerOnly = { enabled: enabled && isOwner, ...STATIC };
  const intents = api.intent.getTree.useQuery(byCountry, ownerOnly);
  const pending = api.nationalIssues.getPendingCount.useQuery(byCountry, ownerOnly);

  return useMemo<CountryProfileLayer | null>(() => {
    if (!c) return null;
    const infobox = wikiProfile.data?.infobox ?? null;
    const identity = buildIdentity(c, infobox, flagUrl, wikiProfile.data?.wikiSource ?? wikiSource);

    const founding = infoboxFounding(infobox);

    const land = toLand(geo.data, geo.isLoading);
    const directives: PublicDirective[] = record.data?.directives ?? [];
    const issueOutcomes: PublicIssueOutcome[] = record.data?.issueOutcomes ?? [];
    const { decisions, diplomacy } = splitCanonFeed(canon.data, (ms) => clockTimeAt(clock, ms));
    const state: ProfileState = {
      government: buildGovernment(government.data),
      election: buildElection(election.data),
      isLoading: record.isLoading || government.isLoading,
    };

    return {
      countryId,
      slug: str(c.slug) ?? identity.name.replace(/\s+/g, "_"),
      identity,
      vitals: buildVitals(c),
      land,
      state,
      world: buildWorld(
        rankings.data,
        relations.data,
        embassies.data,
        rankings.isLoading || relations.isLoading
      ),
      // Lore dates + map story pins + the record on the country's realm clock.
      chronicle: buildChronicle({
        calendar: clock.calendar,
        founding,
        storyPins: land.storyPins.map((p) => ({
          id: p.id,
          title: p.title,
          content: p.excerpt,
          ixTimeYear: p.year,
          eraLabel: p.eraLabel,
        })),
        directives,
        issueOutcomes,
        decisions,
        diplomacy,
      }),
      owner: buildOwner(isOwner, intents.data?.allIntents, pending.data),
      clock,
    };
  }, [
    c,
    countryId,
    flagUrl,
    isOwner,
    clock,
    wikiSource,
    wikiProfile.data,
    geo.data,
    geo.isLoading,
    record.data,
    record.isLoading,
    intents.data,
    canon.data,
    government.data,
    government.isLoading,
    election.data,
    rankings.data,
    rankings.isLoading,
    relations.data,
    relations.isLoading,
    embassies.data,
    pending.data,
  ]);
}
