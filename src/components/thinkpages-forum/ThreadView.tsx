"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useThreadActionCards } from "~/hooks/useThreadActionCards";
import { pageCount, POSTS_PER_PAGE } from "~/lib/thinkpages-forum";
import { api } from "~/trpc/react";
import { ForumComposer, type ForumComposerInput } from "./ForumComposer";
import { Pagination } from "./Pagination";
import { PostItem, type ForumPost } from "./PostItem";

const NO_POSTS: ForumPost[] = [];

/** Scrolls to `#post-<id>` once that page's posts are on screen (permalinks, after a reply). */
function useScrollToPostHash(posts: readonly ForumPost[]) {
  useEffect(() => {
    const hash = window.location.hash;
    if (posts.length === 0 || !hash.startsWith("#post-")) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [posts]);
}

interface ThreadViewProps {
  threadId: string;
  page: number;
}

/** A thread's posts with edit in place for the author and a reply composer while it is open. */
export function ThreadView({ threadId, page }: ThreadViewProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const { data, isLoading, error } = api.thinkpagesForum.thread.useQuery({ threadId, page });
  const posts = data?.posts ?? NO_POSTS;
  const { cards, ready, errored } = useThreadActionCards(posts);
  useScrollToPostHash(posts);
  usePageTitle({ title: data?.thread.title ?? "ThinkPages Forum" });

  const { mutateAsync: replyTo } = api.thinkpagesForum.reply.useMutation();
  const { mutateAsync: editPost } = api.thinkpagesForum.editPost.useMutation();

  const reply = useCallback(
    async ({ html, personaId }: ForumComposerInput) => {
      const { postId } = await replyTo({ threadId, html, personaId });
      await utils.thinkpagesForum.thread.invalidate({ threadId });
      void utils.thinkpagesForum.category.invalidate();
      void utils.thinkpagesForum.categories.invalidate();
      // The reply is the thread's last post; ask where that is rather than guessing the page.
      const at = await utils.thinkpagesForum.resolvePost.fetch({ postId }).catch(() => null);
      const target = at?.page ?? page;
      router.push(`/thinkpages/t/${threadId}?page=${target}#post-${postId}`);
    },
    [replyTo, utils, threadId, page, router]
  );

  const edit = useCallback(
    async (postId: string, html: string) => {
      await editPost({ postId, html });
      await utils.thinkpagesForum.thread.invalidate({ threadId });
    },
    [editPost, utils, threadId]
  );

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="rounded-card h-40 w-full" />
        <Skeleton className="rounded-card h-40 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Card>
          <EmptyState
            title="Thread not found"
            message="It may have been removed, or the link is incorrect."
            action={
              <Button asChild variant="secondary">
                <Link href="/thinkpages/forum">Back to the forum</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const { thread, category } = data;
  const open = !thread.locked && !thread.archived;

  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-4 sm:py-6 md:py-8">
      <PageHeader
        title={thread.title}
        back={{ href: `/thinkpages/c/${category.key}`, label: category.name }}
        bleed
      />
      {thread.locked ? (
        <p className="text-callout text-label-secondary flex items-center gap-2 px-1">
          <Lock aria-hidden className="size-4 shrink-0" />
          This thread is locked.
        </p>
      ) : null}
      <div className="space-y-3">
        {posts.map((post) => (
          <PostItem
            key={post.id}
            post={post}
            authors={data.authors}
            cards={cards}
            cardsReady={ready}
            cardsErrored={errored}
            canEdit={post.isOwn && open}
            onEdit={edit}
          />
        ))}
      </div>
      <Pagination
        basePath={`/thinkpages/t/${threadId}`}
        page={page}
        totalPages={pageCount(data.total, POSTS_PER_PAGE)}
      />
      {data.canReply ? (
        <section aria-label="Reply" className="space-y-2">
          <ForumComposer icAllowed={category.icAllowed} submitLabel="Reply" onSubmit={reply} />
        </section>
      ) : null}
    </div>
  );
}
