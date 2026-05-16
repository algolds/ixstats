"use client";

import React, { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { MessagesChatHeader } from "./MessagesChatHeader";
import { MessagesBubble, type MessageActions } from "./MessagesBubble";
import { MessagesInputBar } from "./MessagesInputBar";
import type { ThinkShareConversation, ThinkShareClientState } from "~/types/thinkshare";
import type { MessageFolder } from "~/types/messages";

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
}

export function MessagesChatPanel({
  conversation,
  currentUserId,
  activeFolder,
  clientState,
  sendTypingIndicator,
}: MessagesChatPanelProps) {
  const notify = useNotify();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch messages
  const {
    data: messagesData,
    isLoading,
    refetch: refetchMessages,
  } = api.messages.getConversationMessages.useQuery(
    {
      conversationId: conversation.id,
      userId: currentUserId,
    },
    {
      enabled: !!conversation.id && !!currentUserId,
      refetchOnWindowFocus: false,
      staleTime: 5000,
    }
  );

  // Invalidate conversation list (for unread badges)
  const utils = api.useUtils();
  const refetchConversations = useCallback(() => {
    void utils.messages.getConversationsByFolder.invalidate();
  }, [utils]);

  // Mark messages as read
  const markAsRead = api.messages.markMessagesAsRead.useMutation();

  useEffect(() => {
    if (conversation.id && currentUserId) {
      markAsRead.mutate({
        conversationId: conversation.id,
        userId: currentUserId,
        messageIds: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, currentUserId]);

  // Send message
  const sendMessage = api.messages.sendMessage.useMutation({
    onSuccess: () => {
      void refetchMessages();
      refetchConversations();
    },
    onError: (error: any) => {
      let msg = "Failed to send message";
      if (error.message?.includes("conversation")) {
        msg = "Conversation not found or you're not a participant";
      } else if (error.message?.includes("content")) {
        msg = "Message content is invalid";
      }
      notify.error(msg);
    },
  });

  // ── Lifted mutations (shared across all bubbles) ──
  const addReaction = api.messages.addReaction.useMutation({
    onSuccess: () => void refetchMessages(),
  });
  const removeReaction = api.messages.removeReaction.useMutation({
    onSuccess: () => void refetchMessages(),
  });
  const editMutation = api.messages.editMessage.useMutation({
    onSuccess: () => {
      void refetchMessages();
      notify.success("Message edited");
    },
  });
  const deleteMutation = api.messages.deleteMessage.useMutation({
    onSuccess: () => {
      void refetchMessages();
      notify.success("Message deleted");
    },
  });

  const messageActions: MessageActions = useMemo(
    () => ({
      onAddReaction: (messageId: string, reaction: string) =>
        addReaction.mutate({ messageId, userId: currentUserId, reaction }),
      onRemoveReaction: (messageId: string, reaction: string) =>
        removeReaction.mutate({ messageId, reaction }),
      onEditMessage: (messageId: string, content: string) =>
        editMutation.mutate({ messageId, content }),
      onDeleteMessage: (messageId: string) =>
        deleteMutation.mutate({ messageId }),
    }),
    [currentUserId, addReaction, removeReaction, editMutation, deleteMutation]
  );

  const handleSendMessage = useCallback(
    (content?: string, plainText?: string) => {
      const text = plainText ?? "";
      if (!text.trim() || !conversation || !currentUserId) return;

      sendMessage.mutate({
        conversationId: conversation.id,
        userId: currentUserId,
        content: content ?? "",
        messageType: "text",
      });
      setReplyingTo(null);
    },
    [conversation, currentUserId, sendMessage]
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!searchQuery) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messagesData?.messages?.length, searchQuery]);

  const messages = useMemo(() => {
    const rawMessages = messagesData?.messages ?? [];
    if (!searchQuery) return rawMessages;
    
    return rawMessages.filter((msg: any) => 
      msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.account?.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [messagesData?.messages, searchQuery]);

  const participantStatus = useMemo(() => {
    if (conversation.type === "group") return undefined;
    const otherParticipant = conversation.otherParticipants[0];
    if (!otherParticipant) return undefined;
    return clientState.presenceMap?.[otherParticipant.accountId] as any;
  }, [conversation, clientState.presenceMap]);

  return (
    <div className="flex h-full flex-col">
      <MessagesChatHeader
        conversation={conversation}
        currentUserId={currentUserId}
        activeFolder={activeFolder}
        participantStatus={participantStatus}
        onSearch={setSearchQuery}
      />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "No messages matching your search." : "No messages yet. Say hello!"}
            </p>
          </div>
        ) : (
          <div className="py-2">
            {[...messages].reverse().map((message: any, index: number, arr: any[]) => {
              const prev = index > 0 ? arr[index - 1] : null;
              const isConsecutive =
                prev != null &&
                prev.accountId === message.accountId &&
                new Date(message.createdAt ?? message.ixTimeTimestamp).getTime() -
                  new Date(prev.createdAt ?? prev.ixTimeTimestamp).getTime() <
                  5 * 60 * 1000;

              return (
                <MessagesBubble
                  key={message.id}
                  message={message}
                  currentUserId={currentUserId}
                  isConsecutive={isConsecutive}
                  onReply={setReplyingTo}
                  actions={messageActions}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <MessagesInputBar
        onSendMessage={handleSendMessage}
        onTyping={(isTyping) => {
          if (clientState.connectionStatus === "connected") {
            sendTypingIndicator(conversation.id, undefined, isTyping);
          }
        }}
        isSending={sendMessage.isPending}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />
    </div>
  );
}
