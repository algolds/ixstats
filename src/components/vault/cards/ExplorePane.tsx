"use client";

import { useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { keepPreviousData } from "@tanstack/react-query";
import { MultiplePages, Plus } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button, focusRing } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { useDebounce } from "~/hooks/useDebounce";
import { EXPLORE_SORT_OPTIONS, type ExploreSort } from "~/lib/cards/face/explore-options";
import {
  activeFilterCount,
  EMPTY_CARD_FILTERS,
  exploreFilterInput,
  type CardFilters,
} from "~/lib/cards/face/filters";
import { TYPE_ORDER } from "~/lib/cards/face/labels";
import type { CardFaceData, CardRealmBadge } from "~/lib/cards/face/types";
import type { ExplorePage, RealmShelf as Shelf } from "~/lib/cards/hub/explore";
import { STORE_PATH } from "~/lib/cards/hub-routes";
import { DEFAULT_REALM_ID, isIxnaySlug, NS_REALM_ID } from "~/lib/realms/realm-ids";
import { cn } from "~/lib/utils/cn";
import { CardFilterBar, type FilterDimension, type RegionSearchOptions } from "./CardFilterBar";
import { CardGrid } from "./CardGrid";
import { MoreCards } from "./MoreCards";
import { RealmShelf } from "./RealmShelf";
import { SuggestCardDialog } from "./SuggestCardDialog";

const EXPLORE_DIMENSIONS: readonly FilterDimension[] = [
  "owned",
  "realm",
  "rarity",
  "type",
  "category",
  "region",
];
/** Trophy cards are not in Explore: they live in Lorewards and Mine. */
const EXPLORE_TYPES = TYPE_ORDER.filter((type) => type !== "TROPHY");
const PAGE = 48;
/** Regions change only when NationStates cards are imported. */
const REGIONS_STALE_MS = 10 * 60 * 1000;

/** The realm a `?realm=` slug names; Ixnay's old slugs still find it. */
function realmForSlug(realms: readonly CardRealmBadge[], slug: string) {
  return realms.find((realm) =>
    isIxnaySlug(slug) ? realm.id === DEFAULT_REALM_ID : realm.slug === slug
  );
}

/** Every loaded card once: a card published between page fetches shifts the offsets, so pages can overlap. */
function uniqueFaces(pages: readonly ExplorePage[]): CardFaceData[] {
  const seen = new Set<string>();
  return pages
    .flatMap((p) => p.faces)
    .filter((face) => {
      if (seen.has(face.cardId)) return false;
      seen.add(face.cardId);
      return true;
    });
}

/** A region narrows NationStates cards: picking another realm drops it, while every realm keeps it. */
function withRegionInRealm(filters: CardFilters, nsRealmId: string | undefined): CardFilters {
  const otherRealm = filters.realmId !== null && filters.realmId !== nsRealmId;
  return otherRealm && filters.region !== null ? { ...filters, region: null } : filters;
}

/**
 * The grid's filters. A `?realm=` slug picks its realm once the realms have loaded, and again only when the slug
 * changes, so the player's own choice of realm is never undone.
 */
function useExploreFilters(realms: readonly CardRealmBadge[], slug: string | null) {
  const [filters, setFilters] = useState<CardFilters>(EMPTY_CARD_FILTERS);
  const [appliedSlug, setAppliedSlug] = useState<string | null>(null);
  const nsRealmId = realms.find((realm) => realm.slug === NS_REALM_ID)?.id;
  // A slug the address drops is forgotten, so the same slug coming back picks its realm again.
  if (slug === null && appliedSlug !== null) setAppliedSlug(null);
  if (slug && slug !== appliedSlug && realms.length > 0) {
    setAppliedSlug(slug);
    const realm = realmForSlug(realms, slug);
    if (realm) {
      setFilters((current) => withRegionInRealm({ ...current, realmId: realm.id }, nsRealmId));
    }
  }
  const change = (next: CardFilters) => setFilters(withRegionInRealm(next, nsRealmId));
  return { filters, setFilters, change, nsRealmId };
}

/** The region filter's search over the server's NationStates regions, loaded only while that realm is picked. */
function useRegionSearch(nsPicked: boolean): {
  regions: string[];
  regionSearch: RegionSearchOptions;
} {
  const [term, setTerm] = useState("");
  const search = useDebounce(term, 300).trim();
  const query = api.cards.exploreRegions.useQuery(
    { search },
    // The last matches stay listed while the next search loads, so the list never flashes "No regions match".
    { enabled: nsPicked, staleTime: REGIONS_STALE_MS, placeholderData: keepPreviousData }
  );
  return {
    regions: query.data ?? [],
    regionSearch: { available: nsPicked, term, onSearch: setTerm },
  };
}

interface ExplorePaneProps {
  onOpenCard: (cardId: string) => void;
  /** A realm slug from the address (`?realm=`): the old NationStates library redirects here with `nationstates`. */
  initialRealmSlug: string | null;
  /** Whether the suggestion dialog is open; the hub keeps it in the address. */
  suggesting: boolean;
  onSuggestingChange: (open: boolean) => void;
}

/** Explore: every realm's shelf, then every card in a filtered grid, with silhouettes for the ones not collected. */
export function ExplorePane({
  onOpenCard,
  initialRealmSlug,
  suggesting,
  onSuggestingChange,
}: ExplorePaneProps) {
  const shelves = api.cards.exploreShelves.useQuery();
  const realms = useMemo(() => shelves.data?.realms ?? [], [shelves.data]);
  const { filters, setFilters, change, nsRealmId } = useExploreFilters(realms, initialRealmSlug);
  const [sort, setSort] = useState<ExploreSort>("newest");
  const gridSection = useRef<HTMLElement>(null);
  const gridHeading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const search = useDebounce(filters.search, 300);
  const query = api.cards.exploreGrid.useInfiniteQuery(
    { ...exploreFilterInput({ ...filters, search }), sort, limit: PAGE },
    {
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      // A new search or filter keeps the cards on screen until its page arrives.
      placeholderData: keepPreviousData,
    }
  );
  const pages = query.data?.pages;
  const faces = useMemo(() => uniqueFaces(pages ?? []), [pages]);
  // A picked realm id is a string or null, so with no NationStates shelf this is false.
  const { regions, regionSearch } = useRegionSearch(filters.realmId === nsRealmId);
  const open = (face: CardFaceData) => onOpenCard(face.cardId);

  const browseRealm = (realmId: string) => {
    setFilters({ ...EMPTY_CARD_FILTERS, realmId });
    gridSection.current?.scrollIntoView({ block: "start" });
    // Keyboard and screen reader users land on the grid they asked for, not on a shelf far above it.
    gridHeading.current?.focus({ preventScroll: true });
  };

  return (
    <div className="space-y-8">
      <RealmShelves
        loading={shelves.isLoading}
        failed={shelves.isError && !shelves.data}
        onRetry={() => void shelves.refetch()}
        shelves={shelves.data?.shelves ?? []}
        onOpen={open}
        onBrowse={browseRealm}
      />
      <section
        ref={gridSection}
        aria-labelledby={headingId}
        className="scroll-mt-(--shell-top-offset) space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 ref={gridHeading} id={headingId} tabIndex={-1} className="text-title-3 outline-none">
            All cards
          </h2>
          <Button variant="secondary" size="sm" onClick={() => onSuggestingChange(true)}>
            <Plus />
            Suggest a card
          </Button>
        </div>
        <CardFilterBar
          filters={filters}
          onChange={change}
          dimensions={EXPLORE_DIMENSIONS}
          types={EXPLORE_TYPES}
          realms={realms}
          regions={regions}
          regionSearch={regionSearch}
          sort={sort}
          sortOptions={EXPLORE_SORT_OPTIONS}
          onSortChange={setSort}
        />
        <div aria-busy={query.isFetching && !query.isFetchingNextPage}>
          <GridBody
            loading={query.isLoading}
            // A failed refresh keeps the cards it already has; only a grid that never loaded says so.
            failed={query.isError && !query.data}
            onRetry={() => void query.refetch()}
            faces={faces}
            filtered={activeFilterCount(filters) > 0 || filters.search.trim() !== ""}
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
      </section>
      <SuggestCardDialog open={suggesting} onOpenChange={onSuggestingChange} />
    </div>
  );
}

interface ShelvesProps {
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  shelves: readonly Shelf[];
  onOpen: (face: CardFaceData) => void;
  onBrowse: (realmId: string) => void;
}

function ShelvesBody(props: ShelvesProps) {
  if (props.loading) return <Skeleton className="rounded-card h-48" />;
  if (props.failed) {
    return (
      <EmptyState
        title="Realms did not load"
        action={
          <Button variant="secondary" onClick={props.onRetry}>
            Try again
          </Button>
        }
      />
    );
  }
  return (
    <>
      {props.shelves.map((shelf) => (
        <RealmShelf
          key={shelf.realm.id}
          shelf={shelf}
          onOpen={props.onOpen}
          onBrowse={props.onBrowse}
        />
      ))}
    </>
  );
}

/** The realm shelves; with no shelf to show, the section is left out and the grid says what is missing. */
function RealmShelves(props: ShelvesProps) {
  const headingId = useId();
  if (!props.loading && !props.failed && props.shelves.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h2 id={headingId} className="text-title-3">
        Realms
      </h2>
      <ShelvesBody {...props} />
    </section>
  );
}

function GridBody(props: {
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  faces: readonly CardFaceData[];
  filtered: boolean;
  onOpen: (face: CardFaceData) => void;
  onClearFilters: () => void;
}) {
  if (props.loading) return <Skeleton className="rounded-card h-64" />;
  if (props.failed) {
    return (
      <EmptyState
        title="Cards did not load"
        action={
          <Button variant="secondary" onClick={props.onRetry}>
            Try again
          </Button>
        }
      />
    );
  }
  if (props.faces.length > 0) {
    return <CardGrid faces={props.faces} onOpen={props.onOpen} label="All cards" />;
  }
  if (props.filtered) {
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
  return (
    <EmptyState
      icon={<MultiplePages />}
      title="No cards yet"
      message={
        <>
          Cards appear here as realms publish them. Packs are in the{" "}
          <Link
            href={STORE_PATH}
            className={cn("text-tint-ink rounded-control-sm underline", focusRing)}
          >
            Store
          </Link>
          .
        </>
      }
    />
  );
}
