import { useEffect, useMemo } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import type { MessageActions } from "./MessagesBubble";

const timeOf = (item: any) => new Date(item.createdAt ?? item.ixTimeTimestamp ?? 0).getTime();

export const sortByTime = <T>(items: T[]): T[] => [...items].sort((a, b) => timeOf(a) - timeOf(b));

export const isConsecutiveMessage = (prev: any, message: any) =>
  prev != null &&
  prev.accountId === message.accountId &&
  timeOf(message) - timeOf(prev) < 5 * 60 * 1000;

type ClerkLikeUser = {
  username?: string | null;
  fullName?: string | null;
  imageUrl?: string | null;
} | null;

export const ownAccount = (currentUserId: string, user?: ClerkLikeUser) => ({
  id: currentUserId,
  username: user?.username ?? "me",
  displayName: user?.fullName ?? user?.username ?? "Me",
  profileImageUrl: user?.imageUrl ?? null,
  accountType: "country" as const,
});

/** A cached message row, as inserted optimistically or from a realtime event. */
export const buildMessage = (fields: {
  id: string;
  conversationId: string;
  accountId: string;
  account: ReturnType<typeof ownAccount> | Record<string, unknown>;
  content: string;
  messageType: string;
  at: Date;
}) => {
  const { at, ...rest } = fields;
  return {
    ...rest,
    ixTimeTimestamp: at,
    createdAt: at,
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
};

/**
 * Optimistic cache edits for one conversation's message list. `patch` cancels in-flight
 * fetches, applies `mapMessages` to the cached messages and returns the previous snapshot.
 */
function useMessageCache(conversationId: string, userId: string) {
  const utils = api.useUtils();
  const queryKey = { conversationId, userId };
  const cache = utils.messages.getConversationMessages;

  return {
    queryKey,
    cache,
    async patch(mapMessages: (messages: any[]) => any[], ifEmpty?: unknown) {
      await cache.cancel(queryKey);
      const previousMessages = cache.getData(queryKey);
      cache.setData(queryKey, (old: any) =>
        old ? { ...old, messages: mapMessages(old.messages) } : ifEmpty
      );
      return { previousMessages };
    },
    invalidate: () => void cache.invalidate(queryKey),
  };
}

const patchMessage = (messageId: string, update: (m: any) => any) => (messages: any[]) =>
  messages.map((m) => (m.id === messageId ? update(m) : m));

interface Options {
  conversationId: string;
  currentUserId: string;
  enabled: boolean;
  searchQuery: string;
  user?: ClerkLikeUser;
  onSent: () => void;
}

export function useConversationMessages({
  conversationId,
  currentUserId,
  enabled,
  searchQuery,
  user,
  onSent,
}: Options) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { queryKey, cache, patch, invalidate } = useMessageCache(conversationId, currentUserId);

  const { data, isLoading } = api.messages.getConversationMessages.useQuery(queryKey, {
    enabled: enabled && !!conversationId && !!currentUserId,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  const sendMessage = api.messages.sendMessage.useMutation({
    onMutate: (newMsg) => {
      const now = new Date();
      const optimisticMsg = buildMessage({
        id: `temp-${now.getTime()}`,
        conversationId,
        accountId: currentUserId,
        account: ownAccount(currentUserId, user),
        content: newMsg.content,
        messageType: newMsg.messageType ?? "text",
        at: now,
      });
      return patch((messages) => [...messages, optimisticMsg], {
        messages: [optimisticMsg],
        nextCursor: undefined,
      });
    },
    onError: (error: any, _newMsg, context) => {
      if (context?.previousMessages) cache.setData(queryKey, context.previousMessages);
      notify.error(
        error.message?.includes("content") ? "Invalid content" : "Failed to send message"
      );
    },
    onSettled: (_data, error) => {
      if (error) invalidate();
      void utils.messages.getConversationsByFolder.invalidate();
    },
  });

  const addReaction = api.messages.addReaction.useMutation({
    onMutate: ({ messageId, reaction }) =>
      patch(
        patchMessage(messageId, (m) => ({
          ...m,
          reactions: { ...m.reactions, [reaction]: (m.reactions?.[reaction] ?? 0) + 1 },
        }))
      ),
    onSettled: invalidate,
  });

  const removeReaction = api.messages.removeReaction.useMutation({
    onMutate: ({ messageId, reaction }) =>
      patch(
        patchMessage(messageId, (m) => {
          const reactions = { ...m.reactions };
          if (reactions[reaction] !== undefined) {
            reactions[reaction] -= 1;
            if (reactions[reaction] <= 0) delete reactions[reaction];
          }
          return { ...m, reactions };
        })
      ),
    onSettled: invalidate,
  });

  const editMutation = api.messages.editMessage.useMutation({
    onMutate: ({ messageId, content }) =>
      patch(patchMessage(messageId, (m) => ({ ...m, content, editedAt: new Date() }))),
    onSettled: invalidate,
  });

  const deleteMutation = api.messages.deleteMessage.useMutation({
    onMutate: ({ messageId }) => patch((messages) => messages.filter((m) => m.id !== messageId)),
    onSettled: invalidate,
  });

  const actions: MessageActions = useMemo(
    () => ({
      onAddReaction: (messageId, reaction) =>
        addReaction.mutate({ messageId, userId: currentUserId, reaction }),
      onRemoveReaction: (messageId, reaction) => removeReaction.mutate({ messageId, reaction }),
      onEditMessage: (messageId, content) => editMutation.mutate({ messageId, content }),
      onDeleteMessage: (messageId) => deleteMutation.mutate({ messageId }),
    }),
    [currentUserId, addReaction, removeReaction, editMutation, deleteMutation]
  );

  const send = (content: string) => {
    sendMessage.mutate({ conversationId, userId: currentUserId, content, messageType: "text" });
    onSent();
  };

  const messages = useMemo(() => {
    const sorted = sortByTime(data?.messages ?? []);
    if (!searchQuery) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter(
      (msg: any) =>
        msg.content.toLowerCase().includes(q) || msg.account?.displayName.toLowerCase().includes(q)
    );
  }, [data?.messages, searchQuery]);

  return { messages, isLoading, actions, send, isSending: sendMessage.isPending };
}

export function useSystemBroadcasts({
  enabled,
  currentUserId,
  searchQuery,
}: {
  enabled: boolean;
  currentUserId: string;
  searchQuery: string;
}) {
  const notify = useNotify();
  const utils = api.useUtils();

  const { data, isLoading, refetch } = api.notifications.getUserNotifications.useQuery(
    { limit: 100 },
    { enabled: enabled && !!currentUserId, refetchOnWindowFocus: false, staleTime: 15000 }
  );

  const dismiss = api.notifications.dismissNotification.useMutation({
    onSuccess: () => {
      notify.success("Notification dismissed");
      void refetch();
    },
    onError: (err) => notify.error(err.message || "Failed to dismiss notification"),
  });

  const clearAll = api.messages.clearAllSystemNotifications.useMutation({
    onSuccess: () => {
      notify.success("System notifications cleared");
      void utils.notifications.getUserNotifications.invalidate();
      void utils.messages.getFolderCounts.invalidate();
    },
    onError: (err) => notify.error(err.message || "Failed to clear system notifications"),
  });

  const broadcasts = useMemo(() => {
    const sorted = sortByTime(data?.notifications ?? []);
    if (!searchQuery) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter(
      (n: any) =>
        (n.title ?? "").toLowerCase().includes(q) ||
        (n.description ?? n.message ?? "").toLowerCase().includes(q)
    );
  }, [data?.notifications, searchQuery]);

  return {
    broadcasts,
    isLoading,
    dismiss: (notificationId: string) => dismiss.mutate({ notificationId }),
    clearAll: () => clearAll.mutate({ userId: currentUserId }),
  };
}

/** Marks the open conversation as read once, when it is opened with unread messages. */
export function useMarkConversationRead(
  conversation: { id: string; unreadCount: number },
  currentUserId: string,
  isSystemThread: boolean
) {
  const utils = api.useUtils();
  const markAsRead = api.messages.markMessagesAsRead.useMutation({
    onSuccess: () => {
      void utils.messages.getFolderCounts.invalidate();
      void utils.messages.getConversationsByFolder.invalidate();
    },
  });

  useEffect(() => {
    if (!isSystemThread && conversation.id && currentUserId && conversation.unreadCount > 0) {
      markAsRead.mutate({ conversationId: conversation.id, userId: currentUserId, messageIds: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, currentUserId, isSystemThread]);
}
