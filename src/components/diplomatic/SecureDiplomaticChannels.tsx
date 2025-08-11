"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { IxTime } from "~/lib/ixtime";
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
  RiFilterLine
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
    countryName: string;
    flagUrl?: string;
  };
  subject: string;
  content: string;
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  status: 'SENT' | 'DELIVERED' | 'READ' | 'ARCHIVED';
  timestamp: string;
  ixTimeTimestamp: number;
  encrypted: boolean;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

interface DiplomaticChannel {
  id: string;
  name: string;
  type: 'BILATERAL' | 'MULTILATERAL' | 'EMERGENCY';
  participants: Array<{
    countryId: string;
    countryName: string;
    flagUrl?: string;
    role: 'MEMBER' | 'MODERATOR' | 'OBSERVER';
  }>;
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  encrypted: boolean;
  lastActivity: string;
  unreadCount: number;
}

interface SecureDiplomaticChannelsProps {
  currentCountryId: string;
  currentCountryName: string;
  channels: DiplomaticChannel[];
  messages: DiplomaticMessage[];
  viewerClearanceLevel?: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  onSendMessage?: (channelId: string, message: Partial<DiplomaticMessage>) => void;
  onCreateChannel?: (channelData: Partial<DiplomaticChannel>) => void;
  onJoinChannel?: (channelId: string) => void;
}

// Message classification styles
const CLASSIFICATION_STYLES = {
  'PUBLIC': { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  'RESTRICTED': { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  'CONFIDENTIAL': { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' }
} as const;

// Priority styles
const PRIORITY_STYLES = {
  'LOW': { color: 'text-gray-400', icon: '◦' },
  'NORMAL': { color: 'text-blue-400', icon: '●' },
  'HIGH': { color: 'text-orange-400', icon: '▲' },
  'URGENT': { color: 'text-red-400', icon: '⚠' }
} as const;

const SecureDiplomaticChannelsComponent: React.FC<SecureDiplomaticChannelsProps> = ({
  currentCountryId,
  currentCountryName,
  channels,
  messages,
  viewerClearanceLevel = 'PUBLIC',
  onSendMessage,
  onCreateChannel,
  onJoinChannel
}) => {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // Filter channels based on clearance level
  const accessibleChannels = useMemo(() => {
    return channels.filter(channel => {
      // Check if user has sufficient clearance
      if (viewerClearanceLevel === 'PUBLIC' && channel.classification !== 'PUBLIC') {
        return false;
      }
      if (viewerClearanceLevel === 'RESTRICTED' && channel.classification === 'CONFIDENTIAL') {
        return false;
      }
      return true;
    });
  }, [channels, viewerClearanceLevel]);

  // Get messages for active channel
  const channelMessages = useMemo(() => {
    if (!activeChannelId) return [];
    
    let filtered = messages.filter(msg => 
      (msg.from.countryId === currentCountryId || msg.to.countryId === currentCountryId) &&
      // Filter by clearance level
      (viewerClearanceLevel === 'CONFIDENTIAL' || 
       (viewerClearanceLevel === 'RESTRICTED' && msg.classification !== 'CONFIDENTIAL') ||
       (viewerClearanceLevel === 'PUBLIC' && msg.classification === 'PUBLIC'))
    );

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(msg =>
        msg.subject.toLowerCase().includes(query) ||
        msg.content.toLowerCase().includes(query) ||
        msg.from.countryName.toLowerCase().includes(query)
      );
    }

    // Apply priority filter
    if (filterPriority !== 'all') {
      filtered = filtered.filter(msg => msg.priority === filterPriority);
    }

    return filtered.sort((a, b) => b.ixTimeTimestamp - a.ixTimeTimestamp);
  }, [activeChannelId, messages, currentCountryId, viewerClearanceLevel, searchQuery, filterPriority]);

  const activeChannel = useMemo(() => {
    return accessibleChannels.find(ch => ch.id === activeChannelId) || null;
  }, [accessibleChannels, activeChannelId]);

  const handleSendMessage = useCallback((messageData: Partial<DiplomaticMessage>) => {
    if (!activeChannelId || !onSendMessage) return;
    
    const message: Partial<DiplomaticMessage> = {
      ...messageData,
      from: {
        countryId: currentCountryId,
        countryName: currentCountryName
      },
      timestamp: new Date().toISOString(),
      ixTimeTimestamp: IxTime.getCurrentIxTime(),
      status: 'SENT',
      encrypted: activeChannel?.encrypted || false
    };
    
    onSendMessage(activeChannelId, message);
    setShowNewMessage(false);
  }, [activeChannelId, onSendMessage, currentCountryId, currentCountryName, activeChannel?.encrypted]);

  return (
    <div className="secure-diplomatic-channels h-full flex flex-col lg:flex-row gap-6">
      {/* Channels Sidebar */}
      <div className="lg:w-80 flex-shrink-0 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[--intel-gold] flex items-center gap-2">
            <RiShieldLine className="h-5 w-5" />
            Secure Channels
          </h3>
          <button
            onClick={() => setShowNewChannel(true)}
            className="p-2 text-[--intel-silver] hover:text-[--intel-gold] hover:bg-white/10 rounded-lg transition-colors"
            title="Create New Channel"
          >
            <RiAddLine className="h-4 w-4" />
          </button>
        </div>

        {/* Channel List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {accessibleChannels.map((channel) => (
            <motion.div
              key={channel.id}
              onClick={() => setActiveChannelId(channel.id)}
              className={cn(
                "p-4 rounded-lg border cursor-pointer transition-all",
                "bg-white/5 hover:bg-white/10 border-white/10",
                activeChannelId === channel.id && "border-[--intel-gold]/50 bg-[--intel-gold]/10"
              )}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {channel.type === 'BILATERAL' && <RiUserLine className="h-4 w-4 text-blue-400" />}
                    {channel.type === 'MULTILATERAL' && <RiGroupLine className="h-4 w-4 text-purple-400" />}
                    {channel.type === 'EMERGENCY' && <RiAlertLine className="h-4 w-4 text-red-400" />}
                    <span className="font-medium text-white truncate">{channel.name}</span>
                    {channel.encrypted && <RiLockLine className="h-3 w-3 text-[--intel-gold]" />}
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-[--intel-silver]">
                    <span className={cn(
                      "px-2 py-1 rounded-full",
                      CLASSIFICATION_STYLES[channel.classification].bg,
                      CLASSIFICATION_STYLES[channel.classification].color
                    )}>
                      {channel.classification}
                    </span>
                    <span>{channel.participants.length} participants</span>
                  </div>
                  
                  <div className="text-xs text-[--intel-silver] mt-1">
                    Last: {new Date(channel.lastActivity).toLocaleString()}
                  </div>
                </div>
                
                {channel.unreadCount > 0 && (
                  <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                    {channel.unreadCount}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          
          {accessibleChannels.length === 0 && (
            <div className="text-center py-8 text-[--intel-silver]">
              <RiShieldLine className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No accessible channels</p>
              <p className="text-xs">Clearance level: {viewerClearanceLevel}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Communication Area */}
      <div className="flex-1 flex flex-col">
        {activeChannel ? (
          <>
            {/* Channel Header */}
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 mb-4">
              <div className="flex items-center gap-3">
                <div>
                  <h4 className="text-lg font-bold text-white flex items-center gap-2">
                    {activeChannel.name}
                    {activeChannel.encrypted && (
                      <div className="flex items-center gap-1 text-[--intel-gold] text-sm">
                        <RiLockLine className="h-4 w-4" />
                        <span>Encrypted</span>
                      </div>
                    )}
                  </h4>
                  <div className="flex items-center gap-3 text-sm text-[--intel-silver]">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs",
                      CLASSIFICATION_STYLES[activeChannel.classification].bg,
                      CLASSIFICATION_STYLES[activeChannel.classification].color
                    )}>
                      {activeChannel.classification}
                    </span>
                    <span>{activeChannel.participants.length} participants</span>
                    <span className="capitalize">{activeChannel.type.toLowerCase()} Channel</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowNewMessage(true)}
                  className="flex items-center gap-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <RiSendPlaneLine className="h-4 w-4" />
                  New Message
                </button>
              </div>
            </div>

            {/* Message Filters */}
            <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg border border-white/10 mb-4">
              <div className="flex-1 relative">
                <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--intel-silver]" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-[--intel-silver] focus:outline-none focus:border-[--intel-gold]/50"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <RiFilterLine className="h-4 w-4 text-[--intel-silver]" />
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[--intel-gold]/50"
                >
                  <option value="all">All Priorities</option>
                  <option value="URGENT">Urgent</option>
                  <option value="HIGH">High</option>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-4 overflow-y-auto max-h-96">
              {channelMessages.map((message) => {
                const isOutgoing = message.from.countryId === currentCountryId;
                const priorityStyle = PRIORITY_STYLES[message.priority];
                const classificationStyle = CLASSIFICATION_STYLES[message.classification];
                
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-4 rounded-lg border",
                      isOutgoing ? "ml-12 bg-[--intel-gold]/10 border-[--intel-gold]/30" : "mr-12 bg-white/5 border-white/10"
                    )}
                  >
                    {/* Message Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {message.from.flagUrl && (
                            <img
                              src={message.from.flagUrl}
                              alt={`${message.from.countryName} flag`}
                              className="w-5 h-3 object-cover rounded border border-white/20"
                            />
                          )}
                          <span className="font-medium text-white">
                            {isOutgoing ? 'You' : message.from.countryName}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs", priorityStyle.color)}>
                            {priorityStyle.icon}
                          </span>
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs",
                            classificationStyle.bg,
                            classificationStyle.color
                          )}>
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
                        {isOutgoing && (
                          <div className="flex items-center gap-1">
                            {message.status === 'READ' && <RiCheckDoubleLine className="h-3 w-3 text-green-400" />}
                            {message.status === 'DELIVERED' && <RiCheckDoubleLine className="h-3 w-3 text-blue-400" />}
                            {message.status === 'SENT' && <RiCheckDoubleLine className="h-3 w-3 text-gray-400" />}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Message Subject */}
                    {message.subject && (
                      <div className="font-semibold text-white mb-2">
                        {message.subject}
                      </div>
                    )}
                    
                    {/* Message Content */}
                    <div className="text-[--intel-silver] leading-relaxed">
                      {message.content}
                    </div>
                  </motion.div>
                );
              })}
              
              {channelMessages.length === 0 && (
                <div className="text-center py-12 text-[--intel-silver]">
                  <RiChat3Line className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No messages in this channel</p>
                  <p className="text-sm">Start a secure diplomatic conversation</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center py-12 text-[--intel-silver]">
            <div>
              <RiShieldLine className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl">Secure Diplomatic Communications</p>
              <p className="text-sm mt-2">Select a channel to begin encrypted diplomatic correspondence</p>
              
              {accessibleChannels.length > 0 && (
                <button
                  onClick={() => setActiveChannelId(accessibleChannels[0]?.id || null)}
                  className="mt-4 px-4 py-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] rounded-lg transition-colors"
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
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10001]"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-[10002] glass-modal rounded-xl p-6"
            >
              <NewMessageForm
                onSend={handleSendMessage}
                onCancel={() => setShowNewMessage(false)}
                viewerClearanceLevel={viewerClearanceLevel}
                encrypted={activeChannel?.encrypted || false}
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
  viewerClearanceLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  encrypted: boolean;
}

const NewMessageForm: React.FC<NewMessageFormProps> = ({ onSend, onCancel, viewerClearanceLevel, encrypted }) => {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [classification, setClassification] = useState<'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL'>('PUBLIC');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !content.trim()) return;
    
    onSend({
      subject: subject.trim(),
      content: content.trim(),
      classification,
      priority,
      encrypted
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-[--intel-gold] flex items-center gap-2">
          <RiSendPlaneLine className="h-5 w-5" />
          New Diplomatic Message
          {encrypted && (
            <div className="text-sm text-[--intel-gold] flex items-center gap-1">
              <RiLockLine className="h-4 w-4" />
              Encrypted
            </div>
          )}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-[--intel-silver] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <RiCloseLine className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white mb-2">Classification</label>
          <select
            value={classification}
            onChange={(e) => setClassification(e.target.value as any)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[--intel-gold]/50"
          >
            <option value="PUBLIC">PUBLIC</option>
            {(viewerClearanceLevel === 'RESTRICTED' || viewerClearanceLevel === 'CONFIDENTIAL') && (
              <option value="RESTRICTED">RESTRICTED</option>
            )}
            {viewerClearanceLevel === 'CONFIDENTIAL' && (
              <option value="CONFIDENTIAL">CONFIDENTIAL</option>
            )}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-white mb-2">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[--intel-gold]/50"
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Diplomatic message subject..."
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-[--intel-silver] focus:outline-none focus:border-[--intel-gold]/50"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">Message</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Compose your diplomatic message..."
          rows={6}
          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-[--intel-silver] focus:outline-none focus:border-[--intel-gold]/50 resize-none"
          required
        />
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <div className="text-sm text-[--intel-silver] flex items-center gap-2">
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
            className="px-4 py-2 text-[--intel-silver] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-6 py-2 rounded-lg font-medium transition-colors"
          >
            <RiSendPlaneLine className="h-4 w-4" />
            Send Message
          </button>
        </div>
      </div>
    </form>
  );
};

SecureDiplomaticChannelsComponent.displayName = 'SecureDiplomaticChannels';

export const SecureDiplomaticChannels = React.memo(SecureDiplomaticChannelsComponent);