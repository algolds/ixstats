"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { MessageSquare, Send, Loader2, Plus, Crown, Hash, Globe } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { useThinkPagesWebSocket } from '~/hooks/useThinkPagesWebSocket';

// Import the new sub-components
import { ThinkshareHeader } from './ThinkshareHeader';
import { ConversationList } from './ConversationList';
import { ChatArea } from './ChatArea';
import { NewConversationModal } from './NewConversationModal';

interface ThinkshareMessagesProps {
  countryId: string;
  countryName: string;
  userAccounts?: any[]; // Optional - for backward compatibility with thinkpages
}

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

interface Account {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl?: string | null;
  accountType: string;
}

export function ThinkshareMessages({ countryId, countryName, userAccounts = [] }: ThinkshareMessagesProps) {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);

  // Handle URL parameter for auto-selecting conversation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const conversationParam = urlParams.get('conversation');
      
      if (conversationParam) {
        setSelectedConversation(conversationParam);
        // Clean up URL after setting the conversation
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // Get user's country data directly for thinkshare (no thinkpages account required)
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: 'dummy' }, // Will be replaced with actual auth
    { enabled: false } // Disabled for now - will be enabled with proper auth
  );

  // Use the first available thinkpages account
  const currentAccount: Account | undefined = userAccounts?.[0];

  // Show error state if no thinkpages account is available
  if (!currentAccount) {
    return (
      <div className="space-y-6">
        <Card className="glass-hierarchy-parent">
          <CardContent className="p-8 text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No ThinkPages Account</h3>
            <p className="text-muted-foreground">
              You need a ThinkPages account to use ThinkShare messaging.
              <br />
              Create one first in the ThinkPages section.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // API Queries with smart enabling for live functionality (moved above callbacks)
  const shouldFetchConversations = currentAccount?.id && currentAccount.id.trim() !== '';
  
  // Use unified API that works with both thinkpages accounts and country-based users
  const { data: conversations, isLoading: isLoadingConversations, refetch: refetchConversations } = api.thinkpages.getConversations.useQuery({
    accountId: currentAccount?.id ?? 'INVALID'
  }, {
    enabled: Boolean(shouldFetchConversations), // Enable when we have valid account
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

    const { data: conversationMessages, isLoading: isLoadingMessages, refetch: refetchMessages } = api.thinkpages.getConversationMessages.useQuery({
    conversationId: selectedConversation ?? 'INVALID',
    accountId: currentAccount?.id ?? 'INVALID'
  }, {
    enabled: !!selectedConversation,
    refetchOnWindowFocus: false,
  });

  // Temporarily disable WebSocket to isolate the infinite loop issue
  const clientState = { 
    connected: false, 
    typingIndicators: new Map() 
  };
  const sendTypingIndicator = () => {};
  const subscribeToConversation = () => {};
  const markMessageAsRead = () => {};

  // Search for other countries/users to message
  const { data: allAccounts, isLoading: isLoadingAccounts } = api.thinkpages.searchAccounts.useQuery({
    query: searchQuery ?? 'INVALID'
  }, {
    enabled: Boolean(showNewConversationModal && searchQuery && searchQuery.length > 2), // Only when searching
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Temporarily disable WebSocket subscription useEffect to isolate infinite loop
  // useEffect(() => {
  //   if (selectedConversation && selectedConversation.trim() !== '' && currentAccount?.id && currentAccount.id.trim() !== '') {
  //     subscribeToConversation(selectedConversation);
  //   }
  // }, [selectedConversation, currentAccount?.id]);

  // Mutations
  const createConversationMutation = api.thinkpages.createConversation.useMutation();

  const markMessagesAsReadMutation = api.thinkpages.markMessagesAsRead.useMutation({
    onSuccess: () => {
      // Conversations will be refetched automatically to update read status
    }
  });

  const handleCreateConversation = async (participantId: string) => {
    console.log('🔧 handleCreateConversation called with:', { participantId, currentAccountId: currentAccount?.id });
    
    if (!currentAccount?.id?.trim() || !participantId?.trim()) {
      toast.error('Invalid account or participant');
      return;
    }

    const participantIds = participantId === currentAccount.id 
      ? [currentAccount.id] // Self-message
      : [currentAccount.id, participantId]; // Regular conversation
    
    const mutationInput = { participantIds };
    console.log('📤 About to call mutation with input:', mutationInput);
    console.log('📤 Input JSON:', JSON.stringify(mutationInput, null, 2));
    
    try {
      console.log('⏳ Calling mutateAsync...');
      const result = await createConversationMutation.mutateAsync(mutationInput);
      console.log('✅ Mutation result:', result);
      setSelectedConversation(result.id);
      setShowNewConversationModal(false);
      setSearchQuery('');
      toast.success('Conversation created!');
      void refetchConversations();
    } catch (error: any) {
      console.error('❌ Mutation error:', error);
      toast.error(error.message || 'Failed to create conversation');
    }
  };

  const selectedConv = conversations?.conversations.find((c: ThinkshareConversation) => c.id === selectedConversation);

  // Memoize the icon function to prevent re-creation on every render
  const getAccountTypeIcon = useCallback((accountType: string) => {
    switch (accountType) {
      case 'government': return <Crown className="h-3 w-3 text-amber-500" />;
      case 'media': return <Hash className="h-3 w-3 text-blue-500" />;
      case 'citizen': return <Globe className="h-3 w-3 text-green-500" />;
      default: return null;
    }
  }, []);

  const handleAccountChange = (accountId: string) => {
    toast.info('Account switching is not implemented yet.');
    console.log(`Selected account ID: ${accountId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <ThinkshareHeader
        onNewMessageClick={() => setShowNewConversationModal(true)}
        accounts={userAccounts}
        selectedAccount={currentAccount?.id ?? null}
        onAccountChange={handleAccountChange}
      />

      {/* Main Chat Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Conversations List */}
        <div className="lg:col-span-4">
          <ConversationList
            conversations={conversations?.conversations || []}
            isLoadingConversations={isLoadingConversations}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedConversation={selectedConversation}
            setSelectedConversation={setSelectedConversation}
            currentAccountId={currentAccount?.id || ''}
            onNewConversationClick={() => setShowNewConversationModal(true)}
            getAccountTypeIcon={getAccountTypeIcon}
            clientState={clientState}
          />
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-8">
          {selectedConv ? (
            <ChatArea
              selectedConversation={selectedConv}
              currentAccount={currentAccount}
              conversationMessages={conversationMessages}
              isLoadingMessages={isLoadingMessages}
              refetchMessages={refetchMessages}
              refetchConversations={refetchConversations}
              clientState={clientState}
              sendTypingIndicator={sendTypingIndicator}
              markMessagesAsReadMutation={markMessagesAsReadMutation}
            />
          ) : (
            <Card className="glass-hierarchy-child h-[700px] flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a Thinkshare</h3>
                <p className="text-muted-foreground mb-6">
                  Choose a conversation from the sidebar to start ThinkSharing
                </p>
                <Button 
                  onClick={() => setShowNewConversationModal(true)}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Start New ThinkShare
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <NewConversationModal 
        isOpen={showNewConversationModal}
        onClose={() => {
          setShowNewConversationModal(false);
          setSearchQuery('');
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        accounts={allAccounts || []}
        isLoading={isLoadingAccounts}
        onCreateConversation={handleCreateConversation}
        currentAccount={currentAccount}
      />
    </div>
  );
}

