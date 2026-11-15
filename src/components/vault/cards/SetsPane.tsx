"use client";

import { useEffect, useEffectEvent, useId, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { skipToken } from "@tanstack/react-query";
import { Album, BookStack, NavArrowDown, NavArrowUp, Plus, WarningCircle } from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button, focusRing } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { CutoutCard, CutoutCardContent, CutoutCardHeader } from "~/components/ui/cutout-card";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Skeleton } from "~/components/ui/skeleton";
import { CardFace } from "~/components/cards/face/CardFace";
import { CardFaceDown } from "~/components/cards/face/CardFaceDown";
import { RarityMark } from "~/components/cards/face/RarityMark";
import { RealmCrest } from "~/components/cards/face/RealmCrest";
import { cardCount } from "~/lib/cards/curation-limits";
import { SHOWCASE_LIMITS } from "~/lib/cards/face/showcase-limits";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";
import type { RealmShelf } from "~/lib/cards/hub/explore";
import type { MineRow } from "~/lib/cards/hub/mine";
import type { ShowcaseSummary } from "~/lib/cards/hub/showcases";
import { CARD_HUB_PATHS } from "~/lib/cards/hub-routes";
import { cn } from "~/lib/utils/cn";
import { ShowcaseEditorDialog } from "./ShowcaseEditorDialog";
import { ShowcaseBadges, ShowcaseView } from "./ShowcaseView";

const CHECKLIST_LIMIT = 96;
const MINE_SAMPLE_LIMIT = 120;

interface SetsPaneProps {
  onOpenCard: (cardId: string, from?: SheetFrom | null) => void;
  /** `?showcase=<id>`: the showcase on screen, or null for the album shelf. */
  showcaseId: string | null;
  onShowcaseChange: (showcaseId: string | null) => void;
}

/**
 * Moves focus to the heading of what the pane shows once that changes (the shelf, or a showcase), since the control
 * that changed it is gone: a tile, Back, Delete, or a new showcase's Create. The first screen takes no focus, so a
 * route mount keeps its natural focus, and neither does the same screen again (Strict Mode runs the mount twice).
 */
function useHeadingFocus(screen: string | null) {
  const heading = useRef<HTMLHeadingElement>(null);
  const lastShown = useRef<string | null>(null);
  useEffect(() => {
    if (screen === null) return;
    if (lastShown.current !== null && lastShown.current !== screen) heading.current?.focus();
    lastShown.current = screen;
  }, [screen]);
  return heading;
}

/** Distinct non-trophy, non-retired cards collected per realm, matching the Explore album counts. */
function countOwnedByRealm(rows: readonly MineRow[]): Map<string, number> {
  const sets = new Map<string, Set<string>>();
  for (const { face } of rows) {
    if (face.isRetired || face.cardType === "TROPHY") continue;
    const realmSet = sets.get(face.realm.id) ?? new Set<string>();
    realmSet.add(face.cardId);
    sets.set(face.realm.id, realmSet);
  }
  return new Map([...sets].map(([realmId, ids]) => [realmId, ids.size]));
}

function checklistSubtitle(season: number | null, cardNumber: number | null): string | undefined {
  const parts: string[] = [];
  if (season !== null) parts.push(`Season ${season}`);
  if (cardNumber !== null) parts.push(`#${cardNumber}`);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** Expandable card checklist inside a season or realm album card. */
function AlbumChecklist({
  id,
  realmId,
  realmName,
  total,
  onOpenCard,
}: {
  id: string;
  realmId: string;
  realmName: string;
  total: number;
  onOpenCard: (cardId: string) => void;
}) {
  const query = api.cards.exploreGrid.useQuery({
    realmId,
    sort: "title",
    limit: CHECKLIST_LIMIT,
  });

  if (query.isLoading) return <Skeleton id={id} className="rounded-row h-28" />;
  if (query.isError && !query.data) {
    return (
      <div
        id={id}
        className="border-separator flex items-center justify-between gap-2 border-t pt-3"
      >
        <p className="text-footnote text-label-secondary">Checklist did not load.</p>
        <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  const faces = query.data?.faces ?? [];
  return (
    <div id={id} className="border-separator max-h-64 overflow-y-auto border-t pt-2">
      <FacetList variant="plain">
        <FacetListSection
          aria-label={`${realmName} checklist`}
          footer={
            total > faces.length
              ? `Showing ${faces.length.toLocaleString()} of ${total.toLocaleString()} cards. Browse the realm for the full index.`
              : undefined
          }
        >
          {faces.map((face) => {
            const sub = checklistSubtitle(face.season, face.number);
            return (
              <FacetRow
                key={face.cardId}
                onClick={() => onOpenCard(face.cardId)}
                title={face.title}
                subtitle={sub ? <span className="tabular-nums">{sub}</span> : undefined}
                trailing={
                  <span className="inline-flex items-center gap-2">
                    <RarityMark rarity={face.rarity} />
                    <Badge variant={face.uncollected ? "outline" : "success"}>
                      {face.uncollected ? "Missing" : "Owned"}
                    </Badge>
                  </span>
                }
              />
            );
          })}
        </FacetListSection>
      </FacetList>
    </div>
  );
}

/** One realm or season album on the shelf, with completion meter and inline checklist disclosure. */
function AlbumShelfCard({
  shelf,
  owned,
  expanded,
  onToggle,
  onOpenCard,
}: {
  shelf: RealmShelf;
  owned: number;
  expanded: boolean;
  onToggle: () => void;
  onOpenCard: (cardId: string) => void;
}) {
  const checklistId = useId();
  const total = shelf.cardCount;
  const clampedOwned = Math.min(owned, total);
  const missing = Math.max(0, total - clampedOwned);
  const pct = total > 0 ? Math.round((clampedOwned / total) * 100) : 0;
  const previewFaces = shelf.newest.slice(0, 3).map((entry) => entry.face);

  return (
    <CutoutCard className="flex h-full flex-col">
      <CutoutCardHeader
        as="h3"
        icon={<Album />}
        trailing={
          <Badge variant="secondary">
            {clampedOwned.toLocaleString()}/{total.toLocaleString()}
          </Badge>
        }
      >
        {shelf.realm.name}
      </CutoutCardHeader>
      <CutoutCardContent className="flex flex-1 flex-col gap-4 p-4 pt-2">
        <div className="bg-fill-4 rounded-row flex items-center justify-between gap-3 p-3">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            {previewFaces.length > 0 ? (
              previewFaces.map((face) => (
                <CardFace
                  key={face.cardId}
                  face={face}
                  size="S"
                  className="w-16 shrink-0"
                  onOpen={() => onOpenCard(face.cardId)}
                />
              ))
            ) : (
              <CardFaceDown size="S" className="w-16 shrink-0" />
            )}
          </div>
          <RealmCrest realm={shelf.realm} size="md" />
        </div>

        <div className="space-y-1.5">
          <div className="text-footnote flex items-center justify-between gap-2 tabular-nums">
            <span className="text-label font-medium">{pct}% complete</span>
            <span className="text-label-secondary">
              {missing === 0 ? "Complete album" : `${missing.toLocaleString()} missing`}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`${shelf.realm.name} completion`}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={clampedOwned}
            className="bg-fill-3 h-2 w-full overflow-hidden rounded-full"
          >
            <div
              className="bg-tint duration-fast ease-out-facet h-full rounded-full transition-[width] motion-reduce:transition-none"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={expanded}
            aria-controls={checklistId}
            onClick={onToggle}
          >
            {expanded ? "Hide checklist" : "View checklist"}
            {expanded ? <NavArrowUp aria-hidden /> : <NavArrowDown aria-hidden />}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`${CARD_HUB_PATHS.explore}?realm=${encodeURIComponent(shelf.realm.slug)}`}>
              Browse realm
            </Link>
          </Button>
        </div>

        {expanded && (
          <AlbumChecklist
            id={checklistId}
            realmId={shelf.realm.id}
            realmName={shelf.realm.name}
            total={total}
            onOpenCard={onOpenCard}
          />
        )}
      </CutoutCardContent>
    </CutoutCard>
  );
}

/** Sets: season and realm album shelves with completion meters, plus personal showcases. */
export function SetsPane({ onOpenCard, showcaseId, onShowcaseChange }: SetsPaneProps) {
  const shown = api.cards.getShowcase.useQuery(showcaseId ? { showcaseId } : skipToken);
  // A showcase that is private, gone, or an old name-slug bookmark comes back null (or fails its input check), and
  // one can fail to load: the list shows instead, with nothing to report.
  const unknown = showcaseId !== null && !shown.isLoading && !shown.data;
  const loading = showcaseId !== null && shown.isLoading;
  const heading = useHeadingFocus(loading ? null : unknown ? "list" : (showcaseId ?? "list"));
  // Dropping `?showcase=` lets a press on that showcase's tile ask for it afresh.
  const clearShowcase = useEffectEvent(() => onShowcaseChange(null));
  useEffect(() => {
    if (unknown) clearShowcase();
  }, [unknown]);

  if (loading) return <Skeleton className="rounded-card h-64" />;
  if (showcaseId && shown.data) {
    return (
      <ShowcaseView
        showcase={shown.data}
        headingRef={heading}
        onBack={() => onShowcaseChange(null)}
        onOpenCard={onOpenCard}
      />
    );
  }
  return (
    <SetsOverview headingRef={heading} onOpenCard={onOpenCard} onOpenShowcase={onShowcaseChange} />
  );
}

/** The tile's name says what its face shows: the count, and whether it is pinned, public or private. */
function tileLabel(showcase: ShowcaseSummary): string {
  const status = showcase.pinned ? "pinned" : showcase.isPublic ? "public" : "private";
  return `Open ${showcase.name}, ${cardCount(showcase.itemCount)}, ${status}`;
}

function ShowcaseTile({
  showcase,
  onOpen,
  onOpenCard,
}: {
  showcase: ShowcaseSummary;
  onOpen: () => void;
  onOpenCard: (cardId: string) => void;
}) {
  const cap = SHOWCASE_LIMITS.items;
  const pct = Math.min(100, Math.round((showcase.itemCount / cap) * 100));

  return (
    <CutoutCard className="flex h-full flex-col">
      <CutoutCardHeader
        as="h3"
        icon={<BookStack />}
        trailing={
          <Badge variant="secondary">
            {showcase.itemCount.toLocaleString()}/{cap.toLocaleString()}
          </Badge>
        }
      >
        {showcase.name}
      </CutoutCardHeader>
      <CutoutCardContent className="flex flex-1 flex-col gap-3 p-4 pt-2">
        <div className="flex items-center gap-3">
          {showcase.cover ? (
            <CardFace
              face={showcase.cover}
              size="S"
              className="w-16 shrink-0"
              onOpen={() => onOpenCard(showcase.cover!.cardId)}
            />
          ) : (
            <CardFaceDown size="S" className="w-16 shrink-0" />
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            {showcase.description && (
              <p className="text-footnote text-label-secondary line-clamp-2">
                {showcase.description}
              </p>
            )}
            <ShowcaseBadges showcase={showcase} />
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-footnote text-label-secondary flex items-center justify-between tabular-nums">
            <span>{pct}% filled</span>
            <span>{cardCount(showcase.itemCount)}</span>
          </div>
          <div className="bg-fill-3 h-1.5 w-full overflow-hidden rounded-full" aria-hidden>
            <div className="bg-tint h-full rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="mt-auto pt-1">
          <Button variant="secondary" size="sm" aria-label={tileLabel(showcase)} onClick={onOpen}>
            Open showcase
          </Button>
        </div>
      </CutoutCardContent>
    </CutoutCard>
  );
}

interface ShowcaseListProps {
  query: { data?: ShowcaseSummary[]; isLoading: boolean; isError: boolean; refetch: () => void };
  onOpen: (showcaseId: string) => void;
  onOpenCard: (cardId: string) => void;
}

function ShowcaseList({ query, onOpen, onOpenCard }: ShowcaseListProps) {
  if (query.isLoading) return <Skeleton className="rounded-card h-32" />;
  // A failed refresh keeps the showcases it already has; only a list that never loaded says so.
  if (query.isError && !query.data) {
    return (
      <Card>
        <EmptyState
          compact
          role="alert"
          icon={<WarningCircle />}
          title="Your showcases did not load"
          message="Try loading your showcases again."
          action={
            <Button variant="secondary" onClick={query.refetch}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  }
  const list = query.data ?? [];
  if (list.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Album />}
          title="No showcases yet"
          message="Gather the cards you are proudest of. Pin a public showcase and your wallet shows it."
        />
      </Card>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((showcase) => (
        <li key={showcase.id}>
          <ShowcaseTile
            showcase={showcase}
            onOpen={() => onOpen(showcase.id)}
            onOpenCard={onOpenCard}
          />
        </li>
      ))}
    </ul>
  );
}

/** Header action for creating a showcase on the Sets overview. */
export function NewShowcaseAction({ onSaved }: { onSaved: (showcaseId: string) => void }) {
  const showcases = api.cards.listMyShowcases.useQuery();
  const atLimit = (showcases.data?.length ?? 0) >= SHOWCASE_LIMITS.perPlayer;
  return (
    <ShowcaseEditorDialog
      showcase={null}
      onSaved={onSaved}
      trigger={
        <Button
          size="sm"
          disabled={atLimit}
          aria-describedby={atLimit ? "sets-showcase-limit" : undefined}
        >
          <Plus aria-hidden />
          New showcase
        </Button>
      }
    />
  );
}

function AlbumShelfSection({ onOpenCard }: { onOpenCard: (cardId: string) => void }) {
  const [expandedRealmId, setExpandedRealmId] = useState<string | null>(null);
  const shelvesQuery = api.cards.exploreShelves.useQuery();
  const mineQuery = api.cards.listMine.useQuery({ sort: "acquired", limit: MINE_SAMPLE_LIMIT });
  const ownedByRealm = countOwnedByRealm(mineQuery.data?.rows ?? []);
  const shelves = shelvesQuery.data?.shelves ?? [];

  if (shelvesQuery.isLoading) return <Skeleton className="rounded-card h-48" />;
  if (shelvesQuery.isError && !shelvesQuery.data) {
    return (
      <Card>
        <EmptyState
          compact
          role="alert"
          icon={<WarningCircle />}
          title="Season albums did not load"
          message="Try loading the album shelf again."
          action={
            <Button variant="secondary" onClick={() => void shelvesQuery.refetch()}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  }
  if (shelves.length === 0) {
    return (
      <Card padding="md">
        <EmptyState
          compact
          icon={<BookStack />}
          title="No season albums yet"
          message="Realm and season sets appear here once cards are minted."
        />
      </Card>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {shelves.map((shelf) => (
        <li key={shelf.realm.id}>
          <AlbumShelfCard
            shelf={shelf}
            owned={ownedByRealm.get(shelf.realm.id) ?? 0}
            expanded={expandedRealmId === shelf.realm.id}
            onToggle={() =>
              setExpandedRealmId((prev) => (prev === shelf.realm.id ? null : shelf.realm.id))
            }
            onOpenCard={onOpenCard}
          />
        </li>
      ))}
    </ul>
  );
}

function SetsOverview({
  headingRef,
  onOpenCard,
  onOpenShowcase,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  onOpenCard: (cardId: string, from?: SheetFrom | null) => void;
  onOpenShowcase: (showcaseId: string) => void;
}) {
  const showcases = api.cards.listMyShowcases.useQuery();
  const atLimit = (showcases.data?.length ?? 0) >= SHOWCASE_LIMITS.perPlayer;
  return (
    <div className="space-y-8">
      <section aria-labelledby="sets-albums" className="space-y-4">
        <h2 id="sets-albums" className="text-headline">
          Season &amp; realm albums
        </h2>
        <AlbumShelfSection onOpenCard={(cardId) => onOpenCard(cardId)} />
      </section>
      <section aria-labelledby="sets-showcases" className="space-y-4">
        <h2
          id="sets-showcases"
          ref={headingRef}
          tabIndex={-1}
          className={cn("text-headline rounded-control-sm", focusRing)}
        >
          Showcases
        </h2>
        {atLimit && (
          <p id="sets-showcase-limit" className="text-footnote text-label-secondary tabular-nums">
            {`You have ${SHOWCASE_LIMITS.perPlayer} showcases, the most you can keep.`}
          </p>
        )}
        <ShowcaseList
          query={{
            data: showcases.data,
            isLoading: showcases.isLoading,
            isError: showcases.isError,
            refetch: () => void showcases.refetch(),
          }}
          onOpen={onOpenShowcase}
          onOpenCard={(cardId) => onOpenCard(cardId)}
        />
      </section>
    </div>
  );
}
