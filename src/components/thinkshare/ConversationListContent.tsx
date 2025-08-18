"use client";

import React from 'react';
// import { ScrollArea } from '~/components/ui/scroll-area'; // Temporarily disabled due to infinite loop
import { Loader2, MessageSquare } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { ConversationCard } from './ConversationCard';

interface ThinkshareConversation {
  id: string;
  type: string;
  name?: string | null;
  avatar?: string | null;
  isActive: boolean;
  lastActivity: Date;
  otherParticipants: {
    id: string;
    accountId: string;
    account: {
      id: string;
      username: string;
      displayName: string;
      profileImageUrl?: string | null;
      accountType: string;
    };
    isActive: boolean;
  }[];
  lastMessage?: {
    id: string;
    accountId: string;
    content: string;
    ixTimeTimestamp: Date;
    createdAt?: Date;
    account: {
      id: string;
      username: string;
      displayName: string;
    };
  };
  lastReadAt?: Date;
  unreadCount: number;
}

interface ConversationListContentProps {
  conversations: ThinkshareConversation[];
  isLoadingConversations: boolean;
  selectedConversation: string | null;
  setSelectedConversation: (id: string) => void;
  currentAccountId: string;
  onNewConversationClick: () => void;
  getAccountTypeIcon: (type: string) => React.ReactNode;
  clientState: any; // TODO: Define a proper type for clientState
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
      <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        <div className="px-4 pb-4 space-y-2">
          {isLoadingConversations ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No Thinkshares yet</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onNewConversationClick}
                className="mt-2"
              >
                Start a thinkshare
              </Button>
            </div>
          ) : (
            conversations.map((conversation: ThinkshareConversation) => (
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
