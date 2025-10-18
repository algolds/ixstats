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
  userId: string; // Changed to userId (clerkUserId)
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
    userId: string; // Changed from accountId to userId
    isActive: boolean;
  }[];
  lastMessage?: {
    id: string;
    userId: string; // Changed from accountId to userId
    content: string;
    ixTimeTimestamp: Date;
    createdAt?: Date;
  };
  lastReadAt?: Date;
  unreadCount: number;
}

// No longer using separate Account interface - using global User accounts

export function ThinkshareMessages({ userId, userAccounts = [] }: ThinkshareMessagesProps) {
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

  // Use the global user ID directly - no longer need thinkpages accounts for ThinkShare
  const currentUserId = userId;

  // Create currentAccount object for ChatArea
  const currentAccount = currentUserId ? {
    id: currentUserId,
    username: currentUserId, // fallback
    displayName: currentUserId, // fallback
    profileImageUrl: null,
    accountType: 'user'
  } : undefined;

  // Show error state if no user ID is provided
  if (!currentUserId) {
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
  const shouldFetchConversations = currentUserId && currentUserId.trim() !== '';
  
  // Use unified API that works with global users
  const { data: conversations, isLoading: isLoadingConversations, refetch: refetchConversations } = api.thinkpages.getConversations.useQuery({
    userId: currentUserId ?? 'INVALID'
  }, {
    enabled: Boolean(shouldFetchConversations), // Enable when we have valid user
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  // Only create query input when we have valid data
  const shouldFetchMessages = Boolean(
    selectedConversation &&
    selectedConversation.trim() !== '' &&
    currentUserId &&
    currentUserId.trim() !== ''
  );

  // Use skip pattern instead of enabled to prevent ANY query execution
  const conversationMessagesQuery = api.thinkpages.getConversationMessages.useQuery(
    {
      conversationId: selectedConversation || 'SKIP_QUERY',
      userId: currentUserId || 'SKIP_QUERY'
    },
    {
      enabled: shouldFetchMessages,
      refetchOnWindowFocus: false,
      retry: false,
      // Add staleTime to prevent unnecessary refetches
      staleTime: 5000,
    }
  );

  const conversationMessages = conversationMessagesQuery.data;
  const isLoadingMessages = conversationMessagesQuery.isLoading;
  const refetchMessages = conversationMessagesQuery.refetch;

  // Re-enable WebSocket for real-time ThinkShare
  const {
    clientState: rawClientState,
    sendTypingIndicator,
    subscribeToConversation,
    markMessageAsRead
  } = useThinkPagesWebSocket({
    accountId: currentUserId,
    autoReconnect: true,
    onMessageUpdate: (update) => {
      if (selectedConversation && update.conversationId === selectedConversation) {
        void refetchMessages();
      }
    },
    onConversationUpdate: () => {
      void refetchConversations();
    }
  });

  // Map ThinkPagesClientState to ThinkShareClientState
  const clientState = useMemo(() => ({
    presenceStatus: rawClientState.presenceStatus,
    typingIndicators: rawClientState.typingIndicators,
    connectionStatus: rawClientState.connected ? ('connected' as const) : ('disconnected' as const),
    lastSyncTime: new Date(rawClientState.lastHeartbeat),
    unreadCount: 0 // Track separately if needed
  }), [rawClientState]);

  // Search for other users to message
  const { data: allUsers, isLoading: isLoadingUsers } = api.thinkpages.searchUsers.useQuery({
    query: searchQuery ?? 'INVALID'
  }, {
    enabled: Boolean(showNewConversationModal && searchQuery && searchQuery.length > 2), // Only when searching
    retry: 1,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (selectedConversation && selectedConversation.trim() !== '' && currentAccount?.id && currentAccount.id.trim() !== '') {
      subscribeToConversation(selectedConversation);
    }
  }, [selectedConversation, currentAccount?.id, subscribeToConversation]);

  // Mutations
  const createConversationMutation = api.thinkpages.createConversation.useMutation();

  const markMessagesAsReadMutation = api.thinkpages.markMessagesAsRead.useMutation({
    onSuccess: () => {
      // Conversations will be refetched automatically to update read status
    }
  });

  const handleCreateConversation = async (participantId: string) => {
    console.log('🔧 handleCreateConversation called with:', { participantId, currentUserId });
    
    if (!currentUserId?.trim() || !participantId?.trim()) {
      toast.error('Invalid user or participant');
      return;
    }

    const participantIds = participantId === currentUserId 
      ? [currentUserId] // Self-message
      : [currentUserId, participantId]; // Regular conversation
    
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
        selectedAccount={currentUserId}
        onAccountChange={handleAccountChange}
      />

      {/* Main Chat Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Conversations List */}
        <div className="lg:col-span-4">
          <ConversationList
            conversations={(conversations?.conversations || []) as any}
            isLoadingConversations={isLoadingConversations}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedConversation={selectedConversation}
            setSelectedConversation={setSelectedConversation}
            currentAccountId={currentUserId || ''}
            onNewConversationClick={() => setShowNewConversationModal(true)}
            getAccountTypeIcon={getAccountTypeIcon}
            clientState={clientState as any}
          />
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-8">
          {selectedConv ? (
            <ChatArea
              selectedConversation={selectedConv as any}
              currentAccount={currentAccount as any}
              conversationMessages={conversationMessages as any}
              isLoadingMessages={isLoadingMessages}
              refetchMessages={refetchMessages}
              refetchConversations={refetchConversations}
              clientState={clientState as any}
              sendTypingIndicator={sendTypingIndicator}
              markMessagesAsReadMutation={markMessagesAsReadMutation as any}
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
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
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
        accounts={allUsers as any || []}
        isLoading={isLoadingUsers}
        onCreateConversation={handleCreateConversation}
        currentAccount={{ id: currentUserId } as any}
      />
    </div>
  );
}

