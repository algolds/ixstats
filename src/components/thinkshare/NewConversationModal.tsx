"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Search, Send, UserPlus, Crown, Hash, Globe, Loader2 } from "lucide-react";

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
      case "government":
        return <Crown className="h-3 w-3 text-amber-500" />;
      case "media":
        return <Hash className="h-3 w-3 text-blue-500" />;
      case "citizen":
        return <Globe className="h-3 w-3 text-green-500" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/20 p-2">
              <Send className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <DialogTitle className="text-lg">Start New Conversation</DialogTitle>
              <p className="text-muted-foreground text-sm">Search and message users</p>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 overflow-x-visible overflow-y-auto p-6">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
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
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : searchQuery.length === 0 ? (
              <div className="space-y-4">
                <div className="text-muted-foreground py-4 text-center">
                  <UserPlus className="mx-auto mb-2 h-8 w-8" />
                  <p className="text-sm">Start typing to search for users</p>
                  <p className="mt-1 text-xs">You can search by name or @username</p>
                </div>

                {currentAccount && (
                  <div className="border-border border-t pt-4">
                    <p className="text-muted-foreground mb-2 text-xs">Quick Actions:</p>
                    <div
                      className="hover:bg-muted border-border flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors"
                      onClick={() => {
                        if (currentAccount) {
                          onCreateConversation(currentAccount.id);
                        }
                      }}
                    >
                      <div className="relative">
                        <div className="border-border flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border bg-gradient-to-br from-green-500 to-emerald-600 text-sm font-semibold text-white">
                          📝
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium">Message Myself</h4>
                          <span className="text-muted-foreground text-xs">(Notes & Testing)</span>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          Create a personal chat for notes and testing
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center">
                <p className="text-sm">No users found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="hover:bg-muted flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors"
                    onClick={() => onCreateConversation(account.id)}
                  >
                    <div className="relative">
                      <div className="border-border h-10 w-10 overflow-hidden rounded-full border">
                        {account.profileImageUrl ? (
                          <img
                            src={account.profileImageUrl}
                            alt={account.displayName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600 text-sm font-semibold text-white">
                            {account.displayName
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium">{account.displayName}</h4>
                        {getAccountTypeIcon(account.accountType)}
                      </div>
                      <p className="text-muted-foreground text-xs">@{account.username}</p>
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
