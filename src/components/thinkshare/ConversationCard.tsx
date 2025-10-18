"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';
import { MessageTimestamp } from './MessageTimestamp'; // Assuming this will be a separate component
import { Users, MessageSquare } from 'lucide-react';
import type { ThinkShareConversation, ThinkShareClientState } from '~/types/thinkshare';

interface ConversationCardProps {
  conversation: ThinkShareConversation;
  isSelected: boolean;
  onClick: () => void;
  currentAccountId: string;
  getAccountTypeIcon: (type: string) => React.ReactNode;
  clientState: ThinkShareClientState;
}

export function ConversationCard({
  conversation,
  isSelected,
  onClick,
  currentAccountId,
  getAccountTypeIcon,
  clientState
}: ConversationCardProps) {
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
                  <AvatarImage src={otherParticipant.account?.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold">
                    {(otherParticipant.account?.displayName || '??').split(' ').map((n: string) => n[0]).join('')}
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
                  ? (otherParticipant.accountId === currentAccountId
                      ? `${otherParticipant.account?.displayName || 'You'} (You)`
                      : otherParticipant.account?.displayName || 'Unknown')
                  : conversation.name || 'Group Chat'}
              </h4>
              {conversation.type === 'direct' && otherParticipant && 
                getAccountTypeIcon(otherParticipant.account?.accountType || 'country')
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
