"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Plus } from "iconoir-react";
import { RealmCard } from "~/components/realms/RealmCard";
import { Card } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useIsAdmin } from "~/hooks/usePermissions";
import { REALM_TAGS } from "~/lib/realms/realm-region";
import { ADVERT_CATEGORY_KEY } from "~/lib/thinkpages-forum/adverts";
import { categoryHref } from "~/lib/thinkpages-forum/links";
import { ATLAS_FILTER_MIN, atlasOrder, realmMatches, type DirectoryRealm } from "./realm-directory";

type SortId = "open" | "name" | "nations" | "activity" | "newest";

const SORTS: Array<{ value: SortId; label: string }> = [
  { value: "open", label: "Most open" },
  { value: "name", label: "Name" },
  { value: "nations", label: "Most nations" },
  { value: "activity", label: "Most active" },
  { value: "newest", label: "Newest" },
];

const SORTERS: Record<SortId, (realms: DirectoryRealm[]) => DirectoryRealm[]> = {
  open: atlasOrder,
  name: (realms) => [...realms].sort((a, b) => a.name.localeCompare(b.name)),
  nations: (realms) =>
    [...realms].sort((a, b) => b.nationCount - a.nationCount || a.name.localeCompare(b.name)),
  activity: (realms) =>
    [...realms].sort(
      (a, b) => b.board.recentPosts - a.board.recentPosts || a.name.localeCompare(b.name)
    ),
  newest: (realms) =>
    [...realms].sort((a, b) => new Date(b.foundedAt).getTime() - new Date(a.foundedAt).getTime()),
};

const FOUND_HREF = "/admin/maps/studio";
const ADVERT_HREF = categoryHref({ key: ADVERT_CATEGORY_KEY });

/** The last tile of the atlas: admins found a realm in Studio, players post theirs on the Find a Realm board. */
function FoundingTile({ isAdmin }: { isAdmin: boolean }) {
  return (
    <li>
      <Card
        variant="well"
        interactive
        className="has-[a[data-stretch]:focus-visible]:outline-tint relative flex h-full items-start gap-3 has-[a[data-stretch]:focus-visible]:outline-2 has-[a[data-stretch]:focus-visible]:outline-offset-2"
      >
        <span className="border-tint text-tint rounded-row flex size-10 shrink-0 items-center justify-center border">
          <Plus className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <Link
            data-stretch
            href={isAdmin ? FOUND_HREF : ADVERT_HREF}
            className="text-label text-body font-medium after:absolute after:inset-0 after:content-['']"
          >
            {isAdmin ? "Found a realm" : "Bring your realm"}
          </Link>
          <p className="text-label-secondary text-footnote mt-1">
            {isAdmin
              ? "Start a world in Studio, with its map, board and factbook."
              : "Run a community with its own world? Post it on the Find a Realm board."}
          </p>
        </div>
      </Card>
    </li>
  );
}

/** Sort and tag controls, shown once the atlas is big enough to need them. */
function AtlasControls({
  sort,
  onSort,
  tags,
  onTags,
  usedTags,
}: {
  sort: SortId;
  onSort: (sort: SortId) => void;
  tags: string[];
  onTags: (tags: string[]) => void;
  usedTags: string[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Select value={sort} onValueChange={(v) => onSort(v as SortId)}>
          <SelectTrigger size="sm" aria-label="Sort realms">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {usedTags.length > 0 && (
        <ToggleGroup
          type="multiple"
          variant="pill"
          size="sm"
          aria-label="Filter by tag"
          value={tags}
          onValueChange={onTags}
          className="flex-wrap justify-start"
        >
          {usedTags.map((tag) => (
            <ToggleGroupItem key={tag} value={tag}>
              {tag}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </div>
  );
}

function emptyMessage(realms: DirectoryRealm[], query: string): string | null {
  if (realms.length === 0) return "No realms are open yet.";
  return query.trim()
    ? `No realm matches “${query.trim()}”.`
    : "No realm has every tag you picked.";
}

/**
 * Every listed realm as one grid of atlas cards, most open first, ending in the founding tile (hidden while a search or tag narrows the list). A
 * scroll-snap row on phones. Sort and tag filters appear from `ATLAS_FILTER_MIN` realms.
 */
export function AtlasGrid({
  realms,
  isLoading,
  query,
}: {
  realms: DirectoryRealm[] | undefined;
  isLoading: boolean;
  query: string;
}): ReactNode {
  const isAdmin = useIsAdmin();
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortId>("open");
  const all = realms ?? [];
  const filtered = query.trim() !== "" || tags.length > 0;
  const showControls = all.length >= ATLAS_FILTER_MIN;
  const shown = useMemo(
    () =>
      SORTERS[sort](
        all.filter(
          (realm) => realmMatches(realm, query) && tags.every((t) => realm.tags.includes(t))
        )
      ),
    [all, query, tags, sort]
  );
  const usedTags = REALM_TAGS.filter((tag) => all.some((realm) => realm.tags.includes(tag)));

  return (
    <section id="atlas" aria-label="Realms" className="flex scroll-mt-4 flex-col gap-3">
      {showControls && (
        <AtlasControls
          sort={sort}
          onSort={setSort}
          tags={tags}
          onTags={setTags}
          usedTags={usedTags}
        />
      )}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading realms">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="rounded-card h-64 w-full" />
          ))}
        </div>
      ) : (
        <>
          {shown.length === 0 && (
            <p className="text-label-secondary text-body">{emptyMessage(all, query)}</p>
          )}
          {(shown.length > 0 || !filtered) && (
            <ul className="grid gap-4 max-md:-mx-4 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:scroll-px-4 max-md:overflow-x-auto max-md:px-4 max-md:py-1 sm:grid-cols-2 xl:grid-cols-3 max-md:[&>li]:shrink-0 max-md:[&>li]:basis-[84%] max-md:[&>li]:snap-start">
              {shown.map((realm) => (
                <RealmCard key={realm.id} realm={realm} />
              ))}
              {!filtered && <FoundingTile isAdmin={isAdmin} />}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
