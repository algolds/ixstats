"use client";

import { useState } from "react";
import { UserPlus } from "iconoir-react";
import { SearchField } from "~/components/ui/search-field";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { api } from "~/trpc/react";
import { MessagesUserSearchResults } from "./MessagesUserSearchResults";

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
    (user) => !existingParticipantIds.includes(user.clerkUserId)
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
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="text-tint size-5" aria-hidden="true" />
            Add participant
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          <SearchField
            placeholder="Search users to add..."
            aria-label="Search users to add"
            value={searchQuery}
            onValueChange={setSearchQuery}
            autoFocus
          />

          <div className="max-h-64 overflow-y-auto">
            <MessagesUserSearchResults
              query={searchQuery}
              users={filteredUsers}
              isLoading={isLoading}
              emptyLabel="No new users found"
              disabled={isAdding}
              onPick={handleAdd}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
