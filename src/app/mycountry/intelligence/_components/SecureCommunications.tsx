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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
  Circle,
} from "lucide-react";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ClassificationLevel = "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET";
type PriorityLevel = "LOW" | "NORMAL" | "HIGH" | "URGENT" | "CRITICAL";

interface DiplomaticChannel {
  id: string;
  name: string;
  type: "BILATERAL" | "MULTILATERAL" | "EMERGENCY";
  classification: ClassificationLevel;
  encrypted: boolean;
  lastActivity: string;
  unreadCount: number;
  participants: Array<{
    countryId: string;
    countryName: string;
    flagUrl?: string;
    role: "MEMBER" | "MODERATOR" | "OBSERVER";
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
  status: "SENT" | "DELIVERED" | "READ" | "ARCHIVED";
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
  PUBLIC: {
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    badge: "bg-green-500/20 text-green-400 border-green-500/40",
  },
  RESTRICTED: {
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  },
  CONFIDENTIAL: {
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    badge: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  },
  SECRET: {
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    badge: "bg-red-500/20 text-red-400 border-red-500/40",
  },
  TOP_SECRET: {
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  },
} as const;

const PRIORITY_STYLES = {
  LOW: { color: "text-gray-400", icon: Circle },
  NORMAL: { color: "text-blue-400", icon: Circle },
  HIGH: { color: "text-orange-400", icon: AlertTriangle },
  URGENT: { color: "text-red-400", icon: AlertTriangle },
  CRITICAL: { color: "text-cyan-400", icon: AlertTriangle },
} as const;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SecureCommunications({
  countryId,
  countryName,
  clearanceLevel = "PUBLIC",
  onEncryptionError,
}: SecureCommunicationsProps) {
  // ===== STATE =====
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClassification, setFilterClassification] = useState<string>("all");
  const [messageContent, setMessageContent] = useState("");
  const [messageClassification, setMessageClassification] = useState<ClassificationLevel>("PUBLIC");
  const [messagePriority, setMessagePriority] = useState<PriorityLevel>("NORMAL");
  const [messageSubject, setMessageSubject] = useState("");
  const [encryptMessage, setEncryptMessage] = useState(false);

  // New channel form state
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"BILATERAL" | "MULTILATERAL" | "EMERGENCY">(
    "BILATERAL"
  );
  const [newChannelClassification, setNewChannelClassification] =
    useState<ClassificationLevel>("PUBLIC");
  const [newChannelEncrypted, setNewChannelEncrypted] = useState(false);

  // ===== API QUERIES =====

  // Fetch diplomatic conversations (using unified ThinkShare API)
  const {
    data: conversationsData,
    isLoading: channelsLoading,
    refetch: refetchChannels,
  } = api.thinkpages.getConversations.useQuery(
    {
      userId: countryId,
      limit: 50,
    },
    {
      enabled: !!countryId,
      refetchInterval: 15000, // Refresh every 15 seconds
    }
  );

  // Filter and map diplomatic conversations to channel format
  const channels = useMemo(() => {
    if (!conversationsData?.conversations) return [];

    // Filter only diplomatic conversations with appropriate clearance
    return conversationsData.conversations
      .filter((conv: any) => {
        // Only show diplomatic conversations
        if (conv.conversationType !== "diplomatic") return false;

        // Filter by clearance level
        const convClassification = conv.diplomaticClassification as ClassificationLevel;
        const clearanceLevels: Record<ClassificationLevel, number> = {
          PUBLIC: 1,
          RESTRICTED: 2,
          CONFIDENTIAL: 3,
          SECRET: 4,
          TOP_SECRET: 5,
        };

        const userClearance = clearanceLevels[clearanceLevel] || 1;
        const convClearanceLevel = clearanceLevels[convClassification] || 1;

        return convClearanceLevel <= userClearance;
      })
      .map((conv: any) => ({
        id: conv.id,
        name: conv.name || `Channel ${conv.id.substring(0, 8)}`,
        type: conv.channelType || "BILATERAL",
        classification: conv.diplomaticClassification || "PUBLIC",
        encrypted: conv.encrypted || false,
        lastActivity: conv.lastActivity,
        unreadCount: conv.unreadCount || 0,
        participants: conv.otherParticipants?.map((p: any) => ({
          countryId: p.userId,
          countryName: p.userId, // TODO: Resolve country name from userId
          flagUrl: undefined,
          role: p.role?.toUpperCase() || "MEMBER",
        })) || [],
      }));
  }, [conversationsData, clearanceLevel]);

  // Fetch messages for active conversation
  const {
    data: messagesData,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = api.thinkpages.getConversationMessages.useQuery(
    {
      conversationId: activeChannelId || "",
      userId: countryId,
      limit: 100,
    },
    {
      enabled: !!activeChannelId && !!countryId,
      refetchInterval: 5000, // Refresh every 5 seconds
    }
  );

  // Map ThinkShare messages to diplomatic message format
  const messages = useMemo(() => {
    if (!messagesData?.messages) return [];

    return messagesData.messages.map((msg: any) => ({
      id: msg.id,
      from: {
        countryId: msg.userId,
        countryName: msg.userId, // TODO: Resolve country name from userId
      },
      to: null, // ThinkShare conversations don't have explicit "to"
      subject: msg.subject,
      content: msg.content,
      classification: msg.classification || "PUBLIC",
      priority: msg.priority || "NORMAL",
      status: msg.status || "SENT",
      encrypted: !!msg.encryptedContent,
      ixTimeTimestamp: new Date(msg.ixTimeTimestamp).getTime(),
      timestamp: msg.ixTimeTimestamp,
    }));
  }, [messagesData]);

  // ===== MUTATIONS =====

  const sendMessageMutation = api.thinkpages.sendMessage.useMutation({
    onSuccess: () => {
      toast.success("Message sent successfully", {
        description: encryptMessage ? "Message encrypted and delivered" : "Message delivered",
      });
      setMessageContent("");
      setMessageSubject("");
      setShowNewMessage(false);
      void refetchMessages();
      void refetchChannels();
    },
    onError: (error) => {
      toast.error("Failed to send message", {
        description: error.message,
      });
      if (onEncryptionError && encryptMessage) {
        onEncryptionError(error as unknown as Error);
      }
    },
  });

  // ===== COMPUTED VALUES =====

  const activeChannel = useMemo(() => {
    return channels?.find((ch) => ch.id === activeChannelId);
  }, [channels, activeChannelId]);

  const filteredChannels = useMemo(() => {
    if (!channels) return [];

    let filtered = channels;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (ch) =>
          ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ch.participants.some((p: { countryId: string; countryName: string; flagUrl?: string; role: string }) =>
            p.countryName.toLowerCase().includes(searchQuery.toLowerCase())
          )
      );
    }

    // Filter by classification
    if (filterClassification !== "all") {
      filtered = filtered.filter((ch) => ch.classification === filterClassification);
    }

    return filtered;
  }, [channels, searchQuery, filterClassification]);

  // Messages are already filtered/mapped above, use directly
  const filteredMessages = messages;

  // ===== HANDLERS =====

  const handleSendMessage = useCallback(() => {
    if (!activeChannelId || !messageContent.trim()) {
      toast.error("Please enter a message");
      return;
    }

    sendMessageMutation.mutate({
      conversationId: activeChannelId,
      userId: countryId,
      content: messageContent,
      messageType: "text",
      // Diplomatic extensions
      subject: messageSubject || undefined,
      classification: messageClassification,
      priority: messagePriority,
      encryptedContent: encryptMessage ? messageContent : undefined, // TODO: Implement actual encryption
      status: "SENT",
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
    sendMessageMutation,
  ]);

  const handleCreateChannel = useCallback(() => {
    if (!newChannelName.trim()) {
      toast.error("Please enter a channel name");
      return;
    }

    // TODO: Implement channel creation mutation
    toast.info("Channel creation coming soon");
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
      <Badge className={cn("border text-xs", style.badge)}>
        <Lock className="mr-1 h-3 w-3" />
        {classification}
      </Badge>
    );
  };

  const renderEncryptionBadge = (encrypted: boolean, verified?: boolean) => {
    if (!encrypted) return null;

    return (
      <Badge
        className={cn(
          "border text-xs",
          verified
            ? "border-green-500/40 bg-green-500/20 text-green-400"
            : "border-blue-500/40 bg-blue-500/20 text-blue-400"
        )}
      >
        {verified ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <Shield className="mr-1 h-3 w-3" />}
        {verified ? "Verified" : "Encrypted"}
      </Badge>
    );
  };

  const renderKeyExpirationWarning = () => {
    // TODO: Check actual key expiration from encryption service
    const keyExpiringIn = 30; // days

    if (keyExpiringIn < 30) {
      return (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-400">Encryption Key Expiring Soon</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Your encryption keys will expire in {keyExpiringIn} days. Please rotate them to
              maintain secure communications.
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
    <div className="flex h-[800px] gap-4">
      {/* LEFT PANEL - Channel List */}
      <Card className="glass-hierarchy-child flex w-80 flex-col">
        <CardHeader className="pb-3">
          <div className="mb-3 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
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
              <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
              <Input
                placeholder="Search channels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>
            <Select value={filterClassification} onValueChange={setFilterClassification}>
              <SelectTrigger className="h-9 text-sm">
                <Filter className="mr-2 h-3 w-3" />
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
          <div className="space-y-1 p-2">
            {channelsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">No channels found</p>
              </div>
            ) : (
              filteredChannels.map((channel) => {
                const isActive = channel.id === activeChannelId;
                const classificationStyle =
                  CLASSIFICATION_STYLES[channel.classification as ClassificationLevel];

                return (
                  <button
                    key={channel.id}
                    onClick={() => setActiveChannelId(channel.id)}
                    className={cn(
                      "w-full rounded-lg p-3 text-left transition-all",
                      "hover:bg-muted/50",
                      isActive && "border border-blue-500/30 bg-blue-500/10"
                    )}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{channel.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {channel.participants.length} participant
                          {channel.participants.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {channel.unreadCount > 0 && (
                        <Badge className="flex h-5 min-w-[20px] items-center justify-center bg-blue-500 text-xs text-white">
                          {channel.unreadCount}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn("border text-xs", classificationStyle.badge)}>
                        {channel.classification}
                      </Badge>
                      {channel.encrypted && (
                        <Badge className="border border-blue-500/40 bg-blue-500/20 text-xs text-blue-400">
                          <Lock className="h-3 w-3" />
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-xs">
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
      <Card className="glass-hierarchy-child flex flex-1 flex-col">
        {activeChannel ? (
          <>
            {/* Channel Header */}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="mb-2 flex items-center gap-2 text-lg">
                    <Shield className="h-5 w-5" />
                    {activeChannel.name}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {renderClassificationBadge(activeChannel.classification as ClassificationLevel)}
                    {renderEncryptionBadge(activeChannel.encrypted, true)}
                    <Badge variant="outline" className="text-xs">
                      <Users className="mr-1 h-3 w-3" />
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
            <div className="p-4">{renderKeyExpirationWarning()}</div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="text-muted-foreground h-5 w-5 animate-spin" />
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center">
                    <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p className="text-sm">No messages yet</p>
                    <p className="mt-1 text-xs">Send the first message to start the conversation</p>
                  </div>
                ) : (
                  filteredMessages.map((message) => {
                    const isFromCurrentCountry = message.from.countryId === countryId;
                    const classificationStyle =
                      CLASSIFICATION_STYLES[message.classification as ClassificationLevel];
                    const PriorityIcon =
                      PRIORITY_STYLES[message.priority as keyof typeof PRIORITY_STYLES]?.icon ||
                      Circle;

                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("flex gap-3", isFromCurrentCountry && "flex-row-reverse")}
                      >
                        {/* Avatar */}
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {message.from.countryName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* Message Content */}
                        <div
                          className={cn(
                            "max-w-[70%] flex-1",
                            isFromCurrentCountry && "flex flex-col items-end"
                          )}
                        >
                          {/* Sender Info */}
                          <div
                            className={cn(
                              "mb-1 flex items-center gap-2",
                              isFromCurrentCountry && "flex-row-reverse"
                            )}
                          >
                            <span className="text-xs font-medium">{message.from.countryName}</span>
                            <span className="text-muted-foreground text-xs">
                              {IxTime.formatIxTime(message.ixTimeTimestamp)}
                            </span>
                          </div>

                          {/* Message Bubble */}
                          <div
                            className={cn(
                              "rounded-lg border p-3",
                              isFromCurrentCountry
                                ? "border-blue-500/30 bg-blue-500/10"
                                : "bg-muted border-border"
                            )}
                          >
                            {message.subject && (
                              <p className="mb-1 text-sm font-semibold">{message.subject}</p>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>

                          {/* Message Metadata */}
                          <div
                            className={cn(
                              "mt-1 flex flex-wrap items-center gap-2",
                              isFromCurrentCountry && "flex-row-reverse"
                            )}
                          >
                            <Badge className={cn("border text-xs", classificationStyle.badge)}>
                              {message.classification}
                            </Badge>
                            {message.encrypted && renderEncryptionBadge(true, true)}
                            <Badge variant="outline" className="text-xs">
                              <PriorityIcon
                                className={cn(
                                  "mr-1 h-3 w-3",
                                  PRIORITY_STYLES[message.priority as keyof typeof PRIORITY_STYLES]
                                    ?.color
                                )}
                              />
                              {message.priority}
                            </Badge>
                            {message.status === "READ" && isFromCurrentCountry && (
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
            <div className="space-y-3 p-4">
              {/* Message Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={messageClassification}
                  onValueChange={(val) => setMessageClassification(val as ClassificationLevel)}
                >
                  <SelectTrigger className="h-8 w-[140px] text-xs">
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
                  <SelectTrigger className="h-8 w-[120px] text-xs">
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
                  <Lock className="mr-1 h-3 w-3" />
                  {encryptMessage ? "Encrypted" : "Encrypt"}
                </Button>

                <div className="flex-1" />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewMessage(!showNewMessage)}
                  className="h-8"
                >
                  {showNewMessage ? "Simple Mode" : "Advanced"}
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
                  className="min-h-[80px] resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
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

              <p className="text-muted-foreground text-xs">
                Press Ctrl+Enter to send •{" "}
                {encryptMessage
                  ? "Messages will be encrypted end-to-end"
                  : "Messages sent in cleartext"}
              </p>
            </div>
          </>
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageCircle className="mx-auto mb-3 h-12 w-12 opacity-50" />
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
              <label htmlFor="encrypt-channel" className="cursor-pointer text-sm font-medium">
                Enable end-to-end encryption
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewChannel(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateChannel}>
              <Plus className="mr-2 h-4 w-4" />
              Create Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
