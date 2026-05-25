"use client";

import React, { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useUser } from "~/context/auth-context";
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
  const { user } = useUser();
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
    onMutate: async (newMsg) => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };

      // Cancel outgoing fetches so they don't overwrite our optimistic update
      await utils.messages.getConversationMessages.cancel(queryKey);

      // Snapshot the previous value
      const previousMessages = utils.messages.getConversationMessages.getData(queryKey);

      // Optimistically add the message to the query cache
      const tempId = `temp-${Date.now()}`;

      const senderAccount = {
        id: currentUserId,
        username: user?.username ?? "me",
        displayName: user?.fullName ?? user?.username ?? "Me",
        profileImageUrl: user?.imageUrl ?? null,
        accountType: "country" as const,
      };

      const optimisticMsg = {
        id: tempId,
        conversationId: conversation.id,
        accountId: currentUserId,
        account: senderAccount,
        content: newMsg.content,
        messageType: newMsg.messageType ?? "text",
        ixTimeTimestamp: new Date(),
        createdAt: new Date(),
        reactions: {},
        mentions: [],
        attachments: [],
        replyTo: undefined,
        readReceipts: [],
        isSystem: false,
        editedAt: null,
        deletedAt: null,
        source: null,
      };

      utils.messages.getConversationMessages.setData(queryKey, (old: any) => {
        if (!old) return { messages: [optimisticMsg], nextCursor: undefined };
        return {
          ...old,
          messages: [optimisticMsg, ...old.messages],
        };
      });

      return { previousMessages };
    },
    onError: (error: any, newMsg, context) => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      if (context?.previousMessages) {
        utils.messages.getConversationMessages.setData(queryKey, context.previousMessages);
      }

      let msg = "Failed to send message";
      if (error.message?.includes("conversation")) {
        msg = "Conversation not found or you're not a participant";
      } else if (error.message?.includes("content")) {
        msg = "Message content is invalid";
      }
      notify.error(msg);
    },
    onSettled: () => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      void utils.messages.getConversationMessages.invalidate(queryKey);
      refetchConversations();
    },
  });

  // ── Lifted mutations (shared across all bubbles) ──
  const addReaction = api.messages.addReaction.useMutation({
    onMutate: async ({ messageId, reaction }) => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      await utils.messages.getConversationMessages.cancel(queryKey);
      const previousMessages = utils.messages.getConversationMessages.getData(queryKey);

      utils.messages.getConversationMessages.setData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m: any) => {
            if (m.id !== messageId) return m;
            const reactions = { ...m.reactions };
            reactions[reaction] = (reactions[reaction] ?? 0) + 1;
            return { ...m, reactions };
          }),
        };
      });

      return { previousMessages };
    },
    onError: (err, newReaction, context) => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      if (context?.previousMessages) {
        utils.messages.getConversationMessages.setData(queryKey, context.previousMessages);
      }
    },
    onSettled: () => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      void utils.messages.getConversationMessages.invalidate(queryKey);
    },
  });

  const removeReaction = api.messages.removeReaction.useMutation({
    onMutate: async ({ messageId, reaction }) => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      await utils.messages.getConversationMessages.cancel(queryKey);
      const previousMessages = utils.messages.getConversationMessages.getData(queryKey);

      utils.messages.getConversationMessages.setData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m: any) => {
            if (m.id !== messageId) return m;
            const reactions = { ...m.reactions };
            if (reactions[reaction] !== undefined) {
              reactions[reaction] = Math.max(0, reactions[reaction] - 1);
              if (reactions[reaction] === 0) {
                delete reactions[reaction];
              }
            }
            return { ...m, reactions };
          }),
        };
      });

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      if (context?.previousMessages) {
        utils.messages.getConversationMessages.setData(queryKey, context.previousMessages);
      }
    },
    onSettled: () => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      void utils.messages.getConversationMessages.invalidate(queryKey);
    },
  });

  const editMutation = api.messages.editMessage.useMutation({
    onMutate: async ({ messageId, content }) => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      await utils.messages.getConversationMessages.cancel(queryKey);
      const previousMessages = utils.messages.getConversationMessages.getData(queryKey);

      utils.messages.getConversationMessages.setData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m: any) =>
            m.id === messageId ? { ...m, content, editedAt: new Date() } : m
          ),
        };
      });

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      if (context?.previousMessages) {
        utils.messages.getConversationMessages.setData(queryKey, context.previousMessages);
      }
      notify.error("Failed to edit message");
    },
    onSettled: () => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      void utils.messages.getConversationMessages.invalidate(queryKey);
    },
  });

  const deleteMutation = api.messages.deleteMessage.useMutation({
    onMutate: async ({ messageId }) => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      await utils.messages.getConversationMessages.cancel(queryKey);
      const previousMessages = utils.messages.getConversationMessages.getData(queryKey);

      utils.messages.getConversationMessages.setData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.filter((m: any) => m.id !== messageId),
        };
      });

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      if (context?.previousMessages) {
        utils.messages.getConversationMessages.setData(queryKey, context.previousMessages);
      }
      notify.error("Failed to delete message");
    },
    onSettled: () => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      void utils.messages.getConversationMessages.invalidate(queryKey);
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
      onDeleteMessage: (messageId: string) => deleteMutation.mutate({ messageId }),
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

    return rawMessages.filter(
      (msg: any) =>
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
            <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">
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
