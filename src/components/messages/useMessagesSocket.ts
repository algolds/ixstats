import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { useThinkPagesWebSocket } from "~/hooks/useThinkPagesWebSocket";
import { soundCues } from "~/lib/sound/cuelume";
import { buildMessage, ownAccount } from "./useConversationMessages";
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

/** Applies an incoming realtime message to the cached message list. */
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
  utils.messages.getConversationMessages.setData(queryKey, (old: any) => {
    if (!old || old.messages.some((m: any) => m.id === data.messageId)) return old;

    const sender =
      data.accountId === currentUserId
        ? ownAccount(currentUserId, user)
        : (selectedConversation?.otherParticipants.find((p: any) => p.accountId === data.accountId)
            ?.account ?? {
            id: data.accountId,
            username: "user",
            displayName: "User",
            profileImageUrl: null,
            accountType: "country" as const,
          });

    const newMessage = buildMessage({
      id: data.messageId,
      conversationId: data.conversationId!,
      accountId: data.accountId,
      account: sender,
      content: data.content ?? "",
      messageType: "text",
      at: new Date(data.timestamp),
    });
    return { ...old, messages: [newMessage, ...old.messages] };
  });
}

/** Updates the conversation list preview in place instead of refetching it. */
function bumpConversationPreview(
  utils: Utils,
  folderQueryKey: { userId: string; folder: MessageFolder },
  data: ThinkPagesMessageEvent,
  { currentUserId, user }: Pick<Options, "currentUserId" | "user">
) {
  utils.messages.getConversationsByFolder.setData(folderQueryKey, (old: any) => {
    if (!old?.conversations) return old;
    const at = new Date(data.timestamp);
    const isOwn = data.accountId === currentUserId;
    const updated = old.conversations.map((c: any) =>
      c.id !== data.conversationId
        ? c
        : {
            ...c,
            lastActivity: at,
            lastMessage: {
              id: data.messageId,
              accountId: data.accountId,
              content: data.content ?? "",
              ixTimeTimestamp: at,
              createdAt: at,
              account: isOwn
                ? { id: currentUserId, displayName: user?.fullName ?? "Me" }
                : (c.lastMessage?.account ?? { id: data.accountId, displayName: "User" }),
            },
            unreadCount: isOwn ? c.unreadCount : (c.unreadCount ?? 0) + 1,
          }
    );
    // Most recently active first so the updated conversation bubbles up
    updated.sort(
      (a: any, b: any) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
    return { ...old, conversations: updated };
  });
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
      utils.messages.getConversationMessages.setData(
        queryKey,
        (old: any) =>
          old && {
            ...old,
            messages: old.messages.map((m: any) =>
              m.id === data.messageId
                ? { ...m, content: data.content ?? m.content, editedAt: new Date(data.timestamp) }
                : m
            ),
          }
      );
    } else if (data.type === "message:deleted") {
      utils.messages.getConversationMessages.setData(
        queryKey,
        (old: any) =>
          old && { ...old, messages: old.messages.filter((m: any) => m.id !== data.messageId) }
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

  const clientState = {
    presenceStatus: raw.presenceStatus,
    typingIndicators: raw.typingIndicators,
    presenceMap,
    connectionStatus: raw.connected ? ("connected" as const) : ("disconnected" as const),
    lastSyncTime: new Date(raw.lastHeartbeat),
    unreadCount: 0,
  };

  return { clientState, sendTypingIndicator, connected };
}
