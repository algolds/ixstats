"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useViewerRealmId } from "~/hooks/useViewerRealmId";
import { createUrl } from "~/lib/utils";
import { RealmFeed } from "~/app/r/[realm]/_components/RealmFeed";

const ALL = "__all__";

type DirectoryRealm = RouterOutputs["realms"]["directory"][number];

function boardActivity(board: DirectoryRealm["board"]): string {
  if (!board) return "Board not opened yet";
  const week = `${board.recentPosts.toLocaleString()} post${board.recentPosts === 1 ? "" : "s"} this week`;
  if (!board.lastPostAt) return week;
  return `${week} · last ${new Date(board.lastPostAt).toLocaleDateString()}`;
}

function RealmCard({ realm }: { realm: DirectoryRealm }) {
  const base = `/r/${encodeURIComponent(realm.slug)}`;
  const canClaimMore = realm.myNationCount < realm.maxNationsPerUser;
  return (
    <li className="border-border bg-card/70 flex flex-col gap-3 rounded-2xl border p-5">
      <div className="flex items-center gap-3">
        <div className="border-border bg-accent flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
          {realm.thumbnail ? (
            <img src={realm.thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <Globe className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <Link
            href={createUrl(base)}
            className="text-foreground block truncate text-sm font-bold hover:underline"
          >
            {realm.name}
          </Link>
          <p className="text-muted-foreground text-xs">
            {realm.nationCount.toLocaleString()} nations · {realm.openNationCount.toLocaleString()}{" "}
            unclaimed
          </p>
        </div>
      </div>
      {realm.description && (
        <p className="text-muted-foreground line-clamp-2 text-xs">{realm.description}</p>
      )}
      <p className="text-muted-foreground text-xs">{boardActivity(realm.board)}</p>
      <div className="mt-auto flex flex-wrap items-center gap-3 text-xs font-medium">
        <Link href={createUrl(`${base}/board`)} className="text-foreground hover:underline">
          Board
        </Link>
        {realm.myNationCount > 0 && (
          <span className="text-muted-foreground">
            You hold {realm.myNationCount} of {realm.maxNationsPerUser}
          </span>
        )}
        {canClaimMore && (
          <Link href={createUrl(base)} className="text-foreground hover:underline">
            {realm.myNationCount > 0 ? "Claim another nation" : "Join · claim a nation"}
          </Link>
        )}
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Realms</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Worlds you can play in. Each realm has its own nations and a board where they talk.
        </p>
      </header>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading realms…</p>
      ) : !realms?.length ? (
        <p className="text-muted-foreground text-sm">No realms are open yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {realms.map((realm) => (
            <RealmCard key={realm.id} realm={realm} />
          ))}
        </ul>
      )}

      <section className="border-border bg-card/40 rounded-2xl border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-foreground text-sm font-bold">Realm feed</h2>
          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            Showing
            <select
              value={selected}
              onChange={(e) => setChoice(e.target.value)}
              className="border-border bg-background text-foreground rounded-lg border px-2 py-1 text-xs"
            >
              <option value={ALL}>All realms</option>
              {selected !== ALL && !realms?.some((realm) => realm.id === selected) && (
                <option value={selected}>Your realm</option>
              )}
              {realms?.map((realm) => (
                <option key={realm.id} value={realm.id}>
                  {realm.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <RealmFeed realmId={selected === ALL ? null : selected} />
      </section>
    </div>
  );
}
