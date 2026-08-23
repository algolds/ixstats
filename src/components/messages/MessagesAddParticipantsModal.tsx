"use client";

import { useState } from "react";
import { Search, UserPlus } from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Input } from "~/components/ui/input";
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
            <UserPlus className="h-5 w-5" />
            Add Participant
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search users to add..."
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
            ) : filteredUsers.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">No new users found</p>
            ) : (
              <div className="space-y-1">
                {filteredUsers.map((user: any) => (
                  <button
                    key={user.id || user.clerkUserId}
                    onClick={() => handleAdd(user.clerkUserId || user.id)}
                    disabled={isAdding}
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
