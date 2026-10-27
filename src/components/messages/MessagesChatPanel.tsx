"use client";

import React, { useEffect, useState, useRef } from "react";
import { useUser } from "~/context/auth-context";
import { MessagesChatHeader } from "./MessagesChatHeader";
import { MessagesBubble, formatTimestamp } from "./MessagesBubble";
import {
  isConsecutiveMessage,
  useConversationMessages,
  useMarkConversationRead,
  useSeenMessageId,
  useSystemBroadcasts,
} from "./useConversationMessages";
import { MessagesAwaitingNote, MessagesRequestBar } from "./MessagesRequestBar";
import { MessagesInputBar } from "./MessagesInputBar";
import type { MessagesSettings } from "./MessagesFolderNav";
import type { ThinkShareConversation, ThinkShareClientState } from "~/types/thinkshare";
import type { MessageFolder } from "~/types/messages";
import { SYSTEM_CONVERSATION_ID, LOREBOT_CONVERSATION_ID } from "~/types/messages";
import {
  Crown,
  Shield,
  AntennaSignal as Radio,
  Xmark as X,
  OpenNewWindow as ExternalLink,
  BellNotification as BellRing,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { cn } from "~/lib/utils";
import { sanitizeUserContent } from "~/lib/utils/sanitize-html";
import { MessagesViewDetailsModal } from "./MessagesViewDetailsModal";
import { MessagesAddParticipantsModal } from "./MessagesAddParticipantsModal";
import { LoreBotFeedView } from "./LoreBotFeedView";
import Link from "next/link";
import { toRouterPath } from "~/lib/base-path";

const DISPATCH_PATTERN = /diplomatic|treaty|embassy|alliance|summons|dispatch/;

function getSystemAlertStyle(content: string, type?: string) {
  if (DISPATCH_PATTERN.test(`${content} ${type || ""}`.toLowerCase())) {
    return {
      icon: Crown,
      iconColor: "text-yellow bg-yellow/15",
      badgeClass: "text-yellow bg-yellow/15",
      label: "Dispatch",
    };
  }
  return {
    icon: Radio,
    iconColor: "text-indigo bg-indigo/15",
    badgeClass: "text-indigo bg-indigo/15",
    label: "System",
  };
}

export function SystemBroadcastCard({ item, onDismiss }: { item: any; onDismiss?: () => void }) {
  const content = item.description || item.message || item.content || "";
  const title = item.title || item.subject || "System Notification";
  const {
    icon: Icon,
    iconColor,
    badgeClass,
    label,
  } = getSystemAlertStyle(title + " " + content, item.type || item.category);

  return (
    <div className="bg-surface-secondary rounded-row relative mx-4 my-2 flex gap-3 p-4">
      <div
        className={cn(
          "rounded-control flex size-9 shrink-0 items-center justify-center self-start",
          iconColor
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 pr-6">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={cn("text-caption rounded-full px-2 py-0.5", badgeClass)}>{label}</span>
            {item.priority && (
              <span className="text-footnote text-label-secondary">• {item.priority}</span>
            )}
          </div>
          <span className="text-footnote text-label-secondary tabular-nums">
            {formatTimestamp(item.createdAt ?? item.ixTimeTimestamp)}
          </span>
        </div>

        <h4 className="text-headline text-label mb-1">{title}</h4>

        <div
          className="text-callout text-label-secondary [&>a]:text-tint [&>a]:underline [&>p]:mb-0"
          dangerouslySetInnerHTML={{ __html: sanitizeUserContent(content) }}
        />

        {item.href && (
          <div className="mt-2 flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={toRouterPath(item.href)}>
                <span>Open details</span>
                <ExternalLink aria-hidden="true" />
              </Link>
            </Button>
          </div>
        )}
      </div>

      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDismiss}
          className="text-label-secondary hover:text-label absolute top-2 right-2"
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}

interface ThreadStreamProps {
  /** The newest own message the other person has read (read receipts), if any. */
  seenMessageId?: string | null;
  isSystemThread: boolean;
  isLoreBotThread: boolean;
  isLoading: boolean;
  system: ReturnType<typeof useSystemBroadcasts>;
  thread: ReturnType<typeof useConversationMessages>;
  currentUserId: string;
  searchQuery: string;
  settings?: MessagesSettings;
  onReply: (message: any) => void;
  endRef: React.RefObject<HTMLDivElement | null>;
}

function ThreadStream({
  isSystemThread,
  isLoreBotThread,
  isLoading,
  system,
  thread,
  currentUserId,
  searchQuery,
  settings,
  onReply,
  endRef,
  seenMessageId,
}: ThreadStreamProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="border-tint size-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }
  if (isLoreBotThread && !isSystemThread) return <LoreBotFeedView currentUserId={currentUserId} />;

  if (isSystemThread) {
    return (
      <div className="mx-auto w-full max-w-3xl py-3">
        {system.broadcasts.length === 0 ? (
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
          system.broadcasts.map((item: any) => (
            <SystemBroadcastCard
              key={item.id}
              item={item}
              onDismiss={() => system.dismiss(item.id)}
            />
          ))
        )}
        <div ref={endRef} />
      </div>
    );
  }

  return (
    <div className="py-2">
      {thread.messages.map((message: any, index: number, arr: any[]) => (
        <React.Fragment key={message.id}>
          <MessagesBubble
            message={message}
            currentUserId={currentUserId}
            isConsecutive={isConsecutiveMessage(arr[index - 1], message)}
            onReply={onReply}
            actions={thread.actions}
            settings={settings}
            searchQuery={searchQuery}
          />
          {message.id === seenMessageId && (
            <p className="text-caption text-label-secondary px-4 text-right">Seen</p>
          )}
        </React.Fragment>
      ))}
      <div ref={endRef} />
    </div>
  );
}

interface MessagesChatPanelProps {
  conversation: ThinkShareConversation;
  currentUserId: string;
  activeFolder: MessageFolder;
  clientState: ThinkShareClientState;
  sendTypingIndicator: (
    conversationId: string,
    accountId: string | undefined,
    isTyping: boolean
  ) => void;
  onBack?: () => void;
  settings?: MessagesSettings;
  isMuted?: boolean;
  isArchived?: boolean;
  onMuteToggle?: () => void;
  onArchiveToggle?: () => void;
  onDeleteConversation?: () => void;
  onAddParticipant?: (userId: string) => Promise<void>;
}

export function MessagesChatPanel({
  conversation,
  currentUserId,
  activeFolder,
  clientState,
  sendTypingIndicator,
  onBack,
  settings,
  isMuted = false,
  isArchived = false,
  onMuteToggle,
  onArchiveToggle,
  onDeleteConversation,
  onAddParticipant,
}: MessagesChatPanelProps) {
  const { user } = useUser();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddParticipantsOpen, setIsAddParticipantsOpen] = useState(false);

  const isSystemThread =
    conversation.id === SYSTEM_CONVERSATION_ID || conversation.source === "system";
  const isLoreBotThread =
    conversation.id === LOREBOT_CONVERSATION_ID || conversation.source === "lorebot";

  const system = useSystemBroadcasts({
    enabled: isSystemThread,
    currentUserId,
    searchQuery,
  });
  const thread = useConversationMessages({
    conversationId: conversation.id,
    currentUserId,
    enabled: !isSystemThread && !isLoreBotThread,
    searchQuery,
    user,
    onSent: () => setReplyingTo(null),
  });

  useMarkConversationRead(conversation, currentUserId, isSystemThread);

  const handleSendMessage = (content?: string, plainText?: string) => {
    if (!plainText?.trim() || !currentUserId || isSystemThread) return;
    thread.send(content ?? "");
  };

  // Scroll to bottom on new messages or system broadcasts
  useEffect(() => {
    if (!searchQuery) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [thread.messages.length, system.broadcasts.length, searchQuery, isSystemThread]);

  const otherParticipant =
    isSystemThread || conversation.type === "group" ? undefined : conversation.otherParticipants[0];
  // Server presence, already filtered by the other person's Online status setting (SL-4).
  const participantStatus = otherParticipant?.isOnline ? "online" : undefined;
  const isDirect = conversation.type === "direct" && !isSystemThread && !isLoreBotThread;
  const seenMessageId = useSeenMessageId(conversation.id, thread.messages, currentUserId, isDirect);
  const otherName = otherParticipant?.account?.displayName ?? "This person";

  const isLoading = isSystemThread ? system.isLoading : thread.isLoading;

  return (
    <div className="flex h-full flex-col">
      <MessagesChatHeader
        conversation={conversation}
        currentUserId={currentUserId}
        activeFolder={activeFolder}
        participantStatus={participantStatus}
        onSearch={setSearchQuery}
        onBack={onBack}
        onViewDetails={() => setIsDetailsOpen(true)}
        onAddParticipants={() => setIsAddParticipantsOpen(true)}
        onMuteToggle={onMuteToggle}
        onArchiveToggle={onArchiveToggle}
        onDeleteConversation={onDeleteConversation}
        onClearSystemMessages={isSystemThread ? system.clearAll : undefined}
        isMuted={isMuted}
        isArchived={isArchived}
      />

      <div className="flex-1 scrollbar-none overflow-x-hidden overflow-y-auto">
        <ThreadStream
          isSystemThread={isSystemThread}
          isLoreBotThread={isLoreBotThread}
          isLoading={isLoading}
          system={system}
          thread={thread}
          currentUserId={currentUserId}
          searchQuery={searchQuery}
          settings={settings}
          onReply={setReplyingTo}
          endRef={messagesEndRef}
          seenMessageId={seenMessageId}
        />
      </div>

      {conversation.awaitingAcceptance && <MessagesAwaitingNote recipientName={otherName} />}
      {conversation.isRequest ? (
        <MessagesRequestBar
          conversationId={conversation.id}
          senderName={otherName}
          onDeclined={() => onBack?.()}
        />
      ) : isSystemThread || isLoreBotThread || conversation.source === "forum" ? (
        <div className="border-separator text-footnote text-label-secondary flex shrink-0 items-center justify-center gap-2 border-t px-4 py-3">
          <Shield className="text-label-secondary size-3.5" aria-hidden="true" />
          <span>
            {conversation.source === "forum"
              ? "This conversation came from the old forum and is read-only."
              : "System Messages is an official broadcast channel. Messages are read-only."}
          </span>
        </div>
      ) : (
        <MessagesInputBar
          onSendMessage={handleSendMessage}
          onTyping={(isTyping) => {
            if (clientState.connectionStatus === "connected") {
              sendTypingIndicator(conversation.id, undefined, isTyping);
            }
          }}
          isSending={thread.isSending}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      )}

      {isDetailsOpen && (
        <MessagesViewDetailsModal
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          conversation={conversation as any}
          currentUser={
            user
              ? {
                  id: currentUserId,
                  username: user.username ?? undefined,
                  displayName: user.fullName ?? user.username ?? undefined,
                  profileImageUrl: user.imageUrl,
                }
              : null
          }
          displayNamePreference={settings?.displayNamePreference ?? "country"}
        />
      )}

      {isAddParticipantsOpen && (
        <MessagesAddParticipantsModal
          isOpen={isAddParticipantsOpen}
          onClose={() => setIsAddParticipantsOpen(false)}
          existingParticipantIds={[
            currentUserId,
            ...conversation.otherParticipants.map((p) => p.accountId),
          ]}
          onAddParticipant={async (userId) => {
            await onAddParticipant?.(userId);
          }}
        />
      )}
    </div>
  );
}
