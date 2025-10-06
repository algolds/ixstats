"use client";

import React, { useState } from 'react';
import { CardHeader } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Search, Settings, MoreHorizontal, Users, Crown, Hash, Globe, X, Bell, BellOff, Archive, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { toast } from 'sonner';

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
  currentAccountId?: string;
  onSearchToggle?: (query: string) => void;
}

export function ChatHeader({ selectedConversation, currentAccountId, onSearchToggle }: ChatHeaderProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const getAccountTypeIcon = (accountType: string) => {
    switch (accountType) {
      case 'government': return <Crown className="h-3 w-3 text-amber-500" />;
      case 'media': return <Hash className="h-3 w-3 text-blue-500" />;
      case 'citizen': return <Globe className="h-3 w-3 text-green-500" />;
      default: return null;
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchToggle) {
      onSearchToggle(searchQuery);
    }
    toast.info(`Searching for: ${searchQuery}`);
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    toast.success(isMuted ? 'Notifications enabled' : 'Notifications muted');
  };

  const handleArchive = () => {
    toast.info('Archive conversation - Feature coming soon');
  };

  const handleDelete = () => {
    toast.error('Delete conversation - Feature coming soon');
  };

  return (
    <CardHeader className="pb-3">
      <div className="flex flex-col gap-3">
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
                    {selectedConversation.otherParticipants[0].accountId === currentAccountId
                      ? selectedConversation.otherParticipants[0].account.displayName + " (You)"
                      : selectedConversation.otherParticipants[0].account.displayName
                    }
                    {getAccountTypeIcon(selectedConversation.otherParticipants[0].account.accountType)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.otherParticipants[0].accountId === currentAccountId
                      ? "Your personal notes"
                      : "@" + selectedConversation.otherParticipants[0].account.username
                    }
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
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Conversation settings"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>

            {/* Hamburger Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-9 px-3"
                title="More options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuGroupLabel>Conversation Options</DropdownMenuGroupLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleMuteToggle}>
                    {isMuted ? <Bell className="h-4 w-4 mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
                    {isMuted ? 'Unmute notifications' : 'Mute notifications'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleArchive}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive conversation
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDelete} variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete conversation
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <Button type="submit" size="sm">Search</Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
            >
              Cancel
            </Button>
          </form>
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conversation Settings</DialogTitle>
            <DialogDescription>
              Manage settings for this conversation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Notifications</h4>
                <p className="text-sm text-muted-foreground">Get notified about new messages</p>
              </div>
              <Button
                variant={isMuted ? "outline" : "default"}
                size="sm"
                onClick={handleMuteToggle}
              >
                {isMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              </Button>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Conversation Info</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium capitalize">{selectedConversation.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Participants:</span>
                  <span className="font-medium">{selectedConversation.otherParticipants.length + 1}</span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleArchive}
              >
                <Archive className="h-4 w-4 mr-2" />
                Archive conversation
              </Button>
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete conversation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </CardHeader>
  );
}
