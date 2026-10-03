"use client";

import { useState } from "react";
import { UserPlus } from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { SearchField } from "~/components/ui/search-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { api } from "~/trpc/react";

interface MessagesAddParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingParticipantIds: string[];
  onAddParticipant: (userId: string) => Promise<void>;
}

export function MessagesAddParticipantsModal({
  isOpen,
  onClose,
  existingParticipantIds,
  onAddParticipant,
}: MessagesAddParticipantsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const { data: users, isLoading } = api.messages.searchUsers.useQuery(
    { query: searchQuery },
    { enabled: isOpen && searchQuery.length > 2 }
  );

  // Filter out users who are already in the conversation
  const filteredUsers = (users ?? []).filter(
    (user: any) => !existingParticipantIds.includes(user.clerkUserId || user.id)
  );

  const handleAdd = async (userId: string) => {
    setIsAdding(true);
    try {
      await onAddParticipant(userId);
      setSearchQuery("");
      onClose();
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="text-tint size-5" aria-hidden="true" />
            Add participant
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <SearchField
            placeholder="Search users to add..."
            aria-label="Search users to add"
            value={searchQuery}
            onValueChange={setSearchQuery}
            autoFocus
          />

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
            ) : filteredUsers.length === 0 ? (
              <p className="text-body text-label-secondary py-6 text-center">No new users found</p>
            ) : (
              <div className="space-y-1">
                {filteredUsers.map((user: any) => (
                  <button
                    key={user.id || user.clerkUserId}
                    onClick={() => handleAdd(user.clerkUserId || user.id)}
                    disabled={isAdding}
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
