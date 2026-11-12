"use client";

import { useEffect, useState } from "react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

import { AuthenticationGuard } from "~/components/mycountry/primitives";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { MessagesLayout } from "./MessagesLayout";
import { MessagesFolderNav } from "./MessagesFolderNav";
import { MessagesConversationPanel } from "./MessagesConversationPanel";
import { MessagesChatPanel } from "./MessagesChatPanel";
import { MessagesEmptyState } from "./MessagesEmptyState";
import { MessagesNewConversationModal } from "./MessagesNewConversationModal";
import { useMessagePreferences } from "./useMessagePreferences";
import { useMessagesSocket } from "./useMessagesSocket";
import { useMessagesAddress } from "./useMessagesAddress";
import { useMessagesInbox } from "./useMessagesInbox";
import { useMessagesDeepLink } from "./useMessagesDeepLink";

import type { MessageFolder } from "~/types/messages";
import { SYSTEM_CONVERSATION_ID, LOREBOT_CONVERSATION_ID } from "~/types/messages";
import type { ThinkShareConversation } from "~/types/thinkshare";

const SECTION_TITLES: Record<MessageFolder, string> = {
  conversations: "Messages",
  requests: "Requests",
};

const officialConversation = (
  id: string,
  name: string,
  source: string
): ThinkShareConversation => ({
  id,
  type: "channel",
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

function ThreadSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-label="Loading conversation">
      <div className="border-separator flex items-center gap-3 border-b p-4">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="flex flex-1 flex-col justify-end gap-4 p-4">
        <Skeleton className="rounded-row h-10 w-1/2" />
        <Skeleton className="rounded-row h-10 w-2/5 self-end" />
        <Skeleton className="rounded-row h-10 w-3/5" />
      </div>
    </div>
  );
}

function MessagesRouterInner() {
  const { user } = useUser();
  const notify = useNotify();
  const utils = api.useUtils();
  const address = useMessagesAddress();

  const currentUserId = user?.id ?? "";
  const activeFolder = address.folder;
  const selectedConversationId = address.conversationId;
  const showArchived = address.archived && activeFolder === "conversations";

  const [searchQuery, setSearchQuery] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { settings: messagesSettings, updateSettings, muted, archived } = useMessagePreferences();
  const inbox = useMessagesInbox(activeFolder, currentUserId);

  const listedConversations =
    activeFolder === "requests"
      ? inbox.conversations
      : inbox.conversations.filter((c) => archived.ids.includes(c.id) === showArchived);

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

  // A thread opened by a link may not be on a loaded page of the list (or may be archived), so it is fetched on its own.
  const isSpecialId =
    !selectedConversationId ||
    selectedConversationId === SYSTEM_CONVERSATION_ID ||
    selectedConversationId === LOREBOT_CONVERSATION_ID;

  const foundInInbox = isSpecialId
    ? null
    : (inbox.conversations.find((c) => c.id === selectedConversationId) ?? null);

  const {
    data: fetchedConversation,
    isLoading: isLoadingSingleConversation,
    isError: failedToLoadConversation,
  } = api.messages.getConversation.useQuery(
    { conversationId: selectedConversationId ?? "" },
    { enabled: !isSpecialId && !foundInInbox, staleTime: 30000, retry: false }
  );

  const selectedConversation: ThinkShareConversation | null =
    selectedConversationId === SYSTEM_CONVERSATION_ID
      ? officialConversation(SYSTEM_CONVERSATION_ID, "System Messages", "system")
      : selectedConversationId === LOREBOT_CONVERSATION_ID
        ? officialConversation(LOREBOT_CONVERSATION_ID, "LoreBot", "lorebot")
        : (foundInInbox ?? (fetchedConversation as ThinkShareConversation | undefined) ?? null);

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
    refetchConversations: inbox.refetch,
  });

  useEffect(() => {
    document.title = `${SECTION_TITLES[activeFolder]} - Messages - IxStates`;
  }, [activeFolder]);

  const createConversation = api.messages.createConversation.useMutation();

  const startConversation = async (
    participantId: string,
    options?: { diplomatic?: boolean; fromLink?: boolean }
  ) => {
    if (!currentUserId.trim() || !participantId.trim()) {
      notify.error("Invalid user or participant");
      return;
    }

    // The diplomatic channel is chosen explicitly in the new-conversation modal, or by a link from a country
    const isDiplomatic = options?.diplomatic === true;

    try {
      const result = await createConversation.mutateAsync({
        participantIds:
          participantId === currentUserId ? [currentUserId] : [currentUserId, participantId],
        source: isDiplomatic ? "diplomatic" : "thinkshare",
        conversationType: isDiplomatic ? "diplomatic" : undefined,
      });
      address.selectConversation(result.id, { replace: options?.fromLink });
      setShowNewConversation(false);
      if (!options?.fromLink) {
        // Message myself reopens the one notes conversation after the first time.
        notify.success(participantId === currentUserId ? "Notes to self" : "Conversation created");
      }
      void inbox.refetch();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to create conversation");
      if (options?.fromLink) address.selectConversation(null);
    }
  };

  useMessagesDeepLink({
    countryId: address.countryId,
    userHandle: address.userHandle,
    currentUserId,
    open: ({ clerkUserId, diplomatic }) =>
      startConversation(clerkUserId, { diplomatic, fromLink: true }),
    dismiss: () => address.selectConversation(null),
  });

  const leaveConversationMutation = api.messages.leaveConversation.useMutation({
    onSuccess: () => {
      notify.success("Conversation deleted");
      address.selectConversation(null);
      void inbox.refetch();
    },
    onError: (err) => notify.error(err.message || "Failed to delete conversation"),
  });

  const confirmDelete = () => {
    if (pendingDeleteId) {
      leaveConversationMutation.mutate({ conversationId: pendingDeleteId, userId: currentUserId });
    }
    setPendingDeleteId(null);
  };

  const addParticipantMutation = api.messages.addParticipant.useMutation({
    onSuccess: (result) => {
      // Someone who left, or who filters message requests, gets the group as a request to accept.
      notify.success(result.pending ? "Invitation sent as a message request" : "Participant added");
      if (selectedConversationId) {
        void utils.messages.getConversationMessages.invalidate({
          conversationId: selectedConversationId,
          userId: currentUserId,
        });
      }
      void inbox.refetch();
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
        source: selectedConversation.source === "diplomatic" ? "diplomatic" : "thinkshare",
        name: "Group Chat",
      });
      address.selectConversation(result.id);
      notify.success("Upgraded to group chat");
      void inbox.refetch();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to create group chat");
    }
  };

  const handleArchiveToggle = (conversationId: string) => {
    const wasArchived = archived.ids.includes(conversationId);
    archived.toggle(conversationId);
    // The thread leaves the list it was opened from.
    if (!wasArchived || showArchived) address.selectConversation(null);
  };

  const handleFolderNavigate = (folder: MessageFolder) => {
    if (folder === activeFolder) return;
    setSearchQuery("");
    address.setFolder(folder);
  };

  const thread =
    isLoadingSingleConversation && selectedConversationId ? (
      <ThreadSkeleton />
    ) : selectedConversation ? (
      <MessagesChatPanel
        conversation={selectedConversation}
        currentUserId={currentUserId}
        activeFolder={activeFolder}
        clientState={clientState}
        sendTypingIndicator={sendTypingIndicator}
        onBack={address.leaveConversation}
        settings={messagesSettings}
        isMuted={muted.ids.includes(selectedConversation.id)}
        isArchived={archived.ids.includes(selectedConversation.id)}
        onMuteToggle={() => muted.toggle(selectedConversation.id)}
        onArchiveToggle={() => handleArchiveToggle(selectedConversation.id)}
        onDeleteConversation={() => setPendingDeleteId(selectedConversation.id)}
        onAddParticipant={handleAddParticipant}
      />
    ) : selectedConversationId && (failedToLoadConversation || fetchedConversation === null) ? (
      <EmptyState
        className="h-full"
        title="Conversation not found"
        message="It may have been deleted, or you are not a participant."
        action={
          <Button variant="secondary" onClick={() => address.selectConversation(null)}>
            Back to messages
          </Button>
        }
      />
    ) : (
      <MessagesEmptyState
        activeFolder={activeFolder}
        onNewConversation={() => setShowNewConversation(true)}
      />
    );

  return (
    <>
      <MessagesLayout
        hasThread={!!selectedConversationId}
        rail={
          <div className="flex h-full min-h-0 flex-col">
            <MessagesFolderNav
              activeFolder={activeFolder}
              onNavigate={handleFolderNavigate}
              unreadCounts={unreadCounts}
              settings={messagesSettings}
              onSettingsChange={updateSettings}
              archivedCount={archived.ids.length}
              showArchived={showArchived}
              onToggleArchived={() => address.setArchived(!showArchived)}
            />
            <div className="min-h-0 flex-1">
              <MessagesConversationPanel
                activeFolder={activeFolder}
                conversations={listedConversations}
                isLoading={inbox.isLoading}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedConversationId={selectedConversationId}
                onSelectConversation={(id) => address.selectConversation(id)}
                currentUserId={currentUserId}
                onNewConversation={() => setShowNewConversation(true)}
                settings={messagesSettings}
                mutedConversations={muted.ids}
                showArchived={showArchived}
                hasMore={inbox.hasMore}
                isLoadingMore={inbox.isLoadingMore}
                onLoadMore={inbox.loadMore}
              />
            </div>
          </div>
        }
        thread={thread}
      />

      <MessagesNewConversationModal
        isOpen={showNewConversation}
        onClose={() => setShowNewConversation(false)}
        currentUserId={currentUserId}
        onCreateConversation={startConversation}
      />

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              It leaves your list. Other participants keep their copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
