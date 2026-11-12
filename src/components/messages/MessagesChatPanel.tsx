"use client";

import { useState } from "react";
import { Shield } from "iconoir-react";
import { useUser } from "~/context/auth-context";
import { MessagesChatHeader } from "./MessagesChatHeader";
import {
  useConversationMessages,
  useMarkConversationRead,
  useSeenMessageId,
  useSystemBroadcasts,
} from "./useConversationMessages";
import { useThreadScroll } from "./useThreadScroll";
import { MessagesThreadStream } from "./MessagesThreadStream";
import { MessagesAwaitingNote, MessagesRequestBar } from "./MessagesRequestBar";
import { MessagesInputBar } from "./MessagesInputBar";
import type { MessagesSettings } from "./MessagesFolderNav";
import type { ThinkShareConversation } from "~/types/thinkshare";
import type { MessagesClientState } from "./useMessagesSocket";
import type { MessageFolder } from "~/types/messages";
import { SYSTEM_CONVERSATION_ID, LOREBOT_CONVERSATION_ID } from "~/types/messages";
import { displayNameOf } from "~/lib/messages/format";
import { typingAccountIds, typingLabel, type ThreadMessage } from "~/lib/messages/thread";
import { MessagesViewDetailsModal } from "./MessagesViewDetailsModal";
import { MessagesAddParticipantsModal } from "./MessagesAddParticipantsModal";

interface MessagesChatPanelProps {
  conversation: ThinkShareConversation;
  currentUserId: string;
  activeFolder: MessageFolder;
  clientState: MessagesClientState;
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
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
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

  const handleSendMessage = (content: string, plainText: string, mentions: string[]) => {
    if (!plainText.trim() || !currentUserId || isSystemThread) return;
    thread.send(content, { replyToId: replyingTo?.id, mentions });
  };

  const isLoading = isSystemThread ? system.isLoading : thread.isLoading;
  const newest = isSystemThread ? system.broadcasts.at(-1) : thread.messages.at(-1);
  const oldest = isSystemThread ? system.broadcasts[0] : thread.messages[0];
  const { containerRef, endRef, rememberPosition } = useThreadScroll({
    conversationId: conversation.id,
    firstId: oldest?.id,
    lastId: newest?.id,
    followNewest: !searchQuery && !isLoading,
  });

  const otherParticipant =
    isSystemThread || conversation.type === "group" ? undefined : conversation.otherParticipants[0];
  // Server presence, already filtered by the other person's Online status setting.
  const participantStatus = otherParticipant?.isOnline ? "online" : undefined;
  const isDirect = conversation.type === "direct" && !isSystemThread && !isLoreBotThread;
  const seenMessageId = useSeenMessageId(conversation.id, thread.messages, currentUserId, isDirect);
  const otherName = otherParticipant?.account?.displayName ?? "This person";

  const typing = typingLabel(
    typingAccountIds(clientState.typingIndicators, conversation.id, currentUserId).map((id) => {
      const account = conversation.otherParticipants.find((p) => p.accountId === id)?.account;
      return account ? displayNameOf(account, settings?.displayNamePreference) : "Someone";
    })
  );

  const isReadOnly = isSystemThread || isLoreBotThread || conversation.source === "forum";

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

      <div
        ref={containerRef}
        className="flex-1 scrollbar-none overflow-x-hidden overflow-y-auto overscroll-contain"
      >
        <MessagesThreadStream
          isSystemThread={isSystemThread}
          isLoreBotThread={isLoreBotThread}
          isLoading={isLoading}
          broadcasts={system.broadcasts}
          onDismissBroadcast={system.dismiss}
          messages={thread.messages}
          hasOlder={thread.hasOlder}
          isLoadingOlder={thread.isLoadingOlder}
          onLoadOlder={() => {
            rememberPosition();
            thread.loadOlder();
          }}
          actions={thread.actions}
          currentUserId={currentUserId}
          searchQuery={searchQuery}
          settings={settings}
          onReply={setReplyingTo}
          seenMessageId={seenMessageId}
          endRef={endRef}
        />
      </div>

      {conversation.awaitingAcceptance && <MessagesAwaitingNote recipientName={otherName} />}
      {conversation.isRequest ? (
        <MessagesRequestBar
          conversationId={conversation.id}
          senderName={otherName}
          onDeclined={() => onBack?.()}
        />
      ) : isReadOnly ? (
        <div className="border-separator text-footnote text-label-secondary flex shrink-0 items-center justify-center gap-2 border-t px-4 py-3">
          <Shield className="text-label-secondary size-3.5" aria-hidden="true" />
          <span>
            {conversation.source === "forum"
              ? "This conversation came from the old forum and is read-only."
              : "This is an official broadcast channel. Messages are read-only."}
          </span>
        </div>
      ) : (
        <>
          <p
            aria-live="polite"
            className="text-footnote text-label-secondary min-h-5 shrink-0 px-4 pt-1"
          >
            {typing}
          </p>
          <MessagesInputBar
            onSendMessage={handleSendMessage}
            onTyping={(isTyping) => {
              if (clientState.connectionStatus === "connected") {
                sendTypingIndicator(conversation.id, undefined, isTyping);
              }
            }}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            participants={conversation.otherParticipants}
          />
        </>
      )}

      {isDetailsOpen && (
        <MessagesViewDetailsModal
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          conversation={conversation}
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
