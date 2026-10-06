"use client";

import Link from "next/link";
import { ArrowLeft, BookmarkBook, SystemRestart as Loader2 } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { shellPageTitleProps } from "~/components/shell/ShellPageHeader";
import { AuthenticationGuard } from "~/components/mycountry/primitives";
import { ThinkpagesPost } from "./ThinkpagesPost";

/** The signed-in user's saved (bookmarked) posts, most recently saved first (SL-10). */
function SavedPostsInner() {
  const { user } = useUser();
  const notify = useNotify();
  const utils = api.useUtils();

  const { data: accounts } = api.thinkpages.getMyAccounts.useQuery(undefined, {
    enabled: !!user?.id,
  });
  const currentAccount = accounts?.[0];

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.thinkpages.getBookmarkedPosts.useInfiniteQuery(
      { limit: 20 },
      { enabled: !!user?.id, getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    );
  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  const unsave = api.thinkpages.bookmarkPost.useMutation({
    onSuccess: () => {
      notify.success("Removed from saved posts");
      void utils.thinkpages.getBookmarkedPosts.invalidate();
    },
    onError: (err) => notify.error(err.message || "Failed to remove the post"),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 {...shellPageTitleProps} className="text-title-2 text-label">
            Saved posts
          </h1>
          <p className="text-body text-label-secondary">Posts you bookmarked, newest first.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/thinkpages">
            <ArrowLeft aria-hidden="true" />
            ThinkPages
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center">
          <Loader2 className="text-label-secondary size-6 animate-spin" aria-label="Loading" />
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookmarkBook />}
            title="No saved posts"
            message="Bookmark a post from its menu and it appears here."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard">Browse the feed</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="space-y-2">
              <ThinkpagesPost
                post={post}
                currentUserAccountId={currentAccount?.id ?? ""}
                accounts={accounts ?? []}
                countryId={currentAccount?.countryId ?? ""}
              />
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={unsave.isPending}
                  onClick={() => unsave.mutate({ postId: post.id, bookmarked: false })}
                >
                  Remove from saved
                </Button>
              </div>
            </div>
          ))}
          {hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {isFetchingNextPage ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SavedPosts() {
  return (
    <AuthenticationGuard redirectPath="/thinkpages/saved">
      <SavedPostsInner />
    </AuthenticationGuard>
  );
}
