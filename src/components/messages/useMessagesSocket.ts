import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { useThinkPagesWebSocket } from "~/hooks/useThinkPagesWebSocket";
import { soundCues } from "~/lib/sound/cuelume";
import {
  appendIncoming,
  buildMessage,
  mapFirstPage,
  mapPages,
  ownAccount,
  type ThreadAccount,
} from "~/lib/messages/thread";
import type { CachedMessage } from "./useConversationMessages";
import type { MessagesSettings } from "./MessagesFolderNav";
import type { MessageFolder } from "~/types/messages";
import type { ThinkPagesMessageEvent } from "~/lib/websocket/thinkpages-types";

/** While the socket is down the open thread and the inbox are refreshed this often. */
const OFFLINE_POLL_MS = 20_000;

type Utils = ReturnType<typeof api.useUtils>;

interface Options {
  currentUserId: string;
  user: Parameters<typeof ownAccount>[1];
  activeFolder: MessageFolder;
  selectedConversationId: string | null;
  selectedConversation: any;
  settings: MessagesSettings;
  mutedIds: string[];
  archivedIds: string[];
  onUnarchive: (conversationId: string) => void;
  refetchConversations: () => unknown;
}

/** Applies an incoming realtime message to the cached message pages, once. */
function appendIncomingMessage(
  utils: Utils,
  queryKey: { conversationId: string; userId: string },
  data: ThinkPagesMessageEvent,
  {
    currentUserId,
    user,
    selectedConversation,
  }: Pick<Options, "currentUserId" | "user" | "selectedConversation">
) {
  const sender: ThreadAccount =
    data.accountId === currentUserId
      ? ownAccount(currentUserId, user)
      : (selectedConversation?.otherParticipants.find((p: any) => p.accountId === data.accountId)
          ?.account ?? {
          id: data.accountId,
          username: "user",
          displayName: "User",
          profileImageUrl: null,
          accountType: "country",
        });

  const incoming = buildMessage({
    id: data.messageId,
    conversationId: data.conversationId ?? "",
    accountId: data.accountId,
    account: sender,
    content: data.content ?? "",
    messageType: "text",
    at: new Date(data.timestamp),
  }) as CachedMessage;

  utils.messages.getConversationMessages.setInfiniteData(queryKey, (old) =>
    old
      ? mapFirstPage<typeof old>(old, (messages) =>
          appendIncoming(messages, incoming, currentUserId)
        )
      : old
  );
  // The event carries no quoted reply or mentions: others' messages are completed from the server.
  if (data.accountId !== currentUserId) {
    void utils.messages.getConversationMessages.invalidate(queryKey);
  }
}

/** The row's name for whoever wrote the last message. */
function senderNameFor(
  conversation: { otherParticipants: { accountId: string; account?: { displayName?: string } }[] },
  data: ThinkPagesMessageEvent,
  { currentUserId, user }: Pick<Options, "currentUserId" | "user">
): string {
  if (data.accountId === currentUserId) return user?.fullName ?? "Me";
  const other = conversation.otherParticipants.find((p) => p.accountId === data.accountId);
  return other?.account?.displayName ?? "User";
}

/**
 * Updates the conversation list in place instead of refetching it: the new last message and unread
 * count, and the conversation moves to the top of the first page.
 */
function bumpConversationPreview(
  utils: Utils,
  folderQueryKey: { userId: string; folder: MessageFolder },
  data: ThinkPagesMessageEvent,
  options: Pick<Options, "currentUserId" | "user">
) {
  utils.messages.getConversationsByFolder.setInfiniteData(folderQueryKey, (old) => {
    if (!old) return old;
    const at = new Date(data.timestamp);
    const isOwn = data.accountId === options.currentUserId;
    let bumped: (typeof old.pages)[number]["conversations"][number] | undefined;
    const pages = old.pages.map((page) => ({
      ...page,
      conversations: page.conversations.filter((c) => {
        if (c.id !== data.conversationId) return true;
        bumped = {
          ...c,
          lastActivity: at,
          unreadCount: isOwn ? c.unreadCount : c.unreadCount + 1,
          lastMessage: {
            id: data.messageId,
            content: data.content ?? "",
            senderId: data.accountId,
            senderName: senderNameFor(c, data, options),
            senderAvatar: null,
            createdAt: at,
            isDeleted: false,
          },
        };
        return false;
      }),
    }));
    const [first, ...rest] = pages;
    if (!bumped || !first) return old;
    return {
      ...old,
      pages: [{ ...first, conversations: [bumped, ...first.conversations] }, ...rest],
    };
  });
}

/** What the thread panel reads from the socket: connection and who is typing where. */
export interface MessagesClientState {
  connectionStatus: "connected" | "disconnected";
  typingIndicators: ReadonlyMap<string, { accountId: string; conversationId?: string }>;
}

/** Realtime connection for the messages UI: cache updates, sounds and presence. */
export function useMessagesSocket(options: Options) {
  const { currentUserId, selectedConversationId, activeFolder } = options;
  const utils = api.useUtils();
  const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});

  const handleMessageUpdate = (data: ThinkPagesMessageEvent) => {
    if (data.type === "message:new") {
      const { mutedIds, archivedIds, settings } = options;
      const conversationId = data.conversationId ?? "";
      if (
        data.accountId !== currentUserId &&
        settings.notificationSounds &&
        !mutedIds.includes(conversationId)
      ) {
        soundCues.notify();
      }
      if (archivedIds.includes(conversationId)) options.onUnarchive(conversationId);

      void utils.messages.getFolderCounts.invalidate();
      void utils.messages.getConversationsByFolder.invalidate();
    }

    if (!selectedConversationId || data.conversationId !== selectedConversationId) return;
    const queryKey = { conversationId: selectedConversationId, userId: currentUserId };

    if (data.type === "message:new") {
      appendIncomingMessage(utils, queryKey, data, options);
      bumpConversationPreview(
        utils,
        { userId: currentUserId, folder: activeFolder },
        data,
        options
      );
    } else if (data.type === "message:updated") {
      utils.messages.getConversationMessages.setInfiniteData(
        queryKey,
        (old) =>
          old &&
          mapPages<typeof old>(old, (messages) =>
            messages.map((m) =>
              m.id === data.messageId
                ? { ...m, content: data.content ?? m.content, editedAt: new Date(data.timestamp) }
                : m
            )
          )
      );
    } else if (data.type === "message:deleted") {
      utils.messages.getConversationMessages.setInfiniteData(
        queryKey,
        (old) =>
          old &&
          mapPages<typeof old>(old, (messages) => messages.filter((m) => m.id !== data.messageId))
      );
    }
  };

  /** Refreshes what the socket would have pushed: the inbox, its counts and the open thread. */
  const refresh = () => {
    void utils.messages.getFolderCounts.invalidate();
    void utils.messages.getConversationsByFolder.invalidate();
    if (selectedConversationId) {
      void utils.messages.getConversationMessages.invalidate({
        conversationId: selectedConversationId,
        userId: currentUserId,
      });
    }
  };

  const {
    clientState: raw,
    sendTypingIndicator,
    subscribeToConversation,
    unsubscribeFromConversation,
  } = useThinkPagesWebSocket({
    accountId: currentUserId,
    autoReconnect: true,
    onMessageUpdate: handleMessageUpdate,
    onConversationUpdate: () => options.refetchConversations(),
    // A thread that is not open: the open one already updates itself from its own events.
    onInboxUpdate: (update) => {
      if (update.conversationId === selectedConversationId) return;
      void utils.messages.getFolderCounts.invalidate();
      void utils.messages.getConversationsByFolder.invalidate();
    },
    onPresenceUpdate: (data: any) => {
      if (data.accountId) setPresenceMap((prev) => ({ ...prev, [data.accountId]: data.status }));
    },
  });

  // Joined (and re-joined after a reconnect) while the thread is open, left when it changes.
  useEffect(() => {
    if (!selectedConversationId || !currentUserId) return;
    subscribeToConversation(selectedConversationId);
    return () => unsubscribeFromConversation(selectedConversationId);
  }, [selectedConversationId, currentUserId, subscribeToConversation, unsubscribeFromConversation]);

  const connected = raw.connected;
  const dropped = useRef<"never" | "up" | "down">("never");
  // The latest refresh, so the timer below is not restarted by every render.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  // Polling fallback: only while the socket is not connected (disabled, blocked or dropped).
  useEffect(() => {
    if (connected) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "hidden") refreshRef.current();
    }, OFFLINE_POLL_MS);
    return () => clearInterval(timer);
  }, [connected]);

  // Catch up once when the socket comes back after a drop: events in between were missed.
  useEffect(() => {
    if (connected && dropped.current === "down") refreshRef.current();
    dropped.current = connected ? "up" : dropped.current === "never" ? "never" : "down";
  }, [connected]);

  const clientState: MessagesClientState & { presenceMap: Record<string, string> } = {
    typingIndicators: raw.typingIndicators,
    presenceMap,
    connectionStatus: raw.connected ? "connected" : "disconnected",
  };

  return { clientState, sendTypingIndicator, connected };
}
