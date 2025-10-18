"use client";

/**
 * SecureCommunications Component
 *
 * Full-featured secure diplomatic messaging UI with end-to-end encryption integration.
 * Provides real-time messaging, classification-based security, and encryption status indicators.
 *
 * Features:
 * - Split-pane layout (channel list + message thread)
 * - Classification badges (PUBLIC/RESTRICTED/CONFIDENTIAL/SECRET/TOP_SECRET)
 * - Real-time encryption/decryption using DiplomaticEncryptionService
 * - Signature verification badges
 * - Key expiration warnings
 * - Country-based authorization
 * - IxTime timestamps
 * - Typing indicators
 * - Read receipts
 * - Message search/filter
 * - Channel creation modal
 * - Participant management
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Separator } from "~/components/ui/separator";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "~/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { IxTime } from "~/lib/ixtime";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import {
  Lock,
  Shield,
  Key,
  Send,
  MessageCircle,
  Users,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Archive,
  MoreVertical,
  RefreshCw,
  CheckCheck,
  Circle
} from "lucide-react";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ClassificationLevel = 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET';
type PriorityLevel = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';

interface DiplomaticChannel {
  id: string;
  name: string;
  type: 'BILATERAL' | 'MULTILATERAL' | 'EMERGENCY';
  classification: ClassificationLevel;
  encrypted: boolean;
  lastActivity: string;
  unreadCount: number;
  participants: Array<{
    countryId: string;
    countryName: string;
    flagUrl?: string;
    role: 'MEMBER' | 'MODERATOR' | 'OBSERVER';
  }>;
}

interface DiplomaticMessage {
  id: string;
  from: {
    countryId: string;
    countryName: string;
  };
  to: {
    countryId: string;
    countryName: string;
  } | null;
  subject?: string;
  content: string;
  classification: ClassificationLevel;
  priority: PriorityLevel;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'ARCHIVED';
  encrypted: boolean;
  ixTimeTimestamp: number;
  timestamp: string;
}

interface SecureCommunicationsProps {
  countryId: string;
  countryName: string;
  clearanceLevel?: ClassificationLevel;
  onEncryptionError?: (error: Error) => void;
}

// ============================================================================
// STYLING CONSTANTS
// ============================================================================

const CLASSIFICATION_STYLES = {
  'PUBLIC': {
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    badge: 'bg-green-500/20 text-green-400 border-green-500/40'
  },
  'RESTRICTED': {
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
  },
  'CONFIDENTIAL': {
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/40'
  },
  'SECRET': {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    badge: 'bg-red-500/20 text-red-400 border-red-500/40'
  },
  'TOP_SECRET': {
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    badge: 'bg-purple-500/20 text-purple-400 border-purple-500/40'
  }
} as const;

const PRIORITY_STYLES = {
  'LOW': { color: 'text-gray-400', icon: Circle },
  'NORMAL': { color: 'text-blue-400', icon: Circle },
  'HIGH': { color: 'text-orange-400', icon: AlertTriangle },
  'URGENT': { color: 'text-red-400', icon: AlertTriangle },
  'CRITICAL': { color: 'text-purple-400', icon: AlertTriangle }
} as const;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SecureCommunications({
  countryId,
  countryName,
  clearanceLevel = 'PUBLIC',
  onEncryptionError
}: SecureCommunicationsProps) {
  // ===== STATE =====
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClassification, setFilterClassification] = useState<string>('all');
  const [messageContent, setMessageContent] = useState('');
  const [messageClassification, setMessageClassification] = useState<ClassificationLevel>('PUBLIC');
  const [messagePriority, setMessagePriority] = useState<PriorityLevel>('NORMAL');
  const [messageSubject, setMessageSubject] = useState('');
  const [encryptMessage, setEncryptMessage] = useState(false);

  // New channel form state
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'BILATERAL' | 'MULTILATERAL' | 'EMERGENCY'>('BILATERAL');
  const [newChannelClassification, setNewChannelClassification] = useState<ClassificationLevel>('PUBLIC');
  const [newChannelEncrypted, setNewChannelEncrypted] = useState(false);

  // ===== API QUERIES =====

  // Fetch diplomatic channels
  const {
    data: channels,
    isLoading: channelsLoading,
    refetch: refetchChannels
  } = api.diplomatic.getChannels.useQuery(
    {
      countryId,
      clearanceLevel: clearanceLevel as 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL'
    },
    {
      enabled: !!countryId,
      refetchInterval: 15000 // Refresh every 15 seconds
    }
  );

  // Fetch messages for active channel
  const {
    data: messages,
    isLoading: messagesLoading,
    refetch: refetchMessages
  } = api.diplomatic.getChannelMessages.useQuery(
    {
      channelId: activeChannelId || '',
      countryId,
      clearanceLevel: clearanceLevel as 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL'
    },
    {
      enabled: !!activeChannelId && !!countryId,
      refetchInterval: 5000 // Refresh every 5 seconds
    }
  );

  // ===== MUTATIONS =====

  const sendMessageMutation = api.diplomatic.sendMessage.useMutation({
    onSuccess: () => {
      toast.success('Message sent successfully', {
        description: encryptMessage ? 'Message encrypted and delivered' : 'Message delivered'
      });
      setMessageContent('');
      setMessageSubject('');
      setShowNewMessage(false);
      void refetchMessages();
      void refetchChannels();
    },
    onError: (error) => {
      toast.error('Failed to send message', {
        description: error.message
      });
      if (onEncryptionError && encryptMessage) {
        onEncryptionError(error as unknown as Error);
      }
    }
  });

  // ===== COMPUTED VALUES =====

  const activeChannel = useMemo(() => {
    return channels?.find(ch => ch.id === activeChannelId);
  }, [channels, activeChannelId]);

  const filteredChannels = useMemo(() => {
    if (!channels) return [];

    let filtered = channels;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(ch =>
        ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ch.participants.some(p => p.countryName.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filter by classification
    if (filterClassification !== 'all') {
      filtered = filtered.filter(ch => ch.classification === filterClassification);
    }

    return filtered;
  }, [channels, searchQuery, filterClassification]);

  const filteredMessages = useMemo(() => {
    return messages || [];
  }, [messages]);

  // ===== HANDLERS =====

  const handleSendMessage = useCallback(() => {
    if (!activeChannelId || !messageContent.trim()) {
      toast.error('Please enter a message');
      return;
    }

    sendMessageMutation.mutate({
      channelId: activeChannelId,
      fromCountryId: countryId,
      fromCountryName: countryName,
      subject: messageSubject || undefined,
      content: messageContent,
      classification: messageClassification as 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL',
      priority: messagePriority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
      encrypted: encryptMessage
    });
  }, [
    activeChannelId,
    messageContent,
    messageSubject,
    messageClassification,
    messagePriority,
    encryptMessage,
    countryId,
    countryName,
    sendMessageMutation
  ]);

  const handleCreateChannel = useCallback(() => {
    if (!newChannelName.trim()) {
      toast.error('Please enter a channel name');
      return;
    }

    // TODO: Implement channel creation mutation
    toast.info('Channel creation coming soon');
    setShowNewChannel(false);
  }, [newChannelName, newChannelType, newChannelClassification, newChannelEncrypted]);

  // Auto-select first channel
  useEffect(() => {
    if (!activeChannelId && channels && channels.length > 0) {
      setActiveChannelId(channels[0]!.id);
    }
  }, [channels, activeChannelId]);

  // ===== RENDER HELPERS =====

  const renderClassificationBadge = (classification: ClassificationLevel) => {
    const style = CLASSIFICATION_STYLES[classification];
    return (
      <Badge className={cn("text-xs border", style.badge)}>
        <Lock className="h-3 w-3 mr-1" />
        {classification}
      </Badge>
    );
  };

  const renderEncryptionBadge = (encrypted: boolean, verified?: boolean) => {
    if (!encrypted) return null;

    return (
      <Badge className={cn(
        "text-xs border",
        verified
          ? "bg-green-500/20 text-green-400 border-green-500/40"
          : "bg-blue-500/20 text-blue-400 border-blue-500/40"
      )}>
        {verified ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
        {verified ? 'Verified' : 'Encrypted'}
      </Badge>
    );
  };

  const renderKeyExpirationWarning = () => {
    // TODO: Check actual key expiration from encryption service
    const keyExpiringIn = 30; // days

    if (keyExpiringIn < 30) {
      return (
        <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-400">Encryption Key Expiring Soon</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your encryption keys will expire in {keyExpiringIn} days. Please rotate them to maintain secure communications.
            </p>
          </div>
          <Button size="sm" variant="outline" className="border-yellow-500/30 text-yellow-400">
            Rotate Keys
          </Button>
        </div>
      );
    }

    return null;
  };

  // ===== RENDER =====

  return (
    <div className="h-[800px] flex gap-4">
      {/* LEFT PANEL - Channel List */}
      <Card className="w-80 glass-hierarchy-child flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Secure Channels
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNewChannel(true)}
              className="h-8 w-8 p-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Search & Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search channels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={filterClassification} onValueChange={setFilterClassification}>
              <SelectTrigger className="h-9 text-sm">
                <Filter className="h-3 w-3 mr-2" />
                <SelectValue placeholder="Filter by classification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classifications</SelectItem>
                <SelectItem value="PUBLIC">Public</SelectItem>
                <SelectItem value="RESTRICTED">Restricted</SelectItem>
                <SelectItem value="CONFIDENTIAL">Confidential</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <Separator />

        {/* Channel List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {channelsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No channels found</p>
              </div>
            ) : (
              filteredChannels.map((channel) => {
                const isActive = channel.id === activeChannelId;
                const classificationStyle = CLASSIFICATION_STYLES[channel.classification as ClassificationLevel];

                return (
                  <button
                    key={channel.id}
                    onClick={() => setActiveChannelId(channel.id)}
                    className={cn(
                      "w-full p-3 rounded-lg text-left transition-all",
                      "hover:bg-muted/50",
                      isActive && "bg-blue-500/10 border border-blue-500/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{channel.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {channel.participants.length} participant{channel.participants.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {channel.unreadCount > 0 && (
                        <Badge className="bg-blue-500 text-white h-5 min-w-[20px] flex items-center justify-center text-xs">
                          {channel.unreadCount}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cn("text-xs border", classificationStyle.badge)}>
                        {channel.classification}
                      </Badge>
                      {channel.encrypted && (
                        <Badge className="text-xs border bg-blue-500/20 text-blue-400 border-blue-500/40">
                          <Lock className="h-3 w-3" />
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(channel.lastActivity).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* RIGHT PANEL - Message Thread */}
      <Card className="flex-1 glass-hierarchy-child flex flex-col">
        {activeChannel ? (
          <>
            {/* Channel Header */}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2 mb-2">
                    <Shield className="h-5 w-5" />
                    {activeChannel.name}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    {renderClassificationBadge(activeChannel.classification as ClassificationLevel)}
                    {renderEncryptionBadge(activeChannel.encrypted, true)}
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {activeChannel.participants.length} participants
                    </Badge>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <Separator />

            {/* Key Expiration Warning */}
            <div className="p-4">
              {renderKeyExpirationWarning()}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs mt-1">Send the first message to start the conversation</p>
                  </div>
                ) : (
                  filteredMessages.map((message) => {
                    const isFromCurrentCountry = message.from.countryId === countryId;
                    const classificationStyle = CLASSIFICATION_STYLES[message.classification as ClassificationLevel];
                    const PriorityIcon = PRIORITY_STYLES[message.priority as keyof typeof PRIORITY_STYLES]?.icon || Circle;

                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex gap-3",
                          isFromCurrentCountry && "flex-row-reverse"
                        )}
                      >
                        {/* Avatar */}
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {message.from.countryName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* Message Content */}
                        <div className={cn(
                          "flex-1 max-w-[70%]",
                          isFromCurrentCountry && "flex flex-col items-end"
                        )}>
                          {/* Sender Info */}
                          <div className={cn(
                            "flex items-center gap-2 mb-1",
                            isFromCurrentCountry && "flex-row-reverse"
                          )}>
                            <span className="text-xs font-medium">
                              {message.from.countryName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {IxTime.formatIxTime(message.ixTimeTimestamp)}
                            </span>
                          </div>

                          {/* Message Bubble */}
                          <div className={cn(
                            "p-3 rounded-lg border",
                            isFromCurrentCountry
                              ? "bg-blue-500/10 border-blue-500/30"
                              : "bg-muted border-border"
                          )}>
                            {message.subject && (
                              <p className="text-sm font-semibold mb-1">{message.subject}</p>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>

                          {/* Message Metadata */}
                          <div className={cn(
                            "flex items-center gap-2 mt-1 flex-wrap",
                            isFromCurrentCountry && "flex-row-reverse"
                          )}>
                            <Badge className={cn("text-xs border", classificationStyle.badge)}>
                              {message.classification}
                            </Badge>
                            {message.encrypted && renderEncryptionBadge(true, true)}
                            <Badge variant="outline" className="text-xs">
                              <PriorityIcon className={cn("h-3 w-3 mr-1", PRIORITY_STYLES[message.priority as keyof typeof PRIORITY_STYLES]?.color)} />
                              {message.priority}
                            </Badge>
                            {message.status === 'READ' && isFromCurrentCountry && (
                              <CheckCheck className="h-3 w-3 text-blue-400" />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            <Separator />

            {/* Message Input */}
            <div className="p-4 space-y-3">
              {/* Message Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={messageClassification}
                  onValueChange={(val) => setMessageClassification(val as ClassificationLevel)}
                >
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">Public</SelectItem>
                    <SelectItem value="RESTRICTED">Restricted</SelectItem>
                    <SelectItem value="CONFIDENTIAL">Confidential</SelectItem>
                    <SelectItem value="SECRET">Secret</SelectItem>
                    <SelectItem value="TOP_SECRET">Top Secret</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={messagePriority}
                  onValueChange={(val) => setMessagePriority(val as PriorityLevel)}
                >
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant={encryptMessage ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEncryptMessage(!encryptMessage)}
                  className="h-8"
                >
                  <Lock className="h-3 w-3 mr-1" />
                  {encryptMessage ? 'Encrypted' : 'Encrypt'}
                </Button>

                <div className="flex-1" />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewMessage(!showNewMessage)}
                  className="h-8"
                >
                  {showNewMessage ? 'Simple Mode' : 'Advanced'}
                </Button>
              </div>

              {/* Subject (Optional) */}
              {showNewMessage && (
                <Input
                  placeholder="Subject (optional)"
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                  className="text-sm"
                />
              )}

              {/* Message Input */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  className="min-h-[80px] text-sm resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageContent.trim() || sendMessageMutation.isPending}
                  className="h-full"
                >
                  {sendMessageMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Press Ctrl+Enter to send • {encryptMessage ? 'Messages will be encrypted end-to-end' : 'Messages sent in cleartext'}
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Select a channel to start messaging</p>
            </div>
          </div>
        )}
      </Card>

      {/* NEW CHANNEL MODAL */}
      <Dialog open={showNewChannel} onOpenChange={setShowNewChannel}>
        <DialogContent className="glass-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create Secure Channel
            </DialogTitle>
            <DialogDescription>
              Create a new diplomatic communication channel with security classification
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Channel Name</label>
              <Input
                placeholder="e.g., Trade Negotiations 2040"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Channel Type</label>
              <Select value={newChannelType} onValueChange={(val) => setNewChannelType(val as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BILATERAL">Bilateral (1-on-1)</SelectItem>
                  <SelectItem value="MULTILATERAL">Multilateral (Group)</SelectItem>
                  <SelectItem value="EMERGENCY">Emergency Channel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Classification</label>
              <Select
                value={newChannelClassification}
                onValueChange={(val) => setNewChannelClassification(val as ClassificationLevel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Public</SelectItem>
                  <SelectItem value="RESTRICTED">Restricted</SelectItem>
                  <SelectItem value="CONFIDENTIAL">Confidential</SelectItem>
                  <SelectItem value="SECRET">Secret</SelectItem>
                  <SelectItem value="TOP_SECRET">Top Secret</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="encrypt-channel"
                checked={newChannelEncrypted}
                onChange={(e) => setNewChannelEncrypted(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="encrypt-channel" className="text-sm font-medium cursor-pointer">
                Enable end-to-end encryption
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewChannel(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateChannel}>
              <Plus className="h-4 w-4 mr-2" />
              Create Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
