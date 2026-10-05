"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Globe } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useViewerRealmId } from "~/hooks/useViewerRealmId";
import { createUrl } from "~/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { RealmFeed } from "~/app/r/[realm]/_components/RealmFeed";
import { MyClaims } from "~/app/r/[realm]/_components/MyClaims";
import { Badge } from "~/components/ui/badge";
import { SearchField } from "~/components/ui/search-field";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { REALM_TAGS } from "~/lib/realms/realm-region";

const ALL = "__all__";

type DirectoryRealm = RouterOutputs["realms"]["directory"][number];

function boardActivity(board: DirectoryRealm["board"]): string {
  if (!board) return "Board not opened yet";
  const week = `${board.recentPosts.toLocaleString()} post${board.recentPosts === 1 ? "" : "s"} this week`;
  if (!board.lastPostAt) return week;
  return `${week} · last ${new Date(board.lastPostAt).toLocaleDateString()}`;
}

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
  activity: (a, b) =>
    (b.board?.recentPosts ?? 0) - (a.board?.recentPosts ?? 0) || a.name.localeCompare(b.name),
  newest: (a, b) => new Date(b.foundedAt).getTime() - new Date(a.foundedAt).getTime(),
};

function RealmCard({ realm }: { realm: DirectoryRealm }) {
  const base = `/r/${encodeURIComponent(realm.slug)}`;
  const canClaimMore = realm.myNationCount < realm.maxNationsPerUser;
  return (
    <li className="border-separator bg-surface rounded-card flex flex-col overflow-hidden border">
      <Link
        href={createUrl(base)}
        tabIndex={-1}
        aria-hidden="true"
        className="bg-fill-3 block h-24"
      >
        {realm.bannerUrl && (
          <img src={realm.bannerUrl} alt="" className="h-full w-full object-cover" />
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <div className="border-separator bg-fill-3 rounded-row flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border">
            {realm.thumbnail ? (
              <img src={realm.thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <Globe className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <Link
              href={createUrl(base)}
              className="text-label text-headline block truncate hover:underline"
            >
              {realm.name}
            </Link>
            <p className="text-label-secondary text-footnote">
              {realm.nationCount.toLocaleString()} nations ·{" "}
              {realm.openNationCount.toLocaleString()} unclaimed
            </p>
          </div>
        </div>
        {realm.description && (
          <p className="text-label-secondary text-footnote line-clamp-2">{realm.description}</p>
        )}
        {realm.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Tags">
            {realm.tags.map((tag) => (
              <li key={tag}>
                <Badge variant="outline">{tag}</Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="text-label-secondary text-footnote">{boardActivity(realm.board)}</p>
        <div className="text-caption mt-auto flex flex-wrap items-center gap-3">
          <Link href={createUrl(`${base}/board`)} className="text-label hover:underline">
            Board
          </Link>
          {realm.myNationCount > 0 && (
            <span className="text-label-secondary">
              You hold {realm.myNationCount} of {realm.maxNationsPerUser}
            </span>
          )}
          {canClaimMore && (
            <Link href={createUrl(base)} className="text-label hover:underline">
              {realm.myNationCount > 0 ? "Claim another nation" : "Join · claim a nation"}
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

/** The realm directory: every open realm, with its nations, board activity and a way in. */
export default function RealmsDirectoryPage() {
  usePageTitle({ title: "Realms" });
  const { data: realms, isLoading } = api.realms.directory.useQuery();
  const viewerRealmId = useViewerRealmId();
  // undefined = not chosen yet: follow the active nation's realm, else all realms.
  const [choice, setChoice] = useState<string | undefined>(undefined);
  const selected = choice ?? viewerRealmId ?? ALL;
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortId>("name");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (realms ?? [])
      .filter(
        (realm) =>
          (!q ||
            realm.name.toLowerCase().includes(q) ||
            realm.description?.toLowerCase().includes(q)) &&
          tags.every((tag) => realm.tags.includes(tag))
      )
      .sort(SORTERS[sort]);
  }, [realms, query, tags, sort]);
  const usedTags = REALM_TAGS.filter((tag) => realms?.some((realm) => realm.tags.includes(tag)));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header>
        <h1 className="text-label text-title-1">Realms</h1>
        <p className="text-label-secondary text-body mt-1">
          Worlds you can play in. Each realm has its own nations and a board where they talk.
        </p>
      </header>

      <MyClaims />

      {isLoading ? (
        <p className="text-label-secondary text-body">Loading realms…</p>
      ) : !realms?.length ? (
        <p className="text-label-secondary text-body">No realms are open yet.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <SearchField
                size="sm"
                value={query}
                onValueChange={setQuery}
                placeholder="Search realms"
                aria-label="Search realms"
                containerClassName="w-full sm:w-64"
              />
              <Select value={sort} onValueChange={(v) => setSort(v as SortId)}>
                <SelectTrigger size="sm" aria-label="Sort realms">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
          </div>
          {shown.length === 0 ? (
            <p className="text-label-secondary text-body">No realm matches.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((realm) => (
                <RealmCard key={realm.id} realm={realm} />
              ))}
            </ul>
          )}
        </>
      )}

      <section className="border-separator bg-surface rounded-card border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-label text-headline">Realm feed</h2>
          <div className="text-label-secondary text-footnote flex items-center gap-2">
            <span id="realm-feed-scope">Showing</span>
            <Select value={selected} onValueChange={setChoice}>
              <SelectTrigger size="sm" aria-labelledby="realm-feed-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={ALL}>All realms</SelectItem>
                {selected !== ALL && !realms?.some((realm) => realm.id === selected) && (
                  <SelectItem value={selected}>Your realm</SelectItem>
                )}
                {realms?.map((realm) => (
                  <SelectItem key={realm.id} value={realm.id}>
                    {realm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <RealmFeed realmId={selected === ALL ? null : selected} />
      </section>
    </div>
  );
}
