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
import { Crown, Shield, TrendingUp, Newspaper, Trash2, Loader2, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { MessagesViewDetailsModal } from "./MessagesViewDetailsModal";
import { MessagesAddParticipantsModal } from "./MessagesAddParticipantsModal";

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

function getSystemAlertStyle(content: string) {
  const text = content.toLowerCase();
  if (
    text.includes("diplomatic") ||
    text.includes("treaty") ||
    text.includes("embassy") ||
    text.includes("alliance") ||
    text.includes("peace")
  ) {
    return {
      icon: Crown,
      borderClass: "border-l-3 border-l-amber-500",
      iconColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      label: "Diplomatic Alert",
      type: "diplomatic",
    };
  }
  if (
    text.includes("spy") ||
    text.includes("intelligence") ||
    text.includes("security") ||
    text.includes("threat") ||
    text.includes("breach") ||
    text.includes("covert") ||
    text.includes("sabotage")
  ) {
    return {
      icon: Shield,
      borderClass: "border-l-3 border-l-rose-500",
      iconColor: "text-rose-400 bg-rose-500/10 border-rose-500/20",
      label: "Security Alert",
      type: "security",
    };
  }
  if (
    text.includes("gdp") ||
    text.includes("tax") ||
    text.includes("income") ||
    text.includes("economy") ||
    text.includes("gold") ||
    text.includes("market") ||
    text.includes("trade") ||
    text.includes("credits")
  ) {
    return {
      icon: TrendingUp,
      borderClass: "border-l-3 border-l-emerald-500",
      iconColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      label: "Economic Alert",
      type: "economic",
    };
  }
  return {
    icon: Newspaper,
    borderClass: "border-l-3 border-l-blue-500",
    iconColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    label: "System Alert",
    type: "system",
  };
}

function SystemAlertCard({ message, onDelete }: { message: any; onDelete?: () => void }) {
  const { icon: Icon, borderClass, iconColor, label } = getSystemAlertStyle(message.content);

  return (
    <div
      className={cn(
        "relative mx-4 my-3 flex gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 shadow-lg shadow-black/10 transition-all duration-300 hover:scale-[1.005] hover:bg-white/[0.04]",
        borderClass
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center self-start rounded-lg border p-2.5",
          iconColor
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1 pr-6">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-wider uppercase opacity-85">
            {label}
          </span>
          <span className="text-[10px] font-medium tabular-nums opacity-50">
            {formatTimestamp(message.createdAt ?? message.ixTimeTimestamp)}
          </span>
        </div>
        <div
          className="text-xs leading-relaxed font-semibold text-slate-200 [&>a]:text-blue-400 [&>a]:underline [&>a]:hover:text-blue-300 [&>p]:mb-0"
          dangerouslySetInnerHTML={{ __html: message.content }}
        />
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          className="text-muted-foreground absolute top-3 right-3 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10 hover:text-rose-400"
          title="Delete message"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function NotificationCard({
  notification,
  onDismiss,
}: {
  notification: any;
  onDismiss?: () => void;
}) {
  const getNotificationStyle = (type: string, priority: string) => {
    const p = priority.toLowerCase();
    const t = type.toLowerCase();

    if (p === "critical" || p === "high" || t === "error" || t === "crisis") {
      return {
        icon: Shield,
        borderClass: "border-l-3 border-l-rose-500",
        iconColor: "text-rose-400 bg-rose-500/10 border-rose-500/20",
        label: "Critical Notification",
      };
    }
    if (t === "success") {
      return {
        icon: TrendingUp,
        borderClass: "border-l-3 border-l-emerald-500",
        iconColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        label: "Success Notification",
      };
    }
    if (t === "warning" || t === "alert") {
      return {
        icon: Crown,
        borderClass: "border-l-3 border-l-amber-500",
        iconColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        label: "Warning Notification",
      };
    }
    return {
      icon: Newspaper,
      borderClass: "border-l-3 border-l-blue-500",
      iconColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      label: "Notification",
    };
  };

  const {
    icon: Icon,
    borderClass,
    iconColor,
    label,
  } = getNotificationStyle(notification.type ?? "info", notification.priority ?? "medium");

  return (
    <div
      className={cn(
        "relative mx-4 my-3 flex gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left shadow-lg shadow-black/10 transition-all duration-300 hover:scale-[1.005] hover:bg-white/[0.04]",
        borderClass,
        !notification.read && "border-blue-500/10 bg-blue-500/[0.03]"
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center self-start rounded-lg border p-2.5",
          iconColor
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1 pr-6">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold tracking-wider uppercase opacity-85">
              {label}
            </span>
            {!notification.read && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
            )}
          </div>
          <span className="text-[10px] font-medium tabular-nums opacity-50">
            {formatTimestamp(notification.createdAt)}
          </span>
        </div>
        <h4 className="mb-0.5 text-xs font-semibold tracking-tight text-slate-100">
          {notification.title}
        </h4>
        <div
          className="text-xs leading-relaxed text-slate-300 [&>a]:text-blue-400 [&>a]:underline [&>a]:hover:text-blue-300 [&>p]:mb-0"
          dangerouslySetInnerHTML={{
            __html: notification.description || notification.message || "",
          }}
        />
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 cursor-pointer rounded-lg p-1 text-slate-500 transition-colors hover:bg-white/5 hover:text-rose-400"
          title="Dismiss notification"
        >
          <X className="h-4 w-4" />
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
  const [activeAlertFilter, setActiveAlertFilter] = useState<
    "all" | "diplomatic" | "security" | "economic" | "notifications"
  >("all");
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddParticipantsOpen, setIsAddParticipantsOpen] = useState(false);

  const clearAllSystem = api.messages.clearAllSystemNotifications.useMutation({
    onSuccess: () => {
      notify.success("All system notifications cleared!");
      void utils.messages.getConversationMessages.invalidate({
        conversationId: conversation.id,
        userId: currentUserId,
      });
      void utils.messages.getConversationsByFolder.invalidate();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to clear system notifications");
    },
  });

  const handleClearAllSystem = useCallback(() => {
    if (
      confirm(
        "Are you sure you want to clear all system notifications? This action cannot be undone."
      )
    ) {
      clearAllSystem.mutate({ userId: currentUserId });
    }
  }, [clearAllSystem, currentUserId]);

  // Fetch messages
  const { data: messagesData, isLoading } = api.messages.getConversationMessages.useQuery(
    {
      conversationId: conversation.id,
      userId: currentUserId,
    },
    {
      enabled: !!conversation.id && !!currentUserId,
      refetchOnWindowFocus: false,
      staleTime: 30000, // WebSocket provides real-time updates
    }
  );

  // Fetch user notifications (for the Notifications tab)
  const {
    data: notificationsData,
    isLoading: isLoadingNotifications,
    refetch: refetchNotifications,
  } = api.notifications.getUserNotifications.useQuery(
    {
      limit: 100,
    },
    {
      enabled:
        activeFolder === "system" && activeAlertFilter === "notifications" && !!currentUserId,
      refetchOnWindowFocus: false,
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

  const recentNotifications = useMemo(() => {
    const rawNotifications = notificationsData?.notifications ?? [];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return rawNotifications.filter(
      (n: any) => new Date(n.createdAt).getTime() >= sevenDaysAgo.getTime()
    );
  }, [notificationsData?.notifications]);

  // Invalidate conversation list (for unread badges)
  const utils = api.useUtils();
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
    // Only fire mark-as-read if there are actually unread messages
    if (conversation.id && currentUserId && (conversation as any).unreadCount > 0) {
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
    onSettled: (_data, error) => {
      // Only invalidate on error to reconcile; optimistic update handles success
      if (error) {
        const queryKey = { conversationId: conversation.id, userId: currentUserId };
        void utils.messages.getConversationMessages.invalidate(queryKey);
      }
      refetchConversations();
    },
  });

  // ── Lifted mutations (shared across all bubbles) ──
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
    let filtered = rawMessages;

    // Filter by text search
    if (searchQuery) {
      filtered = filtered.filter(
        (msg: any) =>
          msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          msg.account?.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by alert category if in system folder
    if (activeFolder === "system" && activeAlertFilter !== "all") {
      filtered = filtered.filter((msg: any) => {
        const style = getSystemAlertStyle(msg.content);
        return style.type === activeAlertFilter;
      });
    }

    return filtered;
  }, [messagesData?.messages, searchQuery, activeFolder, activeAlertFilter]);

  // Memoize reversed message list to avoid re-creating on every render
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

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
        onBack={onToggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
        onViewDetails={() => setIsDetailsOpen(true)}
        onAddParticipants={() => setIsAddParticipantsOpen(true)}
        onMuteToggle={onMuteToggle}
        onArchiveToggle={onArchiveToggle}
        onDeleteConversation={onDeleteConversation}
        isMuted={isMuted}
        isArchived={isArchived}
        displayNamePreference={settings?.displayNamePreference}
      />

      {/* Clear All System notifications header banner with category filters */}
      {activeFolder === "system" && (messagesData?.messages?.length ?? 0) > 0 && (
        <div className="flex shrink-0 flex-col justify-between gap-3 border-b border-white/5 bg-slate-900/25 px-6 py-3 backdrop-blur-md sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "all", label: "All" },
                { id: "diplomatic", label: "Diplomatic" },
                { id: "security", label: "Security" },
                { id: "economic", label: "Economic" },
                { id: "notifications", label: "Notifications" },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveAlertFilter(filter.id)}
                className={cn(
                  "cursor-pointer rounded-lg border border-transparent px-2.5 py-1 text-[10px] font-bold transition-all duration-150 select-none",
                  activeAlertFilter === filter.id
                    ? "border-white/10 bg-white/10 text-white shadow-sm"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleClearAllSystem}
            disabled={clearAllSystem.isPending}
            className="flex cursor-pointer items-center gap-1.5 self-end rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 shadow-sm transition-all hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-50 sm:self-auto"
          >
            {clearAllSystem.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Clear All Alerts
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 scrollbar-none overflow-x-hidden overflow-y-auto">
        {isLoading || (activeAlertFilter === "notifications" && isLoadingNotifications) ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : activeFolder === "system" ? (
          <div className="mx-auto w-full max-w-3xl py-3">
            {activeAlertFilter === "notifications" ? (
              recentNotifications.length === 0 ? (
                <div className="flex h-full min-h-[300px] items-center justify-center p-6 text-center">
                  <div>
                    <Newspaper className="mx-auto mb-2 h-10 w-10 text-slate-500/50" />
                    <p className="text-muted-foreground text-sm font-medium">
                      No notifications in the last 7 days.
                    </p>
                  </div>
                </div>
              ) : (
                recentNotifications.map((notif: any) => (
                  <NotificationCard
                    key={notif.id}
                    notification={notif}
                    onDismiss={() => dismissNotification.mutate({ notificationId: notif.id })}
                  />
                ))
              )
            ) : messages.length === 0 ? (
              <div className="flex h-full min-h-[300px] items-center justify-center p-6 text-center">
                <div>
                  <Newspaper className="mx-auto mb-2 h-10 w-10 text-slate-500/50" />
                  <p className="text-muted-foreground text-sm font-medium">
                    {searchQuery ? "No results matching your search." : "No system alerts."}
                  </p>
                </div>
              </div>
            ) : (
              reversedMessages.map((message: any) => (
                <SystemAlertCard
                  key={message.id}
                  message={message}
                  onDelete={() => deleteMutation.mutate({ messageId: message.id })}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="py-2">
            {reversedMessages.map((message: any, index: number, arr: any[]) => {
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

      {activeFolder !== "system" && (
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
