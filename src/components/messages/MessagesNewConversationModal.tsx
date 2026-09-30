"use client";

import { useState } from "react";
import { ChatBubble as MessageSquare } from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Checkbox } from "~/components/ui/checkbox";
import { SearchField } from "~/components/ui/search-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { api } from "~/trpc/react";

interface MessagesNewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onCreateConversation: (
    participantId: string,
    options?: { diplomatic?: boolean }
  ) => Promise<void>;
}

export function MessagesNewConversationModal({
  isOpen,
  onClose,
  currentUserId,
  onCreateConversation,
}: MessagesNewConversationModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [diplomatic, setDiplomatic] = useState(false);

  const { data: users, isLoading } = api.messages.searchUsers.useQuery(
    { query: searchQuery },
    { enabled: isOpen && searchQuery.length > 2 }
  );

  const handleCreate = async (userId: string, isDiplomatic = false) => {
    setIsCreating(true);
    try {
      await onCreateConversation(userId, isDiplomatic ? { diplomatic: true } : undefined);
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
            <MessageSquare className="text-tint size-5" aria-hidden="true" />
            New Conversation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Self-message shortcut */}
          <button
            onClick={() => handleCreate(currentUserId)}
            disabled={isCreating}
            type="button"
            className="border-separator hover:bg-fill-4 rounded-control flex w-full items-center gap-3 border p-3 text-left transition-colors"
          >
            <div className="bg-tint text-on-tint flex size-9 items-center justify-center rounded-full">
              <MessageSquare className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-headline text-label">Message Myself</p>
              <p className="text-footnote text-label-secondary">Save notes and drafts</p>
            </div>
          </button>

          {/* Search */}
          <SearchField
            placeholder="Search users..."
            aria-label="Search users"
            value={searchQuery}
            onValueChange={setSearchQuery}
            autoFocus
          />

          <label className="text-body text-label flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={diplomatic}
              onCheckedChange={(checked) => setDiplomatic(checked === true)}
            />
            <span>Diplomatic channel (country-to-country)</span>
          </label>

          {/* Results */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <div className="border-tint size-5 animate-spin rounded-full border-2 border-t-transparent" />
              </div>
            ) : searchQuery.length <= 2 ? (
              <p className="text-body text-label-secondary py-6 text-center">
                Type at least 3 characters to search
              </p>
            ) : !users || users.length === 0 ? (
              <p className="text-body text-label-secondary py-6 text-center">No users found</p>
            ) : (
              <div className="space-y-1">
                {(users as any[]).map((user: any) => (
                  <button
                    key={user.id || user.clerkUserId}
                    onClick={() => handleCreate(user.clerkUserId || user.id, diplomatic)}
                    disabled={isCreating}
                    type="button"
                    className="hover:bg-fill-4 rounded-control flex w-full items-center gap-3 p-2 text-left transition-colors"
                  >
                    <Avatar className="size-8">
                      <AvatarImage src={user.country?.flag ?? undefined} />
                      <AvatarFallback className="bg-fill-3 text-caption text-label-secondary">
                        {(user.country?.name ?? user.displayName ?? "?")
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-headline text-label truncate">
                        {user.country?.name ?? user.displayName ?? "Unknown"}
                      </p>
                      {user.country?.slug && (
                        <p className="text-footnote text-label-secondary truncate">
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
