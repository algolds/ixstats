"use client";

import React from 'react';
import { CardHeader } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Search, Settings, MoreHorizontal, Users, Crown, Hash, Globe } from 'lucide-react';

interface ThinkshareConversation {
  id: string;
  type: string;
  name?: string | null;
  avatar?: string | null;
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
  }[];
}

interface ChatHeaderProps {
  selectedConversation: ThinkshareConversation;
}

export function ChatHeader({ selectedConversation }: ChatHeaderProps) {
  const getAccountTypeIcon = (accountType: string) => {
    switch (accountType) {
      case 'government': return <Crown className="h-3 w-3 text-amber-500" />;
      case 'media': return <Hash className="h-3 w-3 text-blue-500" />;
      case 'citizen': return <Globe className="h-3 w-3 text-green-500" />;
      default: return null;
    }
  };

  return (
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selectedConversation.type === 'direct' && selectedConversation.otherParticipants.length > 0 && selectedConversation.otherParticipants[0] ? (
            <>
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedConversation.otherParticipants[0].account.profileImageUrl || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold">
                  {selectedConversation.otherParticipants[0].account.displayName?.split(' ').map((n: string) => n[0]).join('') || '??'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  {selectedConversation.otherParticipants[0].account.displayName}
                  {getAccountTypeIcon(selectedConversation.otherParticipants[0].account.accountType)}
                </h3>
                <p className="text-sm text-muted-foreground">
                  @{selectedConversation.otherParticipants[0].account.username}
                </p>
              </div>
            </>
          ) : (
            <>
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedConversation.avatar || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold">
                  <Users className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{selectedConversation.name || 'Group Chat'}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedConversation.otherParticipants.length + 1} members
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
  );
}
