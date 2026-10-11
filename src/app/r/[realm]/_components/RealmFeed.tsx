"use client";

import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { ThinkpagesPost } from "~/components/thinkpages/ThinkpagesPost";
import { RealmBoardBlock } from "./RealmBoardBlock";

function RealmPosts({ realmId }: { realmId: string | null }) {
  const { user } = useUser();
  const { data, isLoading, error } = api.thinkpages.getFeed.useQuery(
    { realmId: realmId ?? undefined, limit: 20 },
    { staleTime: 15_000 }
  );

  if (isLoading) return <p className="text-label-secondary text-body p-4">Loading posts…</p>;
  if (error)
    return <p className="text-label-secondary text-body p-4">The feed could not be loaded.</p>;
  if (!data?.posts.length)
    return (
      <p className="text-label-secondary text-body p-4">
        No posts yet. {realmId ? "Nations of this realm haven't posted." : ""}
      </p>
    );

  return (
    <div className="space-y-4">
      {data.posts.map((post) => (
        <ThinkpagesPost
          key={post.id}
          post={post}
          currentUserAccountId={user?.id || "placeholder-disabled"}
        />
      ))}
    </div>
  );
}

/**
 * The ThinkPages feed scoped to one realm (posts by its nations' personas), or to every realm when `realmId` is
 * null. For one realm whose slug is known, the realm's live board (its newest native board messages) sits above the
 * posts; the old ThinkTank board chat is no longer part of the feed.
 */
export function RealmFeed({
  realmId,
  realmSlug = null,
}: {
  realmId: string | null;
  realmSlug?: string | null;
}) {
  return (
    <div className="space-y-4">
      {realmId && realmSlug ? <RealmBoardBlock slug={realmSlug} framed /> : null}
      <RealmPosts realmId={realmId} />
    </div>
  );
}
