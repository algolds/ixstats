"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Crown, Hash, Globe } from 'lucide-react';

interface TypingIndicatorProps {
  indicator: {
    id: string;
    conversationId: string;
    accountId: string;
  };
  participant: {
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
  } | undefined;
}

export function TypingIndicator({
  indicator,
  participant,
}: TypingIndicatorProps) {
  const displayName = participant?.account.displayName || 'Someone';
  const profileImage = participant?.account.profileImageUrl;

  const getAccountTypeIcon = (accountType: string) => {
    switch (accountType) {
      case 'government': return <Crown className="h-3 w-3 text-amber-500" />;
      case 'media': return <Hash className="h-3 w-3 text-blue-500" />;
      case 'citizen': return <Globe className="h-3 w-3 text-green-500" />;
      default: return null;
    }
  };

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
}
