"use client";

import { useState } from "react";
import { Search, ChatBubble as MessageSquare } from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Input } from "~/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { api } from "~/trpc/react";

interface MessagesNewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onCreateConversation: (participantId: string) => Promise<void>;
}

export function MessagesNewConversationModal({
  isOpen,
  onClose,
  currentUserId,
  onCreateConversation,
}: MessagesNewConversationModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: users, isLoading } = api.messages.searchUsers.useQuery(
    { query: searchQuery },
    { enabled: isOpen && searchQuery.length > 2 }
  );

  const handleCreate = async (userId: string) => {
    setIsCreating(true);
    try {
      await onCreateConversation(userId);
      setSearchQuery("");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            New Conversation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Self-message shortcut */}
          <button
            onClick={() => handleCreate(currentUserId)}
            disabled={isCreating}
            className="border-border/50 hover:bg-muted/50 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium">Message Myself</p>
              <p className="text-muted-foreground text-xs">Save notes and drafts</p>
            </div>
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
              </div>
            ) : searchQuery.length <= 2 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Type at least 3 characters to search
              </p>
            ) : !users || users.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">No users found</p>
            ) : (
              <div className="space-y-1">
                {(users as any[]).map((user: any) => (
                  <button
                    key={user.id || user.clerkUserId}
                    onClick={() => handleCreate(user.clerkUserId || user.id)}
                    disabled={isCreating}
                    className="hover:bg-muted/50 flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.country?.flag ?? undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-semibold text-white">
                        {(user.country?.name ?? user.displayName ?? "?")
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {user.country?.name ?? user.displayName ?? "Unknown"}
                      </p>
                      {user.country?.slug && (
                        <p className="text-muted-foreground truncate text-xs">
                          @{user.country.slug}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
