"use client";

import React from 'react';
import { Card } from '~/components/ui/card';
import { ConversationListHeader } from './ConversationListHeader';
import { ConversationListContent } from './ConversationListContent';
import type { ThinkShareConversation, ThinkShareClientState } from '~/types/thinkshare';

interface ConversationListProps {
  conversations: ThinkShareConversation[];
  isLoadingConversations: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedConversation: string | null;
  setSelectedConversation: (id: string) => void;
  currentAccountId: string;
  onNewConversationClick: () => void;
  getAccountTypeIcon: (type: string) => React.ReactNode;
  clientState: ThinkShareClientState;
}

export function ConversationList({
  conversations,
  isLoadingConversations,
  searchQuery,
  setSearchQuery,
  selectedConversation,
  setSelectedConversation,
  currentAccountId,
  onNewConversationClick,
  getAccountTypeIcon,
  clientState,
}: ConversationListProps) {
  const filteredConversations = conversations?.filter((conv) => 
    searchQuery === '' || 
    conv.otherParticipants.some((p: any) => 
      p.account.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.account.username.toLowerCase().includes(searchQuery.toLowerCase())
    ) ||
    (conv.name && conv.name.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  return (
    <Card className="glass-hierarchy-child h-[700px] flex flex-col">
      <ConversationListHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onNewConversationClick={onNewConversationClick}
      />
      
      <ConversationListContent
        conversations={filteredConversations}
        isLoadingConversations={isLoadingConversations}
        selectedConversation={selectedConversation}
        setSelectedConversation={setSelectedConversation}
        currentAccountId={currentAccountId}
        onNewConversationClick={onNewConversationClick}
        getAccountTypeIcon={getAccountTypeIcon}
        clientState={clientState}
      />
    </Card>
  );
}
