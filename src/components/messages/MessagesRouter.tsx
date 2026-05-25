"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useThinkPagesWebSocket } from "~/hooks/useThinkPagesWebSocket";
import { withBasePath } from "~/lib/base-path";

import { AuthenticationGuard } from "~/components/mycountry/primitives";
import { MessagesLayout } from "./MessagesLayout";
import { MessagesFolderNav, getFolderFromPathname } from "./MessagesFolderNav";
import { MessagesConversationPanel } from "./MessagesConversationPanel";
import { MessagesChatPanel } from "./MessagesChatPanel";
import { MessagesEmptyState } from "./MessagesEmptyState";
import { MessagesNewConversationModal } from "./MessagesNewConversationModal";
import { MessagesGroupsPanel } from "./MessagesGroupsPanel";

import type { MessageFolder } from "~/types/messages";

// ─── Section titles ──────────────────────────────────────────────

const SECTION_TITLES: Record<MessageFolder, string> = {
  inbox: "Inbox",
  personal: "Personal",
  diplomatic: "Diplomatic",
  discussions: "Discussions",
  groups: "Groups",
  system: "System",
};

// ─── Inner Router ────────────────────────────────────────────────

function MessagesRouterInner() {
  const { user } = useUser();
  const pathname = usePathname();
  const notify = useNotify();
  const utils = api.useUtils();

  const currentUserId = user?.id ?? "";

  // ── State ──
  const [activeFolder, setActiveFolder] = useState<MessageFolder>(() =>
    getFolderFromPathname(pathname)
  );
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [folderNavExpanded, setFolderNavExpanded] = useState(false);

  // ── Handle URL conversation param ──
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const convId = params.get("conversation");
      if (convId) {
        setSelectedConversationId(convId);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  // ── Server-side folder queries (Phase 2) ──
  const {
    data: folderData,
    isLoading: isLoadingConversations,
    refetch: refetchConversations,
  } = api.messages.getConversationsByFolder.useQuery(
    { userId: currentUserId, folder: activeFolder },
    {
      enabled: !!currentUserId,
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    }
  );

  const activeFolderConversations = useMemo(
    () => (folderData?.conversations ?? []) as any[],
    [folderData?.conversations]
  );

  // ── Server-side folder counts ──
  const { data: folderCounts } = api.messages.getFolderCounts.useQuery(
    { userId: currentUserId },
    {
      enabled: !!currentUserId,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    }
  );

  const unreadCounts = useMemo(
    () =>
      (folderCounts as Record<MessageFolder, number> | undefined) ?? {
        inbox: 0,
        personal: 0,
        diplomatic: 0,
        discussions: 0,
        groups: 0,
        system: 0,
      },
    [folderCounts]
  );

  // ── Selected conversation object ──
  const selectedConversation = useMemo(
    () => activeFolderConversations.find((c: any) => c.id === selectedConversationId) ?? null,
    [activeFolderConversations, selectedConversationId]
  );

  // ── Presence Tracking ──
  const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});

  // ── WebSocket ──
  const wsOptions = useMemo(
    () => ({
      accountId: currentUserId,
      autoReconnect: true,
      onMessageUpdate: (data: any) => {
        if (!selectedConversationId || data.conversationId !== selectedConversationId) return;

        const queryKey = { conversationId: selectedConversationId, userId: currentUserId };

        if (data.type === "message:new") {
          utils.messages.getConversationMessages.setData(queryKey, (old: any) => {
            if (!old) return old;
            // Avoid duplicate messages
            if (old.messages.some((m: any) => m.id === data.messageId)) return old;

            let senderAccount;
            if (data.accountId === currentUserId) {
              senderAccount = {
                id: currentUserId,
                username: user?.username ?? "me",
                displayName: user?.fullName ?? user?.username ?? "Me",
                profileImageUrl: user?.imageUrl ?? null,
                accountType: "country" as const,
              };
            } else {
              const participant = selectedConversation?.otherParticipants.find(
                (p: any) => p.accountId === data.accountId
              );
              senderAccount = participant?.account ?? {
                id: data.accountId,
                username: "user",
                displayName: "User",
                profileImageUrl: null,
                accountType: "country" as const,
              };
            }

            const newMessage = {
              id: data.messageId,
              conversationId: data.conversationId!,
              accountId: data.accountId,
              account: senderAccount,
              content: data.content ?? "",
              messageType: "text" as const,
              ixTimeTimestamp: new Date(data.timestamp),
              createdAt: new Date(data.timestamp),
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

            return {
              ...old,
              messages: [newMessage, ...old.messages],
            };
          });

          // Refetch conversations list to update preview/unread state
          void refetchConversations();
        } else if (data.type === "message:updated") {
          utils.messages.getConversationMessages.setData(queryKey, (old: any) => {
            if (!old) return old;
            return {
              ...old,
              messages: old.messages.map((m: any) =>
                m.id === data.messageId
                  ? { ...m, content: data.content ?? m.content, editedAt: new Date(data.timestamp) }
                  : m
              ),
            };
          });
        } else if (data.type === "message:deleted") {
          utils.messages.getConversationMessages.setData(queryKey, (old: any) => {
            if (!old) return old;
            return {
              ...old,
              messages: old.messages.filter((m: any) => m.id !== data.messageId),
            };
          });
        }
      },
      onConversationUpdate: () => {
        void refetchConversations();
      },
      onPresenceUpdate: (data: any) => {
        if (data.accountId) {
          setPresenceMap((prev) => ({
            ...prev,
            [data.accountId]: data.status,
          }));
        }
      },
    }),
    [currentUserId, refetchConversations, selectedConversationId, selectedConversation, user, utils]
  );

  const {
    clientState: rawClientState,
    sendTypingIndicator,
    subscribeToConversation,
  } = useThinkPagesWebSocket(wsOptions);

  const clientState = useMemo(
    () => ({
      presenceStatus: rawClientState.presenceStatus,
      typingIndicators: rawClientState.typingIndicators,
      presenceMap,
      connectionStatus: rawClientState.connected
        ? ("connected" as const)
        : ("disconnected" as const),
      lastSyncTime: new Date(rawClientState.lastHeartbeat),
      unreadCount: 0,
    }),
    [rawClientState, presenceMap]
  );

  // Subscribe to selected conversation
  useEffect(() => {
    if (selectedConversationId && currentUserId) {
      subscribeToConversation(selectedConversationId);
    }
  }, [selectedConversationId, currentUserId, subscribeToConversation]);

  // ── Navigation ──
  const handleFolderNavigate = useCallback(
    (folder: MessageFolder) => {
      if (folder === activeFolder) return;
      setActiveFolder(folder);
      setSelectedConversationId(null);
      setSearchQuery("");

      const href = folder === "inbox" ? "/messages" : `/messages/${folder}`;
      window.history.pushState(null, "", withBasePath(href));
      document.title = `${SECTION_TITLES[folder]} - Messages - IxStats`;
    },
    [activeFolder]
  );

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const newFolder = getFolderFromPathname(window.location.pathname);
      setActiveFolder(newFolder);
      setSelectedConversationId(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Set initial title
  useEffect(() => {
    document.title = `${SECTION_TITLES[activeFolder]} - Messages - IxStats`;
  }, [activeFolder]);

  // ── Create conversation (via unified messages router) ──
  const createConversation = api.messages.createConversation.useMutation();

  const handleCreateConversation = useCallback(
    async (participantId: string) => {
      if (!currentUserId?.trim() || !participantId?.trim()) {
        notify.error("Invalid user or participant");
        return;
      }

      const participantIds =
        participantId === currentUserId ? [currentUserId] : [currentUserId, participantId];

      // Source based on active folder
      const source = activeFolder === "diplomatic" ? "diplomatic" : "thinkshare";

      try {
        const result = await createConversation.mutateAsync({
          participantIds,
          source: source as any,
          conversationType: activeFolder === "diplomatic" ? "diplomatic" : undefined,
        });
        setSelectedConversationId(result.id);
        setShowNewConversation(false);
        notify.success("Conversation created!");
        void refetchConversations();
      } catch (error: any) {
        notify.error(error.message || "Failed to create conversation");
      }
    },
    [currentUserId, activeFolder, createConversation, notify, refetchConversations]
  );

  // ── Render ──
  return (
    <>
      <MessagesLayout
        folderNavExpanded={folderNavExpanded}
        folderNav={
          <MessagesFolderNav
            activeFolder={activeFolder}
            onNavigate={handleFolderNavigate}
            unreadCounts={unreadCounts}
            expanded={folderNavExpanded}
            onToggleExpanded={() => setFolderNavExpanded((prev) => !prev)}
          />
        }
        conversationPanel={
          <MessagesConversationPanel
            activeFolder={activeFolder}
            conversations={activeFolderConversations}
            isLoading={isLoadingConversations}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedConversationId={selectedConversationId}
            onSelectConversation={setSelectedConversationId}
            currentUserId={currentUserId}
            onNewConversation={() => setShowNewConversation(true)}
          />
        }
        chatPanel={
          selectedConversation ? (
            <MessagesChatPanel
              conversation={selectedConversation}
              currentUserId={currentUserId}
              activeFolder={activeFolder}
              clientState={clientState}
              sendTypingIndicator={sendTypingIndicator}
            />
          ) : activeFolder === "groups" ? (
            <MessagesGroupsPanel onSelectGroup={setSelectedConversationId} />
          ) : (
            <MessagesEmptyState
              activeFolder={activeFolder}
              onNewConversation={() => setShowNewConversation(true)}
            />
          )
        }
      />

      <MessagesNewConversationModal
        isOpen={showNewConversation}
        onClose={() => setShowNewConversation(false)}
        currentUserId={currentUserId}
        onCreateConversation={handleCreateConversation}
      />
    </>
  );
}

// ─── Exported Router with Auth Guard ─────────────────────────────

export function MessagesRouter() {
  return (
    <AuthenticationGuard redirectPath="/messages">
      <MessagesRouterInner />
    </AuthenticationGuard>
  );
}
