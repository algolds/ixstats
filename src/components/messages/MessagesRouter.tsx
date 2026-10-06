"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { withBasePath } from "~/lib/base-path";

import { AuthenticationGuard } from "~/components/mycountry/primitives";
import { MessagesLayout } from "./MessagesLayout";
import { MessagesFolderNav, getFolderFromPathname } from "./MessagesFolderNav";
import { MessagesConversationPanel } from "./MessagesConversationPanel";
import { MessagesChatPanel } from "./MessagesChatPanel";
import { MessagesEmptyState } from "./MessagesEmptyState";
import { MessagesNewConversationModal } from "./MessagesNewConversationModal";
import { useMessagePreferences } from "./useMessagePreferences";
import { useMessagesSocket } from "./useMessagesSocket";

import type { MessageFolder } from "~/types/messages";
import { SYSTEM_CONVERSATION_ID, LOREBOT_CONVERSATION_ID } from "~/types/messages";

const SECTION_TITLES: Record<MessageFolder, string> = {
  conversations: "Messages",
  requests: "Requests",
};

const officialConversation = (id: string, name: string, source: string) => ({
  id,
  type: "channel" as const,
  name,
  avatar: null,
  source,
  conversationType: "official",
  isActive: true,
  lastActivity: new Date(),
  otherParticipants: [],
  unreadCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const conversationParam = () =>
  typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search).get("conversation");

function MessagesRouterInner() {
  const { user } = useUser();
  const pathname = usePathname();
  const notify = useNotify();
  const utils = api.useUtils();

  const currentUserId = user?.id ?? "";

  const [activeFolder, setActiveFolder] = useState<MessageFolder>(() =>
    getFolderFromPathname(pathname)
  );
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    conversationParam
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const isSidebarCollapsed = !!selectedConversationId;

  const { settings: messagesSettings, updateSettings, muted, archived } = useMessagePreferences();

  const handleArchiveToggle = (conversationId: string) => {
    archived.toggle(conversationId);
    setSelectedConversationId((prev) => (prev === conversationId ? null : prev));
  };

  // The deep-link param is consumed by the initial state above; drop it from the URL.
  useEffect(() => {
    if (conversationParam()) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const {
    data: folderData,
    isLoading: isLoadingConversations,
    refetch: refetchConversations,
  } = api.messages.getConversationsByFolder.useQuery(
    { userId: currentUserId, folder: activeFolder },
    { enabled: !!currentUserId, retry: 1, refetchOnWindowFocus: false, staleTime: 30000 }
  );

  const activeFolderConversations = useMemo(
    () => ((folderData?.conversations ?? []) as any[]).filter((c) => !archived.ids.includes(c.id)),
    [folderData?.conversations, archived.ids]
  );

  const { data: folderCounts } = api.messages.getFolderCounts.useQuery(
    { userId: currentUserId },
    { enabled: !!currentUserId, refetchOnWindowFocus: false, staleTime: 30000 }
  );

  // "conversations" shows the server's total unread (inbox); "requests" the pending message
  // requests (SL-4), which count nowhere else.
  const unreadCounts: Record<MessageFolder, number> = {
    conversations: folderCounts?.inbox ?? 0,
    requests: folderCounts?.requests ?? 0,
  };

  // Conversations opened by deep link may not be in the folder list, so fall back to a fetch.
  const isSpecialId =
    !selectedConversationId ||
    selectedConversationId === SYSTEM_CONVERSATION_ID ||
    selectedConversationId === LOREBOT_CONVERSATION_ID;

  const foundInFolder = isSpecialId
    ? null
    : (activeFolderConversations.find((c) => c.id === selectedConversationId) ?? null);

  const { data: fetchedConversation, isLoading: isLoadingSingleConversation } =
    api.messages.getConversation.useQuery(
      { conversationId: selectedConversationId || "" },
      { enabled: !isSpecialId && !foundInFolder, staleTime: 30000 }
    );

  const selectedConversation = useMemo(() => {
    if (selectedConversationId === SYSTEM_CONVERSATION_ID) {
      return officialConversation(SYSTEM_CONVERSATION_ID, "System Messages", "system");
    }
    if (selectedConversationId === LOREBOT_CONVERSATION_ID) {
      return officialConversation(LOREBOT_CONVERSATION_ID, "LoreBot", "lorebot");
    }
    return foundInFolder ?? (fetchedConversation as any) ?? null;
  }, [foundInFolder, fetchedConversation, selectedConversationId]);

  const { clientState, sendTypingIndicator } = useMessagesSocket({
    currentUserId,
    user,
    activeFolder,
    selectedConversationId,
    selectedConversation,
    settings: messagesSettings,
    mutedIds: muted.ids,
    archivedIds: archived.ids,
    onUnarchive: archived.remove,
    refetchConversations,
  });

  const handleFolderNavigate = (folder: MessageFolder) => {
    if (folder === activeFolder) return;
    setActiveFolder(folder);
    setSelectedConversationId(null);
    setSearchQuery("");

    window.history.pushState(null, "", withBasePath("/messages"));
    document.title = "Messages - IxStats";
  };

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      setActiveFolder(getFolderFromPathname(window.location.pathname));
      setSelectedConversationId(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.title = `${SECTION_TITLES[activeFolder]} - Messages - IxStats`;
  }, [activeFolder]);

  const createConversation = api.messages.createConversation.useMutation();

  const handleCreateConversation = async (
    participantId: string,
    options?: { diplomatic?: boolean }
  ) => {
    if (!currentUserId?.trim() || !participantId?.trim()) {
      notify.error("Invalid user or participant");
      return;
    }

    // The diplomatic channel is chosen explicitly in the new-conversation modal
    const isDiplomatic = options?.diplomatic === true;

    try {
      const result = await createConversation.mutateAsync({
        participantIds:
          participantId === currentUserId ? [currentUserId] : [currentUserId, participantId],
        source: (isDiplomatic ? "diplomatic" : "thinkshare") as any,
        conversationType: isDiplomatic ? "diplomatic" : undefined,
      });
      setSelectedConversationId(result.id);
      setShowNewConversation(false);
      notify.success("Conversation created");
      void refetchConversations();
    } catch (error: any) {
      notify.error(error.message || "Failed to create conversation");
    }
  };

  const leaveConversationMutation = api.messages.leaveConversation.useMutation({
    onSuccess: () => {
      notify.success("Conversation deleted");
      setSelectedConversationId(null);
      void refetchConversations();
    },
    onError: (err) => notify.error(err.message || "Failed to delete conversation"),
  });

  const handleDeleteConversation = (conversationId: string) => {
    if (
      confirm(
        "Are you sure you want to delete this conversation? This will remove it from your active list."
      )
    ) {
      leaveConversationMutation.mutate({ conversationId, userId: currentUserId });
    }
  };

  const addParticipantMutation = api.messages.addParticipant.useMutation({
    onSuccess: () => {
      notify.success("Participant added");
      if (selectedConversationId) {
        void utils.messages.getConversationMessages.invalidate({
          conversationId: selectedConversationId,
          userId: currentUserId,
        });
      }
      void refetchConversations();
    },
    onError: (err) => notify.error(err.message || "Failed to add participant"),
  });

  const handleAddParticipant = async (userId: string) => {
    if (!selectedConversation) return;

    if (selectedConversation.type !== "direct") {
      addParticipantMutation.mutate({ conversationId: selectedConversation.id, userId });
      return;
    }

    // Adding to a direct conversation upgrades it to a group chat
    const otherParticipantId = selectedConversation.otherParticipants[0]?.accountId;
    try {
      const result = await createConversation.mutateAsync({
        participantIds: [
          currentUserId,
          ...(otherParticipantId ? [otherParticipantId] : []),
          userId,
        ],
        source: selectedConversation.source as any,
        name: "Group Chat",
      });
      setSelectedConversationId(result.id);
      notify.success("Upgraded to group chat");
      void refetchConversations();
    } catch (err: any) {
      notify.error(err.message || "Failed to create group chat");
    }
  };

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
              onSettingsChange={updateSettings}
            />
            <div className="min-h-0 flex-1">
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
                settings={messagesSettings}
                mutedConversations={muted.ids}
              />
            </div>
          </div>
        }
        chatPanel={
          isLoadingSingleConversation && selectedConversationId ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <span className="border-tint size-5 animate-spin rounded-full border-2 border-t-transparent" />
              <p className="text-footnote text-label-secondary">Connecting to thread...</p>
            </div>
          ) : selectedConversation ? (
            <MessagesChatPanel
              conversation={selectedConversation}
              currentUserId={currentUserId}
              activeFolder={activeFolder}
              clientState={clientState as any}
              sendTypingIndicator={sendTypingIndicator}
              onBack={() => setSelectedConversationId(null)}
              settings={messagesSettings}
              isMuted={muted.ids.includes(selectedConversation.id)}
              isArchived={archived.ids.includes(selectedConversation.id)}
              onMuteToggle={() => muted.toggle(selectedConversation.id)}
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

export function MessagesRouter() {
  return (
    <AuthenticationGuard redirectPath="/messages">
      <MessagesRouterInner />
    </AuthenticationGuard>
  );
}
