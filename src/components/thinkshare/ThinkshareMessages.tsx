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
  userAccounts: any[];
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

export function ThinkshareMessages({ countryId, countryName, userAccounts }: ThinkshareMessagesProps) {
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

  // Get current user's primary account
  const currentAccount: Account | undefined = userAccounts?.[0];

  // Early return if no accounts are available
  if (!userAccounts || userAccounts.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="glass-hierarchy-parent">
          <CardContent className="p-8 text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Accounts Available</h3>
            <p className="text-muted-foreground">
              Please create a ThinkPages account to use Thinkshare messaging.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Validate required props and account first
  const hasValidProps = countryId && countryName && countryId.trim() !== '' && countryName.trim() !== '';
  const hasValidAccount = currentAccount?.id && currentAccount.id.trim() !== '';
  
  // Early return if required props are missing
  if (!hasValidProps) {
    return (
      <div className="space-y-6">
        <Card className="glass-hierarchy-parent">
          <CardContent className="p-8 text-center">
            <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Loading...</h3>
            <p className="text-muted-foreground">
              Setting up your ThinkShare experience
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // API Queries with smart enabling for live functionality (moved above callbacks)
  const shouldFetchConversations = hasValidProps && hasValidAccount && currentAccount?.id && currentAccount.id.trim() !== '';
  
  const { data: conversations, isLoading: isLoadingConversations, refetch: refetchConversations } = api.thinkpages.getConversations.useQuery({
    accountId: currentAccount?.id ?? 'INVALID'
  }, {
    enabled: Boolean(shouldFetchConversations), // Enable when we have valid data
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 30000,
    // refetchInterval: 10000, // Temporarily disabled to prevent infinite loops
  });

  const { data: conversationMessages, isLoading: isLoadingMessages, refetch: refetchMessages } = api.thinkpages.getConversationMessages.useQuery({
    conversationId: selectedConversation ?? 'INVALID',
    accountId: currentAccount?.id ?? 'INVALID'
  }, {
    enabled: Boolean(selectedConversation && currentAccount?.id), // Enable when conversation is selected
    retry: 1,
    refetchOnWindowFocus: false,
    // refetchInterval: 5000, // Temporarily disabled to prevent infinite loops
  });

  // Temporarily disable WebSocket to isolate the infinite loop issue
  const clientState = { 
    connected: false, 
    typingIndicators: new Map() 
  };
  const sendTypingIndicator = () => {};
  const subscribeToConversation = () => {};
  const markMessageAsRead = () => {};

  // Temporarily disable search query to isolate infinite loop
  const allAccounts: any[] = [];
  const isLoadingAccounts = false;
  // const { data: allAccounts, isLoading: isLoadingAccounts } = api.thinkpages.searchAccounts.useQuery({
  //   query: searchQuery ?? 'INVALID'
  // }, {
  //   enabled: Boolean(showNewConversationModal && searchQuery && searchQuery.length > 2), // Only when searching
  //   retry: 1,
  //   refetchOnWindowFocus: false
  // });

  // Temporarily disable WebSocket subscription useEffect to isolate infinite loop
  // useEffect(() => {
  //   if (selectedConversation && selectedConversation.trim() !== '' && currentAccount?.id && currentAccount.id.trim() !== '') {
  //     subscribeToConversation(selectedConversation);
  //   }
  // }, [selectedConversation, currentAccount?.id]);

  // Mutations
  const createConversationMutation = api.thinkpages.createConversation.useMutation({
    onSuccess: (newConversation: any) => {
      console.log('🎉 MUTATION SUCCESS CALLBACK called with:', newConversation);
      toast.success('Conversation created successfully!');
      setSelectedConversation(newConversation.id); // Re-enabled - infinite loop should be fixed
      setShowNewConversationModal(false);
      setSearchQuery(''); // Clear search
      void refetchConversations(); // Re-enabled - should be safe now
    },
    onError: (error: any) => {
      console.error('Create conversation error:', error);
      console.error('Error details:', {
        code: error.data?.code,
        message: error.message,
        stack: error.data?.stack
      });
      
      // Enhanced error messages
      let errorMessage = 'Failed to create conversation';
      if (error.message?.includes('already exists')) {
        errorMessage = 'Conversation already exists with this user';
      } else if (error.message?.includes('permission')) {
        errorMessage = 'You don\'t have permission to message this user';
      } else if (error.message?.includes('account')) {
        errorMessage = 'Account not found or invalid';
      }
      
      toast.error(errorMessage);
    }
  });

  const markMessagesAsReadMutation = api.thinkpages.markMessagesAsRead.useMutation({
    onSuccess: () => {
      // Conversations will be refetched automatically to update read status
    }
  });

  const handleCreateConversation = useCallback(async (participantId: string) => {
    console.log('🚀 handleCreateConversation called with:', { participantId, currentAccount: currentAccount?.id });
    
    if (!currentAccount?.id?.trim()) {
      console.error('❌ No current account available');
      toast.error('No account selected. Please select an account first.');
      return;
    }
    
    if (!participantId?.trim()) {
      console.error('❌ No participant ID provided');
      toast.error('Invalid participant ID');
      return;
    }

    // Enhanced participant validation for self-messaging and regular messaging
    let participantIds: string[];
    
    if (participantId === currentAccount.id) {
      // Self-message: use single participant, mutation will duplicate it
      participantIds = [currentAccount.id];
      console.log('📝 Creating self-message conversation');
    } else {
      // Regular conversation: include both participants
      participantIds = [currentAccount.id, participantId];
      console.log('💬 Creating regular conversation with participants:', participantIds);
    }

    // Validate participant IDs
    const validParticipantIds = participantIds.filter(id => id && id.trim() !== '');
    if (validParticipantIds.length === 0) {
      console.error('❌ No valid participant IDs after filtering');
      toast.error('Invalid participants');
      return;
    }

    const mutationInput = {
      participantIds: validParticipantIds
    };
    
    console.log('📤 Final mutation input:', JSON.stringify(mutationInput, null, 2));
    console.log('📤 Mutation input type:', typeof mutationInput);
    console.log('📤 Mutation input keys:', Object.keys(mutationInput));
    
    // Test the mutation input before calling
    try {
      console.log('⏳ About to call createConversation mutation...');
      const result = await createConversationMutation.mutateAsync(mutationInput);
      console.log('✅ Mutation success result:', result);
      console.log('✅ SUCCESS: Conversation created with ID:', result?.id);
    } catch (error: any) {
      console.error('💥 Mutation failed with full error details:', {
        message: error.message,
        data: error.data,
        shape: error.shape,
        stack: error.stack
      });
      
      // More specific error messages
      if (error.message?.includes('participantIds')) {
        toast.error('Invalid participant data. Please try again.');
      } else if (error.message?.includes('already exists')) {
        toast.error('Conversation already exists with this user');
      } else {
        toast.error(`Failed to create conversation: ${error.message || 'Unknown error'}`);
      }
    }
  }, [currentAccount, createConversationMutation]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <ThinkshareHeader onNewMessageClick={() => setShowNewConversationModal(true)} />

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

