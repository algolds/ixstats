"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useThinkPagesWebSocket } from "~/hooks/useThinkPagesWebSocket";
import { withBasePath } from "~/lib/base-path";
import { getSoundService } from "~/lib/media";

import { AuthenticationGuard } from "~/components/mycountry/primitives";
import { MessagesLayout } from "./MessagesLayout";
import {
  MessagesFolderNav,
  getFolderFromPathname,
  DEFAULT_MESSAGES_SETTINGS,
  type MessagesSettings,
} from "./MessagesFolderNav";
import { MessagesConversationPanel } from "./MessagesConversationPanel";
import { MessagesChatPanel } from "./MessagesChatPanel";
import { MessagesEmptyState } from "./MessagesEmptyState";
import { MessagesNewConversationModal } from "./MessagesNewConversationModal";
import { MessagesGroupsPanel } from "./MessagesGroupsPanel";
import { MessagesGroupsListPanel } from "./MessagesGroupsListPanel";

import type { MessageFolder } from "~/types/messages";
import { SYSTEM_CONVERSATION_ID } from "~/types/messages";

// ─── Section titles ──────────────────────────────────────────────

const SECTION_TITLES: Record<MessageFolder, string> = {
  conversations: "Messages",
  groups: "ThinkTanks",
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
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const convId = params.get("conversation");
      if (convId) return convId;
    }
    const folder = getFolderFromPathname(pathname);
    if (folder === "groups") {
      return "groups_directory";
    }
    return null;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Auto-collapse sidebar when a conversation is selected
  useEffect(() => {
    if (selectedConversationId) {
      setIsSidebarCollapsed(true);
    } else {
      setIsSidebarCollapsed(false);
    }
  }, [selectedConversationId]);

  // ── Settings (localStorage-backed) ──
  const [messagesSettings, setMessagesSettings] = useState<MessagesSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_MESSAGES_SETTINGS;
    try {
      const stored = localStorage.getItem("ixstats:messages:settings");
      return stored
        ? { ...DEFAULT_MESSAGES_SETTINGS, ...JSON.parse(stored) }
        : DEFAULT_MESSAGES_SETTINGS;
    } catch {
      return DEFAULT_MESSAGES_SETTINGS;
    }
  });

  const handleSettingsChange = useCallback((next: MessagesSettings) => {
    setMessagesSettings(next);
    try {
      localStorage.setItem("ixstats:messages:settings", JSON.stringify(next));
    } catch {
      // Storage unavailable
    }
  }, []);

  // ── Muted and Archived conversations lists (localStorage-backed) ──
  const [mutedConversations, setMutedConversations] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("ixstats:messages:muted");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [archivedConversations, setArchivedConversations] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("ixstats:messages:archived");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleMuteToggle = useCallback((conversationId: string) => {
    setMutedConversations((prev) => {
      const next = prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId];
      try {
        localStorage.setItem("ixstats:messages:muted", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const handleArchiveToggle = useCallback((conversationId: string) => {
    setArchivedConversations((prev) => {
      const next = prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId];
      try {
        localStorage.setItem("ixstats:messages:archived", JSON.stringify(next));
      } catch {}
      return next;
    });
    // Deselect active conversation if archived
    setSelectedConversationId((prev) => (prev === conversationId ? null : prev));
  }, []);

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

  const activeFolderConversations = useMemo(() => {
    const list = (folderData?.conversations ?? []) as any[];
    return list.filter((c: any) => !archivedConversations.includes(c.id));
  }, [folderData?.conversations, archivedConversations]);

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
        conversations: 0,
        groups: 0,
      },
    [folderCounts]
  );

  // ── Selected conversation object ──
  const selectedConversation = useMemo(() => {
    if (selectedConversationId === "groups_directory") return null;
    if (selectedConversationId === SYSTEM_CONVERSATION_ID) {
      return {
        id: SYSTEM_CONVERSATION_ID,
        type: "channel" as const,
        name: "System Messages",
        avatar: null,
        source: "system",
        conversationType: "official",
        isActive: true,
        lastActivity: new Date(),
        otherParticipants: [],
        unreadCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return activeFolderConversations.find((c: any) => c.id === selectedConversationId) ?? null;
  }, [activeFolderConversations, selectedConversationId]);

  // ── Presence Tracking ──
  const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});

  // ── WebSocket ──
  const wsOptions = useMemo(
    () => ({
      accountId: currentUserId,
      autoReconnect: true,
      onMessageUpdate: (data: any) => {
        if (data.type === "message:new") {
          // Play sound on incoming message if not muted
          const isMuted = mutedConversations.includes(data.conversationId);
          if (data.accountId !== currentUserId && messagesSettings.notificationSounds && !isMuted) {
            try {
              getSoundService().play("card-select");
            } catch (err) {
              console.warn("Failed to play notification sound:", err);
            }
          }

          // Unarchive on new message
          if (archivedConversations.includes(data.conversationId)) {
            setArchivedConversations((prev) => {
              const next = prev.filter((id) => id !== data.conversationId);
              try {
                localStorage.setItem("ixstats:messages:archived", JSON.stringify(next));
              } catch {}
              return next;
            });
          }

          // Invalidate list counts to show updated unread badge in sidebar
          void utils.messages.getFolderCounts.invalidate();
          void utils.messages.getConversationsByFolder.invalidate();
        }

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

          // Optimistically update conversation list preview instead of full refetch
          const folderQueryKey = { userId: currentUserId, folder: activeFolder };
          utils.messages.getConversationsByFolder.setData(folderQueryKey, (old: any) => {
            if (!old?.conversations) return old;
            const updated = old.conversations.map((c: any) => {
              if (c.id !== data.conversationId) return c;
              return {
                ...c,
                lastActivity: new Date(data.timestamp),
                lastMessage: {
                  id: data.messageId,
                  accountId: data.accountId,
                  content: data.content ?? "",
                  ixTimeTimestamp: new Date(data.timestamp),
                  createdAt: new Date(data.timestamp),
                  account:
                    data.accountId === currentUserId
                      ? { id: currentUserId, displayName: user?.fullName ?? "Me" }
                      : (c.lastMessage?.account ?? { id: data.accountId, displayName: "User" }),
                },
                unreadCount:
                  data.accountId !== currentUserId ? (c.unreadCount ?? 0) + 1 : c.unreadCount,
              };
            });
            // Sort by lastActivity descending so the updated conversation bubbles up
            updated.sort(
              (a: any, b: any) =>
                new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
            );
            return { ...old, conversations: updated };
          });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      currentUserId,
      refetchConversations,
      selectedConversationId,
      selectedConversation,
      user,
      utils,
      messagesSettings,
      mutedConversations,
      archivedConversations,
    ]
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
      setSelectedConversationId(folder === "groups" ? "groups_directory" : null);
      setSearchQuery("");

      const href = folder === "conversations" ? "/messages" : `/messages/${folder}`;
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
      setSelectedConversationId(newFolder === "groups" ? "groups_directory" : null);
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
      const source = (activeFolder as string) === "diplomatic" ? "diplomatic" : "thinkshare";

      try {
        const result = await createConversation.mutateAsync({
          participantIds,
          source: source as any,
          conversationType: (activeFolder as string) === "diplomatic" ? "diplomatic" : undefined,
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

  const leaveConversationMutation = api.messages.leaveConversation.useMutation({
    onSuccess: () => {
      notify.success("Conversation deleted successfully");
      setSelectedConversationId(null);
      void refetchConversations();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to delete conversation");
    },
  });

  const handleDeleteConversation = useCallback(
    (conversationId: string) => {
      if (
        confirm(
          "Are you sure you want to delete this conversation? This will remove it from your active list."
        )
      ) {
        leaveConversationMutation.mutate({ conversationId, userId: currentUserId });
      }
    },
    [leaveConversationMutation, currentUserId]
  );

  const addParticipantMutation = api.messages.addParticipant.useMutation({
    onSuccess: () => {
      notify.success("Participant added successfully");
      if (selectedConversationId) {
        void utils.messages.getConversationMessages.invalidate({
          conversationId: selectedConversationId,
          userId: currentUserId,
        });
      }
      void refetchConversations();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to add participant");
    },
  });

  const handleAddParticipant = useCallback(
    async (userId: string) => {
      if (!selectedConversation) return;

      if (selectedConversation.type === "direct") {
        // Upgrade direct conversation to group chat
        const otherParticipantId = selectedConversation.otherParticipants[0]?.accountId;
        const participantIds = [currentUserId];
        if (otherParticipantId) {
          participantIds.push(otherParticipantId);
        }
        participantIds.push(userId);

        try {
          const result = await createConversation.mutateAsync({
            participantIds,
            source: selectedConversation.source as any,
            name: "Group Chat",
          });
          setSelectedConversationId(result.id);
          notify.success("Upgraded to group chat");
          void refetchConversations();
        } catch (err: any) {
          notify.error(err.message || "Failed to create group chat");
        }
      } else {
        // Add participant directly to group chat
        addParticipantMutation.mutate({
          conversationId: selectedConversation.id,
          userId,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      selectedConversation,
      currentUserId,
      createConversation,
      addParticipantMutation,
      refetchConversations,
      selectedConversationId,
      utils.messages.getConversationMessages,
    ]
  );

  // ── Render ──
  return (
    <>
      <MessagesLayout
        isSidebarCollapsed={isSidebarCollapsed}
        conversationPanel={
          <div className="flex h-full flex-col">
            <MessagesFolderNav
              activeFolder={activeFolder}
              onNavigate={handleFolderNavigate}
              unreadCounts={unreadCounts}
              settings={messagesSettings}
              onSettingsChange={handleSettingsChange}
            />
            <div className="min-h-0 flex-1">
              {activeFolder === "groups" ? (
                <MessagesGroupsListPanel
                  selectedConversationId={selectedConversationId}
                  onSelectConversation={setSelectedConversationId}
                  onOpenGroupsDirectory={() => setSelectedConversationId("groups_directory")}
                />
              ) : (
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
                  onOpenGroupsDirectory={() => setSelectedConversationId("groups_directory")}
                  settings={messagesSettings}
                  mutedConversations={mutedConversations}
                />
              )}
            </div>
          </div>
        }
        chatPanel={
          selectedConversationId === "groups_directory" ? (
            <MessagesGroupsPanel
              onSelectGroup={setSelectedConversationId}
              onBack={() => setSelectedConversationId(null)}
            />
          ) : selectedConversation ? (
            <MessagesChatPanel
              conversation={selectedConversation}
              currentUserId={currentUserId}
              activeFolder={activeFolder}
              clientState={clientState as any}
              sendTypingIndicator={sendTypingIndicator}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
              settings={messagesSettings}
              isMuted={mutedConversations.includes(selectedConversation.id)}
              isArchived={archivedConversations.includes(selectedConversation.id)}
              onMuteToggle={() => handleMuteToggle(selectedConversation.id)}
              onArchiveToggle={() => handleArchiveToggle(selectedConversation.id)}
              onDeleteConversation={() => handleDeleteConversation(selectedConversation.id)}
              onAddParticipant={handleAddParticipant}
            />
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
