"use client";

import React from 'react';
import { Card } from '~/components/ui/card';
import { ConversationListHeader } from './ConversationListHeader';
import { ConversationListContent } from './ConversationListContent';

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

interface ConversationListProps {
  conversations: ThinkshareConversation[];
  isLoadingConversations: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedConversation: string | null;
  setSelectedConversation: (id: string) => void;
  currentAccountId: string;
  onNewConversationClick: () => void;
  getAccountTypeIcon: (type: string) => React.ReactNode;
  clientState: any; // TODO: Define a proper type for clientState
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
  const filteredConversations = conversations?.filter((conv: ThinkshareConversation) => 
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
