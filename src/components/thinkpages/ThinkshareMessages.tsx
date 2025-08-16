"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  X
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
  reactions?: any;
  mentions?: any;
  attachments?: any;
  replyTo?: any;
  readReceipts?: any[];
  isSystem?: boolean;
}

export function ThinkshareMessages({ countryId, countryName, userAccounts }: ThinkshareMessagesProps) {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const richTextEditorRef = useRef<RichTextEditorRef>(null);

  // Get current user's primary account
  const currentAccount = userAccounts?.[0];

  // Real-time WebSocket functionality
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
        refetchMessages();
        refetchConversations(); // Update conversation list for read status
      }
    },
    onConversationUpdate: (update) => {
      refetchConversations();
    },
    onPresenceUpdate: (update) => {
      // Presence updates will be reflected in the UI
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

  // API Queries with manual control - NO AUTO-ENABLE
  const shouldFetchConversations = hasValidProps && hasValidAccount && currentAccount?.id && currentAccount.id.trim() !== '';
  
  const { data: conversations, isLoading: isLoadingConversations, refetch: refetchConversations } = api.thinkpages.getConversations.useQuery({
    accountId: currentAccount?.id || 'INVALID'
  }, {
    enabled: false, // NEVER auto-enable
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  const { data: conversationMessages, isLoading: isLoadingMessages, refetch: refetchMessages } = api.thinkpages.getConversationMessages.useQuery({
    conversationId: selectedConversation || 'INVALID',
    accountId: currentAccount?.id || 'INVALID'
  }, {
    enabled: false, // NEVER auto-enable
    retry: 0,
    refetchOnWindowFocus: false
  });

  const { data: allAccounts, isLoading: isLoadingAccounts, refetch: refetchAccounts } = api.thinkpages.searchAccounts.useQuery({
    query: searchQuery || 'INVALID'
  }, {
    enabled: false, // NEVER auto-enable
    retry: 0,
    refetchOnWindowFocus: false
  });

  // Manual fetch control
  React.useEffect(() => {
    if (shouldFetchConversations) {
      refetchConversations();
    }
  }, [shouldFetchConversations, refetchConversations]);

  React.useEffect(() => {
    if (selectedConversation && selectedConversation.trim() !== '' && currentAccount?.id && currentAccount.id.trim() !== '') {
      refetchMessages();
      // Subscribe to real-time updates for this conversation
      subscribeToConversation(selectedConversation);
    }
  }, [selectedConversation, currentAccount?.id, refetchMessages, subscribeToConversation]);

  React.useEffect(() => {
    if (showNewConversationModal && searchQuery && searchQuery.length > 2) {
      // Add a small delay to avoid too many requests while typing
      const timeoutId = setTimeout(() => {
        if (searchQuery.length > 2) {
          refetchAccounts();
        }
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [showNewConversationModal, searchQuery, refetchAccounts]);

  // Mutations
  const createConversationMutation = api.thinkpages.createConversation.useMutation({
    onSuccess: (newConversation) => {
      toast.success('Conversation created successfully!');
      refetchConversations();
      setSelectedConversation(newConversation.id);
      setShowNewConversationModal(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create conversation');
    }
  });

  const sendMessageMutation = api.thinkpages.sendMessage.useMutation({
    onSuccess: () => {
      setMessageText('');
      refetchMessages();
      scrollToBottom();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send message');
    }
  });

  const markMessagesAsReadMutation = api.thinkpages.markMessagesAsRead.useMutation({
    onSuccess: () => {
      refetchConversations();
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
  }, [selectedConversation, currentAccount]);

  const handleSendMessage = useCallback((content?: string, plainText?: string) => {
    const finalContent = content || messageText;
    const finalPlainText = plainText || messageText;
    
    if (!finalPlainText.trim() || !selectedConversation || !currentAccount) return;

    sendMessageMutation.mutate({
      conversationId: selectedConversation,
      accountId: currentAccount.id,
      content: finalContent,
      messageType: content && content !== plainText ? 'text' : 'text' // Using 'text' as 'rich_text' is not in API schema
    });

    // Clear the simple input if used
    if (!content) {
      setMessageText('');
    }
  }, [messageText, selectedConversation, currentAccount, sendMessageMutation]);

  const handleCreateConversation = useCallback((participantId: string) => {
    if (!currentAccount) return;

    createConversationMutation.mutate({
      type: 'direct',
      participantIds: [currentAccount.id, participantId]
    });
  }, [currentAccount, createConversationMutation]);

  const selectedConv = conversations?.conversations.find(c => c.id === selectedConversation);
  const filteredConversations = conversations?.conversations.filter(conv => 
    searchQuery === '' || 
    conv.otherParticipants.some(p => 
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Check className="h-3 w-3 text-muted-foreground" />;
      case 'delivered': return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case 'read': return <CheckCheck className="h-3 w-3 text-blue-500" />;
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
                    filteredConversations.map((conversation) => (
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
                            {selectedConv.otherParticipants[0].account.displayName?.split(' ').map(n => n[0]).join('') || '??'}
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
                    <Button variant="ghost" size="sm">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Video className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
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
                      conversationMessages?.messages.map((message: ThinkshareMessage) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${message.accountId === currentAccount?.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] ${message.accountId === currentAccount?.id ? 'order-2' : 'order-1'}`}>
                            {message.accountId !== currentAccount?.id && (
                              <div className="flex items-center gap-2 mb-1">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={message.account.profileImageUrl || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {message.account.displayName.split(' ').map(n => n[0]).join('')}
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
                                  ? 'bg-primary text-primary-foreground ml-4'
                                  : 'bg-muted mr-4'
                              }`}
                            >
                              {message.messageType === 'rich_text' ? (
                                <div 
                                  className="text-sm prose prose-sm max-w-none prose-invert" 
                                  dangerouslySetInnerHTML={{ __html: message.content }}
                                />
                              ) : (
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              )}
                            </div>
                            
                            <div className={`flex items-center gap-1 mt-1 px-3 ${
                              message.accountId === currentAccount?.id ? 'justify-end' : 'justify-start'
                            }`}>
                              <span className="text-xs text-muted-foreground">
                                {new Date(message.ixTimeTimestamp).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </span>
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
                                    <Check className="h-3 w-3 text-muted-foreground" title="Delivered" />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
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
              <AvatarImage src={otherParticipant.account.profileImageUrl || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold">
                {otherParticipant.account.displayName.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            {/* Online indicator - enhanced with presence status */}
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
                  ? otherParticipant.account.displayName
                  : conversation.name || 'Group Chat'
                }
              </h4>
              {conversation.type === 'direct' && otherParticipant && 
                getAccountTypeIcon(otherParticipant.account.accountType)
              }
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {lastMessage && (
                <span className="text-xs text-muted-foreground">
                  {new Date(lastMessage.ixTimeTimestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
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
  onCreateConversation
}: {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  accounts: any[];
  isLoading: boolean;
  onCreateConversation: (accountId: string) => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center hs-overlay-backdrop-open:bg-black/50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md mx-4 max-h-[90vh] flex flex-col"
          >
            <div className="bg-neutral-900/50 border border-white/10 rounded-xl shadow-lg backdrop-blur-xl flex flex-col">
              {/* Header */}
              <div className="py-4 px-6 flex justify-between items-center border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Send className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Start New Conversation</h3>
                    <p className="text-sm text-neutral-400">
                      Search and message users
                    </p>
                  </div>
                </div>
                <button type="button" onClick={onClose} className="p-2 rounded-full text-neutral-400 hover:bg-white/10 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto overflow-x-visible space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for users..."
                    className="py-3 px-4 pl-10 block w-full bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto">
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                    </div>
                  ) : searchQuery.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400">
                      <UserPlus className="h-12 w-12 mx-auto mb-2" />
                      <p className="text-sm">Start typing to search for users</p>
                    </div>
                  ) : accounts.length === 0 ? (
                    <div className="text-center py-4 text-neutral-400">
                      <p className="text-sm">No users found</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {accounts.map((account) => (
                        <motion.div
                          key={account.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 rounded-lg hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors"
                          onClick={() => onCreateConversation(account.id)}
                        >
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full overflow-hidden border border-neutral-700">
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
                              <h4 className="font-medium text-sm text-white">{account.displayName}</h4>
                              {(() => {
                                switch (account.accountType) {
                                  case 'government': return <Crown className="h-3 w-3 text-amber-500" />;
                                  case 'media': return <Hash className="h-3 w-3 text-blue-500" />;
                                  case 'citizen': return <Globe className="h-3 w-3 text-green-500" />;
                                  default: return null;
                                }
                              })()}
                            </div>
                            <p className="text-xs text-neutral-400">@{account.username}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}