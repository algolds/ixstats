"use client";

import { skipToken } from "@tanstack/react-query";
import { Album, BookStack, Plus } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { CardFace } from "~/components/cards/face/CardFace";
import { CardFaceDown } from "~/components/cards/face/CardFaceDown";
import { cardCount } from "~/lib/cards/curation-limits";
import { SHOWCASE_LIMITS } from "~/lib/cards/face/showcase-limits";
import type { SheetFrom } from "~/lib/cards/face/sheet-link";
import type { ShowcaseSummary } from "~/lib/cards/hub/showcases";
import { ShowcaseEditorDialog } from "./ShowcaseEditorDialog";
import { ShowcaseBadges, ShowcaseView } from "./ShowcaseView";

interface SetsPaneProps {
  onOpenCard: (cardId: string, from?: SheetFrom | null) => void;
  /** `?showcase=<id>`: the showcase on screen, or null for the list. */
  showcaseId: string | null;
  onShowcaseChange: (showcaseId: string | null) => void;
}

/** Sets: the player's free-form showcases now, and the place the set binders fill later. */
export function SetsPane({ onOpenCard, showcaseId, onShowcaseChange }: SetsPaneProps) {
  const shown = api.cards.getShowcase.useQuery(showcaseId ? { showcaseId } : skipToken);
  if (showcaseId && shown.isLoading) return <Skeleton className="rounded-card h-64" />;
  // A showcase that is private, gone, or an old name-slug bookmark comes back null (or fails its input check):
  // the list shows instead, with nothing to report.
  if (showcaseId && shown.data) {
    return (
      <ShowcaseView
        showcase={shown.data}
        onBack={() => onShowcaseChange(null)}
        onOpenCard={onOpenCard}
      />
    );
  }
  return <SetsOverview onOpenShowcase={onShowcaseChange} />;
}

function ShowcaseTile({ showcase, onOpen }: { showcase: ShowcaseSummary; onOpen: () => void }) {
  return (
    <Card
      interactive
      padding="sm"
      aria-label={`Open ${showcase.name}`}
      onClick={onOpen}
      className="flex items-center gap-3"
    >
      {showcase.cover ? (
        <CardFace face={showcase.cover} size="S" className="w-16" />
      ) : (
        <CardFaceDown size="S" className="w-16" />
      )}
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

function SetsOverview({ onOpenShowcase }: { onOpenShowcase: (showcaseId: string) => void }) {
  const showcases = api.cards.listMyShowcases.useQuery();
  const atLimit = (showcases.data?.length ?? 0) >= SHOWCASE_LIMITS.perPlayer;
  return (
    <div className="space-y-8">
      <section aria-labelledby="sets-showcases" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="sets-showcases" className="text-headline">
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
