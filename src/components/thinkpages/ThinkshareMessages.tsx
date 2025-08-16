"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRelativeTime } from '~/hooks/useRelativeTime';
import { 
  Send, 
  MessageSquare, 
  Search, 
  Plus, 
  MoreHorizontal,
  Phone,
  Video,
  Paperclip,
  Smile,
  Image,
  Hash,
  Crown,
  Shield,
  Globe,
  Check,
  CheckCheck,
  Users,
  UserPlus,
  Settings,
  Loader2,
  X,
  Heart,
  Reply,
  Edit,
  Trash2
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Separator } from '~/components/ui/separator';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { useThinkPagesWebSocket } from '~/hooks/useThinkPagesWebSocket';
import { Label } from '~/components/ui/label';
import RichTextEditor, { type RichTextEditorRef } from '~/components/thinkpages/RichTextEditor';
import { BlurFade } from '~/components/magicui/blur-fade';

interface ThinkshareMessagesProps {
  countryId: string;
  countryName: string;
  userAccounts: any[];
}

function MessageTimestamp({ timestamp }: { timestamp: Date | string | number }) {
  const relativeTime = useRelativeTime(timestamp);
  const date = new Date(timestamp);
  const now = new Date();
  const hoursDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  return (
    <span 
      className="text-xs text-muted-foreground cursor-help" 
      title={`IxTime: ${date.toLocaleString()}`}
    >
      {hoursDiff > 24 ? date.toLocaleDateString() : relativeTime}
    </span>
  );
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

interface ThinkshareMessage {
  id: string;
  conversationId: string;
  accountId: string;
  account: {
    id: string;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
    accountType: string;
  };
  content: string;
  messageType: string;
  ixTimeTimestamp: Date;
  createdAt?: Date;
  reactions?: any;
  mentions?: any;
  attachments?: any;
  replyTo?: any;
  readReceipts?: any[];
  isSystem?: boolean;
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
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [showQuickReactions, setShowQuickReactions] = useState<string | null>(null); // messageId
  const [replyingToMessage, setReplyingToMessage] = useState<ThinkshareMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const richTextEditorRef = useRef<RichTextEditorRef>(null);

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

  // Real-time WebSocket functionality with enhanced error handling
  const { 
    clientState, 
    sendTypingIndicator, 
    subscribeToConversation, 
    markMessageAsRead 
  } = useThinkPagesWebSocket({
    accountId: currentAccount?.id,
    autoReconnect: true,
    onMessageUpdate: (update) => {
      if (selectedConversation && (update.conversationId === selectedConversation)) {
        void refetchMessages();
        void refetchConversations();
      }
    },
    onConversationUpdate: (update) => {
      void refetchConversations();
    },
    onPresenceUpdate: (update) => {
      // Enhanced presence handling - could add user online status indicators
      console.log('Presence update:', update);
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
      toast.error('Connection issue - trying to reconnect...');
    }
  });

  // Validate required props and account
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

  // API Queries with smart enabling for live functionality
  const shouldFetchConversations = hasValidProps && hasValidAccount && currentAccount?.id && currentAccount.id.trim() !== '';
  
  const { data: conversations, isLoading: isLoadingConversations, refetch: refetchConversations } = api.thinkpages.getConversations.useQuery({
    accountId: currentAccount?.id ?? 'INVALID'
  }, {
    enabled: Boolean(shouldFetchConversations), // Enable when we have valid data
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 30000,
    refetchInterval: 10000, // Refetch every 10 seconds for live updates
  });

  const { data: conversationMessages, isLoading: isLoadingMessages, refetch: refetchMessages } = api.thinkpages.getConversationMessages.useQuery({
    conversationId: selectedConversation ?? 'INVALID',
    accountId: currentAccount?.id ?? 'INVALID'
  }, {
    enabled: Boolean(selectedConversation && currentAccount?.id), // Enable when conversation is selected
    retry: 1,
    refetchOnWindowFocus: false,
    refetchInterval: 5000, // Refetch every 5 seconds for live messages
  });

  const { data: allAccounts, isLoading: isLoadingAccounts } = api.thinkpages.searchAccounts.useQuery({
    query: searchQuery ?? 'INVALID'
  }, {
    enabled: Boolean(showNewConversationModal && searchQuery && searchQuery.length > 2), // Only when searching
    retry: 1,
    refetchOnWindowFocus: false
  });

  // WebSocket subscription for real-time updates
  useEffect(() => {
    if (selectedConversation && selectedConversation.trim() !== '' && currentAccount?.id && currentAccount.id.trim() !== '') {
      // Subscribe to real-time updates for this conversation
      subscribeToConversation(selectedConversation);
    }
  }, [selectedConversation, currentAccount?.id, subscribeToConversation]);

  // Mutations
  const createConversationMutation = api.thinkpages.createConversation.useMutation({
    onSuccess: (newConversation: any) => {
      toast.success('Conversation created successfully!');
      setSelectedConversation(newConversation.id);
      setShowNewConversationModal(false);
      setSearchQuery(''); // Clear search
      void refetchConversations(); // Force refresh
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

  const sendMessageMutation = api.thinkpages.sendMessage.useMutation({
    onSuccess: () => {
      setMessageText('');
      // Clear rich text editor
      if (richTextEditorRef.current) {
        richTextEditorRef.current.clear();
      }
      scrollToBottom();
      // Force immediate refetch for better UX
      void refetchMessages();
      void refetchConversations(); // Update last message in conversation list
    },
    onError: (error: any) => {
      console.error('Send message error:', error);
      
      // Enhanced error handling
      let errorMessage = 'Failed to send message';
      if (error.message?.includes('conversation')) {
        errorMessage = 'Conversation not found or you\'re not a participant';
      } else if (error.message?.includes('content')) {
        errorMessage = 'Message content is invalid or too long';
      } else if (error.message?.includes('permission')) {
        errorMessage = 'You don\'t have permission to send messages in this conversation';
      }
      
      toast.error(errorMessage);
    }
  });

  const addReactionMutation = api.thinkpages.addReactionToMessage.useMutation({
    onSuccess: () => {
      refetchMessages();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add reaction');
    }
  });

  const removeReactionMutation = api.thinkpages.removeReactionFromMessage.useMutation({
    onSuccess: () => {
      refetchMessages();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove reaction');
    }
  });

  const editMessageMutation = api.thinkpages.editMessage.useMutation({
    onSuccess: () => {
      refetchMessages();
      toast.success('Message edited');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to edit message');
    }
  });

  const deleteMessageMutation = api.thinkpages.deleteMessage.useMutation({
    onSuccess: () => {
      refetchMessages();
      toast.success('Message deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete message');
    }
  });

  const markMessagesAsReadMutation = api.thinkpages.markMessagesAsRead.useMutation({
    onSuccess: () => {
      // Conversations will be refetched automatically to update read status
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversationMessages?.messages]);

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (selectedConversation && currentAccount) {
      markMessagesAsReadMutation.mutate({
        conversationId: selectedConversation,
        accountId: currentAccount.id
      });
    }
  }, [selectedConversation, currentAccount, markMessagesAsReadMutation]);

  const handleSendMessage = useCallback((content?: string, plainText?: string) => {
    const finalContent = content || messageText;
    const finalPlainText = plainText || messageText;
    
    if (!finalPlainText.trim() || !selectedConversation || !currentAccount) return;

    sendMessageMutation.mutate({
      conversationId: selectedConversation,
      accountId: currentAccount.id,
      content: finalContent,
      messageType: 'text' // Only allowed values: 'file' | 'system' | 'text' | 'image'
    });

    // Clear the simple input if used and reply state
    if (!content) {
      setMessageText('');
    }
    setReplyingToMessage(null);
  }, [messageText, selectedConversation, currentAccount, sendMessageMutation]);

  const handleCreateConversation = useCallback((participantId: string) => {
    console.log('handleCreateConversation called with:', { participantId, currentAccount: currentAccount?.id });
    
    if (!currentAccount?.id?.trim()) {
      console.error('No current account available');
      toast.error('No account selected. Please select an account first.');
      return;
    }
    
    if (!participantId?.trim()) {
      console.error('No participant ID provided');
      toast.error('Invalid participant ID');
      return;
    }

    // Enhanced participant validation
    const participantIds = participantId === currentAccount.id 
      ? [currentAccount.id] // Self-message for testing
      : [currentAccount.id, participantId];

    // Validate participant IDs
    const validParticipantIds = participantIds.filter(id => id && id.trim() !== '');
    if (validParticipantIds.length === 0) {
      toast.error('Invalid participants');
      return;
    }

    const mutationInput = {
      type: 'direct' as const,
      participantIds: validParticipantIds
    };
    
    console.log('Creating conversation with input:', mutationInput);
    createConversationMutation.mutate(mutationInput);
  }, [currentAccount, createConversationMutation]);

  const selectedConv = conversations?.conversations.find((c: ThinkshareConversation) => c.id === selectedConversation);
  const filteredConversations = conversations?.conversations.filter((conv: ThinkshareConversation) => 
    searchQuery === '' || 
    conv.otherParticipants.some((p: any) => 
      p.account.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.account.username.toLowerCase().includes(searchQuery.toLowerCase())
    ) ||
    (conv.name && conv.name.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  const getAccountTypeIcon = (accountType: string) => {
    switch (accountType) {
      case 'government': return <Crown className="h-3 w-3 text-amber-500" />;
      case 'media': return <Hash className="h-3 w-3 text-blue-500" />;
      case 'citizen': return <Globe className="h-3 w-3 text-green-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="glass-hierarchy-parent overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-green-600/10 via-transparent to-emerald-600/10" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500" />
        <CardContent className="p-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-12 w-12 bg-gradient-to-br from-green-600 to-emerald-700 rounded-lg flex items-center justify-center shadow-lg">
                  <Send className="h-6 w-6 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  ThinkShare
                </h2>
                <p className="text-sm text-muted-foreground">
                  Private messaging • Connect with minds worldwide
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setShowNewConversationModal(true)}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Message
            </Button>
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
        </CardContent>
      </Card>

      {/* Main Chat Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Conversations List */}
        <div className="lg:col-span-4">
          <Card className="glass-hierarchy-child h-[700px] flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Messages</h3>
                <Button 
                  size="sm" 
                  onClick={() => setShowNewConversationModal(true)}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="pl-10"
                />
              </div>
            </CardHeader>
            
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="px-4 pb-4 space-y-2">
                  {isLoadingConversations ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No Thinkshares yet</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowNewConversationModal(true)}
                        className="mt-2"
                      >
                        Start a thinkshare
                      </Button>
                    </div>
                  ) : (
                    filteredConversations.map((conversation: ThinkshareConversation) => (
                      <ConversationCard
                        key={conversation.id}
                        conversation={conversation}
                        isSelected={selectedConversation === conversation.id}
                        onClick={() => setSelectedConversation(conversation.id)}
                        currentAccountId={currentAccount?.id || ''}
                        getAccountTypeIcon={getAccountTypeIcon}
                        clientState={clientState}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </Card>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-8">
          {selectedConv ? (
            <Card className="glass-hierarchy-child h-[700px] flex flex-col">
              {/* Chat Header */}
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {selectedConv.type === 'direct' && selectedConv.otherParticipants.length > 0 && selectedConv.otherParticipants[0] ? (
                      <>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={selectedConv.otherParticipants[0].account.profileImageUrl || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold">
                            {selectedConv.otherParticipants[0].account.displayName?.split(' ').map((n: string) => n[0]).join('') || '??'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold flex items-center gap-2">
                            {selectedConv.otherParticipants[0].account.displayName}
                            {getAccountTypeIcon(selectedConv.otherParticipants[0].account.accountType)}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            @{selectedConv.otherParticipants[0].account.username}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={selectedConv.avatar || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold">
                            <Users className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">{selectedConv.name || 'Group Chat'}</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedConv.otherParticipants.length + 1} members
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      title="Search in conversation"
                      onClick={() => {
                        console.log('Search in conversation');
                      }}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      title="Conversation info"
                      onClick={() => {
                        console.log('Show conversation info');
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      title="More options"
                      onClick={() => {
                        console.log('More options');
                      }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <Separator />

              {/* Messages */}
              <div className="flex-1 p-4">
                <ScrollArea className="h-full">
                  <div className="space-y-4">
                    {isLoadingMessages ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      conversationMessages?.messages.map((message: ThinkshareMessage, index: number) => (
                        <BlurFade 
                          key={message.id}
                          delay={0.02 * index}
                          direction="up"
                          className={`flex group ${message.accountId === currentAccount?.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] ${message.accountId === currentAccount?.id ? 'order-2' : 'order-1'}`}>
                            {message.accountId !== currentAccount?.id && (
                              <div className="flex items-center gap-2 mb-1">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={message.account.profileImageUrl || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {message.account.displayName.split(' ').map((n: string) => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground font-medium">
                                  {message.account.displayName}
                                </span>
                                {getAccountTypeIcon(message.account.accountType)}
                              </div>
                            )}
                            
                            <div
                              className={`p-3 rounded-2xl ${
                                message.accountId === currentAccount?.id
                                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white ml-4'
                                  : 'bg-background/50 border border-blue-200/30 dark:border-blue-800/30 mr-4'
                              }`}
                            >
                              {message.messageType === 'rich_text' ? (
                                <div 
                                  className="text-sm [&_img]:inline-block [&_img]:h-5 [&_img]:w-5 [&_img]:mx-1 [&_img]:align-middle" 
                                  dangerouslySetInnerHTML={{ __html: message.content }}
                                />
                              ) : (
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              )}
                            </div>
                            
                            {/* Message Actions - Reply, React, etc. */}
                            <div className={`flex items-center gap-1 mt-1 px-3 ${
                              message.accountId === currentAccount?.id ? 'justify-end' : 'justify-start'
                            }`}>
                              {/* Action buttons - visible on hover */}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mr-2">
                                <div className="relative">
                                  <button
                                    className="p-1 rounded-full hover:bg-accent transition-colors"
                                    title="React"
                                    onClick={() => {
                                      setShowQuickReactions(showQuickReactions === message.id ? null : message.id);
                                    }}
                                  >
                                    <Heart className="h-3 w-3" />
                                  </button>
                                  
                                  {/* Quick Reactions Popup */}
                                  {showQuickReactions === message.id && (
                                    <div className="absolute bottom-full left-0 mb-2 p-2 bg-background border rounded-lg shadow-lg z-10 flex gap-1">
                                      {['❤️', '👍', '👎', '😂', '😮', '😢', '😡'].map((emoji) => (
                                        <button
                                          key={emoji}
                                          className="p-1 hover:bg-accent rounded transition-colors text-lg"
                                          onClick={() => {
                                            if (!currentAccount) return;
                                            addReactionMutation.mutate({ messageId: message.id, accountId: currentAccount.id, reaction: emoji });
                                            setShowQuickReactions(null);
                                          }}
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button
                                  className="p-1 rounded-full hover:bg-accent transition-colors"
                                  title="Reply"
                                  onClick={() => {
                                    setReplyingToMessage(message);
                                    richTextEditorRef.current?.focus();
                                  }}
                                >
                                  <Reply className="h-3 w-3" />
                                </button>
                                {message.accountId === currentAccount?.id && (
                                  <>
                                    <button
                                      className="p-1 rounded-full hover:bg-accent transition-colors"
                                      title="Edit"
                                      onClick={() => {
                                        const newContent = prompt('Edit your message:', message.content);
                                        if (newContent) {
                                          editMessageMutation.mutate({ messageId: message.id, content: newContent });
                                        }
                                      }}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </button>
                                    <button
                                      className="p-1 rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
                                      title="Delete"
                                      onClick={() => {
                                        if (confirm('Are you sure you want to delete this message?')) {
                                          deleteMessageMutation.mutate({ messageId: message.id });
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            {/* Reactions Display */}
                            {message.reactions && Object.keys(message.reactions).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 px-3">
                                {Object.entries(message.reactions).map(([emoji, count]) => (
                                  <button
                                    key={emoji}
                                    className="flex items-center gap-1 px-2 py-1 bg-accent/50 hover:bg-accent rounded-full text-xs transition-colors"
                                    onClick={() => {
                                      if (!currentAccount) return;
                                      removeReactionMutation.mutate({ messageId: message.id, reaction: emoji });
                                    }}
                                  >
                                    <span>{emoji}</span>
                                    <span className="text-muted-foreground">{count as number}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            
                            <div className={`flex items-center gap-1 mt-1 px-3 ${
                              message.accountId === currentAccount?.id ? 'justify-end' : 'justify-start'
                            }`}>
                              <MessageTimestamp timestamp={message.createdAt || message.ixTimeTimestamp} />
                              {message.accountId === currentAccount?.id && (
                                <div className="flex items-center gap-1">
                                  {/* Enhanced read receipts */}
                                  {message.readReceipts && message.readReceipts.length > 0 ? (
                                    <div className="flex items-center gap-1" title={`Read by ${message.readReceipts.length} people`}>
                                      <CheckCheck className="h-3 w-3 text-blue-500" />
                                      {message.readReceipts.length > 1 && (
                                        <span className="text-xs text-blue-500 font-medium">
                                          {message.readReceipts.length}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <Check className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </BlurFade>
                      ))
                    )}
                    
                    {/* Enhanced Typing Indicators */}
                    {Array.from(clientState.typingIndicators.values())
                      .filter(indicator => indicator.conversationId === selectedConversation && indicator.accountId !== currentAccount?.id)
                      .map(indicator => {
                        // Find the participant info from the conversation
                        const participant = selectedConv?.otherParticipants.find(p => p.accountId === indicator.accountId);
                        const displayName = participant?.account.displayName || 'Someone';
                        const profileImage = participant?.account.profileImageUrl;
                        
                        return (
                          <div key={indicator.id} className="flex justify-start">
                            <div className="max-w-[70%]">
                              <div className="flex items-center gap-2 mb-1">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={profileImage || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {displayName.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground font-medium">
                                  {displayName} is typing...
                                </span>
                                {participant && getAccountTypeIcon(participant.account.accountType)}
                              </div>
                              <div className="bg-muted mr-4 p-3 rounded-2xl">
                                <div className="flex gap-1">
                                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </div>

              <Separator />

              {/* Reply Preview */}
              {replyingToMessage && (
                <div className="px-4 pt-3 pb-0">
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border-l-4 border-primary">
                    <Reply className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">
                        Replying to {replyingToMessage.account.displayName}
                      </p>
                      <p className="text-sm truncate">
                        {replyingToMessage.content.replace(/<[^>]*>/g, '').substring(0, 50)}...
                      </p>
                    </div>
                    <button
                      onClick={() => setReplyingToMessage(null)}
                      className="p-1 hover:bg-accent rounded transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Rich Text Message Input */}
              <div className="p-4">
                <RichTextEditor
                  ref={richTextEditorRef}
                  placeholder="Type a message..."
                  onSubmit={handleSendMessage}
                  onTyping={(isTyping) => {
                    if (selectedConversation && clientState.connected) {
                      sendTypingIndicator(selectedConversation, undefined, isTyping);
                    }
                  }}
                  disabled={sendMessageMutation.isPending}
                  minHeight={60}
                  maxHeight={150}
                  showToolbar={true}
                  submitButtonText="Send"
                  className="w-full"
                />
              </div>
            </Card>
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
    </div>
  );
}

function ConversationCard({
  conversation,
  isSelected,
  onClick,
  currentAccountId,
  getAccountTypeIcon,
  clientState
}: {
  conversation: ThinkshareConversation;
  isSelected: boolean;
  onClick: () => void;
  currentAccountId: string;
  getAccountTypeIcon: (type: string) => React.ReactNode;
  clientState: any;
}) {
  const otherParticipant = conversation.otherParticipants[0];
  const lastMessage = conversation.lastMessage;
  const hasUnread = conversation.unreadCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-primary/10 border border-primary/20' 
          : 'hover:bg-muted/50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {conversation.type === 'direct' && otherParticipant ? (
          <div className="relative">
            <Avatar className="h-12 w-12">
              {otherParticipant.accountId === currentAccountId ? (
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                  <MessageSquare className="h-6 w-6" />
                </AvatarFallback>
              ) : (
                <>
                  <AvatarImage src={otherParticipant.account.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold">
                    {otherParticipant.account.displayName.split(' ').map((n: string) => n[0]).join('')}
                  </AvatarFallback>
                </>
              )}
            </Avatar>
            {/* Online indicator - enhanced with presence status */}
            {otherParticipant.accountId !== currentAccountId && (
              <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background ${
                clientState.presenceStatus === 'online' ? 'bg-green-500 animate-pulse' : 
                clientState.presenceStatus === 'away' ? 'bg-yellow-500' :
                clientState.presenceStatus === 'busy' ? 'bg-red-500' :
                'bg-gray-400'
              }`} title={
                clientState.presenceStatus === 'online' ? 'Online' :
                clientState.presenceStatus === 'away' ? 'Away' :
                clientState.presenceStatus === 'busy' ? 'Busy' :
                'Offline'
              } />
            )}
          </div>
        ) : (
          <Avatar className="h-12 w-12">
            <AvatarImage src={conversation.avatar || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold">
              <Users className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <h4 className="font-medium text-sm truncate">
                    {conversation.type === 'direct' && otherParticipant
                      ? (otherParticipant.accountId === currentAccountId ? 'Notes (Self-Chat)' : otherParticipant.account.displayName)
                      : conversation.name || 'Group Chat'
                    }
                  </h4>
              {conversation.type === 'direct' && otherParticipant && 
                getAccountTypeIcon(otherParticipant.account.accountType)
              }
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {lastMessage && (
                <MessageTimestamp timestamp={lastMessage.createdAt || lastMessage.ixTimeTimestamp} />
              )}
              {hasUnread && (
                <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs bg-primary text-primary-foreground">
                  {conversation.unreadCount}
                </Badge>
              )}
            </div>
          </div>
          
          {lastMessage && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {lastMessage.accountId === currentAccountId ? 'You: ' : ''}
              {lastMessage.content}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function NewConversationModal({
  isOpen,
  onClose,
  searchQuery,
  setSearchQuery,
  accounts,
  isLoading,
  onCreateConversation,
  currentAccount,
}: {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  accounts: Account[];
  isLoading: boolean;
  onCreateConversation: (accountId: string) => void;
  currentAccount?: Account;
}) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Send className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <DialogTitle className="text-lg">Start New Conversation</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Search and message users
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="p-6 overflow-y-auto overflow-x-visible space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for users..."
              className="pl-10"
            />
          </div>

          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : searchQuery.length === 0 ? (
              <div className="space-y-4">
                <div className="text-center py-4 text-muted-foreground">
                  <UserPlus className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Start typing to search for users</p>
                  <p className="text-xs mt-1">You can search by name or @username</p>
                </div>
                
                {currentAccount && <div className="border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Quick Actions:</p>
                  <div
                    className="p-3 rounded-lg hover:bg-muted cursor-pointer flex items-center gap-3 transition-colors border border-border"
                    onClick={() => {
                      if (currentAccount) {
                        onCreateConversation(currentAccount.id);
                      }
                    }}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm">
                        📝
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">Message Myself</h4>
                        <span className="text-xs text-muted-foreground">(Notes & Testing)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Create a personal chat for notes and testing</p>
                    </div>
                  </div>
                </div>}
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p className="text-sm">No users found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="p-3 rounded-lg hover:bg-muted cursor-pointer flex items-center gap-3 transition-colors"
                    onClick={() => onCreateConversation(account.id)}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-border">
                        {account.profileImageUrl ? (
                          <img src={account.profileImageUrl} alt={account.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm">
                            {account.displayName.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">{account.displayName}</h4>
                        {(() => {
                          switch (account.accountType) {
                            case 'government': return <Crown className="h-3 w-3 text-amber-500" />;
                            case 'media': return <Hash className="h-3 w-3 text-blue-500" />;
                            case 'citizen': return <Globe className="h-3 w-3 text-green-500" />;
                            default: return null;
                          }
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground">@{account.username}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
