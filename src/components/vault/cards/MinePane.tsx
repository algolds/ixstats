"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { keepPreviousData } from "@tanstack/react-query";
import { Filter, List, MultiplePages, ViewGrid, WarningCircle } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button, focusRing } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { LensCard } from "~/components/ui/lens-card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { AddToShowcaseDialog } from "~/components/cards/showcase/AddToShowcaseDialog";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { useDebounce } from "~/hooks/useDebounce";
import {
  activeFilterCount,
  EMPTY_CARD_FILTERS,
  mineFilterInput,
  type CardFilters,
} from "~/lib/cards/face/filters";
import { MINE_SORT_OPTIONS, type MineSort } from "~/lib/cards/face/mine-options";
import type { CardFaceData } from "~/lib/cards/face/types";
import type { MinePage, MineRow } from "~/lib/cards/hub/mine";
import { CARD_HUB_PATHS, STORE_PATH } from "~/lib/cards/hub-routes";
import { cn } from "~/lib/utils/cn";
import { CardFilterBar, type FilterDimension } from "./CardFilterBar";
import { CardGrid } from "./CardGrid";
import { DustBalances } from "./DustBalances";
import { MineBulkBar, selectedCopyOf } from "./MineBulkBar";
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
const PAGE = 120;
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
  const picked = selected ? [...selected] : [];
  return {
    selected,
    picked,
    toggle: (id: string) => setSelected((previous) => toggled(previous, id)),
    start: () => setSelected(new Set()),
    stop: () => setSelected(null),
  };
}

/** Collector binder summary strip: copies held, distinct cards, and estimated deck value on Lens glass. */
function BinderSummaryStrip(props: {
  loading: boolean;
  failed: boolean;
  totalCopies: number;
  uniqueCards: number;
  deckValue: number;
}) {
  if (props.failed) return null;
  if (props.loading) return <Skeleton className="rounded-card h-16" />;
  if (props.totalCopies === 0) {
    return (
      <LensCard app="vault" content="data" padding="sm">
        <EmptyState
          icon={<MultiplePages />}
          title="Your binder is empty"
          message={
            <>
              Explore every realm&apos;s cards, or open packs in the{" "}
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
            <Button variant="secondary" asChild>
              <Link href={CARD_HUB_PATHS.explore}>Explore cards</Link>
            </Button>
          }
        />
      </LensCard>
    );
  }
  return (
    <LensCard app="vault" content="data" padding="sm" data-slot="binder-summary">
      <div className="divide-separator grid grid-cols-3 divide-x">
        <Stat
          size="sm"
          label="Total copies"
          value={props.totalCopies.toLocaleString()}
          className="px-2 sm:px-3"
        />
        <Stat
          size="sm"
          label="Unique cards"
          value={props.uniqueCards.toLocaleString()}
          className="px-2 sm:px-3"
        />
        <Stat
          size="sm"
          label="Estimated deck value"
          value={
            <span className="inline-flex items-center gap-1 tabular-nums">
              <IxCreditsSymbol className="size-[0.85em]" />
              {props.deckValue.toLocaleString()}
            </span>
          }
          className="px-2 sm:px-3"
        />
      </div>
    </LensCard>
  );
}

/** My cards: collector binder summary strip over the filtered binder grid/list and bulk selection bar. */
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
  const statsQuery = api.vault.getUserStats.useQuery();
  const pages = query.data?.pages;
  const rows = uniqueRows(pages ?? []);
  const listed = new Set(rows.map(copyIdOf));
  const first = pages?.[0];
  const totalCopies = first?.totalCopies ?? statsQuery.data?.totalCards ?? 0;
  const isFiltered = activeFilterCount(filters) > 0 || filters.search.trim() !== "";
  const uniqueInRows = new Set(rows.map((row) => row.face.cardId)).size;
  const unfilteredUnique = useRef<number | null>(null);
  if (!isFiltered && rows.length > 0) unfilteredUnique.current = uniqueInRows;
  const uniqueCards = !isFiltered ? uniqueInRows : (unfilteredUnique.current ?? uniqueInRows);
  const deckValue = statsQuery.data?.deckValue ?? rows.reduce((sum, row) => sum + row.value, 0);
  const failed = query.isError && !query.data;

  const picks = useMinePicks(listed);
  const selected = picks.selected;
  const rowById = new Map(rows.map((row) => [copyIdOf(row), row]));
  // Picks are already limited to the listed copies.
  const selectedCopies = picks.picked.flatMap((id) => {
    const row = rowById.get(id);
    const copy = row && selectedCopyOf(row);
    return copy ? [copy] : [];
  });
  const selectButton = useRef<HTMLButtonElement>(null);
  // Select mode picks from the grid, whichever view was on.
  const shownView: MineView = selected ? "grid" : view;

  const open = (face: CardFaceData) => {
    const copyId = face.copy?.ownershipId;
    if (!selected) onOpenCard(face.cardId);
    else if (copyId) picks.toggle(copyId);
  };

  return (
    <div className="flex flex-col gap-4">
      <BinderSummaryStrip
        loading={query.isLoading}
        failed={failed}
        totalCopies={totalCopies}
        uniqueCards={uniqueCards}
        deckValue={deckValue}
      />
      {(query.isLoading || failed || totalCopies > 0) && (
        <>
          <CardFilterBar
            filters={filters}
            onChange={setFilters}
            dimensions={MINE_DIMENSIONS}
            types={first?.facets.types ?? []}
            categories={first?.facets.categories ?? []}
            realms={first?.realms ?? []}
            sort={sort}
            sortOptions={MINE_SORT_OPTIONS}
            onSortChange={setSort}
            trailing={
              <>
                <DustBalances />
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
                  ref={selectButton}
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
              copies={selectedCopies}
              onAddToShowcase={() => setShowcasing(true)}
              onDone={picks.stop}
              focusAfter={selectButton}
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
              failed={failed}
              onRetry={() => void query.refetch()}
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
        </>
      )}
      {/* A dismissed dialog keeps the picks; once they are in a showcase, select mode ends. */}
      <AddToShowcaseDialog
        open={showcasing}
        onOpenChange={setShowcasing}
        ownershipIds={picks.picked}
        onAdded={picks.stop}
        focusAfterAdd={selectButton}
      />
    </div>
  );
}

function MineBody(props: {
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  rows: MineRow[];
  view: MineView;
  selected: ReadonlySet<string> | null;
  onOpen: (face: CardFaceData) => void;
  onClearFilters: () => void;
}) {
  if (props.loading) return <Skeleton className="rounded-card h-64" />;
  if (props.failed) {
    return (
      <Card>
        <EmptyState
          role="alert"
          icon={<WarningCircle />}
          title="Your cards did not load"
          message="Try loading your collection again."
          action={
            <Button variant="secondary" onClick={props.onRetry}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  }
  if (props.rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Filter />}
          title="No cards match these filters"
          message="Clear or loosen your filters to see your cards."
          action={
            <Button variant="secondary" onClick={props.onClearFilters}>
              Clear filters
            </Button>
          }
        />
      </Card>
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
