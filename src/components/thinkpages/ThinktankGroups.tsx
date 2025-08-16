"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, 
  Users, 
  Plus, 
  Search, 
  Crown, 
  Shield, 
  Briefcase,
  MessageSquare,
  TrendingUp,
  Lock,
  ChevronRight,
  Hash,
  Calendar,
  MapPin,
  Send,
  Smile,
  Paperclip,
  MoreHorizontal,
  Check,
  CheckCheck,
  Phone,
  Video,
  Settings,
  UserPlus,
  X,
  ArrowLeft,
  File,
  Edit3
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Separator } from '~/components/ui/separator';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { useThinkPagesWebSocket } from '~/hooks/useThinkPagesWebSocket';
import { Label } from '~/components/ui/label';
import RichTextEditor, { type RichTextEditorRef } from '~/components/thinkpages/RichTextEditor';
import { Textarea } from '~/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';

interface ThinktankGroupsProps {
  countryId: string;
  countryName: string;
  userAccounts: any[];
}

interface GroupChatMessage {
  id: string;
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
  reactions?: Record<string, number>;
  mentions?: string[];
  attachments?: any[];
  replyTo?: any;
  readReceipts?: any[];
}

interface ThinktankGroup {
  id: string;
  name: string;
  description?: string | null;
  avatar?: string | null;
  type: string;
  category?: string | null;
  tags?: string[];
  memberCount: number;
  createdBy: string;
  isActive: boolean;
  createdAt: Date;
  creator: any;
  members: any[];
  _count: {
    members: number;
    messages: number;
  };
  isJoined?: boolean;
}

const categories = ['All', 'Environment', 'Technology', 'Business', 'Healthcare', 'Culture', 'Education', 'Sports'];

export function ThinktankGroups({ countryId, countryName, userAccounts }: ThinktankGroupsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<'discover' | 'joined' | 'created'>('discover');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ThinktankGroup | null>(null);
  const [messageText, setMessageText] = useState('');
  const [view, setView] = useState<'list' | 'chat' | 'collaboration'>('list');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const richTextEditorRef = useRef<RichTextEditorRef>(null);

  // Get current user's primary account
  const currentAccount = userAccounts?.[0];

  // Real-time WebSocket functionality
  const { 
    clientState, 
    sendTypingIndicator, 
    subscribeToGroup, 
    markMessageAsRead 
  } = useThinkPagesWebSocket({
    accountId: currentAccount?.id,
    autoReconnect: true,
    onMessageUpdate: (update) => {
      if (selectedGroup && (update.groupId === selectedGroup.id)) {
        refetchMessages();
      }
    },
    onGroupUpdate: (update) => {
      refetchGroups();
    },
    onTypingUpdate: (update) => {
      // Typing indicators are handled in the hook state
    }
  });

  // Validate required props - more defensive check
  const hasValidProps = countryId && countryName && countryId.trim() !== '' && countryName.trim() !== '';
  
  // Early return if required props are missing
  if (!hasValidProps) {
    return (
      <div className="space-y-6">
        <Card className="glass-hierarchy-parent">
          <CardContent className="p-8 text-center">
            <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Loading...</h3>
            <p className="text-muted-foreground">
              Setting up your ThinkTanks experience
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // API Queries with defensive input validation - USE CONDITIONAL QUERY
  const shouldFetchGroups = hasValidProps && countryId && countryId.trim() !== '';
  
  const { data: groups, isLoading: isLoadingGroups, refetch: refetchGroups } = api.thinkpages.getThinktanksByCountry.useQuery({
    countryId: countryId || 'INVALID',
    type: activeTab === 'discover' ? 'all' : activeTab,
    accountId: currentAccount?.id || undefined
  }, {
    enabled: false, // NEVER auto-enable
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  // Manual fetch only when conditions are met
  React.useEffect(() => {
    if (shouldFetchGroups && countryId && countryId.trim() !== '') {
      refetchGroups();
    }
  }, [shouldFetchGroups, countryId, activeTab, currentAccount?.id, refetchGroups]);

  const { data: groupMessages, isLoading: isLoadingMessages, refetch: refetchMessages } = api.thinkpages.getThinktankMessages.useQuery(
    { groupId: selectedGroup?.id || 'INVALID' },
    { 
      enabled: false, // NEVER auto-enable
      retry: 0,
      refetchOnWindowFocus: false
    }
  );

  // Manual fetch for messages
  React.useEffect(() => {
    if (selectedGroup?.id && selectedGroup.id.trim() !== '' && view === 'chat') {
      refetchMessages();
      // Subscribe to real-time updates for this group
      subscribeToGroup(selectedGroup.id);
    }
  }, [selectedGroup?.id, view, refetchMessages, subscribeToGroup]);

  // Mutations
  const createGroupMutation = api.thinkpages.createThinktank.useMutation({
    onSuccess: () => {
      toast.success('ThinkTank created successfully!');
      refetchGroups();
      setShowCreateModal(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create ThinkTank');
    }
  });

  const joinGroupMutation = api.thinkpages.joinThinktank.useMutation({
    onSuccess: () => {
      toast.success('Joined ThinkTank successfully!');
      refetchGroups();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to join ThinkTank');
    }
  });

  const sendMessageMutation = api.thinkpages.sendThinktankMessage.useMutation({
    onSuccess: () => {
      setMessageText('');
      refetchMessages();
      scrollToBottom();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send message');
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [groupMessages?.messages]);

  const handleSendMessage = useCallback((content?: string, plainText?: string) => {
    const finalContent = content || messageText;
    const finalPlainText = plainText || messageText;
    
    if (!finalPlainText.trim() || !selectedGroup || !currentAccount) return;

    sendMessageMutation.mutate({
      groupId: selectedGroup.id,
      accountId: currentAccount.id,
      content: finalContent,
      messageType: content && content !== plainText ? 'text' : 'text' // Using 'text' as 'rich_text' is not in API schema
    });

    // Clear the simple input if used
    if (!content) {
      setMessageText('');
    }
  }, [messageText, selectedGroup, currentAccount, sendMessageMutation]);

  const handleJoinGroup = useCallback((groupId: string) => {
    if (!currentAccount) return;
    
    joinGroupMutation.mutate({
      groupId,
      accountId: currentAccount.id
    });
  }, [currentAccount, joinGroupMutation]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'public': return <Globe className="h-4 w-4 text-green-500" />;
      case 'private': return <Lock className="h-4 w-4 text-blue-500" />;
      case 'invite_only': return <Shield className="h-4 w-4 text-orange-500" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'public': return 'Public';
      case 'private': return 'Private';
      case 'invite_only': return 'Invite Only';
      default: return 'Unknown';
    }
  };

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

  const filteredGroups = groups?.filter(group => {
    const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         group.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (group.tags && group.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    const matchesCategory = selectedCategory === 'All' || group.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  if (view === 'chat' && selectedGroup) {
    return (
      <div className="space-y-6">
        {/* Chat Header */}
        <Card className="glass-hierarchy-parent overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 via-transparent to-yellow-600/10" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-yellow-500 to-orange-500" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setView('list');
                    setSelectedGroup(null);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedGroup.avatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold">
                    {selectedGroup.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    {selectedGroup.name}
                    {getTypeIcon(selectedGroup.type)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedGroup.memberCount} members • {selectedGroup._count.messages} messages
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView('collaboration')}
                >
                  <File className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                >
                  <Video className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chat Messages */}
        <Card className="glass-hierarchy-child h-[600px] flex flex-col">
          <div className="flex-1 p-4">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {isLoadingMessages ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  groupMessages?.messages.map((message: GroupChatMessage) => (
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
                              {/* Enhanced read receipts for groups */}
                              {message.readReceipts && message.readReceipts.length > 0 ? (
                                <div className="flex items-center gap-1" title={`Read by ${message.readReceipts.length} members`}>
                                  <CheckCheck className="h-3 w-3 text-orange-500" />
                                  {message.readReceipts.length > 1 && (
                                    <span className="text-xs text-orange-500 font-medium">
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
                
                {/* Enhanced Group Typing Indicators */}
                {Array.from(clientState.typingIndicators.values())
                  .filter(indicator => indicator.groupId === selectedGroup?.id && indicator.accountId !== currentAccount?.id)
                  .map(indicator => {
                    // In group chats, we can try to find member info
                    // For now, we'll use the account ID, but this could be enhanced with member lookup
                    const displayName = `User ${indicator.accountId.substring(0, 8)}...`;
                    
                    return (
                      <div key={indicator.id} className="flex justify-start">
                        <div className="max-w-[70%]">
                          <div className="flex items-center gap-2 mb-1">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                                {indicator.accountId.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground font-medium">
                              {displayName} is typing...
                            </span>
                          </div>
                          <div className="bg-muted mr-4 p-3 rounded-2xl">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-orange-500/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-2 h-2 bg-orange-500/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-2 h-2 bg-orange-500/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
                if (selectedGroup && clientState.connected) {
                  sendTypingIndicator(undefined, selectedGroup.id, isTyping);
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
      </div>
    );
  }

  if (view === 'collaboration' && selectedGroup) {
    return (
      <div className="space-y-6">
        {/* Collaboration Header */}
        <Card className="glass-hierarchy-parent overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-blue-600/10" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView('chat')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                
                <div className="h-10 w-10 bg-gradient-to-br from-purple-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <File className="h-5 w-5 text-white" />
                </div>
                
                <div>
                  <h3 className="font-semibold">
                    {selectedGroup.name} - Collaboration
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Lore writing and planning space
                  </p>
                </div>
              </div>
              
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                <Edit3 className="h-4 w-4 mr-2" />
                New Document
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Collaboration Space */}
        <Card className="glass-hierarchy-child h-[600px]">
          <CardContent className="p-8 text-center">
            <File className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Collaborative Documents</h3>
            <p className="text-muted-foreground mb-6">
              Create and edit shared documents for lore writing, planning, and strategy.
            </p>
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Create First Document
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="glass-hierarchy-parent overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 via-transparent to-yellow-600/10" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-yellow-500 to-orange-500" />
        <CardContent className="p-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-12 w-12 bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg flex items-center justify-center shadow-lg">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 h-4 w-4 bg-orange-500 rounded-full border-2 border-background animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent">
                  ThinkTanks
                </h2>
                <p className="text-sm text-muted-foreground">
                  Group discussions and collaboration spaces
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
            <CreateGroupModal 
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
              onCreateGroup={(data) => {
                if (!currentAccount) return;
                createGroupMutation.mutate({
                  ...data,
                  createdBy: currentAccount.id
                });
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <div className="flex items-center justify-between gap-4 mb-6">
          <TabsList className="glass-hierarchy-child p-1">
            <TabsTrigger value="joined" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Joined Groups
            </TabsTrigger>
            <TabsTrigger value="discover" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="created" className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Created
            </TabsTrigger>
          </TabsList>

          {/* Search and Filters */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search groups..."
                className="pl-10 w-64"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="joined" className="space-y-4">
          {isLoadingGroups ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredGroups.filter(g => g.isJoined).map(group => (
                <ThinktankCard 
                  key={group.id} 
                  group={group} 
                  onJoin={handleJoinGroup}
                  onEnter={(group) => {
                    setSelectedGroup(group);
                    setView('chat');
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="discover" className="space-y-4">
          {isLoadingGroups ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredGroups.map(group => (
                <ThinktankCard 
                  key={group.id} 
                  group={group} 
                  onJoin={handleJoinGroup}
                  onEnter={(group) => {
                    setSelectedGroup(group);
                    setView('chat');
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="created" className="space-y-4">
          {isLoadingGroups ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredGroups.length === 0 ? (
            <Card className="glass-hierarchy-child">
              <CardContent className="p-8 text-center">
                <Crown className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Created Groups</h3>
                <p className="text-muted-foreground mb-4">
                  Start your own community and bring together people who share your passions.
                </p>
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Group
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredGroups.map(group => (
                <ThinktankCard 
                  key={group.id} 
                  group={group} 
                  onJoin={handleJoinGroup}
                  onEnter={(group) => {
                    setSelectedGroup(group);
                    setView('chat');
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ThinktankCard({ 
  group, 
  onJoin, 
  onEnter 
}: { 
  group: ThinktankGroup;
  onJoin: (groupId: string) => void;
  onEnter: (group: ThinktankGroup) => void;
}) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'public': return <Globe className="h-4 w-4 text-green-500" />;
      case 'private': return <Lock className="h-4 w-4 text-blue-500" />;
      case 'invite_only': return <Shield className="h-4 w-4 text-orange-500" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'public': return 'Public';
      case 'private': return 'Private';
      case 'invite_only': return 'Invite Only';
      default: return 'Unknown';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="glass-hierarchy-child hover:glass-hierarchy-interactive transition-all duration-300 cursor-pointer group">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 border-2 border-background shadow-lg">
              <AvatarImage src={group.avatar} alt={group.name} />
              <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold">
                {group.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-sm truncate group-hover:text-orange-600 transition-colors">
                  {group.name}
                </h3>
              </div>
              
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                {group.description || 'No description available'}
              </p>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  {getTypeIcon(group.type)}
                  <span>{getTypeLabel(group.type)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>{group.memberCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  <span>{group._count.messages} messages</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {group.tags?.slice(0, 3).map((tag: string) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      <Hash className="h-2 w-2 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                  {group.category && (
                    <Badge variant="secondary" className="text-xs">
                      {group.category}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {group.isJoined ? (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEnter(group);
                      }}
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Enter
                    </Button>
                  ) : (
                    <Button 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onJoin(group.id);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Join
                    </Button>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-orange-600 transition-colors" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CreateGroupModal({
  isOpen,
  onClose,
  onCreateGroup
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (data: {
    name: string;
    description?: string;
    type: "public" | "private" | "invite_only";
    category?: string;
    tags?: string[];
  }) => void;
}) {
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    type: "public" | "private" | "invite_only";
    category: string;
    tags: string[];
  }>({
    name: '',
    description: '',
    type: 'public',
    category: '',
    tags: []
  });
  const [tagInput, setTagInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    onCreateGroup({
      name: formData.name,
      description: formData.description || undefined,
      type: formData.type,
      category: formData.category || undefined,
      tags: formData.tags.length > 0 ? formData.tags : undefined
    });

    // Reset form
    setFormData({
      name: '',
      description: '',
      type: 'public',
      category: '',
      tags: []
    });
    setTagInput('');
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

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
            className="relative w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
          >
            <div className="bg-neutral-900/50 border border-white/10 rounded-xl shadow-lg backdrop-blur-xl flex flex-col">
              {/* Header */}
              <div className="py-4 px-6 flex justify-between items-center border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                    <Users className="h-6 w-6 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Create New ThinkTank</h3>
                    <p className="text-sm text-neutral-400">
                      Start a discussion group
                    </p>
                  </div>
                </div>
                <button type="button" onClick={onClose} className="p-2 rounded-full text-neutral-400 hover:bg-white/10 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto overflow-x-visible">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-300">Group Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter group name..."
                      className="py-3 px-4 block w-full bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-orange-500 focus:ring-orange-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-300">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe your group's purpose..."
                      rows={3}
                      className="py-3 px-4 block w-full bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-orange-500 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-300">Privacy</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                      className="py-3 px-4 block w-full bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-orange-500 focus:ring-orange-500"
                    >
                      <option value="public">Public - Anyone can join</option>
                      <option value="private">Private - Approval required</option>
                      <option value="invite_only">Invite Only - Invitation required</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-300">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="py-3 px-4 block w-full bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-orange-500 focus:ring-orange-500"
                    >
                      <option value="">Select category</option>
                      {categories.filter(c => c !== 'All').map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-neutral-300">Tags</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="Add a tag..."
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        className="flex-1 py-2 px-3 bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-orange-500 focus:ring-orange-500"
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="py-2 px-3 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-white"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    {formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.tags.map(tag => (
                          <span
                            key={tag}
                            onClick={() => removeTag(tag)}
                            className="cursor-pointer inline-flex items-center gap-1 py-1 px-2 bg-orange-500/20 text-orange-400 rounded-full text-xs"
                          >
                            {tag}
                            <X className="h-3 w-3" />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end gap-2 pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="py-2 px-4 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-transparent bg-neutral-700 text-white hover:bg-neutral-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="py-2 px-4 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-transparent bg-gradient-to-r from-orange-600 to-yellow-600 text-white hover:from-orange-700 hover:to-yellow-700"
                    >
                      Create Group
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}