"use client";

import React, { useMemo } from "react";
import { ChatBubble, Plus, Refresh } from "iconoir-react";
import { api } from "~/trpc/react";
import { MessagesChatPanel } from "~/components/messages/MessagesChatPanel";
import { Button } from "~/components/ui/button";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";

interface ThinktankChatTabProps {
  groupId: string;
  groupName: string;
  conversationId?: string | null;
  currentUserId: string;
  isMember?: boolean;
  onJoin?: () => void;
}

export function ThinktankChatTab({
  groupId,
  groupName,
  conversationId,
  currentUserId,
  isMember = true,
  onJoin,
}: ThinktankChatTabProps) {
  // oxlint-disable-next-line eslint/no-unused-vars
  const notify = useNotify();
  const utils = api.useUtils();
  const targetId = conversationId || groupId;

  const {
    data: conversation,
    isLoading,
    refetch,
    isRefetching,
  } = api.messages.getConversation.useQuery(
    { conversationId: targetId },
    {
      enabled: Boolean(targetId) && Boolean(currentUserId),
      staleTime: 15000,
      retry: 2,
    }
  );

  const clientState = useMemo(
    () => ({
      presenceMap: {},
      typingIndicators: {},
    }),
    []
  );

  const sendTypingIndicator = () => {
    // No-op or hooked to websocket
  };

  if (!isMember) {
    return (
      <div className="flex h-full min-h-[450px] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 shadow-xs dark:text-emerald-400">
          <ChatBubble className="h-7 w-7" />
        </div>
        <h3 className="text-foreground mt-4 text-base font-bold">Group Chat</h3>
        <p className="text-muted-foreground mt-1.5 max-w-md text-xs leading-relaxed">
          Join <strong>{groupName}</strong> to participate in group discussions, real-time
          messaging, and shared notes.
        </p>
        {onJoin && (
          <Button
            onClick={() => {
              soundEffects.press();
              onJoin();
            }}
            className="mt-4 rounded-xl bg-emerald-600 font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Join Group
          </Button>
        )}
      </div>
    );
  }

  if (isLoading || isRefetching) {
    return (
      <div className="flex h-full min-h-[450px] flex-col items-center justify-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 shadow-xs">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
        <p className="text-muted-foreground text-xs font-semibold">Connecting to group chat...</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-full min-h-[450px] flex-col items-center justify-center p-6 text-center">
        <div className="border-border/50 bg-card/60 text-muted-foreground flex h-12 w-12 items-center justify-center rounded-2xl border shadow-xs">
          <ChatBubble className="h-6 w-6" />
        </div>
        <h3 className="text-foreground mt-3.5 text-sm font-bold">Connecting Chat Room</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-relaxed">
          The chat room is preparing its live sync channel. Click below to establish the connection.
        </p>
        <Button
          onClick={() => {
            soundEffects.press();
            void refetch();
            void utils.thinkpages.getThinktankById.invalidate({ groupId });
          }}
          className="mt-4 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500"
        >
          <Refresh className="mr-1.5 h-3.5 w-3.5" />
          Connect Now
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden bg-transparent">
      <MessagesChatPanel
        conversation={conversation as any}
        currentUserId={currentUserId}
        activeFolder="conversations"
        clientState={clientState as any}
        sendTypingIndicator={sendTypingIndicator}
        isSidebarCollapsed={false}
      />
    </div>
  );
}
