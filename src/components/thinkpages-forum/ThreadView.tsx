"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { useUser } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useThreadActionCards } from "~/hooks/useThreadActionCards";
import { categoryHref, threadHref } from "~/lib/thinkpages-forum/links";
import { pageCount, POSTS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { api } from "~/trpc/react";
import { ForumNotice } from "./BanNotice";
import { ForumBreadcrumbs, forumTrail } from "./ForumBreadcrumbs";
import { ForumComposer, type ForumComposerInput } from "./ForumComposer";
import { ForumLoadError, ForumPageSkeleton } from "./ForumPageState";
import { Pagination, useLastPageRedirect } from "./Pagination";
import type { ModeratorTools } from "./ModeratorMenu";
import { PostItem, type ForumPost } from "./PostItem";
import { ReportDialog } from "./ReportDialog";
import { ThreadModeratorBar } from "./ThreadModeratorBar";

const NO_POSTS: ForumPost[] = [];

/**
 * Scrolls to `#post-<id>` once that page's posts are on screen (permalinks, after a reply), once per hash: a refetch
 * (saving an edit, a moderator action) leaves the reader where they are.
 */
function useScrollToPostHash(posts: readonly ForumPost[]) {
  const scrolled = useRef<string | null>(null);
  useEffect(() => {
    const hash = window.location.hash;
    if (posts.length === 0 || !hash.startsWith("#post-") || scrolled.current === hash) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    target.scrollIntoView({ block: "start" });
    scrolled.current = hash;
  }, [posts]);
}

interface ThreadViewProps {
  threadId: string;
  page: number;
}

/**
 * A thread's posts with edit in place for the author and a reply composer while it is open; members report, and the
 * category's moderators get the thread bar and each post's menu. Without a composer, the reason why (a ban notice).
 */
export function ThreadView({ threadId, page }: ThreadViewProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const { isSignedIn } = useUser();
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
  const { mutateAsync: modEditPost } = api.thinkpagesForumMod.editPost.useMutation();

  /** The thread, then the listings whose counts and order follow it. */
  const refresh = useCallback(async () => {
    await utils.thinkpagesForum.thread.invalidate({ threadId });
    void utils.thinkpagesForum.category.invalidate();
    void utils.thinkpagesForum.categories.invalidate();
    void utils.thinkpagesForum.realmSection.invalidate();
  }, [utils, threadId]);

  const reply = useCallback(
    async ({ html, personaId }: ForumComposerInput) => {
      const { postId } = await replyTo({ threadId, html, personaId });
      await refresh();
      // The reply is the thread's last post; ask where that is rather than guessing the page.
      const at = await utils.thinkpagesForum.resolvePost.fetch({ postId }).catch(() => null);
      const target = at?.page ?? page;
      router.push(`${basePath}?page=${target}#post-${postId}`);
    },
    [replyTo, refresh, utils, threadId, basePath, page, router]
  );

  const edit = useCallback(
    async (postId: string, html: string) => {
      await editPost({ postId, html });
      await utils.thinkpagesForum.thread.invalidate({ threadId });
    },
    [editPost, utils, threadId]
  );

  const threadCategory = data?.category;
  const tools = useMemo<ModeratorTools | null>(
    () =>
      threadCategory
        ? {
            category: threadCategory,
            refresh,
            saveEdit: async (postId, html, note) => {
              await modEditPost({ postId, html, note });
              await utils.thinkpagesForum.thread.invalidate({ threadId });
            },
          }
        : null,
    [threadCategory, refresh, modEditPost, utils, threadId]
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
  // The thread's author, when one of the viewer's own posts on this page shows it is them.
  const ownThread = posts.some((p) => p.isOwn && p.authorUserId === thread.authorUserId);

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
      {data.canModerate ? (
        <ThreadModeratorBar
          thread={thread}
          categories={data.moderatorTools?.categories ?? []}
          refresh={refresh}
        />
      ) : null}
      {!data.canModerate && isSignedIn && !ownThread ? (
        <div className="flex justify-end">
          <ReportDialog targetType="thread" targetId={thread.id} label="Report thread" />
        </div>
      ) : null}
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
            canReport={!!isSignedIn && !post.isOwn && !data.canModerate}
            canModerate={data.canModerate}
            tools={tools}
          />
        ))}
      </div>
      <Pagination basePath={basePath} page={page} totalPages={totalPages} />
      {data.canReply ? (
        <section aria-label="Reply" className="space-y-2">
          <ForumComposer icAllowed={category.icAllowed} submitLabel="Reply" onSubmit={reply} />
        </section>
      ) : data.notice ? (
        <ForumNotice notice={data.notice} banned={data.banned} />
      ) : null}
    </div>
  );
}
