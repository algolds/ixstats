"use client";

import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { ThinkpagesPost } from "~/components/thinkpages/ThinkpagesPost";

/**
 * The ThinkPages feed scoped to one realm (posts by its nations' personas plus its board), or to every
 * realm when `realmId` is null.
 */
export function RealmFeed({ realmId }: { realmId: string | null }) {
  const { user } = useUser();
  const { data, isLoading, error } = api.thinkpages.getFeed.useQuery(
    { realmId: realmId ?? undefined, limit: 20 },
    { staleTime: 15_000 }
  );

  if (isLoading) return <p className="text-muted-foreground p-4 text-sm">Loading posts…</p>;
  if (error)
    return <p className="text-muted-foreground p-4 text-sm">The feed could not be loaded.</p>;
  if (!data?.posts.length)
    return (
      <p className="text-muted-foreground p-4 text-sm">
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
