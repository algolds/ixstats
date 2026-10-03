"use client";

import { useState } from "react";
import {
  Bank,
  Clock,
  Coins,
  Dna,
  Globe,
  Group,
  Map as MapIcon,
  OpenBook,
  Sparks,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetMaterial } from "~/components/ui/facet";
import { FacetList } from "~/components/ui/facet-list";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils/cn";
import type { CountryWithEconomicData } from "~/components/mycountry/shared/primitives/CountryDataProvider";
import { ChronicleTimeline } from "~/components/country-profile/ChronicleTimeline";
import { ConditionMatrix } from "~/components/country-profile/ConditionMatrix";
import { CountryDNA, DnaLegend } from "~/components/country-profile/CountryDNA";
import { CountryHero, type HeroCover } from "~/components/country-profile/CountryHero";
import { DiplomaticMatrix } from "~/components/country-profile/DiplomaticMatrix";
import { EconomyTrend } from "~/components/country-profile/EconomyTrend";
import { LoreProse } from "~/components/country-profile/LoreProse";
import { OwnerLayer } from "~/components/country-profile/OwnerLayer";
import { PulseBanner } from "~/components/country-profile/PulseBanner";
import { QuickActions } from "~/components/country-profile/QuickActions";
import { StateStructure } from "~/components/country-profile/StateStructure";
import { DirectiveRows, IssueOutcomeRows } from "~/components/country-profile/StateRecord";
import { TerritoryMap } from "~/components/country-profile/TerritoryMap";
import { EmbassyRows } from "~/components/country-profile/WorldStanding";
import {
  ElectionSummary,
  IdentityRows,
  LandRows,
  PlaceRows,
  StatGrid,
  StoryPinRows,
} from "~/components/country-profile/ProfileFacts";
import {
  conditionPillars,
  dnaSummary,
  stateBranches,
  toDnaAxes,
} from "~/components/country-profile/derive";
import { economyVitals, headlineVitals, peopleVitals } from "~/components/country-profile/vitals";
import { useScrollSpy } from "~/components/country-profile/useScrollSpy";
import { censusRealmName, scrollBehavior } from "~/components/country-profile/labels";
import { useCountryProfileLayer, type CountryProfileLayer } from "../_hooks/useCountryProfileLayer";
import type { LoreChapter } from "../_utils/profileLayer";
import { CountryTabs } from "./CountryTabs";
import { Card } from "~/components/ui/card";

/** The dock: one entry per domain. */
const DOCK_ITEMS = [
  { id: "glance", label: "Overview", icon: Sparks },
  { id: "dna", label: "Country DNA", icon: Dna },
  { id: "land", label: "Territory", icon: MapIcon },
  { id: "lore", label: "Lore", icon: OpenBook },
  { id: "economy", label: "Economy", icon: Coins },
  { id: "people", label: "People", icon: Group },
  { id: "state", label: "State", icon: Bank },
  { id: "world", label: "Foreign affairs", icon: Globe },
  { id: "chronicle", label: "Chronicle", icon: Clock },
] as const;
type DockId = (typeof DOCK_ITEMS)[number]["id"];

const tileId = (id: DockId) => `command-${id}`;
const SCROLL_MARGIN = "scroll-mt-[calc(var(--shell-top-offset,5rem)+1rem)]";

const LORE_TITLES: Record<LoreChapter, string> = {
  land: "The land",
  people: "The people",
  economy: "The economy",
  state: "The state",
  world: "The world",
  history: "History",
};

export interface CommandProfileViewProps {
  /** The country's URL slug (`/countries/[slug]`). */
  slug: string;
  country: CountryWithEconomicData;
  /** Resolved flag (country.flag or the flag service). */
  flagUrl: string | null;
  /** The signed-in viewer owns this country (reveals the owner layer and the cover picker). */
  isOwner: boolean;
  currentIxTime: number;
  cover?: HeroCover | null;
}

/**
 * CommandProfileView — the country profile (`/countries/[slug]`): the hero (cover, flag,
 * identity), the national pulse, then a sticky dock (side rail ≥1024px, bottom bar below) over a
 * stream of domain tiles: country DNA and condition, territory, lore, economy, people, state
 * structure, foreign affairs and the chronicle. Visitors see the public record only
 * (server-enforced); the owner also sees a private strip. The Factbook (`/factbook`) is the
 * deep-dive.
 */
export function CommandProfileView({
  slug,
  country,
  flagUrl,
  isOwner,
  currentIxTime,
  cover,
}: CommandProfileViewProps) {
  const layer = useCountryProfileLayer({ country, flagUrl, isOwner, currentIxTime });
  if (!layer) return <ProfileLoading />;
  return <CommandBody layer={layer} slug={slug} cover={cover ?? null} />;
}

function ProfileLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading profile">
      <Skeleton className="rounded-card h-64 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="rounded-card h-80 lg:col-span-2" />
        <Skeleton className="rounded-card h-80" />
      </div>
    </div>
  );
}

function CommandBody({
  layer,
  slug,
  cover,
}: {
  layer: CountryProfileLayer;
  slug: string;
  cover: HeroCover | null;
}) {
  const { identity, lore, vitals, land, state, world, chronicle } = layer;
  const [storyOpen, setStoryOpen] = useState(false);
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const active = useScrollSpy(
    DOCK_ITEMS.map((d) => tileId(d.id)),
    "-15% 0px -55% 0px"
  );

  const vitalStats = headlineVitals(vitals);
  const loreChapters = (Object.keys(LORE_TITLES) as LoreChapter[]).filter((k) => lore.chapters[k]);
  const dna = toDnaAxes(world.rankings);
  const dnaLine = dnaSummary(dna);
  // World Census ranks are realm ranks: label them with the realm they are drawn from.
  const censusRealm = censusRealmName(identity.realm);
  const pillars = conditionPillars(vitals);
  const inMatrix = new Set<string>(pillars.map((p) => p.key));
  const branches = stateBranches(state, identity);
  // Readings the condition matrix already shows are not repeated in the domain tiles.
  const economyStats = [
    ...vitalStats.filter((s) => s.key === "gdp" || s.key === "gdppc"),
    ...economyVitals(vitals).filter(
      (s) => !(s.key === "unemployment" && inMatrix.has("employment"))
    ),
  ];
  const peopleStats = [
    ...vitalStats.filter((s) => s.key === "population"),
    ...peopleVitals(vitals).filter((s) => !inMatrix.has(s.key)),
  ];
  const stateChapter = lore.chapters.state;
  const wikiAnchor = (heading: string) =>
    `${lore.wikiHref}#${encodeURIComponent(heading.replace(/ /g, "_"))}`;

  const jump = (id: DockId) => {
    document
      .getElementById(tileId(id))
      ?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  };

  const dock = (orientation: "vertical" | "horizontal") => (
    <ul className={cn("flex gap-1", orientation === "vertical" ? "flex-col" : "w-max")}>
      {DOCK_ITEMS.map((item) => {
        const Icon = item.icon;
        const current = active === tileId(item.id);
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => jump(item.id)}
              aria-current={current ? "location" : undefined}
              className={cn(
                "focus-visible:outline-tint flex items-center gap-2 focus-visible:outline-2 focus-visible:-outline-offset-2",
                orientation === "vertical"
                  ? "text-body rounded-control-sm w-full px-3 py-2"
                  : "text-caption flex-col justify-center rounded-full px-3 py-1 pointer-coarse:min-h-11",
                current
                  ? "bg-tint-fill text-tint ring-tint/30 font-semibold ring-1"
                  : "text-label-secondary hover:bg-fill-4 hover:text-label"
              )}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className={orientation === "horizontal" ? "whitespace-nowrap" : undefined}>
                {item.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-6">
      {/* ── Hero */}
      <CountryHero
        id={tileId("glance")}
        className={SCROLL_MARGIN}
        name={identity.name}
        officialName={identity.officialName}
        flagUrl={identity.flagUrl}
        eyebrow={[identity.continent, identity.region].filter(Boolean).join(" · ") || null}
        motto={identity.motto}
        facts={[
          { label: "Capital", value: identity.capital ?? land.capital?.name },
          { label: "Anthem", value: identity.anthem },
        ]}
        realm={identity.realm}
        sovereign={identity.sovereign}
        stats={vitalStats}
        cover={cover}
        countrySlug={layer.slug}
      />

      <CountryTabs countrySlug={slug} />
      <OwnerLayer owner={layer.owner} />
      <PulseBanner name={identity.name} vitals={vitals} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* ── Dock (≥1024px): domains and tools */}
        <aside aria-label="Profile sections" className="hidden lg:block">
          <Card className="sticky top-[var(--shell-top-offset,5rem)] space-y-4 p-2">
            <nav aria-labelledby="command-dock-domains" className="space-y-1">
              <h2 id="command-dock-domains" className="text-subhead text-label-secondary px-3 pt-1">
                Domains
              </h2>
              {dock("vertical")}
            </nav>
            <div className="border-separator space-y-2 border-t px-1 pt-3 pb-1">
              <h2 className="text-subhead text-label-secondary px-2">Tools</h2>
              <QuickActions
                countryId={layer.countryId}
                slug={slug}
                wikiHref={lore.isEmpty ? null : lore.wikiHref}
                hasGeometry={land.hasGeometry}
              />
            </div>
          </Card>
        </aside>

        <div className="min-w-0 space-y-6">
          {/* ── Country DNA and national condition */}
          <Tile id="dna" icon={Dna} title="Country DNA" subtitle={dnaLine ?? undefined}>
            {dna.length > 0 && (
              <div
                className={cn(
                  "grid grid-cols-1 items-center gap-6",
                  dna.length >= 3 && "md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]"
                )}
              >
                <CountryDNA
                  axes={dna}
                  caption={`${identity.name}'s World Census percentile within ${censusRealm} in ${dna.length} categories. ${dnaLine ?? ""}`}
                />
                <FacetList variant="plain">
                  <DnaLegend axes={dna} realm={censusRealm} />
                </FacetList>
              </div>
            )}
            {pillars.length >= 2 && (
              <section aria-labelledby="command-condition" className="space-y-3">
                <h3 id="command-condition" className="text-subhead text-label-secondary">
                  National condition
                </h3>
                <ConditionMatrix pillars={pillars} />
              </section>
            )}
            {dna.length === 0 && pillars.length < 2 && (
              <EmptyState compact icon={<Dna />} title="No standing on record yet" />
            )}
          </Tile>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-6 xl:grid-cols-12">
            <Tile
              id="land"
              icon={MapIcon}
              title="Territory"
              className="md:col-span-6 xl:col-span-7"
            >
              <TerritoryMap
                countryId={layer.countryId}
                hasGeometry={land.hasGeometry}
                isLoading={land.isLoading}
                heightClass="h-72"
              />
              <FacetList variant="plain">
                <LandRows land={land} header="Territorial attributes" />
                <PlaceRows land={land} limit={4} />
              </FacetList>
            </Tile>

            <Tile
              id="lore"
              icon={OpenBook}
              title="Lore"
              subtitle={lore.isEmpty ? undefined : `From the wiki article “${lore.articleTitle}”`}
              className="md:col-span-6 xl:col-span-5"
              action={
                lore.prologue.length > 0 || loreChapters.length > 0 ? (
                  <Button variant="secondary" size="sm" onClick={() => setStoryOpen(true)}>
                    <OpenBook aria-hidden />
                    Read the story
                  </Button>
                ) : undefined
              }
            >
              {lore.isLoading ? (
                <div className="space-y-3" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className={cn("h-4", i === 3 ? "w-1/2" : "w-full")} />
                  ))}
                </div>
              ) : lore.prologue.length > 0 ? (
                <div className="relative max-h-80 overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
                  <LoreProse paragraphs={lore.prologue.slice(0, 2)} />
                </div>
              ) : (
                <EmptyState
                  compact
                  icon={<OpenBook />}
                  title="No wiki article yet"
                  message={`${identity.name}'s story has not been written on the wiki.`}
                />
              )}
              {loreChapters.length > 0 && (
                <p className="text-footnote text-label-secondary">
                  {loreChapters.length} {loreChapters.length === 1 ? "chapter" : "chapters"}:{" "}
                  {loreChapters.map((k) => LORE_TITLES[k].toLowerCase()).join(", ")}
                </p>
              )}
            </Tile>

            <Tile
              id="economy"
              icon={Coins}
              title="Economy"
              subtitle={vitals.economicTier ? `${vitals.economicTier} economy` : undefined}
              className="md:col-span-6 xl:col-span-7"
            >
              <StatGrid stats={economyStats} columns="grid-cols-2 sm:grid-cols-4" />
              <EconomyTrend points={vitals.history} />
              {economyStats.length === 0 && vitals.history.length < 2 && (
                <EmptyState compact icon={<Coins />} title="No economic data" />
              )}
            </Tile>

            <Tile
              id="people"
              icon={Group}
              title="People"
              subtitle={identity.demonym ?? undefined}
              className="md:col-span-6 xl:col-span-5"
            >
              <StatGrid stats={peopleStats} columns="grid-cols-2" />
              <FacetList variant="plain">
                <IdentityRows
                  identity={{
                    ...identity,
                    officialName: null,
                    capital: null,
                    governmentType: null,
                    anthem: null,
                    leaders: [],
                  }}
                  header="Identity"
                />
              </FacetList>
              {peopleStats.length === 0 && !identity.languages && !identity.currency && (
                <EmptyState compact icon={<Group />} title="No population data" />
              )}
            </Tile>

            <Tile
              id="state"
              icon={Bank}
              title="State"
              subtitle={state.government?.name ?? identity.governmentType ?? undefined}
              className="md:col-span-6 xl:col-span-12"
            >
              <StateStructure
                branches={branches}
                system={state.government?.type ?? identity.governmentType}
                ministries={state.government?.departments ?? []}
                wikiSource={
                  stateChapter
                    ? { heading: stateChapter.heading, href: wikiAnchor(stateChapter.heading) }
                    : null
                }
              />
              <ElectionSummary state={state} />
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
                <FacetList variant="plain">
                  <DirectiveRows directives={state.directives} limit={4} header="Directives" />
                </FacetList>
                <FacetList variant="plain">
                  <IssueOutcomeRows outcomes={state.issueOutcomes} limit={4} header="Decisions" />
                </FacetList>
              </div>
              {branches.length === 0 &&
                state.directives.length === 0 &&
                state.issueOutcomes.length === 0 &&
                !state.election && (
                  <EmptyState compact icon={<Bank />} title="No public record yet" />
                )}
            </Tile>

            <Tile
              id="world"
              icon={Globe}
              title="Foreign affairs"
              className="md:col-span-6 xl:col-span-12"
            >
              <DiplomaticMatrix world={world} />
              <FacetList variant="plain">
                <EmbassyRows embassies={world.embassies} limit={6} />
              </FacetList>
              {world.relations.length === 0 && world.embassies.length === 0 && (
                <EmptyState compact icon={<Globe />} title="No foreign relations yet" />
              )}
            </Tile>

            <Tile
              id="chronicle"
              icon={Clock}
              title="Chronicle"
              className="md:col-span-6 xl:col-span-12"
              action={
                chronicle.length > 6 ? (
                  <Button variant="secondary" size="sm" onClick={() => setChronicleOpen(true)}>
                    Full chronicle
                  </Button>
                ) : undefined
              }
            >
              {chronicle.length > 0 ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  <ChronicleTimeline entries={chronicle} order="desc" limit={6} />
                  <FacetList variant="plain">
                    <StoryPinRows land={land} limit={3} />
                  </FacetList>
                </div>
              ) : (
                <EmptyState compact icon={<Clock />} title="No dated events yet" />
              )}
            </Tile>
          </div>

          {/* ── Bottom dock (<1024px), pinned while the stream is on screen: tab-bar acrylic */}
          <FacetMaterial
            as="nav"
            material="acrylic"
            aria-label="Domains"
            className="shadow-floating z-sticky sticky bottom-[calc(var(--shell-tabbar-height,0px)+1rem)] mx-auto w-fit max-w-full overflow-x-auto rounded-full p-1 lg:hidden"
          >
            {dock("horizontal")}
          </FacetMaterial>
          <div className="lg:hidden">
            <QuickActions
              layout="row"
              countryId={layer.countryId}
              slug={slug}
              wikiHref={lore.isEmpty ? null : lore.wikiHref}
              hasGeometry={land.hasGeometry}
            />
          </div>
        </div>
      </div>

      {/* ── Reading sheet: the whole story in the Reading style */}
      <Sheet open={storyOpen} onOpenChange={setStoryOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="mb-6">
            <SheetTitle>The story of {identity.name}</SheetTitle>
            <SheetDescription>From the wiki article “{lore.articleTitle}”.</SheetDescription>
          </SheetHeader>
          <div className="space-y-10 pb-6">
            {lore.prologue.length > 0 && <LoreProse paragraphs={lore.prologue} />}
            {loreChapters.map((key) => {
              const section = lore.chapters[key]!;
              return (
                <section key={key} aria-labelledby={`story-${key}`} className="space-y-3">
                  <h3 id={`story-${key}`} className="text-title-1 text-label">
                    {LORE_TITLES[key]}
                  </h3>
                  <LoreProse
                    paragraphs={section.paragraphs}
                    source={{ heading: section.heading, href: wikiAnchor(section.heading) }}
                  />
                </section>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={chronicleOpen} onOpenChange={setChronicleOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="mb-6">
            <SheetTitle>Chronicle of {identity.name}</SheetTitle>
            <SheetDescription>
              Founding dates, map stories and the IxTime record, newest first.
            </SheetDescription>
          </SheetHeader>
          <ChronicleTimeline entries={chronicle} order="desc" />
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** A domain tile: an opaque card with an icon, a title and an optional subtitle. */
function Tile({
  id,
  icon: Icon,
  title,
  subtitle,
  action,
  className,
  children,
}: {
  id: DockId;
  icon: typeof Bank;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const titleId = `${tileId(id)}-title`;
  return (
    <section
      id={tileId(id)}
      aria-labelledby={titleId}
      className={cn("min-w-0", SCROLL_MARGIN, className)}
    >
      <Card padding="md" className="flex h-full flex-col gap-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden
              className="bg-fill-3 text-label-secondary rounded-control-sm flex size-9 shrink-0 items-center justify-center"
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-title-2 text-label truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-callout text-label-secondary line-clamp-2">{subtitle}</p>
              )}
            </div>
          </div>
          {action}
        </header>
        {children}
      </Card>
    </section>
  );
}
