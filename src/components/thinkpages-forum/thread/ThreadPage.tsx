"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, EyeClosed } from "iconoir-react";
import { Card } from "~/components/ui/card";
import { Signal } from "~/components/ui/signal";
import { useUser } from "~/context/auth-context";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { useScrollToPostHash } from "~/hooks/useScrollToPostHash";
import { useThreadActionCards } from "~/hooks/useThreadActionCards";
import { categoryHref, threadHref } from "~/lib/thinkpages-forum/links";
import { pageCount, POSTS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { cn } from "~/lib/utils/cn";
import { api } from "~/trpc/react";
import { ForumNotice } from "../BanNotice";
import { ForumBreadcrumbs, forumTrail } from "../ForumBreadcrumbs";
import {
  PHONE_QUERY,
  REPLY_ID,
  ReplyComposer,
  type CanvasSubmitMeta,
  type QuoteRequest,
} from "../composer";
import { ForumLoadError, ForumPageSkeleton } from "../ForumPageState";
import type { ModeratorTools } from "../ModeratorMenu";
import { Pagination, pageHref, useLastPageRedirect } from "../Pagination";
import { ForumPage } from "../shell";
import { PostCard } from "./PostCard";
import { ThreadActions } from "./ThreadActions";
import { ThreadRail } from "./ThreadRail";
import type { EditBody, ForumPost, ThreadData } from "./types";

const NO_POSTS: ForumPost[] = [];

interface ThreadPageProps {
  threadId: string;
  page: number;
}

/** Takes the reader to the reply composer under the posts and puts the caret in it. */
function focusComposer() {
  const composer = document.getElementById(REPLY_ID);
  composer?.scrollIntoView({ block: "center" });
  composer?.querySelector<HTMLElement>("[contenteditable='true'], textarea, input")?.focus();
}

/** Why the thread takes no reply: it is closed (a Signal), or the viewer may not post (the server's notice). */
function ClosedNote({ data }: { data: ThreadData }) {
  const { thread } = data;
  if (thread.locked || thread.archived) {
    return (
      <Signal
        tone="info"
        title={thread.locked ? "This thread is locked." : "This thread is archived."}
      >
        No new replies can be posted. You can still read it.
      </Signal>
    );
  }
  return data.notice ? <ForumNotice notice={data.notice} banned={data.banned} /> : null;
}

/** Footer of the feed pane: where the page sits in the thread, and the page links. */
function FeedFooter({
  data,
  page,
  totalPages,
  basePath,
}: {
  data: ThreadData;
  page: number;
  totalPages: number;
  basePath: string;
}) {
  const first = data.posts[0]?.number;
  const last = data.posts[data.posts.length - 1]?.number;
  if (totalPages <= 1 || first === undefined || last === undefined) return null;
  return (
    <div className="border-separator border-t px-4 py-3 sm:px-6">
      <Pagination
        page={page}
        last={totalPages}
        hrefFor={(n) => pageHref(basePath, n)}
        summary={`Posts ${first}–${last} of ${data.total}`}
      />
    </div>
  );
}

/**
 * A thread: its posts in one feed pane (divided, no card per post) with the thread's actions in the header, the
 * reply composer while it is open, and the Inspector rail. Authors edit in place; members report; the category's
 * moderators get the thread bar and each post's menu.
 */
export function ThreadPage({ threadId, page }: ThreadPageProps) {
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
  useScrollToPostHash(posts, threadId, page);
  usePageTitle({ title: data?.thread.title ?? "ThinkPages" });

  // Phones reply from a docked bar and a sheet; wider screens from the composer under the posts.
  const phone = useMediaQuery(PHONE_QUERY);
  const [replyOpen, setReplyOpen] = useState(false);
  const [quote, setQuote] = useState<QuoteRequest | null>(null);
  const startReply = useCallback(() => (phone ? setReplyOpen(true) : focusComposer()), [phone]);
  const startQuote = useCallback(
    (next: QuoteRequest) => {
      setQuote(next);
      startReply();
    },
    [startReply]
  );
  const clearQuote = useCallback(() => setQuote(null), []);

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
    async (wikitext: string, { personaId }: CanvasSubmitMeta) => {
      const { postId, formatting } = await replyTo({ threadId, wikitext, personaId });
      await refresh();
      // The reply is the thread's last post; ask where that is rather than guessing the page.
      const at = await utils.thinkpagesForum.resolvePost.fetch({ postId }).catch(() => null);
      const target = at?.page ?? page;
      router.push(`${basePath}?page=${target}#post-${postId}`);
      return { formatting };
    },
    [replyTo, refresh, utils, threadId, basePath, page, router]
  );

  const edit = useCallback(
    async (postId: string, body: EditBody) => {
      // M1: the server refuses the edit if the post changed (a moderator edit) since this page loaded it.
      const editedAt = posts.find((p) => p.id === postId)?.editedAt ?? null;
      const { formatting } = await editPost({ postId, ...body, editedAt });
      await utils.thinkpagesForum.thread.invalidate({ threadId });
      return { formatting };
    },
    [editPost, utils, threadId, posts]
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
  const style = data.style === "ic" ? "ic" : "ooc";
  const board = categoryHref(category);

  return (
    <ForumPage
      title={thread.title}
      breadcrumbs={
        <ForumBreadcrumbs
          items={[...forumTrail(category.realm), { label: category.name, href: board }]}
        />
      }
      // The trail scrolls away with the header; the compact bar keeps this way up (as NewThreadForm does).
      back={{ href: board, label: category.name }}
      actions={<ThreadActions data={data} signedIn={!!isSignedIn} refresh={refresh} />}
      rail={<ThreadRail data={data} />}
    >
      {thread.hidden ? (
        <p className="text-callout text-label-secondary flex items-center gap-2 px-1">
          <EyeClosed aria-hidden className="size-4 shrink-0" />
          This thread is hidden from members.
        </p>
      ) : null}
      {typeof thread.xenforoThreadId === "number" ? (
        <p className="text-callout text-label-secondary flex items-center gap-2 px-1">
          <Archive aria-hidden className="size-4 shrink-0" />
          Imported from the old forum.
        </p>
      ) : null}
      <Card content="feed" className="overflow-hidden">
        {posts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            authors={data.authors}
            style={style}
            className={cn(index > 0 && "border-separator border-t")}
            cards={cards}
            cardsReady={ready}
            cardsErrored={errored}
            canReply={data.canReply}
            onReply={startReply}
            onQuote={startQuote}
            open={!thread.locked && !thread.archived}
            signedIn={!!isSignedIn}
            onEdit={edit}
            canModerate={data.canModerate}
            tools={tools}
          />
        ))}
        <FeedFooter data={data} page={page} totalPages={totalPages} basePath={basePath} />
      </Card>
      {data.canReply ? (
        <ReplyComposer
          icAllowed={category.icAllowed}
          threadId={threadId}
          postStyle={style}
          phone={phone}
          open={replyOpen}
          onOpenChange={setReplyOpen}
          quoteRequest={quote}
          onQuoteInserted={clearQuote}
          onSubmit={reply}
        />
      ) : (
        <ClosedNote data={data} />
      )}
    </ForumPage>
  );
}
