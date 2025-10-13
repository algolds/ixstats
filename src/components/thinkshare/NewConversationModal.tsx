"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Search, Send, UserPlus, Crown, Hash, Globe, Loader2 } from 'lucide-react';

interface Account {
  id: string; // Clerk userId
  username: string; // country slug/code
  displayName: string; // country name
  profileImageUrl?: string | null; // flag url
  accountType: string; // always 'country' for ThinkShare UI
}

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  accounts: Account[];
  isLoading: boolean;
  onCreateConversation: (accountId: string) => void;
  currentAccount?: Account;
}

export function NewConversationModal({
  isOpen,
  onClose,
  searchQuery,
  setSearchQuery,
  accounts,
  isLoading,
  onCreateConversation,
  currentAccount,
}: NewConversationModalProps) {
  if (!isOpen) return null;

  const getAccountTypeIcon = (accountType: string) => {
    switch (accountType) {
      case 'government': return <Crown className="h-3 w-3 text-amber-500" />;
      case 'media': return <Hash className="h-3 w-3 text-blue-500" />;
      case 'citizen': return <Globe className="h-3 w-3 text-green-500" />;
      default: return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Send className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <DialogTitle className="text-lg">Start New Conversation</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Search and message users
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="p-6 overflow-y-auto overflow-x-visible space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for users..."
              className="pl-10"
            />
          </div>

          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : searchQuery.length === 0 ? (
              <div className="space-y-4">
                <div className="text-center py-4 text-muted-foreground">
                  <UserPlus className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Start typing to search for users</p>
                  <p className="text-xs mt-1">You can search by name or @username</p>
                </div>
                
                {currentAccount && <div className="border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Quick Actions:</p>
                  <div
                    className="p-3 rounded-lg hover:bg-muted cursor-pointer flex items-center gap-3 transition-colors border border-border"
                    onClick={() => {
                      if (currentAccount) {
                        onCreateConversation(currentAccount.id);
                      }
                    }}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm">
                        📝
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">Message Myself</h4>
                        <span className="text-xs text-muted-foreground">(Notes & Testing)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Create a personal chat for notes and testing</p>
                    </div>
                  </div>
                </div>}
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p className="text-sm">No users found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="p-3 rounded-lg hover:bg-muted cursor-pointer flex items-center gap-3 transition-colors"
                    onClick={() => onCreateConversation(account.id)}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-border">
                        {account.profileImageUrl ? (
                          <img src={account.profileImageUrl} alt={account.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm">
                            {account.displayName.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">{account.displayName}</h4>
                        {getAccountTypeIcon(account.accountType)}
                      </div>
                      <p className="text-xs text-muted-foreground">@{account.username}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
