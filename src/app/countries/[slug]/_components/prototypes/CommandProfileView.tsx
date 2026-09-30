"use client";

import { useState } from "react";
import { Bank, Clock, Coins, Globe, Map as MapIcon, OpenBook, Sparks } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetCard } from "~/components/ui/facet-container";
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
import { Stat } from "~/components/ui/stat";
import { cn } from "~/lib/utils/cn";
import { ChronicleTimeline } from "~/components/country-profile/ChronicleTimeline";
import { CornerFlag } from "~/components/country-profile/CornerFlag";
import { EconomyTrend } from "~/components/country-profile/EconomyTrend";
import { LoreProse } from "~/components/country-profile/LoreProse";
import { OwnerLayer } from "~/components/country-profile/OwnerLayer";
import { QuickActions } from "~/components/country-profile/QuickActions";
import { DirectiveRows, IssueOutcomeRows } from "~/components/country-profile/StateRecord";
import { TerritoryMap } from "~/components/country-profile/TerritoryMap";
import { EmbassyRows, RankingGrid, RelationRows } from "~/components/country-profile/WorldStanding";
import {
  ElectionSummary,
  GovernmentRows,
  IdentityRows,
  StatGrid,
  StoryPinRows,
} from "~/components/country-profile/ProfileFacts";
import { economyVitals, headlineVitals, peopleVitals } from "~/components/country-profile/vitals";
import { useScrollSpy } from "~/components/country-profile/useScrollSpy";
import { scrollBehavior } from "~/components/country-profile/labels";
import type { CountryProfileLayer } from "../../_hooks/useCountryProfileLayer";
import { formatBig, type LoreChapter } from "../../_utils/profileLayer";
import { ProfileLayerLoading, type PrototypeViewProps, useProfilePrototypeLayer } from "./shared";

/** The dock: one entry per domain tile (the retired sample CommandProfileView's DOCK_ITEMS idea). */
const DOCK_ITEMS = [
  { id: "glance", label: "At a glance", icon: Sparks },
  { id: "land", label: "Territory", icon: MapIcon },
  { id: "lore", label: "Lore", icon: OpenBook },
  { id: "economy", label: "Economy", icon: Coins },
  { id: "state", label: "State", icon: Bank },
  { id: "world", label: "World", icon: Globe },
  { id: "chronicle", label: "Chronicle", icon: Clock },
] as const;
type DockId = (typeof DOCK_ITEMS)[number]["id"];

const tileId = (id: DockId) => `command-${id}`;

const LORE_TITLES: Record<LoreChapter, string> = {
  land: "The land",
  people: "The people",
  economy: "The economy",
  state: "The state",
  world: "The world",
  history: "History",
};

/**
 * Prototype B · Command — the profile as a Command OS dashboard: a bento of domain tiles fed by
 * the same layer as Chronicle, with a dock (side rail ≥1024px, bottom bar below) that jumps
 * between domains. Lore stays readable in the Reading style inside the story sheet.
 */
export function CommandProfileView(props: PrototypeViewProps) {
  const layer = useProfilePrototypeLayer(props);
  if (!layer) return <ProfileLayerLoading />;
  return <CommandBody layer={layer} onOpenFactbook={props.onOpenFactbook} />;
}

function CommandBody({
  layer,
  onOpenFactbook,
}: {
  layer: CountryProfileLayer;
  onOpenFactbook: () => void;
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
                "focus-visible:outline-tint duration-fast flex items-center gap-2 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
                orientation === "vertical"
                  ? "text-body rounded-control-sm w-full px-3 py-2"
                  : "text-caption flex-col rounded-full px-3 py-1",
                current
                  ? "bg-tint-fill text-tint"
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
      {/* ── Side dock (≥1024px) */}
      <aside aria-label="Command dock" className="hidden lg:block">
        <FacetMaterial
          as="nav"
          material="regular"
          aria-label="Domains"
          className="rounded-card shadow-floating sticky top-[var(--shell-top-offset,5rem)] space-y-4 p-2"
        >
          {dock("vertical")}
          <div className="border-separator border-t px-1 pt-3 pb-1">
            <QuickActions
              countryId={layer.countryId}
              wikiHref={lore.isEmpty ? null : lore.wikiHref}
              hasGeometry={land.hasGeometry}
              onOpenFactbook={onOpenFactbook}
            />
          </div>
        </FacetMaterial>
      </aside>

      <div className="min-w-0 space-y-6">
        {/* ── At a glance */}
        <FacetCard
          id={tileId("glance")}
          padding="lg"
          className="relative scroll-mt-[calc(var(--shell-top-offset,5rem)+1rem)] overflow-hidden"
        >
          <CornerFlag src={identity.flagUrl} />
          <div className="relative space-y-5">
            <div className="space-y-2">
              <Eyebrow>
                {[identity.continent, identity.region, identity.realm]
                  .filter(Boolean)
                  .join(" · ") || "Sovereign state"}
              </Eyebrow>
              <h1 className="text-display text-label text-balance">{identity.name}</h1>
              {identity.motto && (
                <p className="text-body text-label-secondary font-serif italic">
                  &ldquo;{identity.motto}&rdquo;
                </p>
              )}
            </div>
            {vitalStats.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                {vitalStats.map((s) => (
                  <div key={s.key}>
                    <dt className="sr-only">{s.label}</dt>
                    <dd>
                      <Stat label={s.label} value={s.value} delta={s.delta} hint={s.hint} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </FacetCard>

        <OwnerLayer owner={layer.owner} />

        {/* ── Bento */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-6 xl:grid-cols-12">
          <Tile
            id="land"
            eyebrow="Territory"
            title={land.capital ? `Capital: ${land.capital.name}` : "Territory"}
            className="md:col-span-6 xl:col-span-7"
          >
            <TerritoryMap
              countryId={layer.countryId}
              hasGeometry={land.hasGeometry}
              isLoading={land.isLoading}
              heightClass="h-80"
            />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {land.areaSqKm != null && (
                <StatCell label="Mapped area" value={`${formatBig(land.areaSqKm)} km²`} />
              )}
              {land.subdivisions.length > 0 && (
                <StatCell label="Regions" value={String(land.subdivisions.length)} />
              )}
              {land.cities.length > 0 && (
                <StatCell label="Cities" value={String(land.cities.length)} />
              )}
              {land.profile?.coastlineKm != null && (
                <StatCell label="Coastline" value={`${formatBig(land.profile.coastlineKm)} km`} />
              )}
              {land.profile?.dominantClimate && (
                <StatCell label="Climate" value={land.profile.dominantClimate} />
              )}
              {land.neighbors.length > 0 && (
                <StatCell label="Neighbours" value={String(land.neighbors.length)} />
              )}
            </dl>
          </Tile>

          <Tile
            id="lore"
            eyebrow="Lore"
            title={lore.articleTitle}
            className="md:col-span-6 xl:col-span-5"
            action={
              lore.prologue.length > 0 || loreChapters.length > 0 ? (
                <Button variant="tinted" size="sm" onClick={() => setStoryOpen(true)}>
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
              <div className="relative max-h-72 overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
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
            eyebrow="Economy"
            title={vitals.economicTier ?? "Economy"}
            className="md:col-span-6 xl:col-span-7"
          >
            <StatGrid
              stats={[
                ...vitalStats.filter((s) => s.key === "gdp" || s.key === "gdppc"),
                ...economyVitals(vitals),
              ]}
              columns="grid-cols-2 sm:grid-cols-4"
            />
            <EconomyTrend points={vitals.history} />
            {economyVitals(vitals).length === 0 &&
              vitals.history.length < 2 &&
              vitalStats.length === 0 && (
                <EmptyState compact icon={<Coins />} title="No economic data" />
              )}
          </Tile>

          <Tile
            id="people"
            dock={false}
            eyebrow="People"
            title={identity.demonym ?? "People"}
            className="md:col-span-6 xl:col-span-5"
          >
            <StatGrid
              stats={[...vitalStats.filter((s) => s.key === "population"), ...peopleVitals(vitals)]}
              columns="grid-cols-2"
            />
            <FacetList variant="plain">
              <IdentityRows
                identity={{ ...identity, officialName: null, governmentType: null, leaders: [] }}
                header="Identity"
              />
            </FacetList>
          </Tile>

          <Tile
            id="state"
            eyebrow="State"
            title={state.government?.name ?? identity.governmentType ?? "Government"}
            className="md:col-span-6 xl:col-span-6"
          >
            <FacetList variant="plain">
              <GovernmentRows state={state} />
            </FacetList>
            <ElectionSummary state={state} />
            <FacetList variant="plain">
              <DirectiveRows directives={state.directives} limit={4} header="Directives" />
              <IssueOutcomeRows outcomes={state.issueOutcomes} limit={3} header="Decisions" />
            </FacetList>
            {!state.government &&
              state.directives.length === 0 &&
              state.issueOutcomes.length === 0 &&
              !state.election && (
                <EmptyState
                  compact
                  icon={<Bank />}
                  title="No public record yet"
                  message="Enacted directives and resolved issues appear here."
                />
              )}
          </Tile>

          <Tile
            id="world"
            eyebrow="World"
            title="Standing and relations"
            className="md:col-span-6 xl:col-span-6"
          >
            <RankingGrid rankings={world.rankings} limit={6} />
            <FacetList variant="plain">
              <RelationRows relations={world.relations} limit={5} />
              <EmbassyRows embassies={world.embassies} limit={4} />
            </FacetList>
            {world.rankings.length === 0 &&
              world.relations.length === 0 &&
              world.embassies.length === 0 && (
                <EmptyState
                  compact
                  icon={<Globe />}
                  title="No world record yet"
                  message="Census ranks, relations and embassies appear here."
                />
              )}
          </Tile>

          <Tile
            id="chronicle"
            eyebrow="Chronicle"
            title="Latest in the record"
            className="md:col-span-6 xl:col-span-12"
            action={
              chronicle.length > 6 ? (
                <Button variant="gray" size="sm" onClick={() => setChronicleOpen(true)}>
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
              <EmptyState
                compact
                icon={<Clock />}
                title="No dated events yet"
                message="Founding dates, map stories and the IxTime record appear here."
              />
            )}
          </Tile>
        </div>

        {/* ── Bottom dock (<1024px), pinned while the dashboard is on screen */}
        <FacetMaterial
          as="nav"
          material="regular"
          aria-label="Domains"
          className="shadow-floating z-sticky sticky bottom-[calc(var(--shell-tabbar-height,0px)+1rem)] mx-auto w-fit max-w-full overflow-x-auto rounded-full p-1 lg:hidden"
        >
          {dock("horizontal")}
        </FacetMaterial>
        <div className="lg:hidden">
          <QuickActions
            layout="row"
            countryId={layer.countryId}
            wikiHref={lore.isEmpty ? null : lore.wikiHref}
            hasGeometry={land.hasGeometry}
            onOpenFactbook={onOpenFactbook}
          />
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
                  <h3 id={`story-${key}`} className="font-display text-title-1 text-label">
                    {LORE_TITLES[key]}
                  </h3>
                  <LoreProse
                    paragraphs={section.paragraphs}
                    source={{
                      heading: section.heading,
                      href: `${lore.wikiHref}#${encodeURIComponent(section.heading.replace(/ /g, "_"))}`,
                    }}
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

function Tile({
  id,
  eyebrow,
  title,
  action,
  dock = true,
  className,
  children,
}: {
  id: DockId | "people";
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
  /** Tiles without a dock entry still get an id for deep links. */
  dock?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const titleId = `command-${id}-title`;
  return (
    <section
      id={dock ? tileId(id as DockId) : `command-${id}`}
      aria-labelledby={titleId}
      className={cn("min-w-0 scroll-mt-[calc(var(--shell-top-offset,5rem)+1rem)]", className)}
    >
      <FacetCard padding="md" className="flex h-full flex-col gap-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 id={titleId} className="text-title-2 text-label truncate">
              {title}
            </h2>
          </div>
          {action}
        </header>
        {children}
      </FacetCard>
    </section>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <Stat size="sm" label={label} value={value} />
      </dd>
    </div>
  );
}
