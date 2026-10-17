"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { keepPreviousData } from "@tanstack/react-query";
import { List, MultiplePages, ViewGrid } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button, focusRing } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { AddToShowcaseDialog } from "~/components/cards/showcase/AddToShowcaseDialog";
import { useDebounce } from "~/hooks/useDebounce";
import { EMPTY_CARD_FILTERS, mineFilterInput, type CardFilters } from "~/lib/cards/face/filters";
import { MINE_SORT_OPTIONS, type MineSort } from "~/lib/cards/face/mine-options";
import type { CardFaceData } from "~/lib/cards/face/types";
import type { MineRow } from "~/lib/cards/hub/mine";
import { CARD_HUB_PATHS, STORE_PATH } from "~/lib/cards/hub-routes";
import { cn } from "~/lib/utils/cn";
import { CardFilterBar, type FilterDimension } from "./CardFilterBar";
import { CardGrid } from "./CardGrid";
import { MineBulkBar } from "./MineBulkBar";
import { MineList } from "./MineList";

const MINE_DIMENSIONS: readonly FilterDimension[] = [
  "realm",
  "rarity",
  "finish",
  "type",
  "category",
  "duplicates",
];
const PAGE = 60;
type MineView = "grid" | "list";

interface ViewOption {
  value: MineView;
  label: ReactNode;
  "aria-label": string;
  icon: ReactNode;
}

/** Icons alone on a phone, where the bar is short of room. */
const VIEW_OPTIONS: readonly ViewOption[] = [
  {
    value: "grid",
    label: <span className="max-sm:sr-only">Grid</span>,
    "aria-label": "Grid",
    icon: <ViewGrid />,
  },
  {
    value: "list",
    label: <span className="max-sm:sr-only">List</span>,
    "aria-label": "List",
    icon: <List />,
  },
];

/** The set with `id` added, or taken out when it is already there. */
function toggled(set: ReadonlySet<string> | null, id: string): Set<string> {
  const next = new Set(set ?? []);
  if (!next.delete(id)) next.add(id);
  return next;
}

/** Mine: every copy the player holds, as a still grid or a list with values, and a select mode for bulk actions. */
export function MinePane({ onOpenCard }: { onOpenCard: (cardId: string) => void }) {
  const [filters, setFilters] = useState<CardFilters>(EMPTY_CARD_FILTERS);
  const [sort, setSort] = useState<MineSort>("acquired");
  const [view, setView] = useState<MineView>("grid");
  const [selected, setSelected] = useState<ReadonlySet<string> | null>(null);
  const [showcasing, setShowcasing] = useState(false);
  const panelId = useId();
  const search = useDebounce(filters.search, 300);
  const query = api.cards.listMine.useInfiniteQuery(
    { ...mineFilterInput({ ...filters, search }), sort, limit: PAGE },
    {
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      // A new search or filter keeps the cards on screen until its page arrives.
      placeholderData: keepPreviousData,
    }
  );
  const pages = query.data?.pages ?? [];
  const rows = pages.flatMap((p) => p.rows);
  const totalCopies = pages[0]?.totalCopies ?? 0;
  const picked = useMemo(() => (selected ? [...selected] : []), [selected]);
  // Select mode picks from the grid, whichever view was on.
  const shownView: MineView = selected ? "grid" : view;

  const open = (face: CardFaceData) => {
    const copyId = face.copy?.ownershipId;
    if (!selected) onOpenCard(face.cardId);
    else if (copyId) setSelected((previous) => toggled(previous, copyId));
  };

  return (
    <div className="space-y-4">
      <CardFilterBar
        filters={filters}
        onChange={setFilters}
        dimensions={MINE_DIMENSIONS}
        realms={pages[0]?.realms ?? []}
        sort={sort}
        sortOptions={MINE_SORT_OPTIONS}
        onSortChange={setSort}
        trailing={
          <>
            <SegmentedControl
              asTabs
              size="sm"
              aria-label="View"
              value={shownView}
              onValueChange={setView}
              disabled={selected !== null}
              getTabPanelId={() => panelId}
              options={VIEW_OPTIONS}
            />
            <Button
              variant="secondary"
              disabled={totalCopies === 0}
              onClick={() => setSelected(selected ? null : new Set())}
            >
              {selected ? "Cancel" : "Select"}
            </Button>
          </>
        }
      />
      <div role="tabpanel" id={panelId}>
        <MineBody
          loading={query.isLoading}
          // A failed refresh keeps the cards it already has; only a list that never loaded says so.
          failed={query.isError && !query.data}
          onRetry={() => void query.refetch()}
          totalCopies={totalCopies}
          rows={rows}
          view={shownView}
          selected={selected}
          onOpen={open}
          onClearFilters={() => setFilters(EMPTY_CARD_FILTERS)}
        />
      </div>
      {query.hasNextPage && (
        <Button
          variant="secondary"
          className="w-full"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Show more
        </Button>
      )}
      {selected && (
        <MineBulkBar
          count={selected.size}
          onAddToShowcase={() => setShowcasing(true)}
          onDone={() => setSelected(null)}
        />
      )}
      {/* Closing keeps the picked copies, so a dismissed dialog loses nothing; Done or Cancel lets them go. */}
      <AddToShowcaseDialog open={showcasing} onOpenChange={setShowcasing} ownershipIds={picked} />
    </div>
  );
}

function MineBody(props: {
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  totalCopies: number;
  rows: MineRow[];
  view: MineView;
  selected: ReadonlySet<string> | null;
  onOpen: (face: CardFaceData) => void;
  onClearFilters: () => void;
}) {
  if (props.loading) return <Skeleton className="rounded-card h-64" />;
  if (props.failed) {
    return (
      <EmptyState
        title="Your cards did not load"
        action={
          <Button variant="secondary" onClick={props.onRetry}>
            Try again
          </Button>
        }
      />
    );
  }
  if (props.totalCopies === 0) {
    return (
      <EmptyState
        icon={<MultiplePages />}
        title="No cards yet"
        message={
          <>
            Explore every realm&apos;s cards, or buy a pack in the{" "}
            <Link
              href={STORE_PATH}
              className={cn("text-tint-ink rounded-control-sm underline", focusRing)}
            >
              Store
            </Link>
            .
          </>
        }
        action={
          <Button asChild>
            <Link href={CARD_HUB_PATHS.explore}>Explore cards</Link>
          </Button>
        }
      />
    );
  }
  if (props.rows.length === 0) {
    return (
      <EmptyState
        title="No cards match these filters"
        action={
          <Button variant="secondary" onClick={props.onClearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  }
  if (props.view === "list") return <MineList rows={props.rows} onOpen={props.onOpen} />;
  return (
    <CardGrid
      faces={props.rows.map((r) => r.face)}
      onOpen={props.onOpen}
      selected={props.selected}
      label="Your cards"
    />
  );
}
