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
import type { MinePage, MineRow } from "~/lib/cards/hub/mine";
import { CARD_HUB_PATHS, STORE_PATH } from "~/lib/cards/hub-routes";
import { cn } from "~/lib/utils/cn";
import { CardFilterBar, type FilterDimension } from "./CardFilterBar";
import { CardGrid } from "./CardGrid";
import { MineBulkBar } from "./MineBulkBar";
import { MineList } from "./MineList";
import { MoreCards } from "./MoreCards";

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

const VIEW_LABEL: Record<MineView, string> = { grid: "Grid", list: "List" };

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

const copyIdOf = (row: MineRow) => row.face.copy?.ownershipId ?? row.face.cardId;

/** Every loaded row once: a copy minted or moved between page fetches shifts the offsets, so pages can overlap. */
function uniqueRows(pages: readonly MinePage[]): MineRow[] {
  const seen = new Set<string>();
  return pages
    .flatMap((p) => p.rows)
    .filter((row) => {
      const id = copyIdOf(row);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

/** The set with `id` added, or taken out when it is already there. */
function toggled(set: ReadonlySet<string> | null, id: string): Set<string> {
  const next = new Set(set ?? []);
  if (!next.delete(id)) next.add(id);
  return next;
}

/** Select mode's picks (null outside it), kept to the copies listed now. */
function useMinePicks(listed: ReadonlySet<string>) {
  const [selected, setSelected] = useState<ReadonlySet<string> | null>(null);
  // Picks a search or filter now hides, and copies that left Mine, are dropped, so an add never sends unseen cards.
  if (selected && [...selected].some((id) => !listed.has(id))) {
    setSelected(new Set([...selected].filter((id) => listed.has(id))));
  }
  const picked = useMemo(() => (selected ? [...selected] : []), [selected]);
  return {
    selected,
    picked,
    toggle: (id: string) => setSelected((previous) => toggled(previous, id)),
    start: () => setSelected(new Set()),
    stop: () => setSelected(null),
  };
}

/** Mine: every copy the player holds, as a still grid or a list with values, and a select mode for bulk actions. */
export function MinePane({ onOpenCard }: { onOpenCard: (cardId: string) => void }) {
  const [filters, setFilters] = useState<CardFilters>(EMPTY_CARD_FILTERS);
  const [sort, setSort] = useState<MineSort>("acquired");
  const [view, setView] = useState<MineView>("grid");
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
  const pages = query.data?.pages;
  const rows = useMemo(() => uniqueRows(pages ?? []), [pages]);
  const listed = useMemo(() => new Set(rows.map(copyIdOf)), [rows]);
  const first = pages?.[0];
  const totalCopies = first?.totalCopies ?? 0;
  const picks = useMinePicks(listed);
  const selected = picks.selected;
  // Select mode picks from the grid, whichever view was on.
  const shownView: MineView = selected ? "grid" : view;

  const open = (face: CardFaceData) => {
    const copyId = face.copy?.ownershipId;
    if (!selected) onOpenCard(face.cardId);
    else if (copyId) picks.toggle(copyId);
  };

  return (
    <div className="flex flex-col gap-4">
      <CardFilterBar
        filters={filters}
        onChange={setFilters}
        dimensions={MINE_DIMENSIONS}
        realms={first?.realms ?? []}
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
              onClick={selected ? picks.stop : picks.start}
            >
              {selected ? "Cancel" : "Select"}
            </Button>
          </>
        }
      />
      {selected && (
        // First in the DOM, so the keyboard reaches it before the cards; drawn last, held above the tab bar.
        <MineBulkBar
          className="order-last"
          count={selected.size}
          onAddToShowcase={() => setShowcasing(true)}
          onDone={picks.stop}
        />
      )}
      <div
        role="tabpanel"
        id={panelId}
        aria-label={VIEW_LABEL[shownView]}
        aria-busy={query.isFetching && !query.isFetchingNextPage}
      >
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
      <MoreCards
        hasMore={query.hasNextPage}
        loading={query.isFetchingNextPage}
        failed={query.isFetchNextPageError}
        onMore={() => void query.fetchNextPage()}
      />
      {/* A dismissed dialog keeps the picks; once they are in a showcase, select mode ends. */}
      <AddToShowcaseDialog
        open={showcasing}
        onOpenChange={setShowcasing}
        ownershipIds={picks.picked}
        onAdded={picks.stop}
      />
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
