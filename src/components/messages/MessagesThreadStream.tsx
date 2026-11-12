"use client";

import type { RefObject } from "react";
import { BellNotification as BellRing } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { clusterMessages, type ThreadMessage } from "~/lib/messages/thread";
import { LoreBotFeedView } from "./LoreBotFeedView";
import { MessagesBubble, type MessageActions } from "./MessagesBubble";
import type { MessagesSettings } from "./MessagesFolderNav";
import { SystemBroadcastCard, type BroadcastItem } from "./SystemBroadcastCard";

/** Placeholder bubbles in the shape of a conversation while it loads. */
function ThreadSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 py-4" aria-busy="true" aria-label="Loading messages">
      <Skeleton className="rounded-card h-10 w-2/5 self-start" />
      <Skeleton className="rounded-card h-14 w-3/5 self-start" />
      <Skeleton className="rounded-card h-10 w-1/3 self-end" />
      <Skeleton className="rounded-card h-12 w-1/2 self-start" />
      <Skeleton className="rounded-card h-10 w-2/5 self-end" />
    </div>
  );
}

interface ThreadStreamProps {
  isSystemThread: boolean;
  isLoreBotThread: boolean;
  isLoading: boolean;
  broadcasts: BroadcastItem[];
  onDismissBroadcast: (id: string) => void;
  messages: ThreadMessage[];
  hasOlder: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
  actions: MessageActions;
  currentUserId: string;
  searchQuery: string;
  settings?: MessagesSettings;
  onReply: (message: ThreadMessage) => void;
  /** The newest own message the other person has read, if any. */
  seenMessageId: string | null;
  endRef: RefObject<HTMLDivElement | null>;
}

export function MessagesThreadStream({
  isSystemThread,
  isLoreBotThread,
  isLoading,
  broadcasts,
  onDismissBroadcast,
  messages,
  hasOlder,
  isLoadingOlder,
  onLoadOlder,
  actions,
  currentUserId,
  searchQuery,
  settings,
  onReply,
  seenMessageId,
  endRef,
}: ThreadStreamProps) {
  if (isLoading) return <ThreadSkeleton />;
  if (isLoreBotThread && !isSystemThread) return <LoreBotFeedView currentUserId={currentUserId} />;

  if (isSystemThread) {
    return (
      <div className="mx-auto w-full max-w-3xl py-3">
        {broadcasts.length === 0 ? (
          <EmptyState
            className="min-h-[300px]"
            icon={<BellRing />}
            title="No system broadcasts"
            message={
              searchQuery
                ? `No bulletins match "${searchQuery}"`
                : "No platform announcements or simulation updates have been sent."
            }
          />
        ) : (
          broadcasts.map((item) => (
            <SystemBroadcastCard
              key={item.id}
              item={item}
              onDismiss={() => onDismissBroadcast(item.id)}
            />
          ))
        )}
        <div ref={endRef} />
      </div>
    );
  }

  return (
    <div className="py-2">
      {hasOlder && !searchQuery && (
        <div className="flex justify-center px-4 py-2">
          {isLoadingOlder ? (
            <Skeleton className="rounded-control h-8 w-40" aria-label="Loading older messages" />
          ) : (
            <Button type="button" variant="secondary" size="sm" onClick={onLoadOlder}>
              Load older messages
            </Button>
          )}
        </div>
      )}
      {clusterMessages(messages).map(({ message, startsCluster, endsCluster }) => (
        <MessagesBubble
          key={message.id}
          message={message}
          currentUserId={currentUserId}
          startsCluster={startsCluster}
          endsCluster={endsCluster}
          seen={message.id === seenMessageId}
          onReply={onReply}
          actions={actions}
          settings={settings}
          searchQuery={searchQuery}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
