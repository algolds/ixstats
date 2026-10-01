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
    <li className="border-separator bg-surface rounded-card flex flex-col gap-3 border p-5">
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
            {realm.nationCount.toLocaleString()} nations · {realm.openNationCount.toLocaleString()}{" "}
            unclaimed
          </p>
        </div>
      </div>
      {realm.description && (
        <p className="text-label-secondary text-footnote line-clamp-2">{realm.description}</p>
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
        <h1 className="text-label text-title-1">Realms</h1>
        <p className="text-label-secondary text-body mt-1">
          Worlds you can play in. Each realm has its own nations and a board where they talk.
        </p>
      </header>

      {isLoading ? (
        <p className="text-label-secondary text-body">Loading realms…</p>
      ) : !realms?.length ? (
        <p className="text-label-secondary text-body">No realms are open yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {realms.map((realm) => (
            <RealmCard key={realm.id} realm={realm} />
          ))}
        </ul>
      )}

      <section className="border-separator bg-surface rounded-card border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-label text-headline">Realm feed</h2>
          <label className="text-label-secondary text-footnote flex items-center gap-2">
            Showing
            <select
              value={selected}
              onChange={(e) => setChoice(e.target.value)}
              className="border-separator bg-background text-label rounded-control text-footnote border px-2 py-1"
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
