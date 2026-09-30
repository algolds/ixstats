"use client";

import { useMemo } from "react";
import { OpenBook } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { FacetMaterial } from "~/components/ui/facet";
import { FacetList } from "~/components/ui/facet-list";
import { EmptyState } from "~/components/ui/empty-state";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { cn } from "~/lib/utils/cn";
import { CornerFlag } from "~/components/country-profile/CornerFlag";
import { LoreProse } from "~/components/country-profile/LoreProse";
import { OwnerLayer } from "~/components/country-profile/OwnerLayer";
import { TerritoryMap } from "~/components/country-profile/TerritoryMap";
import { ChronicleTimeline } from "~/components/country-profile/ChronicleTimeline";
import { DirectiveRows, IssueOutcomeRows } from "~/components/country-profile/StateRecord";
import { EmbassyRows, RankingGrid, RelationRows } from "~/components/country-profile/WorldStanding";
import { EconomyTrend } from "~/components/country-profile/EconomyTrend";
import { QuickActions } from "~/components/country-profile/QuickActions";
import {
  ElectionSummary,
  GovernmentRows,
  IdentityRows,
  LandRows,
  PlaceRows,
  StatGrid,
  StoryPinRows,
} from "~/components/country-profile/ProfileFacts";
import { economyVitals, headlineVitals, peopleVitals } from "~/components/country-profile/vitals";
import { useScrollSpy } from "~/components/country-profile/useScrollSpy";
import { scrollBehavior } from "~/components/country-profile/labels";
import type { CountryProfileLayer } from "../../_hooks/useCountryProfileLayer";
import type { LoreSection } from "../../_utils/profileLayer";
import { ProfileLayerLoading, type PrototypeViewProps, useProfilePrototypeLayer } from "./shared";

type ChapterKey = "prologue" | "land" | "people" | "economy" | "state" | "world" | "chronicle";

const CHAPTER_TITLES: Record<ChapterKey, string> = {
  prologue: "Prologue",
  land: "The Land",
  people: "The People",
  economy: "The Economy",
  state: "The State",
  world: "The World",
  chronicle: "Chronicle",
};

const NUMERALS = ["", "I", "II", "III", "IV", "V", "VI", "VII"];
const chapterId = (key: ChapterKey) => `chapter-${key}`;

/**
 * Prototype A · Chronicle — the profile as an editorial long read. Chapters (Prologue → Land →
 * People → Economy → State → World → Chronicle) open with a National title and wiki lore in the
 * Reading style, with the live data woven in beneath. A sticky glass command rail carries the
 * vitals, a scroll-spy chapter index and quick actions; below 1024px it becomes a summary strip
 * plus a chapter pill scroller.
 */
export function ChronicleProfileView(props: PrototypeViewProps) {
  const layer = useProfilePrototypeLayer(props);
  if (!layer) return <ProfileLayerLoading />;
  return <ChronicleBody layer={layer} onOpenFactbook={props.onOpenFactbook} />;
}

function ChronicleBody({
  layer,
  onOpenFactbook,
}: {
  layer: CountryProfileLayer;
  onOpenFactbook: () => void;
}) {
  const { identity, lore, vitals, land, state, world, chronicle } = layer;

  // A chapter appears when it has lore or data; the prologue always does.
  const chapters = useMemo(() => {
    const has: Record<ChapterKey, boolean> = {
      prologue: true,
      land:
        !!lore.chapters.land ||
        land.hasGeometry ||
        land.cities.length > 0 ||
        !!land.profile ||
        land.storyPins.length > 0,
      people: !!lore.chapters.people || peopleVitals(vitals).length > 0,
      economy:
        !!lore.chapters.economy || economyVitals(vitals).length > 0 || vitals.history.length > 1,
      state:
        !!lore.chapters.state ||
        !!state.government ||
        state.directives.length > 0 ||
        state.issueOutcomes.length > 0 ||
        state.resolvedIssueTitles.length > 0 ||
        !!state.election,
      world:
        !!lore.chapters.world ||
        world.rankings.length > 0 ||
        world.relations.length > 0 ||
        world.embassies.length > 0 ||
        land.neighbors.length > 0,
      chronicle: !!lore.chapters.history || chronicle.length > 0,
    };
    return (Object.keys(CHAPTER_TITLES) as ChapterKey[]).filter((k) => has[k]);
  }, [lore, land, vitals, state, world, chronicle]);

  const active = useScrollSpy(chapters.map(chapterId));
  const vitalStats = headlineVitals(vitals);
  const numeral = (key: ChapterKey) => NUMERALS[chapters.indexOf(key) + 1] ?? "";

  const jump = (key: ChapterKey) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(chapterId(key));
    if (!el) return;
    event.preventDefault();
    el.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    window.history.replaceState(window.history.state, "", `#${chapterId(key)}`);
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <article aria-label={`${identity.name}: a chronicle`} className="min-w-0 space-y-12">
        {/* ── Hero */}
        <FacetCard padding="lg" className="relative overflow-hidden">
          <CornerFlag src={identity.flagUrl} />
          <div className="relative space-y-3">
            <Eyebrow>
              {[identity.continent, identity.region, identity.realm].filter(Boolean).join(" · ") ||
                "Sovereign state"}
            </Eyebrow>
            <h1 className="text-display text-label text-balance">{identity.name}</h1>
            {identity.officialName && identity.officialName !== identity.name && (
              <p className="text-title-3 text-label-secondary font-normal">
                {identity.officialName}
              </p>
            )}
            {identity.motto && (
              <p className="text-body text-label-secondary font-serif italic">
                &ldquo;{identity.motto}&rdquo;
              </p>
            )}
            {identity.sovereign?.username && (
              <p className="text-footnote text-label-secondary">
                Governed by {identity.sovereign.username}
                {identity.sovereign.roleName ? ` · ${identity.sovereign.roleName}` : ""}
              </p>
            )}
          </div>
        </FacetCard>

        <OwnerLayer owner={layer.owner} />

        {/* ── Compact rail (<1024px): summary strip + chapter pills. The pill bar is a direct
            child of the article so it stays pinned for the whole read. */}
        {vitalStats.length > 0 && (
          <FacetCard padding="md" className="lg:hidden">
            <dl className="flex gap-6 overflow-x-auto">
              {vitalStats.map((s) => (
                <div key={s.key} className="min-w-28 shrink-0">
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <Stat size="sm" label={s.label} value={s.value} delta={s.delta} />
                  </dd>
                </div>
              ))}
            </dl>
          </FacetCard>
        )}
        <FacetMaterial
          as="nav"
          material="thin"
          aria-label="Chapters"
          className="z-sticky sticky top-[var(--shell-top-offset,5rem)] -mt-8 overflow-x-auto rounded-full p-1 lg:hidden"
        >
          <ol className="flex w-max gap-1">
            {chapters.map((key) => (
              <li key={key}>
                <a
                  href={`#${chapterId(key)}`}
                  onClick={jump(key)}
                  aria-current={active === chapterId(key) ? "location" : undefined}
                  className={cn(
                    "text-subhead focus-visible:outline-tint duration-fast block rounded-full px-3 py-2 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
                    active === chapterId(key)
                      ? "bg-tint text-on-tint"
                      : "text-label-secondary hover:bg-fill-4"
                  )}
                >
                  {CHAPTER_TITLES[key]}
                </a>
              </li>
            ))}
          </ol>
        </FacetMaterial>

        {/* ── Prologue */}
        <Chapter id="prologue" numeral={numeral("prologue")}>
          {lore.isLoading ? (
            <ProseSkeleton />
          ) : lore.prologue.length > 0 ? (
            <LoreProse
              paragraphs={lore.prologue}
              source={{ heading: lore.articleTitle, href: lore.wikiHref }}
            />
          ) : (
            <EmptyState
              compact
              icon={<OpenBook />}
              title="No wiki article yet"
              message={`${identity.name}'s story has not been written on the wiki.`}
              className="bg-surface-secondary rounded-row max-w-[38rem]"
            />
          )}
          <FacetList className="max-w-[38rem]">
            <IdentityRows identity={identity} header="At a glance" />
          </FacetList>
        </Chapter>

        {chapters.includes("land") && (
          <Chapter
            id="land"
            numeral={numeral("land")}
            lore={lore.chapters.land}
            loading={lore.isLoading}
            wikiHref={lore.wikiHref}
          >
            <TerritoryMap
              countryId={layer.countryId}
              hasGeometry={land.hasGeometry}
              isLoading={land.isLoading}
            />
            <FacetList className="grid gap-6 md:grid-cols-2 md:items-start">
              <LandRows land={land} />
              <PlaceRows land={land} />
              <StoryPinRows land={land} />
            </FacetList>
          </Chapter>
        )}

        {chapters.includes("people") && (
          <Chapter
            id="people"
            numeral={numeral("people")}
            lore={lore.chapters.people}
            loading={lore.isLoading}
            wikiHref={lore.wikiHref}
          >
            <DataCard>
              <StatGrid
                stats={[
                  ...headlineVitals(vitals).filter((s) => s.key === "population"),
                  ...peopleVitals(vitals),
                ]}
              />
            </DataCard>
          </Chapter>
        )}

        {chapters.includes("economy") && (
          <Chapter
            id="economy"
            numeral={numeral("economy")}
            lore={lore.chapters.economy}
            loading={lore.isLoading}
            wikiHref={lore.wikiHref}
          >
            <DataCard className="space-y-6">
              <StatGrid
                stats={[
                  ...headlineVitals(vitals).filter((s) => s.key === "gdp" || s.key === "gdppc"),
                  ...economyVitals(vitals),
                ]}
              />
              <EconomyTrend points={vitals.history} />
            </DataCard>
          </Chapter>
        )}

        {chapters.includes("state") && (
          <Chapter
            id="state"
            numeral={numeral("state")}
            lore={lore.chapters.state}
            loading={lore.isLoading}
            wikiHref={lore.wikiHref}
          >
            <FacetList>
              <GovernmentRows state={state} />
            </FacetList>
            {state.election && (
              <DataCard>
                <Eyebrow className="mb-3 block">Parliament</Eyebrow>
                <ElectionSummary state={state} />
              </DataCard>
            )}
            <FacetList>
              <DirectiveRows directives={state.directives} limit={8} />
              <IssueOutcomeRows outcomes={state.issueOutcomes} limit={8} />
              {state.issueOutcomes.length === 0 && state.resolvedIssueTitles.length > 0 && (
                <IssueOutcomeRows
                  outcomes={state.resolvedIssueTitles.slice(0, 8).map((t) => ({
                    id: t.id,
                    title: t.title,
                    domain: "Resolved",
                    decision: null,
                    outcome: null,
                    resolvedBy: "government",
                    ixTime: t.ixTime,
                  }))}
                  footer="Sign in to read the decisions taken and their outcomes."
                />
              )}
            </FacetList>
            {!state.government &&
              state.directives.length === 0 &&
              state.issueOutcomes.length === 0 &&
              state.resolvedIssueTitles.length === 0 && (
                <EmptyState
                  compact
                  title="No public record yet"
                  message="Enacted directives and resolved issues appear here."
                  className="bg-surface-secondary rounded-row"
                />
              )}
          </Chapter>
        )}

        {chapters.includes("world") && (
          <Chapter
            id="world"
            numeral={numeral("world")}
            lore={lore.chapters.world}
            loading={lore.isLoading}
            wikiHref={lore.wikiHref}
          >
            {world.rankings.length > 0 && (
              <DataCard>
                <Eyebrow className="mb-4 block">World Census</Eyebrow>
                <RankingGrid rankings={world.rankings} />
              </DataCard>
            )}
            <FacetList className="grid gap-6 md:grid-cols-2 md:items-start">
              <RelationRows relations={world.relations} limit={8} />
              <EmbassyRows embassies={world.embassies} limit={8} />
            </FacetList>
            {land.neighbors.length > 0 && (
              <p className="text-callout text-label-secondary max-w-[38rem]">
                <span className="text-label">Borders: </span>
                {land.neighbors.map((n) => n.name).join(", ")}.
              </p>
            )}
          </Chapter>
        )}

        {chapters.includes("chronicle") && (
          <Chapter
            id="chronicle"
            numeral={numeral("chronicle")}
            lore={lore.chapters.history}
            loading={lore.isLoading}
            wikiHref={lore.wikiHref}
          >
            {chronicle.length > 0 ? (
              <DataCard>
                <ChronicleTimeline entries={chronicle} />
              </DataCard>
            ) : (
              <EmptyState
                compact
                title="No dated events yet"
                message="Founding dates, map stories and the IxTime record appear here."
                className="bg-surface-secondary rounded-row"
              />
            )}
          </Chapter>
        )}
      </article>

      {/* ── Command rail (≥1024px) */}
      <aside aria-label="Command rail" className="hidden lg:block">
        <FacetMaterial
          material="regular"
          className="rounded-card shadow-floating sticky top-[var(--shell-top-offset,5rem)] space-y-5 p-4"
        >
          {vitalStats.length > 0 && (
            <section aria-label="Vitals" className="grid grid-cols-2 gap-x-4 gap-y-4">
              {vitalStats.map((s) => (
                <Stat key={s.key} size="sm" label={s.label} value={s.value} delta={s.delta} />
              ))}
            </section>
          )}
          <nav aria-label="Chapters" className="border-separator border-t pt-4">
            <ol className="flex flex-col gap-0.5">
              {chapters.map((key) => (
                <li key={key}>
                  <a
                    href={`#${chapterId(key)}`}
                    onClick={jump(key)}
                    aria-current={active === chapterId(key) ? "location" : undefined}
                    className={cn(
                      "text-body rounded-control-sm focus-visible:outline-tint duration-fast flex items-baseline gap-2 px-2 py-2 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
                      active === chapterId(key)
                        ? "bg-tint-fill text-tint font-medium"
                        : "text-label-secondary hover:bg-fill-4 hover:text-label"
                    )}
                  >
                    <span className="text-footnote w-6 shrink-0 tabular-nums">{numeral(key)}</span>
                    {CHAPTER_TITLES[key]}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="border-separator border-t pt-4">
            <QuickActions
              countryId={layer.countryId}
              wikiHref={lore.isEmpty ? null : lore.wikiHref}
              hasGeometry={land.hasGeometry}
              onOpenFactbook={onOpenFactbook}
            />
          </div>
        </FacetMaterial>
      </aside>

      {/* Quick actions stay reachable below 1024px, after the story. */}
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
  );
}

function Chapter({
  id,
  numeral,
  lore,
  loading,
  wikiHref,
  children,
}: {
  id: ChapterKey;
  numeral: string;
  lore?: LoreSection;
  loading?: boolean;
  wikiHref?: string;
  children: React.ReactNode;
}) {
  const titleId = `${chapterId(id)}-title`;
  return (
    <section
      id={chapterId(id)}
      aria-labelledby={titleId}
      className="scroll-mt-[calc(var(--shell-top-offset,5rem)+4rem)] space-y-6 lg:scroll-mt-[calc(var(--shell-top-offset,5rem)+1rem)]"
    >
      <header className="border-separator space-y-1 border-t pt-6">
        {numeral && <Eyebrow>Chapter {numeral}</Eyebrow>}
        <h2
          id={titleId}
          className="font-display text-label text-[calc(1.875rem*var(--text-scale,1))] leading-[1.15] font-bold tracking-[-0.02em]"
        >
          {CHAPTER_TITLES[id]}
        </h2>
      </header>
      {id !== "prologue" &&
        (loading ? (
          <ProseSkeleton lines={3} />
        ) : lore ? (
          <LoreProse
            paragraphs={lore.paragraphs}
            source={
              wikiHref ? { heading: lore.heading, href: sectionHref(wikiHref, lore.heading) } : null
            }
          />
        ) : null)}
      {children}
    </section>
  );
}

/** Deep link to the wiki section the lore came from. */
function sectionHref(articleHref: string, heading: string) {
  return `${articleHref}#${encodeURIComponent(heading.replace(/ /g, "_"))}`;
}

function DataCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <FacetCard padding="md" className={className}>
      {children}
    </FacetCard>
  );
}

function ProseSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="max-w-[38rem] space-y-3" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
