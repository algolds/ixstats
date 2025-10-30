"use client";

import React from "react";
// import { ScrollArea } from '~/components/ui/scroll-area'; // Temporarily disabled due to infinite loop
import { Loader2, MessageSquare } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ConversationCard } from "./ConversationCard";
import type { ThinkShareConversation, ThinkShareClientState } from "~/types/thinkshare";

interface ConversationListContentProps {
  conversations: ThinkShareConversation[];
  isLoadingConversations: boolean;
  selectedConversation: string | null;
  setSelectedConversation: (id: string) => void;
  currentAccountId: string;
  onNewConversationClick: () => void;
  getAccountTypeIcon: (type: string) => React.ReactNode;
  clientState: ThinkShareClientState;
}

export function ConversationListContent({
  conversations,
  isLoadingConversations,
  selectedConversation,
  setSelectedConversation,
  currentAccountId,
  onNewConversationClick,
  getAccountTypeIcon,
  clientState,
}: ConversationListContentProps) {
  return (
    <div className="flex-1 overflow-hidden">
      <div className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent h-full overflow-y-auto">
        <div className="space-y-2 px-4 pb-4">
          {isLoadingConversations ? (
            <div className="flex justify-center py-8">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-8 text-center">
              <MessageSquare className="text-muted-foreground mx-auto mb-3 h-12 w-12" />
              <p className="text-muted-foreground text-sm">No Thinkshares yet</p>
              <Button variant="ghost" size="sm" onClick={onNewConversationClick} className="mt-2">
                Start a thinkshare
              </Button>
            </div>
          ) : (
            conversations.map((conversation) => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedConversation === conversation.id}
                onClick={() => setSelectedConversation(conversation.id)}
                currentAccountId={currentAccountId}
                getAccountTypeIcon={getAccountTypeIcon}
                clientState={clientState}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
