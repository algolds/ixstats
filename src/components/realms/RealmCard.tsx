"use client";

import Link from "next/link";
import { RealmAvatar } from "~/components/realms/RealmAvatar";
import { plural, realmHref, type DirectoryRealm } from "~/app/realms/_components/realm-directory";
import { Badge } from "~/components/ui/badge";
import { assetUrl } from "~/lib/base-path";
import { hubHref, realmBoardHref } from "~/lib/thinkpages-forum/links";
import { RealmAdvertCard, type AdvertOverview } from "./RealmAdvertCard";

function boardActivity(board: DirectoryRealm["board"]): string {
  if (board.recentPosts === 0 && !board.lastPostAt) return "No posts yet";
  const week = `${plural(board.recentPosts, "post")} this week`;
  if (!board.lastPostAt) return week;
  return `${week} · last ${new Date(board.lastPostAt).toLocaleDateString()}`;
}

/** A realm's banner card in the directory: counts, tags, board activity and a way in. */
function DirectoryRealmCard({ realm }: { realm: DirectoryRealm }) {
  const base = realmHref(realm.slug);
  const canClaimMore = realm.myNationCount < realm.maxNationsPerUser;
  return (
    <li className="border-separator bg-surface rounded-card flex flex-col overflow-hidden border">
      <Link href={base} tabIndex={-1} aria-hidden="true" className="bg-fill-3 block h-24">
        {realm.bannerUrl && (
          <img
            src={assetUrl(realm.bannerUrl) ?? ""}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <RealmAvatar thumbnail={realm.thumbnail} />
          <div className="min-w-0">
            <Link href={base} className="text-label text-headline block truncate hover:underline">
              {realm.name}
            </Link>
            <p className="text-label-secondary text-footnote">
              {plural(realm.nationCount, "nation")} · {realm.openNationCount.toLocaleString()}{" "}
              unclaimed
              {realm.openNationPageCount > 0 &&
                ` · ${plural(realm.openNationPageCount, "page")} to claim`}
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
        {realm.boardMessagesThisWeek > 0 && (
          <p className="text-label-secondary text-footnote">
            {plural(realm.boardMessagesThisWeek, "board message")} this week
          </p>
        )}
        <div className="text-caption mt-auto flex flex-wrap items-center gap-3">
          <Link
            href={realmBoardHref(realm.slug)}
            className="text-label hover:underline pointer-coarse:min-h-11"
          >
            Board
          </Link>
          <Link href={hubHref(realm.slug)} className="text-label hover:underline">
            Forum
          </Link>
          {realm.myNationCount > 0 && (
            <span className="text-label-secondary">
              You hold {realm.myNationCount} of {realm.maxNationsPerUser}
            </span>
          )}
          {canClaimMore && (
            <Link href={realmHref(realm.slug, "nations")} className="text-label hover:underline">
              {realm.myNationCount > 0 ? "Claim another nation" : "Join · claim a nation"}
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

export type RealmCardProps =
  | { variant?: "directory"; realm: DirectoryRealm }
  | { variant: "advert"; overview: AdvertOverview };

/**
 * A realm as a card. The directory variant is a list item for the realms directory; the advert variant heads a Find a
 * Realm advert thread and is fed by `realms.region.overview` (live data, never a stored snapshot).
 */
export function RealmCard(props: RealmCardProps) {
  if (props.variant === "advert") return <RealmAdvertCard overview={props.overview} />;
  return <DirectoryRealmCard realm={props.realm} />;
}
