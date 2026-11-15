import { useEffect } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  buildMessage,
  flattenPages,
  mapFirstPage,
  mapPages,
  newTempMessageId,
  ownAccount,
  replaceOptimistic,
  seenMessageId,
  sortByTime,
  withReaction,
  type ThreadMessage,
} from "~/lib/messages/thread";
import type { MessageActions } from "./MessagesBubble";

export type CachedMessage =
  RouterOutputs["messages"]["getConversationMessages"]["messages"][number];

type ClerkLikeUser = {
  username?: string | null;
  fullName?: string | null;
  imageUrl?: string | null;
} | null;

type Edit = (messages: ThreadMessage[]) => ThreadMessage[];

/**
 * Edits for one conversation's cached message pages. The cache holds server rows; an edit works on
 * the thread's own message shape, which every server row already satisfies.
 */
export function useMessageCache(conversationId: string, userId: string) {
  const utils = api.useUtils();
  const queryKey = { conversationId, userId };
  const cache = utils.messages.getConversationMessages;

  return {
    queryKey,
    /** Cancels in-flight fetches so they cannot overwrite the edit, then applies it. */
    async patch(edit: Edit, scope: "all" | "newest" = "all") {
      await cache.cancel(queryKey);
      cache.setInfiniteData(queryKey, (old) => {
        if (!old) return old;
        const apply = scope === "all" ? mapPages : mapFirstPage;
        return apply(old, (messages) => edit(messages) as CachedMessage[]);
      });
    },
    findMessage: (messageId: string) =>
      cache
        .getInfiniteData(queryKey)
        ?.pages.flatMap((page) => page.messages)
        .find((m) => m.id === messageId),
    /** The first message of a thread nobody has loaded yet. */
    seed: (message: ThreadMessage) =>
      cache.setInfiniteData(
        queryKey,
        (old) =>
          old ?? {
            pages: [{ messages: [message as CachedMessage], nextCursor: null }],
            pageParams: [null],
          }
      ),
    invalidate: () => void cache.invalidate(queryKey),
  };
}

const patchMessage =
  (messageId: string, update: (m: ThreadMessage) => ThreadMessage): Edit =>
  (messages) =>
    messages.map((m) => (m.id === messageId ? update(m) : m));

interface SendExtras {
  replyToId?: string;
  mentions?: string[];
}

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
  const { queryKey, patch, findMessage, seed, invalidate } = useMessageCache(
    conversationId,
    currentUserId
  );

  const query = api.messages.getConversationMessages.useInfiniteQuery(queryKey, {
    enabled: enabled && !!conversationId && !!currentUserId,
    refetchOnWindowFocus: false,
    staleTime: 30000,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const sendMessage = api.messages.sendMessage.useMutation({
    onMutate: async (input) => {
      const tempId = newTempMessageId();
      const quoted = input.replyToId ? findMessage(input.replyToId) : undefined;
      const optimistic = buildMessage({
        id: tempId,
        conversationId,
        accountId: currentUserId,
        account: ownAccount(currentUserId, user),
        content: input.content,
        messageType: input.messageType ?? "text",
        at: new Date(),
        replyTo: quoted && {
          id: quoted.id,
          accountId: quoted.accountId,
          account: quoted.account,
          content: quoted.content,
        },
      });
      await patch((messages) => [...messages, optimistic], "newest");
      seed(optimistic);
      return { tempId };
    },
    onSuccess: (saved, _input, context) => {
      void patch(
        (messages) =>
          replaceOptimistic(messages, context.tempId, {
            id: saved.id,
            ixTimeTimestamp: saved.ixTimeTimestamp,
          }),
        "newest"
      );
    },
    onError: (error, _input, context) => {
      if (context) void patch((messages) => messages.filter((m) => m.id !== context.tempId));
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
      patch(patchMessage(messageId, (m) => withReaction(m, reaction, true))),
    onSettled: invalidate,
  });

  const removeReaction = api.messages.removeReaction.useMutation({
    onMutate: ({ messageId, reaction }) =>
      patch(patchMessage(messageId, (m) => withReaction(m, reaction, false))),
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

  const actions: MessageActions = {
    onAddReaction: (messageId, reaction) =>
      addReaction.mutate({ messageId, userId: currentUserId, reaction }),
    onRemoveReaction: (messageId, reaction) => removeReaction.mutate({ messageId, reaction }),
    onEditMessage: (messageId, content) => editMutation.mutate({ messageId, content }),
    onDeleteMessage: (messageId) => deleteMutation.mutate({ messageId }),
  };

  const send = (content: string, extras: SendExtras = {}) => {
    sendMessage.mutate({
      conversationId,
      userId: currentUserId,
      content,
      messageType: "text",
      replyToId: extras.replyToId,
      mentions: extras.mentions?.length ? extras.mentions : undefined,
    });
    onSent();
  };

  const all = flattenPages(query.data);
  const needle = searchQuery.toLowerCase();
  const messages = needle
    ? all.filter(
        (msg) =>
          msg.content.toLowerCase().includes(needle) ||
          msg.account?.displayName.toLowerCase().includes(needle)
      )
    : all;

  return {
    messages,
    isLoading: query.isLoading,
    hasOlder: query.hasNextPage,
    isLoadingOlder: query.isFetchingNextPage,
    loadOlder: () => void query.fetchNextPage(),
    actions,
    send,
    isSending: sendMessage.isPending,
  };
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

  const sorted = sortByTime(data?.notifications ?? []);
  const q = searchQuery.toLowerCase();
  const broadcasts = q
    ? sorted.filter(
        (n) =>
          (n.title ?? "").toLowerCase().includes(q) ||
          (n.description ?? n.message ?? "").toLowerCase().includes(q)
      )
    : sorted;

  return {
    broadcasts,
    isLoading,
    dismiss: (notificationId: string) => dismiss.mutate({ notificationId }),
    clearAll: () => clearAll.mutate({ userId: currentUserId }),
  };
}

/** Marks the open conversation as read when it opens with unread messages and again whenever more arrive. */
export function useMarkConversationRead(
  conversation: { id: string; unreadCount: number },
  currentUserId: string,
  isSystemThread: boolean
) {
  const utils = api.useUtils();
  const { mutate: markAsRead } = api.messages.markMessagesAsRead.useMutation({
    onSuccess: () => {
      void utils.messages.getFolderCounts.invalidate();
      void utils.messages.getConversationsByFolder.invalidate();
    },
  });

  useEffect(() => {
    if (!isSystemThread && conversation.id && currentUserId && conversation.unreadCount > 0) {
      markAsRead({ conversationId: conversation.id, userId: currentUserId, messageIds: [] });
    }
  }, [conversation.id, conversation.unreadCount, currentUserId, isSystemThread, markAsRead]);
}

/**
 * Read receipts: the id of the newest own message the other person has read, in a direct
 * conversation where both of you allow read receipts; null otherwise. Polled while open.
 */
export function useSeenMessageId(
  conversationId: string,
  messages: readonly ThreadMessage[],
  currentUserId: string,
  enabled: boolean
): string | null {
  const { data } = api.messages.getSeenState.useQuery(
    { conversationId },
    { enabled: enabled && !!conversationId, refetchInterval: 20_000, staleTime: 10_000 }
  );
  return seenMessageId(messages, data?.seenAt, currentUserId);
}
