"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { ChatBubble } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { useThreadActionCards } from "~/hooks/useThreadActionCards";
import { cn } from "~/lib/utils/cn";
import { api } from "~/trpc/react";
import type { ModeratorTools } from "../ModeratorMenu";
import { BoardMessage } from "./BoardMessage";
import type { BoardAccess, BoardData, BoardMessageData, BoardRealm } from "./types";

/** What every message of the feed needs besides itself. */
interface FeedContext {
  realm: BoardRealm;
  access: BoardAccess;
  signedIn: boolean;
  tools: ModeratorTools | null;
  onReply: (message: BoardMessageData) => void;
  onQuote: (message: BoardMessageData) => void;
  onChanged: () => void;
}

const DIVIDER = "border-separator border-t";

/** "Fiannria is typing", "Fiannria and Kir are typing", "3 people are typing". */
export function typingLine(names: readonly string[]): string | null {
  const [first, second] = names;
  if (first === undefined) return null;
  if (second === undefined) return `${first} is typing`;
  return names.length === 2
    ? `${first} and ${second} are typing`
    : `${names.length} people are typing`;
}

interface SectionProps {
  /** The messages to show, newest first. */
  messages: readonly BoardMessageData[];
  /** The id of the oldest message of the page, where the next page starts (not of what is held back). */
  cursor: string | undefined;
  hasMore: boolean;
  /** The first message of the feed carries no divider above it. */
  first: boolean;
  context: FeedContext;
}

/** One page of messages with its action cards, then the way to the page before it. */
function Section({ messages, cursor, hasMore, first, context }: SectionProps) {
  const { cards, ready, errored } = useThreadActionCards(messages);
  const [more, setMore] = useState(false);
  return (
    <>
      {messages.map((message, index) => (
        <BoardMessage
          key={message.id}
          message={message}
          {...context}
          cards={cards}
          cardsReady={ready}
          cardsErrored={errored}
          className={cn((!first || index > 0) && DIVIDER)}
        />
      ))}
      {hasMore && cursor ? (
        more ? (
          <EarlierPage before={cursor} context={context} />
        ) : (
          <div className={cn(DIVIDER, "flex items-center justify-center px-5 py-3")}>
            <Button
              variant="ghost"
              size="sm"
              className="text-label-secondary pointer-coarse:min-h-11"
              onClick={() => setMore(true)}
            >
              Load earlier messages
            </Button>
          </div>
        )
      ) : null}
    </>
  );
}

/** The page of 50 messages before `before`. It keeps showing its last answer while the cursor moves on a poll. */
function EarlierPage({ before, context }: { before: string; context: FeedContext }) {
  const { data, isLoading, isError, refetch } = api.thinkpagesForum.getBoard.useQuery(
    { realm: context.realm.slug, before },
    { placeholderData: keepPreviousData, refetchOnWindowFocus: false }
  );
  if (data) {
    return (
      <Section
        messages={data.messages}
        cursor={data.messages.at(-1)?.id}
        hasMore={data.hasMore}
        first={false}
        context={context}
      />
    );
  }
  if (isError) {
    return (
      <div className={cn(DIVIDER, "flex items-center justify-center gap-3 px-5 py-3")}>
        <p className="text-footnote text-label-secondary">Could not load earlier messages</p>
        <Button variant="secondary" size="sm" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  return (
    <div aria-busy={isLoading} className={cn(DIVIDER, "space-y-2 px-5 py-3")}>
      <p className="sr-only">Loading earlier messages</p>
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

/**
 * Whether the reader has scrolled the feed's top out of view upward, watched at `sentinel`. A feed whose top is
 * still below the fold counts as at the top: nothing has been scrolled past.
 */
function useScrolledAway(
  sentinel: RefObject<HTMLElement | null>,
  onChange: (away: boolean) => void
) {
  const notify = useRef(onChange);
  useEffect(() => {
    notify.current = onChange;
  });
  useEffect(() => {
    const element = sentinel.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      const viewportTop = entry.rootBounds?.top ?? 0;
      notify.current(!entry.isIntersecting && entry.boundingClientRect.top < viewportTop);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [sentinel]);
}

/** Brings the feed's top into view; a browser without `scrollIntoView` (a test DOM) leaves the page as it is. */
function scrollToFeedTop(element: HTMLElement | null, block: ScrollLogicalPosition) {
  if (element && typeof element.scrollIntoView === "function") element.scrollIntoView({ block });
}

interface BoardFeedProps {
  realm: BoardRealm & { id: string };
  /** The board's newest page, kept current by the live hook and the poll. */
  data: BoardData;
  /** The names typing now. */
  typing: readonly string[];
  /** The live connection is up; otherwise the page polls and says so. */
  live: boolean;
  signedIn: boolean;
  tools: ModeratorTools | null;
  /** Bumped when the reader posts: show the newest messages and bring the top into view. */
  showLatest: number;
  onReply: (message: BoardMessageData) => void;
  onQuote: (message: BoardMessageData) => void;
  onChanged: () => void;
}

/**
 * The realm board's feed in one pane: newest first, "Load earlier messages" paging back 50 at a time, who is typing,
 * and the note while live updates are paused. When the reader has scrolled away from the top the list holds still:
 * new messages wait behind "Jump to newest", while edits and removals still reach the messages on screen.
 */
export function BoardFeed({
  realm,
  data,
  typing,
  live,
  signedIn,
  tools,
  showLatest,
  onReply,
  onQuote,
  onChanged,
}: BoardFeedProps) {
  const top = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState<ReadonlySet<string> | null>(null);
  const latest = useRef<readonly BoardMessageData[]>(data.messages);
  useEffect(() => {
    latest.current = data.messages;
  });
  useScrolledAway(top, (away) => setHeld(away ? new Set(latest.current.map((m) => m.id)) : null));

  const [seenShowLatest, setSeenShowLatest] = useState(showLatest);
  if (seenShowLatest !== showLatest) {
    setSeenShowLatest(showLatest);
    setHeld(null);
  }
  useEffect(() => {
    if (showLatest > 0) scrollToFeedTop(top.current, "nearest");
  }, [showLatest]);

  const shown = useMemo(
    () => (held ? data.messages.filter((m) => held.has(m.id)) : data.messages),
    [held, data.messages]
  );
  const waiting = data.messages.length - shown.length;
  const context: FeedContext = {
    realm,
    access: data.access,
    signedIn,
    tools,
    onReply,
    onQuote,
    onChanged,
  };
  const typingText = typingLine(typing);

  const jumpToNewest = () => {
    setHeld(null);
    scrollToFeedTop(top.current, "start");
  };

  return (
    <>
      {waiting > 0 ? (
        <div className="z-sticky sticky top-20 flex h-0 justify-center">
          <Button size="sm" className="shadow-floating" onClick={jumpToNewest}>
            Jump to newest
            <span className="tabular-nums">{`${waiting} new`}</span>
          </Button>
        </div>
      ) : null}
      <Card content="feed" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pt-4 pb-2 sm:px-5">
          <h2 className="text-headline flex items-center gap-2 leading-none">
            <ChatBubble aria-hidden className="text-tint size-5" />
            Realm board
          </h2>
          <p aria-live="polite" className="text-footnote text-label-secondary">
            {typingText}
          </p>
        </div>
        {live ? null : (
          <p role="status" className="text-footnote text-label-secondary px-4 pb-2 sm:px-5">
            Live updates paused, retrying
          </p>
        )}
        <div ref={top} aria-hidden className="h-px" />
        {shown.length === 0 ? (
          <EmptyState
            compact
            title={data.access.canPost ? "Start the conversation" : "No messages yet"}
            message={data.access.canPost ? `Say something to ${realm.name}` : undefined}
          />
        ) : (
          <Section
            messages={shown}
            cursor={data.messages.at(-1)?.id}
            hasMore={data.hasMore}
            first
            context={context}
          />
        )}
      </Card>
    </>
  );
}
