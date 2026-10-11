"use client";

import { useMemo, useState } from "react";
import { RealmCard } from "~/components/realms/RealmCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { REALM_TAGS } from "~/lib/realms/realm-region";
import type { DirectoryRealm } from "./realm-directory";

type SortId = "name" | "nations" | "activity" | "newest";

const SORTS: Array<{ value: SortId; label: string }> = [
  { value: "name", label: "Name" },
  { value: "nations", label: "Most nations" },
  { value: "activity", label: "Most active" },
  { value: "newest", label: "Newest" },
];

const SORTERS: Record<SortId, (a: DirectoryRealm, b: DirectoryRealm) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  nations: (a, b) => b.nationCount - a.nationCount || a.name.localeCompare(b.name),
  activity: (a, b) => b.board.recentPosts - a.board.recentPosts || a.name.localeCompare(b.name),
  newest: (a, b) => new Date(b.foundedAt).getTime() - new Date(a.foundedAt).getTime(),
};

/** Every listed realm as banner cards, sortable and filterable by tag. */
export function BrowseRealms({
  realms,
  isLoading,
}: {
  realms: DirectoryRealm[] | undefined;
  isLoading: boolean;
}) {
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortId>("name");
  const shown = useMemo(
    () =>
      (realms ?? [])
        .filter((realm) => tags.every((tag) => realm.tags.includes(tag)))
        .sort(SORTERS[sort]),
    [realms, tags, sort]
  );
  const usedTags = REALM_TAGS.filter((tag) => realms?.some((realm) => realm.tags.includes(tag)));

  return (
    <section
      id="browse-realms"
      aria-labelledby="browse-realms-heading"
      className="flex scroll-mt-4 flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="browse-realms-heading" className="text-label text-title-3">
          Browse all realms{realms?.length ? ` · ${realms.length}` : ""}
        </h2>
        {!!realms?.length && (
          <Select value={sort} onValueChange={(v) => setSort(v as SortId)}>
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
        )}
      </div>
      {usedTags.length > 0 && (
        <ToggleGroup
          type="multiple"
          variant="pill"
          size="sm"
          aria-label="Filter by tag"
          value={tags}
          onValueChange={(next: string[]) => setTags(next)}
          className="flex-wrap justify-start"
        >
          {usedTags.map((tag) => (
            <ToggleGroupItem key={tag} value={tag}>
              {tag}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading realms">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="rounded-card h-64 w-full" />
          ))}
        </div>
      ) : !realms?.length ? (
        <p className="text-label-secondary text-body">No realms are open yet.</p>
      ) : shown.length === 0 ? (
        <p className="text-label-secondary text-body">No realm has every tag you picked.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((realm) => (
            <RealmCard key={realm.id} realm={realm} />
          ))}
        </ul>
      )}
    </section>
  );
}
