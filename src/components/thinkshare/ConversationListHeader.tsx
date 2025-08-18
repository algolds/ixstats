"use client";

import React from 'react';
import { Search, Plus } from 'lucide-react';
import { CardHeader } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';

interface ConversationListHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onNewConversationClick: () => void;
}

export function ConversationListHeader({
  searchQuery,
  setSearchQuery,
  onNewConversationClick,
}: ConversationListHeaderProps) {
  return (
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Messages</h3>
        <Button 
          size="sm" 
          onClick={onNewConversationClick}
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
  );
}
