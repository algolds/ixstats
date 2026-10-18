"use client";

import { useEffect, useEffectEvent, useRef, type RefObject } from "react";
import { skipToken } from "@tanstack/react-query";
import { Album, BookStack, Plus } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button, focusRing } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { CardFace } from "~/components/cards/face/CardFace";
import { CardFaceDown } from "~/components/cards/face/CardFaceDown";
import { cardCount } from "~/lib/cards/curation-limits";
import { SHOWCASE_LIMITS } from "~/lib/cards/face/showcase-limits";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";
import type { ShowcaseSummary } from "~/lib/cards/hub/showcases";
import { cn } from "~/lib/utils/cn";
import { ShowcaseEditorDialog } from "./ShowcaseEditorDialog";
import { ShowcaseBadges, ShowcaseView } from "./ShowcaseView";

interface SetsPaneProps {
  onOpenCard: (cardId: string, from?: SheetFrom | null) => void;
  /** `?showcase=<id>`: the showcase on screen, or null for the list. */
  showcaseId: string | null;
  onShowcaseChange: (showcaseId: string | null) => void;
}

/**
 * Moves focus to the heading of what the pane shows once that changes (the list, or a showcase), since the control
 * that changed it is gone: a tile, Back, Delete, or a new showcase's Create. The first screen takes no focus, so a
 * hub tab that mounts the pane keeps it, and neither does the same screen again (Strict Mode runs the mount twice).
 * `screen` is null while a showcase loads.
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

/** Sets: the player's free-form showcases now, and the place the set binders fill later. */
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
  return <SetsOverview headingRef={heading} onOpenShowcase={onShowcaseChange} />;
}

/** The tile's name says what its face shows: the count, and whether it is pinned, public or private. */
function tileLabel(showcase: ShowcaseSummary): string {
  const status = showcase.pinned ? "pinned" : showcase.isPublic ? "public" : "private";
  return `Open ${showcase.name}, ${cardCount(showcase.itemCount)}, ${status}`;
}

function ShowcaseTile({ showcase, onOpen }: { showcase: ShowcaseSummary; onOpen: () => void }) {
  return (
    <Card
      interactive
      padding="sm"
      aria-label={tileLabel(showcase)}
      onClick={onOpen}
      className="flex items-center gap-3"
    >
      {/* Size S at its own width: narrower, the face has no room for its title. */}
      {showcase.cover ? <CardFace face={showcase.cover} size="S" /> : <CardFaceDown size="S" />}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-headline truncate">{showcase.name}</p>
        <p className="text-footnote text-label-secondary tabular-nums">
          {cardCount(showcase.itemCount)}
        </p>
        <ShowcaseBadges showcase={showcase} />
      </div>
    </Card>
  );
}

interface ShowcaseListProps {
  query: { data?: ShowcaseSummary[]; isLoading: boolean; isError: boolean; refetch: () => void };
  onOpen: (showcaseId: string) => void;
}

function ShowcaseList({ query, onOpen }: ShowcaseListProps) {
  if (query.isLoading) return <Skeleton className="rounded-card h-32" />;
  // A failed refresh keeps the showcases it already has; only a list that never loaded says so.
  if (query.isError && !query.data) {
    return (
      <EmptyState
        compact
        title="Your showcases did not load"
        action={
          <Button variant="secondary" onClick={query.refetch}>
            Try again
          </Button>
        }
      />
    );
  }
  const list = query.data ?? [];
  if (list.length === 0) {
    return (
      <EmptyState
        icon={<Album />}
        title="No showcases yet"
        message="Gather the cards you are proudest of. Pin a public showcase and your wallet shows it."
      />
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((showcase) => (
        <li key={showcase.id}>
          <ShowcaseTile showcase={showcase} onOpen={() => onOpen(showcase.id)} />
        </li>
      ))}
    </ul>
  );
}

function SetsOverview({
  headingRef,
  onOpenShowcase,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  onOpenShowcase: (showcaseId: string) => void;
}) {
  const showcases = api.cards.listMyShowcases.useQuery();
  const atLimit = (showcases.data?.length ?? 0) >= SHOWCASE_LIMITS.perPlayer;
  return (
    <div className="space-y-8">
      <section aria-labelledby="sets-showcases" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="sets-showcases"
            ref={headingRef}
            tabIndex={-1}
            className={cn("text-headline rounded-control-sm", focusRing)}
          >
            Showcases
          </h2>
          <ShowcaseEditorDialog
            showcase={null}
            onSaved={onOpenShowcase}
            trigger={
              <Button
                size="sm"
                disabled={atLimit}
                aria-describedby={atLimit ? "sets-showcase-limit" : undefined}
              >
                <Plus />
                New showcase
              </Button>
            }
          />
        </div>
        {atLimit && (
          <p id="sets-showcase-limit" className="text-footnote text-label-secondary">
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
        />
      </section>
      <section aria-labelledby="sets-binders" className="space-y-4">
        <h2 id="sets-binders" className="text-headline">
          Set binders
        </h2>
        <Card padding="md">
          <EmptyState
            compact
            icon={<BookStack />}
            title="No set binders yet"
            message="Each realm's sets will show here, with the cards you are still missing."
          />
        </Card>
      </section>
    </div>
  );
}
