"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useThreadActionCards } from "~/hooks/useThreadActionCards";
import { categoryHref, threadHref } from "~/lib/thinkpages-forum/links";
import { pageCount, POSTS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { api } from "~/trpc/react";
import { ForumBreadcrumbs, forumTrail } from "./ForumBreadcrumbs";
import { ForumComposer, type ForumComposerInput } from "./ForumComposer";
import { ForumLoadError, ForumPageSkeleton } from "./ForumPageState";
import { Pagination, useLastPageRedirect } from "./Pagination";
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
  const { data, isLoading, error, refetch } = api.thinkpagesForum.thread.useQuery({
    threadId,
    page,
  });
  const basePath = threadHref(threadId);
  const totalPages = pageCount(data?.total ?? 0, POSTS_PER_PAGE);
  const redirecting = useLastPageRedirect(basePath, page, data?.total, totalPages);
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
      void utils.thinkpagesForum.realmSection.invalidate();
      // The reply is the thread's last post; ask where that is rather than guessing the page.
      const at = await utils.thinkpagesForum.resolvePost.fetch({ postId }).catch(() => null);
      const target = at?.page ?? page;
      router.push(`${basePath}?page=${target}#post-${postId}`);
    },
    [replyTo, utils, threadId, basePath, page, router]
  );

  const edit = useCallback(
    async (postId: string, html: string) => {
      await editPost({ postId, html });
      await utils.thinkpagesForum.thread.invalidate({ threadId });
    },
    [editPost, utils, threadId]
  );

  if (isLoading || redirecting) return <ForumPageSkeleton blocks={2} />;

  if (!data) {
    return (
      <ForumLoadError
        notFound={error?.data?.code === "NOT_FOUND"}
        notFoundTitle="Thread not found"
        notFoundMessage="It may have been removed, or the link is incorrect."
        onRetry={() => void refetch()}
      />
    );
  }

  const { thread, category } = data;
  const open = !thread.locked && !thread.archived;

  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-4 sm:py-6 md:py-8">
      <PageHeader
        title={thread.title}
        subtitle={
          <ForumBreadcrumbs
            items={[
              ...forumTrail(category.realm),
              { label: category.name, href: categoryHref(category) },
              { label: thread.title },
            ]}
          />
        }
        back={{ href: categoryHref(category), label: category.name }}
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
      <Pagination basePath={basePath} page={page} totalPages={totalPages} />
      {data.canReply ? (
        <section aria-label="Reply" className="space-y-2">
          <ForumComposer icAllowed={category.icAllowed} submitLabel="Reply" onSubmit={reply} />
        </section>
      ) : null}
    </div>
  );
}
