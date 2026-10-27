"use client";

import { use, useState } from "react";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { Button } from "~/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  HAPPENING_KIND_LABELS,
  HAPPENING_KINDS,
  type HappeningKind,
} from "~/lib/realms/realm-region";
import { HappeningLine } from "../../_components/RealmSidebar";

const PAGE_SIZE = 30;

/** Every happening of the realm, newest first, filtered by kind and loaded a page at a time. */
export default function RealmHappeningsPage({ params }: { params: Promise<{ realm: string }> }) {
  const { realm: slug } = use(params);
  const [kinds, setKinds] = useState<HappeningKind[]>([]);
  const { data: overview } = api.realms.region.overview.useQuery({ slug });
  usePageTitle({ title: overview ? `${overview.realm.name} · Happenings` : "Happenings" });
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.realms.region.happenings.useInfiniteQuery(
      { slug, kinds, limit: PAGE_SIZE },
      { getNextPageParam: (page) => page.nextCursor }
    );
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="border-separator bg-surface rounded-card border p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3">
        <h2 className="text-label text-headline">Happenings</h2>
        <ToggleGroup
          type="multiple"
          variant="pill"
          size="sm"
          aria-label="Show happenings of these kinds"
          value={kinds}
          onValueChange={(next: string[]) => setKinds(next as HappeningKind[])}
          className="flex-wrap justify-start"
        >
          {HAPPENING_KINDS.map((kind) => (
            <ToggleGroupItem key={kind} value={kind}>
              {HAPPENING_KIND_LABELS[kind]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {isLoading ? (
        <p className="text-label-secondary text-body">Loading happenings…</p>
      ) : items.length === 0 ? (
        <p className="text-label-secondary text-body">
          {kinds.length > 0 ? "Nothing of these kinds yet." : "Nothing has happened here yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <HappeningLine key={item.id} item={item} />
          ))}
        </ul>
      )}
      {hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage ? "Loading…" : "Show older"}
        </Button>
      )}
    </section>
  );
}
