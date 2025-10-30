"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { IxTime } from "~/lib/ixtime";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import {
  RiLockLine,
  RiShieldLine,
  RiKeyLine,
  RiSendPlaneLine,
  RiChat3Line,
  RiUserLine,
  RiGroupLine,
  RiCloseLine,
  RiAddLine,
  RiMoreLine,
  RiEyeOffLine,
  RiCheckDoubleLine,
  RiTimeLine,
  RiAlertLine,
  RiArchiveLine,
  RiSearchLine,
  RiFilterLine,
  RiEmotionHappyLine,
  RiReplyLine,
  RiAttachmentLine,
  RiTranslate,
  RiCheckboxCircleLine,
  RiFileTextLine,
  RiDownloadLine,
} from "react-icons/ri";

interface DiplomaticMessage {
  id: string;
  from: {
    countryId: string;
    countryName: string;
    flagUrl?: string;
  };
  to: {
    countryId: string;
    countryName: string | null;
    flagUrl?: string;
  } | null;
  subject?: string;
  content: string;
  classification: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
  status: "SENT" | "DELIVERED" | "READ" | "ARCHIVED";
  timestamp: string;
  ixTimeTimestamp: number;
  encrypted: boolean;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  reactions?: Array<{
    emoji: string;
    countryId: string;
    countryName: string;
    count: number;
  }>;
  replyToId?: string;
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
  }>;
  translations?: Record<string, string>;
  readBy?: Array<{
    countryId: string;
    countryName: string;
    readAt: string;
  }>;
}

interface DiplomaticChannel {
  id: string;
  name: string;
  type: "BILATERAL" | "MULTILATERAL" | "EMERGENCY";
  participants: Array<{
    countryId: string;
    countryName: string;
    flagUrl?: string;
    role: "MEMBER" | "MODERATOR" | "OBSERVER";
  }>;
  classification: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
  encrypted: boolean;
  lastActivity: string;
  unreadCount: number;
}

interface SecureDiplomaticChannelsProps {
  currentCountryId: string;
  currentCountryName: string;
  channels?: DiplomaticChannel[]; // Optional - will fetch internally if not provided
  messages?: DiplomaticMessage[]; // Optional - will fetch internally if not provided
  viewerClearanceLevel?: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
  onSendMessage?: (channelId: string, message: Partial<DiplomaticMessage>) => void;
  onCreateChannel?: (channelData: Partial<DiplomaticChannel>) => void;
  onJoinChannel?: (channelId: string) => void;
}

// Message classification styles
const CLASSIFICATION_STYLES = {
  PUBLIC: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" },
  RESTRICTED: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  CONFIDENTIAL: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
} as const;

// Priority styles
const PRIORITY_STYLES = {
  LOW: { color: "text-gray-400", icon: "◦" },
  NORMAL: { color: "text-blue-400", icon: "●" },
  HIGH: { color: "text-orange-400", icon: "▲" },
  URGENT: { color: "text-red-400", icon: "⚠" },
} as const;

const SecureDiplomaticChannelsComponent: React.FC<SecureDiplomaticChannelsProps> = ({
  currentCountryId,
  currentCountryName,
  channels: propChannels,
  messages: propMessages,
  viewerClearanceLevel = "PUBLIC",
  onSendMessage,
  onCreateChannel,
  onJoinChannel,
}) => {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [replyingTo, setReplyingTo] = useState<DiplomaticMessage | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  // Fetch live diplomatic channels
  const {
    data: liveChannels,
    isLoading: channelsLoading,
    refetch: refetchChannels,
  } = api.diplomatic.getChannels.useQuery(
    {
      countryId: currentCountryId,
      clearanceLevel: viewerClearanceLevel,
    },
    {
      enabled: !!currentCountryId,
      refetchInterval: 15000,
    }
  );

  // Fetch messages for active channel
  const {
    data: liveMessages,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = api.diplomatic.getChannelMessages.useQuery(
    {
      channelId: activeChannelId || "",
      countryId: currentCountryId,
      clearanceLevel: viewerClearanceLevel,
    },
    {
      enabled: !!activeChannelId && !!currentCountryId,
      refetchInterval: 5000,
    }
  );

  // Send message mutation
  const sendMessageMutation = api.diplomatic.sendMessage.useMutation({
    onSuccess: () => {
      toast.success("Message sent successfully");
      setShowNewMessage(false);
      setReplyingTo(null);
      refetchMessages();
      refetchChannels();
    },
    onError: (error) => {
      toast.error(`Failed to send message: ${error.message}`);
    },
  });

  // Add reaction mutation (commented out - endpoint not yet implemented)
  // const addReactionMutation = api.diplomatic.addMessageReaction.useMutation({
  //   onSuccess: () => {
  //     refetchMessages();
  //   },
  //   onError: (error: Error) => {
  //     toast.error(`Failed to add reaction: ${error.message}`);
  //   }
  // });

  // Helper functions
  const handleAddReaction = useCallback((messageId: string, emoji: string) => {
    // Endpoint not yet implemented
    toast.info("Reactions feature coming soon!");
    setShowReactionPicker(null);
    // addReactionMutation.mutate({
    //   messageId,
    //   emoji,
    //   countryId: currentCountryId,
    //   countryName: currentCountryName
    // });
  }, []);

  const toggleThread = useCallback((messageId: string) => {
    setExpandedThreads((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

  const handleReply = useCallback((message: DiplomaticMessage) => {
    setReplyingTo(message);
    setShowNewMessage(true);
  }, []);

  // Use live data or fallback to prop data
  const channels = useMemo(() => {
    return liveChannels || propChannels || [];
  }, [liveChannels, propChannels]);

  const messages = useMemo((): DiplomaticMessage[] => {
    // Transform API response to DiplomaticMessage type since API doesn't include optional fields
    // API returns subject as string|null, we need to ensure compatibility
    const apiMessages = (liveMessages || []).map((msg: any) => msg as DiplomaticMessage);
    const propMessagesTyped = (propMessages || []).map((msg: any) => msg as DiplomaticMessage);
    return apiMessages.length > 0 ? apiMessages : propMessagesTyped;
  }, [liveMessages, propMessages]);

  // Filter channels based on clearance level
  const accessibleChannels = useMemo(() => {
    if (!channels || !Array.isArray(channels)) return [];
    return channels.filter((channel) => {
      // Check if user has sufficient clearance
      if (viewerClearanceLevel === "PUBLIC" && channel.classification !== "PUBLIC") {
        return false;
      }
      if (viewerClearanceLevel === "RESTRICTED" && channel.classification === "CONFIDENTIAL") {
        return false;
      }
      return true;
    });
  }, [channels, viewerClearanceLevel]);

  // Get messages for active channel
  const channelMessages = useMemo((): DiplomaticMessage[] => {
    if (!activeChannelId || !messages || !Array.isArray(messages)) return [];

    // @ts-ignore - TypeScript union type inference issue with tRPC API response, runtime types are compatible
    let filtered = messages.filter(
      (msg) =>
        (msg.from.countryId === currentCountryId || msg.to?.countryId === currentCountryId) &&
        // Filter by clearance level
        (viewerClearanceLevel === "CONFIDENTIAL" ||
          (viewerClearanceLevel === "RESTRICTED" && msg.classification !== "CONFIDENTIAL") ||
          (viewerClearanceLevel === "PUBLIC" && msg.classification === "PUBLIC"))
    );

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      // @ts-ignore - TypeScript union type inference issue, runtime types are compatible
      filtered = filtered.filter(
        (msg) =>
          msg.subject?.toLowerCase().includes(query) ||
          msg.content.toLowerCase().includes(query) ||
          msg.from.countryName.toLowerCase().includes(query)
      );
    }

    // Apply priority filter
    if (filterPriority !== "all") {
      // @ts-ignore - TypeScript union type inference issue, runtime types are compatible
      filtered = filtered.filter((msg) => msg.priority === filterPriority);
    }

    // @ts-ignore - TypeScript union type inference issue, runtime types are compatible
    return filtered.sort((a, b) => b.ixTimeTimestamp - a.ixTimeTimestamp);
  }, [
    activeChannelId,
    messages,
    currentCountryId,
    viewerClearanceLevel,
    searchQuery,
    filterPriority,
  ]);

  const activeChannel = useMemo(() => {
    return accessibleChannels.find((ch) => ch.id === activeChannelId) || null;
  }, [accessibleChannels, activeChannelId]);

  const handleSendMessage = useCallback(
    (messageData: Partial<DiplomaticMessage>) => {
      if (!activeChannelId) return;

      const messageInput = {
        channelId: activeChannelId,
        fromCountryId: currentCountryId,
        fromCountryName: currentCountryName,
        ...(messageData.subject && { subject: messageData.subject }),
        content: messageData.content || "",
        classification: messageData.classification || "PUBLIC",
        priority: messageData.priority || "NORMAL",
        encrypted: activeChannel?.encrypted || false,
      };

      sendMessageMutation.mutate(messageInput);
    },
    [
      activeChannelId,
      currentCountryId,
      currentCountryName,
      activeChannel?.encrypted,
      sendMessageMutation,
    ]
  );

  return (
    <div className="secure-diplomatic-channels flex h-full flex-col gap-6 lg:flex-row">
      {/* Channels Sidebar */}
      <div className="flex-shrink-0 space-y-4 lg:w-80">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-[--intel-gold]">
            <RiShieldLine className="h-5 w-5" />
            Secure Channels
            {channelsLoading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[--intel-gold]/20 border-t-[--intel-gold]" />
            )}
          </h3>
          <button
            onClick={() => setShowNewChannel(true)}
            className="rounded-lg p-2 text-[--intel-silver] transition-colors hover:bg-white/10 hover:text-[--intel-gold]"
            title="Create New Channel"
          >
            <RiAddLine className="h-4 w-4" />
          </button>
        </div>

        {/* Channel List */}
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {accessibleChannels.map((channel) => (
            <motion.div
              key={channel.id}
              onClick={() => setActiveChannelId(channel.id)}
              className={cn(
                "cursor-pointer rounded-lg border p-4 transition-all",
                "border-white/10 bg-white/5 hover:bg-white/10",
                activeChannelId === channel.id && "border-[--intel-gold]/50 bg-[--intel-gold]/10"
              )}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    {channel.type === "BILATERAL" && (
                      <RiUserLine className="h-4 w-4 text-blue-400" />
                    )}
                    {channel.type === "MULTILATERAL" && (
                      <RiGroupLine className="h-4 w-4 text-purple-400" />
                    )}
                    {channel.type === "EMERGENCY" && (
                      <RiAlertLine className="h-4 w-4 text-red-400" />
                    )}
                    <span className="text-foreground truncate font-medium">{channel.name}</span>
                    {channel.encrypted && <RiLockLine className="h-3 w-3 text-[--intel-gold]" />}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[--intel-silver]">
                    <span
                      className={cn(
                        "rounded-full px-2 py-1",
                        CLASSIFICATION_STYLES[
                          channel.classification as keyof typeof CLASSIFICATION_STYLES
                        ]?.bg || CLASSIFICATION_STYLES.PUBLIC.bg,
                        CLASSIFICATION_STYLES[
                          channel.classification as keyof typeof CLASSIFICATION_STYLES
                        ]?.color || CLASSIFICATION_STYLES.PUBLIC.color
                      )}
                    >
                      {channel.classification}
                    </span>
                    <span>{channel.participants.length} participants</span>
                  </div>

                  <div className="mt-1 text-xs text-[--intel-silver]">
                    Last: {new Date(channel.lastActivity).toLocaleString()}
                  </div>
                </div>

                {channel.unreadCount > 0 && (
                  <div className="text-foreground min-w-[20px] rounded-full bg-red-500 px-2 py-1 text-center text-xs">
                    {channel.unreadCount}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {accessibleChannels.length === 0 && (
            <div className="py-8 text-center text-[--intel-silver]">
              <RiShieldLine className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No accessible channels</p>
              <p className="text-xs">Clearance level: {viewerClearanceLevel}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Communication Area */}
      <div className="flex flex-1 flex-col">
        {activeChannel ? (
          <>
            {/* Channel Header */}
            <div className="mb-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div>
                  <h4 className="text-foreground flex items-center gap-2 text-lg font-bold">
                    {activeChannel.name}
                    {activeChannel.encrypted && (
                      <div className="flex items-center gap-1 text-sm text-[--intel-gold]">
                        <RiLockLine className="h-4 w-4" />
                        <span>Encrypted</span>
                      </div>
                    )}
                  </h4>
                  <div className="flex items-center gap-3 text-sm text-[--intel-silver]">
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-xs",
                        CLASSIFICATION_STYLES[
                          activeChannel.classification as keyof typeof CLASSIFICATION_STYLES
                        ]?.bg || CLASSIFICATION_STYLES.PUBLIC.bg,
                        CLASSIFICATION_STYLES[
                          activeChannel.classification as keyof typeof CLASSIFICATION_STYLES
                        ]?.color || CLASSIFICATION_STYLES.PUBLIC.color
                      )}
                    >
                      {activeChannel.classification}
                    </span>
                    <span>{activeChannel.participants.length} participants</span>
                    <span className="capitalize">{activeChannel.type.toLowerCase()} Channel</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTranslationEnabled(!translationEnabled)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    translationEnabled
                      ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                      : "bg-white/5 text-[--intel-silver] hover:bg-white/10"
                  )}
                  title={translationEnabled ? "Translation ON" : "Translation OFF"}
                >
                  <RiTranslate className="h-4 w-4" />
                  {translationEnabled && <span className="text-xs">ON</span>}
                </button>
                <button
                  onClick={() => setShowNewMessage(true)}
                  className="flex items-center gap-2 rounded-lg bg-[--intel-gold]/20 px-4 py-2 text-sm font-medium text-[--intel-gold] transition-colors hover:bg-[--intel-gold]/30"
                >
                  <RiSendPlaneLine className="h-4 w-4" />
                  New Message
                </button>
              </div>
            </div>

            {/* Message Filters */}
            <div className="mb-4 flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="relative flex-1">
                <RiSearchLine className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[--intel-silver]" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchQuery(e.target.value)
                  }
                  className="text-foreground w-full rounded-lg border border-white/20 bg-white/10 py-2 pr-4 pl-10 placeholder:text-[--intel-silver] focus:border-[--intel-gold]/50 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <RiFilterLine className="h-4 w-4 text-[--intel-silver]" />
                <select
                  value={filterPriority}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setFilterPriority(e.target.value)
                  }
                  className="text-foreground rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm focus:border-[--intel-gold]/50 focus:outline-none"
                >
                  <option value="all">All Priorities</option>
                  <option value="URGENT">Urgent</option>
                  <option value="HIGH">High</option>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>

            {/* Typing Indicators */}
            {typingUsers.length > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2">
                <div className="flex items-center gap-1">
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-[--intel-gold]"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-[--intel-gold]"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-[--intel-gold]"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
                <span className="text-xs text-[--intel-silver]">
                  {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                </span>
              </div>
            )}

            {/* Messages */}
            <div className="max-h-96 flex-1 space-y-4 overflow-y-auto">
              {channelMessages
                .filter((msg) => !msg.replyToId)
                .map((message) => {
                  const isOutgoing = message.from.countryId === currentCountryId;
                  const priorityStyle =
                    PRIORITY_STYLES[message.priority as keyof typeof PRIORITY_STYLES] ||
                    PRIORITY_STYLES.NORMAL;
                  const classificationStyle =
                    CLASSIFICATION_STYLES[
                      message.classification as keyof typeof CLASSIFICATION_STYLES
                    ] || CLASSIFICATION_STYLES.PUBLIC;
                  const replies = channelMessages.filter((m) => m.replyToId === message.id);
                  const isThreadExpanded = expandedThreads.has(message.id);

                  return (
                    <div key={message.id} className="space-y-2">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "group relative rounded-lg border p-4",
                          isOutgoing
                            ? "ml-12 border-[--intel-gold]/30 bg-[--intel-gold]/10"
                            : "mr-12 border-white/10 bg-white/5"
                        )}
                      >
                        {/* Message Header */}
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              {(message.from as any).flagUrl && (
                                <img
                                  src={(message.from as any).flagUrl}
                                  alt={`${message.from.countryName} flag`}
                                  className="h-3 w-5 rounded border border-white/20 object-cover"
                                />
                              )}
                              <span className="text-foreground font-medium">
                                {isOutgoing ? "You" : message.from.countryName || "Unknown"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs", priorityStyle.color)}>
                                {priorityStyle.icon}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-1 text-xs",
                                  classificationStyle.bg,
                                  classificationStyle.color
                                )}
                              >
                                {message.classification}
                              </span>
                              {message.encrypted && (
                                <RiLockLine className="h-3 w-3 text-[--intel-gold]" />
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-[--intel-silver]">
                            <RiTimeLine className="h-3 w-3" />
                            <span>{IxTime.formatIxTime(message.ixTimeTimestamp, true)}</span>
                            {isOutgoing && message.readBy && message.readBy.length > 0 && (
                              <div className="group/read flex items-center gap-1">
                                <RiCheckDoubleLine className="h-3 w-3 text-green-400" />
                                <span className="text-xs opacity-0 transition-opacity group-hover/read:opacity-100">
                                  Read by {message.readBy.length}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Message Subject */}
                        {message.subject && (
                          <div className="text-foreground mb-2 font-semibold">
                            {message.subject}
                          </div>
                        )}

                        {/* Message Content */}
                        <div className="mb-3 leading-relaxed text-[--intel-silver]">
                          {translationEnabled && message.translations?.["en"]
                            ? message.translations["en"]
                            : message.content}
                        </div>

                        {/* Attachments */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mb-3 space-y-2">
                            {message.attachments.map(
                              (attachment: {
                                id: string;
                                name: string;
                                type: string;
                                size: number;
                                url: string;
                              }) => (
                                <div
                                  key={attachment.id}
                                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2 transition-colors hover:border-[--intel-gold]/30"
                                >
                                  <RiFileTextLine className="h-5 w-5 text-[--intel-gold]" />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-foreground truncate text-sm">
                                      {attachment.name}
                                    </div>
                                    <div className="text-xs text-[--intel-silver]">
                                      {(attachment.size / 1024).toFixed(1)} KB
                                    </div>
                                  </div>
                                  <RiDownloadLine className="h-4 w-4 text-[--intel-silver]" />
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {/* Reactions */}
                        {message.reactions && message.reactions.length > 0 && (
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            {message.reactions.map(
                              (
                                reaction: {
                                  emoji: string;
                                  countryId: string;
                                  countryName: string;
                                  count: number;
                                },
                                idx: number
                              ) => (
                                <button
                                  key={idx}
                                  onClick={() => handleAddReaction(message.id, reaction.emoji)}
                                  className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs transition-colors hover:bg-white/20"
                                  title={`${reaction.countryName} reacted`}
                                >
                                  <span>{reaction.emoji}</span>
                                  <span className="text-[--intel-silver]">{reaction.count}</span>
                                </button>
                              )
                            )}
                          </div>
                        )}

                        {/* Message Actions */}
                        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() =>
                              setShowReactionPicker(
                                showReactionPicker === message.id ? null : message.id
                              )
                            }
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[--intel-silver] transition-colors hover:bg-white/10 hover:text-[--intel-gold]"
                          >
                            <RiEmotionHappyLine className="h-3 w-3" />
                            React
                          </button>
                          <button
                            onClick={() => handleReply(message)}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[--intel-silver] transition-colors hover:bg-white/10 hover:text-[--intel-gold]"
                          >
                            <RiReplyLine className="h-3 w-3" />
                            Reply
                          </button>
                          {replies.length > 0 && (
                            <button
                              onClick={() => toggleThread(message.id)}
                              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-400 transition-colors hover:bg-white/10 hover:text-blue-300"
                            >
                              <RiChat3Line className="h-3 w-3" />
                              {isThreadExpanded ? "Hide" : "Show"} {replies.length}{" "}
                              {replies.length === 1 ? "reply" : "replies"}
                            </button>
                          )}
                        </div>

                        {/* Reaction Picker */}
                        {showReactionPicker === message.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute bottom-full left-0 z-10 mb-2 flex items-center gap-1 rounded-lg border border-[--intel-gold]/30 bg-black/90 p-2 shadow-xl backdrop-blur-lg"
                          >
                            {["👍", "❤️", "😊", "🎉", "🤝", "⚡", "🌟", "🔥"].map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleAddReaction(message.id, emoji)}
                                className="flex h-8 w-8 items-center justify-center rounded text-lg transition-colors hover:bg-white/20"
                              >
                                {emoji}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </motion.div>

                      {/* Thread Replies */}
                      {isThreadExpanded && replies.length > 0 && (
                        <div className="ml-16 space-y-2 border-l-2 border-[--intel-gold]/30 pl-4">
                          {replies.map((reply) => {
                            const isReplyOutgoing = reply.from.countryId === currentCountryId;
                            return (
                              <motion.div
                                key={reply.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={cn(
                                  "rounded-lg border p-3 text-sm",
                                  isReplyOutgoing
                                    ? "border-[--intel-gold]/20 bg-[--intel-gold]/5"
                                    : "border-white/10 bg-white/5"
                                )}
                              >
                                <div className="mb-1 flex items-center gap-2">
                                  {(reply.from as any).flagUrl && (
                                    <img
                                      src={(reply.from as any).flagUrl}
                                      alt={`${reply.from.countryName} flag`}
                                      className="h-2 w-4 rounded border border-white/20 object-cover"
                                    />
                                  )}
                                  <span className="text-foreground text-xs font-medium">
                                    {isReplyOutgoing ? "You" : reply.from.countryName || "Unknown"}
                                  </span>
                                  <span className="text-xs text-[--intel-silver]">
                                    {IxTime.formatIxTime(reply.ixTimeTimestamp, true)}
                                  </span>
                                </div>
                                <div className="text-xs text-[--intel-silver]">
                                  {translationEnabled && reply.translations?.["en"]
                                    ? reply.translations["en"]
                                    : reply.content}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

              {channelMessages.length === 0 && (
                <div className="py-12 text-center text-[--intel-silver]">
                  <RiChat3Line className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p className="text-lg">No messages in this channel</p>
                  <p className="text-sm">Start a secure diplomatic conversation</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center py-12 text-center text-[--intel-silver]">
            <div>
              <RiShieldLine className="mx-auto mb-4 h-16 w-16 opacity-50" />
              <p className="text-xl">Secure Diplomatic Communications</p>
              <p className="mt-2 text-sm">
                Select a channel to begin encrypted diplomatic correspondence
              </p>

              {accessibleChannels.length > 0 && (
                <button
                  onClick={() => {
                    const firstChannel = accessibleChannels[0];
                    if (firstChannel?.id) {
                      setActiveChannelId(firstChannel.id);
                    }
                  }}
                  className="mt-4 rounded-lg bg-[--intel-gold]/20 px-4 py-2 text-[--intel-gold] transition-colors hover:bg-[--intel-gold]/30"
                >
                  Open First Channel
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Message Modal */}
      <AnimatePresence>
        {showNewMessage && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewMessage(false)}
              className="fixed inset-0 z-[10001] bg-black/20 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-modal fixed top-1/2 left-1/2 z-[10002] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl p-6"
            >
              <NewMessageForm
                onSend={handleSendMessage}
                onCancel={() => {
                  setShowNewMessage(false);
                  setReplyingTo(null);
                }}
                viewerClearanceLevel={viewerClearanceLevel}
                encrypted={activeChannel?.encrypted || false}
                replyingTo={replyingTo}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// New Message Form Component
interface NewMessageFormProps {
  onSend: (message: Partial<DiplomaticMessage>) => void;
  onCancel: () => void;
  viewerClearanceLevel: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
  encrypted: boolean;
  replyingTo?: DiplomaticMessage | null;
}

const NewMessageForm: React.FC<NewMessageFormProps> = ({
  onSend,
  onCancel,
  viewerClearanceLevel,
  encrypted,
  replyingTo,
}) => {
  const [subject, setSubject] = useState(
    replyingTo ? `Re: ${replyingTo.subject || "Message"}` : ""
  );
  const [content, setContent] = useState("");
  const [classification, setClassification] = useState<"PUBLIC" | "RESTRICTED" | "CONFIDENTIAL">(
    "PUBLIC"
  );
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim() || !content.trim()) return;

    onSend({
      subject: subject.trim(),
      content: content.trim(),
      classification,
      priority,
      encrypted,
      replyToId: replyingTo?.id,
      attachments: attachments.map((file: File, idx: number) => ({
        id: `attach-${idx}-${Date.now()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
      })),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xl font-bold text-[--intel-gold]">
          {replyingTo ? (
            <RiReplyLine className="h-5 w-5" />
          ) : (
            <RiSendPlaneLine className="h-5 w-5" />
          )}
          {replyingTo ? "Reply to Message" : "New Diplomatic Message"}
          {encrypted && (
            <div className="flex items-center gap-1 text-sm text-[--intel-gold]">
              <RiLockLine className="h-4 w-4" />
              Encrypted
            </div>
          )}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="hover:text-foreground rounded-lg p-2 text-[--intel-silver] transition-colors hover:bg-white/10"
        >
          <RiCloseLine className="h-4 w-4" />
        </button>
      </div>

      {/* Replying To Preview */}
      {replyingTo && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm text-[--intel-silver]">
            <RiReplyLine className="h-4 w-4" />
            <span>Replying to:</span>
          </div>
          <div className="rounded-lg border-l-2 border-[--intel-gold]/50 bg-white/5 p-2">
            <div className="text-foreground mb-1 text-xs font-medium">
              {replyingTo.from.countryName || "Unknown"}
            </div>
            <div className="line-clamp-2 text-xs text-[--intel-silver]">{replyingTo.content}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Classification</label>
          <select
            value={classification}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setClassification(e.target.value as "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL")
            }
            className="text-foreground w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 focus:border-[--intel-gold]/50 focus:outline-none"
          >
            <option value="PUBLIC">PUBLIC</option>
            {(viewerClearanceLevel === "RESTRICTED" || viewerClearanceLevel === "CONFIDENTIAL") && (
              <option value="RESTRICTED">RESTRICTED</option>
            )}
            {viewerClearanceLevel === "CONFIDENTIAL" && (
              <option value="CONFIDENTIAL">CONFIDENTIAL</option>
            )}
          </select>
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Priority</label>
          <select
            value={priority}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setPriority(e.target.value as "LOW" | "NORMAL" | "HIGH" | "URGENT")
            }
            className="text-foreground w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 focus:border-[--intel-gold]/50 focus:outline-none"
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
          placeholder="Diplomatic message subject..."
          className="text-foreground w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 placeholder:text-[--intel-silver] focus:border-[--intel-gold]/50 focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Message</label>
        <textarea
          value={content}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
          placeholder="Compose your diplomatic message..."
          rows={6}
          className="text-foreground w-full resize-none rounded-lg border border-white/20 bg-white/10 px-4 py-3 placeholder:text-[--intel-silver] focus:border-[--intel-gold]/50 focus:outline-none"
          required
        />
      </div>

      {/* Attachment Upload */}
      <div className="space-y-3">
        <label className="text-foreground block text-sm font-medium">Attachments</label>
        <div className="flex items-center gap-3">
          <label className="text-foreground flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm transition-colors hover:border-[--intel-gold]/30 hover:bg-white/20">
            <RiAttachmentLine className="h-4 w-4" />
            Add Files
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
            />
          </label>
          {attachments.length > 0 && (
            <span className="text-xs text-[--intel-silver]">
              {attachments.length} {attachments.length === 1 ? "file" : "files"} attached
            </span>
          )}
        </div>

        {/* Attachment List */}
        {attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((file: File, index: number) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2"
              >
                <RiFileTextLine className="h-4 w-4 text-[--intel-gold]" />
                <div className="min-w-0 flex-1">
                  <div className="text-foreground truncate text-sm">{file.name}</div>
                  <div className="text-xs text-[--intel-silver]">
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="rounded p-1 text-[--intel-silver] transition-colors hover:bg-white/10 hover:text-red-400"
                >
                  <RiCloseLine className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-4">
        <div className="flex items-center gap-2 text-sm text-[--intel-silver]">
          {encrypted && (
            <>
              <RiLockLine className="h-4 w-4 text-[--intel-gold]" />
              <span>This message will be encrypted end-to-end</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="hover:text-foreground rounded-lg px-4 py-2 text-[--intel-silver] transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-[--intel-gold]/20 px-6 py-2 font-medium text-[--intel-gold] transition-colors hover:bg-[--intel-gold]/30"
          >
            <RiSendPlaneLine className="h-4 w-4" />
            Send Message
          </button>
        </div>
      </div>
    </form>
  );
};

SecureDiplomaticChannelsComponent.displayName = "SecureDiplomaticChannels";

export const SecureDiplomaticChannels = React.memo(SecureDiplomaticChannelsComponent);
