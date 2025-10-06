"use client";

import React, { useRef } from 'react';
// import { ScrollArea } from '~/components/ui/scroll-area'; // Temporarily disabled due to infinite loop
import { Loader2, Crown, Hash, Globe } from 'lucide-react';
// import { BlurFade } from '~/components/magicui/blur-fade'; // Temporarily disabled
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { MessageBubble } from './MessageBubble';

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

interface MessageListProps {
  conversationMessages: { messages: ThinkshareMessage[] } | undefined;
  isLoadingMessages: boolean;
  currentAccount?: Account;
  clientState: any; // TODO: Define a proper type for clientState
  selectedConversation: any; // TODO: Define a proper type for selectedConversation
  refetchMessages: () => void;
  onReply: (message: ThinkshareMessage) => void;
}

export function MessageList({
  conversationMessages,
  isLoadingMessages,
  currentAccount,
  clientState,
  selectedConversation,
  refetchMessages,
  onReply,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Simple ref for auto-scrolling without useEffect
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Temporarily disable auto-scroll to isolate infinite loop
  // React.useLayoutEffect(() => {
  //   if (conversationMessages?.messages && conversationMessages.messages.length > 0) {
  //     scrollToBottom();
  //   }
  // }, [conversationMessages?.messages?.length]);

  const getAccountTypeIcon = (accountType: string) => {
    switch (accountType) {
      case 'government': return <Crown className="h-3 w-3 text-amber-500" />;
      case 'media': return <Hash className="h-3 w-3 text-blue-500" />;
      case 'citizen': return <Globe className="h-3 w-3 text-green-500" />;
      default: return null;
    }
  };

  // Simple typing indicators without memoization to avoid infinite loops
  const getTypingIndicators = () => {
    if (!clientState?.typingIndicators || !selectedConversation?.id || !currentAccount?.id) {
      return [];
    }
    
    return Array.from(clientState.typingIndicators.values())
      .filter((indicator: any) =>
        indicator.conversationId === selectedConversation.id &&
        indicator.accountId !== currentAccount.id
      );
  };

  return (
    <div className="p-4">
      <div className="space-y-3">
          {isLoadingMessages ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            conversationMessages?.messages.map((message: ThinkshareMessage, index: number) => (
              <div
                key={`message-${message.id}`}
                className={`flex group ${message.accountId === currentAccount?.id ? 'justify-end' : 'justify-start'}`}
              >
                <MessageBubble
                  message={message}
                  currentAccount={currentAccount!}
                  refetchMessages={refetchMessages}
                  onReply={onReply}
                  getAccountTypeIcon={getAccountTypeIcon}
                />
              </div>
            ))
          )}
          
          {/* Enhanced Typing Indicators */}
          {getTypingIndicators().map((indicator: any) => {
              // Find the participant info from the conversation
              const participant = selectedConversation.otherParticipants.find((p: any) => p.accountId === indicator.accountId);
              const displayName = participant?.account.displayName || 'Someone';
              const profileImage = participant?.account.profileImageUrl;
              
              return (
                <div key={indicator.id} className="flex justify-start">
                  <div className="max-w-[70%]">
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={profileImage || undefined} />
                        <AvatarFallback className="text-xs">
                          {displayName.split(' ').map((n: string) => n[0]).join('')}
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
    </div>
  );
}
