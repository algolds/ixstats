"use client";

import React, { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useUser } from "~/context/auth-context";
import { MessagesChatHeader } from "./MessagesChatHeader";
import { MessagesBubble, type MessageActions } from "./MessagesBubble";
import { MessagesInputBar } from "./MessagesInputBar";
import type { MessagesSettings } from "./MessagesFolderNav";
import type { ThinkShareConversation, ThinkShareClientState } from "~/types/thinkshare";
import type { MessageFolder } from "~/types/messages";
import { SYSTEM_CONVERSATION_ID, LOREBOT_CONVERSATION_ID } from "~/types/messages";
import { Crown, Shield, ShieldAlert, TrendingUp, Radio, Sparkles, X, ExternalLink, BellRing, BookOpen } from "lucide-react";
import { cn } from "~/lib/utils";
import { sanitizeUserContent } from "~/lib/utils/sanitize-html";
import { MessagesViewDetailsModal } from "./MessagesViewDetailsModal";
import { MessagesAddParticipantsModal } from "./MessagesAddParticipantsModal";
import { LoreBotFeedView } from "./LoreBotFeedView";
import Link from "next/link";

// Pretext shrinkwrap / time formatting helper
function formatTimestamp(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getSystemAlertStyle(content: string, type?: string) {
  const text = (content + " " + (type || "")).toLowerCase();
  if (
    text.includes("diplomatic") ||
    text.includes("treaty") ||
    text.includes("embassy") ||
    text.includes("alliance") ||
    text.includes("summons") ||
    text.includes("dispatch")
  ) {
    return {
      icon: Crown,
      iconColor: "text-amber-500 bg-amber-500/10 ring-amber-500/20",
      badgeClass: "text-amber-500 bg-amber-500/10",
      label: "Dispatch",
    };
  }
  return {
    icon: Radio,
    iconColor: "text-purple-500 bg-purple-500/10 ring-purple-500/20",
    badgeClass: "text-purple-500 bg-purple-500/10",
    label: "System",
  };
}

function SystemBroadcastCard({
  item,
  onDismiss,
}: {
  item: any;
  onDismiss?: () => void;
}) {
  const content = item.description || item.message || item.content || "";
  const title = item.title || item.subject || "System Notification";
  const { icon: Icon, iconColor, badgeClass, label } = getSystemAlertStyle(
    title + " " + content,
    item.type || item.category
  );

  return (
    <div className="relative mx-4 my-2.5 flex gap-3.5 rounded-2xl border border-border/50 bg-card/60 p-4 shadow-2xs backdrop-blur-md transition-all duration-150 hover:border-border/80 hover:bg-card/90">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-xl ring-1 shadow-2xs",
          iconColor
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 pr-6">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-tight",
                badgeClass
              )}
            >
              {label}
            </span>
            {item.priority && (
              <span className="text-[10px] font-medium text-muted-foreground/70">
                • {item.priority}
              </span>
            )}
          </div>
          <span className="text-muted-foreground/60 text-[11px] font-normal tabular-nums">
            {formatTimestamp(item.createdAt ?? item.ixTimeTimestamp)}
          </span>
        </div>

        <h4 className="mb-1 text-[13px] font-semibold tracking-tight text-foreground">{title}</h4>

        <div
          className="text-muted-foreground text-[12px] leading-relaxed [&>a]:text-primary [&>a]:underline [&>a]:hover:text-primary/80 [&>p]:mb-0"
          dangerouslySetInnerHTML={{ __html: sanitizeUserContent(content) }}
        />

        {item.href && (
          <div className="mt-2.5 flex items-center gap-2">
            <Link
              href={item.href}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-2xs transition-all hover:bg-primary/90 active:scale-95"
            >
              <span>Open Details</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:bg-accent/15 hover:text-foreground absolute top-3 right-3 cursor-pointer rounded-lg p-1 transition-colors"
          title="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
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
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
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
  isSidebarCollapsed = false,
  onToggleSidebar,
  onBack,
  settings,
  isMuted = false,
  isArchived = false,
  onMuteToggle,
  onArchiveToggle,
  onDeleteConversation,
  onAddParticipant,
}: MessagesChatPanelProps) {
  const notify = useNotify();
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

  const utils = api.useUtils();

  // Clear system notifications
  const clearAllSystem = api.messages.clearAllSystemNotifications.useMutation({
    onSuccess: () => {
      notify.success("System notifications cleared");
      void utils.notifications.getUserNotifications.invalidate();
      void utils.messages.getFolderCounts.invalidate();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to clear system notifications");
    },
  });

  const handleClearAllSystem = useCallback(() => {
    clearAllSystem.mutate({ userId: currentUserId });
  }, [clearAllSystem, currentUserId]);

  // Query 1: Regular conversation messages
  const { data: messagesData, isLoading: isLoadingMessages } =
    api.messages.getConversationMessages.useQuery(
      {
        conversationId: conversation.id,
        userId: currentUserId,
      },
      {
        enabled: !isSystemThread && !isLoreBotThread && !!conversation.id && !!currentUserId,
        refetchOnWindowFocus: false,
        staleTime: 30000,
      }
    );

  // Query 2: System notifications when viewing system thread
  const {
    data: notificationsData,
    isLoading: isLoadingNotifications,
    refetch: refetchNotifications,
  } = api.notifications.getUserNotifications.useQuery(
    {
      limit: 100,
    },
    {
      enabled: isSystemThread && !!currentUserId,
      refetchOnWindowFocus: false,
      staleTime: 15000,
    }
  );

  const dismissNotification = api.notifications.dismissNotification.useMutation({
    onSuccess: () => {
      notify.success("Notification dismissed");
      void refetchNotifications();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to dismiss notification");
    },
  });

  // Invalidate conversation list (for unread badges)
  const refetchConversations = useCallback(() => {
    void utils.messages.getConversationsByFolder.invalidate();
  }, [utils]);

  // Mark messages as read
  const markAsRead = api.messages.markMessagesAsRead.useMutation({
    onSuccess: () => {
      void utils.messages.getFolderCounts.invalidate();
      void utils.messages.getConversationsByFolder.invalidate();
    },
  });

  useEffect(() => {
    if (!isSystemThread && conversation.id && currentUserId && (conversation as any).unreadCount > 0) {
      markAsRead.mutate({
        conversationId: conversation.id,
        userId: currentUserId,
        messageIds: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, currentUserId, isSystemThread]);

  // Send message
  const sendMessage = api.messages.sendMessage.useMutation({
    onMutate: async (newMsg) => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      await utils.messages.getConversationMessages.cancel(queryKey);
      const previousMessages = utils.messages.getConversationMessages.getData(queryKey);

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
          messages: [...old.messages, optimisticMsg],
        };
      });

      return { previousMessages };
    },
    onError: (error: any, _newMsg, context) => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      if (context?.previousMessages) {
        utils.messages.getConversationMessages.setData(queryKey, context.previousMessages);
      }
      notify.error(error.message?.includes("content") ? "Invalid content" : "Failed to send message");
    },
    onSettled: (_data, error) => {
      if (error) {
        const queryKey = { conversationId: conversation.id, userId: currentUserId };
        void utils.messages.getConversationMessages.invalidate(queryKey);
      }
      refetchConversations();
    },
  });

  // Message Actions
  const addReaction = api.messages.addReaction.useMutation({
    onMutate: async ({ messageId, reaction }: { messageId: string; reaction: string }) => {
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
    onSettled: () => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      void utils.messages.getConversationMessages.invalidate(queryKey);
    },
  });

  const removeReaction = api.messages.removeReaction.useMutation({
    onMutate: async ({ messageId, reaction }: { messageId: string; reaction: string }) => {
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
              if (reactions[reaction] === 0) delete reactions[reaction];
            }
            return { ...m, reactions };
          }),
        };
      });

      return { previousMessages };
    },
    onSettled: () => {
      const queryKey = { conversationId: conversation.id, userId: currentUserId };
      void utils.messages.getConversationMessages.invalidate(queryKey);
    },
  });

  const editMutation = api.messages.editMessage.useMutation({
    onMutate: async ({ messageId, content }: { messageId: string; content: string }) => {
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
      if (!text.trim() || !conversation || !currentUserId || isSystemThread) return;

      sendMessage.mutate({
        conversationId: conversation.id,
        userId: currentUserId,
        content: content ?? "",
        messageType: "text",
      });
      setReplyingTo(null);
    },
    [conversation, currentUserId, sendMessage, isSystemThread]
  );

  const messages = useMemo(() => {
    const rawMessages = messagesData?.messages ?? [];
    const sorted = [...rawMessages].sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt ?? a.ixTimeTimestamp ?? 0).getTime();
      const timeB = new Date(b.createdAt ?? b.ixTimeTimestamp ?? 0).getTime();
      return timeA - timeB;
    });
    if (!searchQuery) return sorted;
    return sorted.filter(
      (msg: any) =>
        msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.account?.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [messagesData?.messages, searchQuery]);

  const systemBroadcasts = useMemo(() => {
    const raw = notificationsData?.notifications ?? [];
    const sorted = [...raw].sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt ?? a.ixTimeTimestamp ?? 0).getTime();
      const timeB = new Date(b.createdAt ?? b.ixTimeTimestamp ?? 0).getTime();
      return timeA - timeB;
    });
    if (!searchQuery) return sorted;
    return sorted.filter(
      (n: any) =>
        (n.title ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.description ?? n.message ?? "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [notificationsData?.notifications, searchQuery]);

  // Scroll to bottom on new messages or system broadcasts
  useEffect(() => {
    if (!searchQuery) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, systemBroadcasts.length, searchQuery, isSystemThread]);

  const participantStatus = useMemo(() => {
    if (isSystemThread || conversation.type === "group") return undefined;
    const otherParticipant = conversation.otherParticipants[0];
    if (!otherParticipant) return undefined;
    return clientState.presenceMap?.[otherParticipant.accountId] as any;
  }, [conversation, clientState.presenceMap, isSystemThread]);

  const isLoading = isSystemThread ? isLoadingNotifications : isLoadingMessages;

  return (
    <div className="flex h-full flex-col">
      <MessagesChatHeader
        conversation={conversation}
        currentUserId={currentUserId}
        activeFolder={activeFolder}
        participantStatus={participantStatus}
        onSearch={setSearchQuery}
        onBack={onBack ?? onToggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
        onViewDetails={() => setIsDetailsOpen(true)}
        onAddParticipants={() => setIsAddParticipantsOpen(true)}
        onMuteToggle={onMuteToggle}
        onArchiveToggle={onArchiveToggle}
        onDeleteConversation={onDeleteConversation}
        onClearSystemMessages={isSystemThread ? handleClearAllSystem : undefined}
        isMuted={isMuted}
        isArchived={isArchived}
        displayNamePreference={settings?.displayNamePreference}
      />

      {/* Messages / Broadcasts stream */}
      <div className="flex-1 scrollbar-none overflow-x-hidden overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : isSystemThread ? (
          <div className="mx-auto w-full max-w-3xl py-3">
            {systemBroadcasts.length === 0 ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-6 text-center">
                <BellRing className="text-muted-foreground/40 mb-2 h-10 w-10" />
                <h4 className="text-foreground text-xs font-semibold">No system broadcasts</h4>
                <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                  {searchQuery
                    ? `No bulletins match "${searchQuery}"`
                    : "Platform announcements and simulation updates will appear here."}
                </p>
              </div>
            ) : (
              systemBroadcasts.map((item: any) => (
                <SystemBroadcastCard
                  key={item.id}
                  item={item}
                  onDismiss={() => dismissNotification.mutate({ notificationId: item.id })}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        ) : isLoreBotThread ? (
          <LoreBotFeedView currentUserId={currentUserId} />
        ) : (
          <div className="py-2">
            {messages.map((message: any, index: number, arr: any[]) => {
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
                  settings={settings}
                  searchQuery={searchQuery}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Footer: Read-only banner for system thread / LoreBot or interactive input bar */}
      {isSystemThread || isLoreBotThread ? (
        <div className="border-border/40 bg-card/60 text-muted-foreground flex shrink-0 items-center justify-center gap-2 border-t px-4 py-3 text-xs backdrop-blur-md">
          <Shield className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-medium">
            System Messages is an official broadcast channel. Messages are read-only.
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
          isSending={sendMessage.isPending}
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
            if (onAddParticipant) {
              await onAddParticipant(userId);
            }
          }}
        />
      )}
    </div>
  );
}
