"use client";

/**
 * useCountryProfileLayer — the one data layer behind the country profile prototypes
 * (Prototype A "Chronicle" and Prototype B "Command"). It fans out the public read queries in
 * parallel and assembles a single model — identity, lore, vitals, land, state, world, chronicle
 * and a small owner layer — so both prototypes render the same facts differently.
 *
 * Rules (docs: src/app/countries/README.md, "Profile prototypes"):
 * - Real data only. A missing source yields `null`/`[]`; views show an EmptyState or omit the
 *   section. Nothing here invents a figure.
 * - Public record only. Directives are filtered to enacted ones and issues to resolved ones
 *   (`_utils/profileLayer.ts`); drafts and open-issue counts exist only in `owner`, which is
 *   `null` unless the signed-in viewer owns this country.
 */

import { useMemo } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { resolveImageUrl } from "~/lib/wiki-os/transformers/image-url";
import type { CountryWithEconomicData } from "~/components/mycountry/shared/primitives/CountryDataProvider";
import { formatCensusValue } from "~/components/mycountry/shell/WorldCensusCard";
import {
  LORE_CHAPTER_KEYWORDS,
  buildChronicle,
  countOwnerDirectives,
  leadParagraphs,
  pickLoreSection,
  realNumber,
  redirectTarget,
  splitCanonFeed,
  splitWikiSections,
  toPublicDirectives,
  toPublicIssueOutcomes,
  wikiToParagraphs,
  yearlySeries,
  type ChronicleEntry,
  type FoundingEvent,
  type LoreChapter,
  type LoreSection,
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

// ─── Model ──────────────────────────────────────────────────────────────────

export interface ProfileIdentity {
  name: string;
  officialName: string | null;
  motto: string | null;
  anthem: string | null;
  demonym: string | null;
  capital: string | null;
  languages: string | null;
  currency: string | null;
  governmentType: string | null;
  leaders: { title: string; name: string }[];
  continent: string | null;
  region: string | null;
  realm: string | null;
  flagUrl: string | null;
  coatOfArmsUrl: string | null;
  sovereign: { username: string | null; roleName: string | null } | null;
}

export interface ProfileLore {
  articleTitle: string;
  wikiHref: string;
  prologue: string[];
  chapters: Partial<Record<LoreChapter, LoreSection>>;
  founding: FoundingEvent[];
  isLoading: boolean;
  /** True once the wiki answered with no usable prose. */
  isEmpty: boolean;
}

export interface ProfileVitals {
  population: number | null;
  populationGrowth: number | null;
  gdpTotal: number | null;
  gdpPerCapita: number | null;
  gdpGrowth: number | null;
  economicTier: string | null;
  populationTier: string | null;
  landArea: number | null;
  density: number | null;
  unemployment: number | null;
  inflation: number | null;
  lifeExpectancy: number | null;
  literacy: number | null;
  urbanShare: number | null;
  gini: number | null;
  povertyRate: number | null;
  debtToGdp: number | null;
  taxRevenueShare: number | null;
  publicApproval: number | null;
  stabilityScore: number | null;
  /** Model history (year, total GDP, population) from the economic engine. */
  history: { year: number; gdp: number; population: number }[];
}

export interface ProfileLand {
  hasGeometry: boolean;
  areaSqKm: number | null;
  capital: { name: string; population: number | null } | null;
  cities: {
    id: string;
    name: string;
    population: number | null;
    isCapital: boolean;
    isPort: boolean;
  }[];
  subdivisions: {
    id: string;
    name: string;
    type: string;
    population: number | null;
    capital: string | null;
  }[];
  storyPins: {
    id: string;
    title: string;
    category: string;
    year: number | null;
    eraLabel: string | null;
    excerpt: string | null;
  }[];
  neighbors: { name: string; countryId: string | null }[];
  profile: {
    coastlineKm: number | null;
    isLandlocked: boolean;
    isIsland: boolean;
    dominantClimate: string | null;
    dominantElevation: string | null;
    arableLandPercent: number | null;
  } | null;
  isLoading: boolean;
}

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
  directives: PublicDirective[];
  issueOutcomes: PublicIssueOutcome[];
  /** Resolved issues known only by title when the viewer cannot read outcomes (signed out). */
  resolvedIssueTitles: { id: string; title: string; ixTime: number }[];
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
  rankings: { category: string; rank: number; total: number; value: string }[];
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
  lore: ProfileLore;
  vitals: ProfileVitals;
  land: ProfileLand;
  state: ProfileState;
  world: ProfileWorld;
  chronicle: ChronicleEntry[];
  /** Null unless the signed-in viewer owns this country. */
  owner: ProfileOwnerLayer | null;
  currentIxTime: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function toLand(bundle: GeoBundle | undefined, isLoading: boolean): ProfileLand {
  const cities = rows(bundle?.cities).map((c) => ({
    id: String(c.id),
    name: String(c.name),
    population: realNumber(c.population),
    isCapital: c.isNationalCapital === true,
    isPort: c.isPort === true,
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

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface UseCountryProfileLayerOptions {
  country: CountryWithEconomicData | null | undefined;
  /** Resolved flag (country.flag or the flag service). */
  flagUrl: string | null;
  /** The signed-in viewer owns this country (reveals the owner layer). */
  isOwner: boolean;
  /** Any signed-in viewer (resolved-issue outcomes need a session). */
  isSignedIn: boolean;
  currentIxTime: number;
}

export function useCountryProfileLayer({
  country,
  flagUrl,
  isOwner,
  isSignedIn,
  currentIxTime,
}: UseCountryProfileLayerOptions): CountryProfileLayer | null {
  // `getByIdWithEconomicData` returns `any`; narrow the fields this layer reads.
  const c = country as Record<string, any> | null | undefined;
  const countryId: string = c?.id ?? "";
  const enabled = !!countryId;
  const wikiSource = (str(c?.wikiSource) ?? "ixwiki") as "ixwiki" | "iiwiki" | "althistory";
  const articleTitle = str(c?.wikiPageTitle) ?? (c?.name ? String(c.name).replace(/_/g, " ") : "");

  // Lore: the infobox (identity, founding dates) and the article text (chapters).
  const wikiProfile = api.wikiCache.getCountryProfile.useQuery(
    { countryName: articleTitle, wikiSource },
    { enabled: !!articleTitle, ...WIKI }
  );
  const wikitext = api.wikios.getWikitext.useQuery(
    { title: articleTitle },
    { enabled: !!articleTitle && wikiSource === "ixwiki", ...WIKI }
  );
  const redirect = redirectTarget(wikitext.data?.wikitext);
  const redirected = api.wikios.getWikitext.useQuery(
    { title: redirect ?? "" },
    { enabled: !!redirect, ...WIKI }
  );

  // Land, state and world.
  const geo = api.countryGeo.getCountryGeoBundle.useQuery({ countryId }, { enabled, ...MAP });
  const intents = api.intent.getTree.useQuery({ countryId }, { enabled, ...STATIC });
  const canon = api.mycountry.getCanonFeed.useQuery(
    { countryId, limit: 40 },
    { enabled, ...STATIC }
  );
  const government = api.government.getByCountryId.useQuery(
    { countryId, budgetYearsLimit: 1, revenueSourcesLimit: 1 },
    { enabled, ...STATIC }
  );
  const election = api.elections.getElectionStatus.useQuery({ countryId }, { enabled, ...STATIC });
  const rankings = api.mycountry.getRankings.useQuery({ countryId }, { enabled, ...STATIC });
  const relations = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled, ...STATIC }
  );
  const embassies = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { enabled, ...STATIC }
  );

  // Resolved-issue outcomes need a session (protected); the owner layer needs ownership.
  const issueHistory = api.nationalIssues.getHistory.useQuery(
    { countryId, limit: 30 },
    { enabled: enabled && isSignedIn, ...STATIC }
  );
  const pending = api.nationalIssues.getPendingCount.useQuery(
    { countryId },
    { enabled: enabled && isOwner, ...STATIC }
  );

  return useMemo<CountryProfileLayer | null>(() => {
    if (!c) return null;
    const infobox = wikiProfile.data?.infobox ?? null;
    const identityRow = (c.nationalIdentity ?? null) as Record<string, unknown> | null;
    const name = String(c.name).replace(/_/g, " ");

    // ── Identity: in-app national identity first, then the wiki infobox.
    const coatFile = str(infobox?.image_coat) ?? str(infobox?.coat_of_arms);
    const identity: ProfileIdentity = {
      name,
      officialName:
        str(identityRow?.officialName) ??
        str(infobox?.conventional_long_name) ??
        str(infobox?.official_name),
      motto: str(identityRow?.motto) ?? str(infobox?.motto) ?? str(infobox?.national_motto),
      anthem: str(identityRow?.nationalAnthem) ?? str(infobox?.national_anthem),
      demonym: str(identityRow?.demonym) ?? str(infobox?.demonym),
      capital: str(identityRow?.capitalCity) ?? str(infobox?.capital),
      languages: str(identityRow?.officialLanguages) ?? str(infobox?.official_languages),
      currency: str(identityRow?.currency) ?? str(infobox?.currency),
      governmentType:
        str(identityRow?.governmentType) ?? str(c.governmentType) ?? str(infobox?.government_type),
      leaders: infoboxLeaders(infobox),
      continent: str(c.continent),
      region: str(c.region),
      realm: str(c.realm?.name),
      flagUrl,
      coatOfArmsUrl:
        str(c.coatOfArms) ??
        (coatFile
          ? (resolveImageUrl(coatFile, wikiProfile.data?.wikiSource ?? wikiSource) ?? null)
          : null),
      sovereign: c.owner
        ? {
            username: str(c.owner.forumUsername) ?? str(c.owner.wikiUsername),
            roleName: str(c.owner.role?.displayName) ?? str(c.owner.role?.name),
          }
        : null,
    };

    // ── Lore: prologue + one wiki section per chapter.
    const text = redirect ? (redirected.data?.wikitext ?? "") : (wikitext.data?.wikitext ?? "");
    const article = splitWikiSections(text);
    let prologue = leadParagraphs(article.lead);
    if (prologue.length === 0) {
      // Non-IxWiki sources (and articles missing from the shadow store): the cached overview.
      prologue = wikiToParagraphs(wikiProfile.data?.sections?.[0]?.content ?? "", { max: 3 });
    }
    const chapters: Partial<Record<LoreChapter, LoreSection>> = {};
    for (const chapter of Object.keys(LORE_CHAPTER_KEYWORDS) as LoreChapter[]) {
      const section = pickLoreSection(article.sections, LORE_CHAPTER_KEYWORDS[chapter], {
        max: chapter === "history" ? 6 : 3,
      });
      if (section) chapters[chapter] = section;
    }
    const loreLoading =
      wikiProfile.isLoading ||
      (wikiSource === "ixwiki" && (wikitext.isLoading || (!!redirect && redirected.isLoading)));
    const founding = infoboxFounding(infobox);
    const lore: ProfileLore = {
      articleTitle: redirect ?? articleTitle,
      wikiHref: titleToWikiOSRoute(redirect ?? articleTitle),
      prologue,
      chapters,
      founding,
      isLoading: loreLoading,
      isEmpty: !loreLoading && prologue.length === 0 && Object.keys(chapters).length === 0,
    };

    // ── Vitals: straight from the economic engine; missing stays null.
    const stability = c.stabilityMetrics as { stabilityScore?: number } | null | undefined;
    const vitals: ProfileVitals = {
      population: realNumber(c.currentPopulation),
      populationGrowth: realNumber(c.populationGrowthRate, { allowZero: true }),
      gdpTotal: realNumber(c.currentTotalGdp),
      gdpPerCapita: realNumber(c.currentGdpPerCapita),
      gdpGrowth: realNumber(c.adjustedGdpGrowth, { allowZero: true }),
      economicTier: str(c.economicTier),
      populationTier: str(c.populationTier),
      landArea: realNumber(c.landArea),
      density: realNumber(c.populationDensity),
      unemployment: realNumber(c.unemploymentRate, { allowZero: true }),
      inflation: realNumber(c.inflationRate, { allowZero: true }),
      lifeExpectancy: realNumber(c.lifeExpectancy),
      literacy: realNumber(c.literacyRate),
      urbanShare: realNumber(c.urbanPopulationPercent),
      gini: realNumber(c.incomeInequalityGini),
      povertyRate: realNumber(c.povertyRate),
      debtToGdp: realNumber(c.totalDebtGDPRatio),
      taxRevenueShare: realNumber(c.taxRevenueGDPPercent),
      publicApproval: realNumber(c.publicApproval),
      stabilityScore: realNumber(stability?.stabilityScore),
      history: yearlySeries(c.historical),
    };

    // ── Land.
    const land = toLand(geo.data, geo.isLoading);

    // ── State: public record only.
    const directives = toPublicDirectives(intents.data?.allIntents as never);
    const issueOutcomes = toPublicIssueOutcomes(issueHistory.data?.issues as never);
    const toIxTime = (ms: number) => IxTime.convertToIxTime(ms);
    const { decisions, diplomacy } = splitCanonFeed(canon.data, toIxTime);
    const outcomeIds = new Set(issueOutcomes.map((o) => o.id));
    const gov = government.data;
    const status = election.data;
    const state: ProfileState = {
      government: gov
        ? {
            name: gov.governmentName,
            type: gov.governmentType,
            headOfState: str(gov.headOfState),
            headOfGovernment: str(gov.headOfGovernment),
            legislature: str(gov.legislatureName),
            executive: str(gov.executiveName),
            judiciary: str(gov.judicialName),
            departments: (gov.departments ?? []).map((d) => d.name).slice(0, 12),
          }
        : null,
      directives,
      issueOutcomes,
      resolvedIssueTitles: decisions.filter((d) => !outcomeIds.has(d.id)),
      election:
        status && (status.lastElection || status.upcoming)
          ? {
              lastName: status.lastElection?.name ?? null,
              lastIxTime: status.lastElection?.scheduledIxTime ?? null,
              turnout: realNumber(status.lastElection?.turnout),
              results: (status.lastElection?.results ?? []).map((r) => ({
                partyName: r.partyName,
                color: r.color,
                votePercentage: r.votePercentage,
                seatsWon: r.seatsWon,
              })),
              upcomingName: status.upcoming?.name ?? null,
              upcomingIxTime: status.upcoming?.scheduledIxTime ?? null,
              totalSeats: status.totalSeats,
            }
          : null,
      isLoading: intents.isLoading || government.isLoading,
    };

    // ── World.
    const world: ProfileWorld = {
      rankings: (rankings.data ?? []).map((r) => ({
        category: r.category,
        rank: r.global.position,
        total: r.global.total,
        value: formatCensusValue(r),
      })),
      relations: (relations.data ?? []).map((r) => ({
        id: r.id,
        countryId: r.targetCountryId,
        name: r.targetCountryName,
        flagUrl: r.targetCountryFlag ?? null,
        relationship: String(r.relationship),
        strength: r.strength,
        treaties: Array.isArray(r.treaties) ? r.treaties.map(String) : [],
      })),
      embassies: (embassies.data ?? [])
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
      isLoading: rankings.isLoading || relations.isLoading,
    };

    // ── Chronicle: lore dates + map story pins + the IxTime record.
    const chronicle = buildChronicle({
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
    });

    // ── Owner layer (never rendered for visitors).
    const ownerCounts = countOwnerDirectives(intents.data?.allIntents as never);
    const owner: ProfileOwnerLayer | null = isOwner
      ? {
          activeIssues: pending.data?.total ?? null,
          urgentIssues: pending.data?.urgent ?? null,
          draftDirectives: ownerCounts.drafts,
          directivesInForce: ownerCounts.active,
        }
      : null;

    return {
      countryId,
      slug: str(c.slug) ?? name.replace(/\s+/g, "_"),
      identity,
      lore,
      vitals,
      land,
      state,
      world,
      chronicle,
      owner,
      currentIxTime,
    };
  }, [
    c,
    countryId,
    flagUrl,
    isOwner,
    currentIxTime,
    articleTitle,
    wikiSource,
    redirect,
    wikiProfile.data,
    wikiProfile.isLoading,
    wikitext.data,
    wikitext.isLoading,
    redirected.data,
    redirected.isLoading,
    geo.data,
    geo.isLoading,
    intents.data,
    intents.isLoading,
    canon.data,
    government.data,
    government.isLoading,
    election.data,
    rankings.data,
    rankings.isLoading,
    relations.data,
    relations.isLoading,
    embassies.data,
    issueHistory.data,
    pending.data,
  ]);
}
