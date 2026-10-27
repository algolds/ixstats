"use client";

import { useState } from "react";
import { ChatBubble as MessageSquare } from "iconoir-react";
import { Checkbox } from "~/components/ui/checkbox";
import { SearchField } from "~/components/ui/search-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { api } from "~/trpc/react";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { MessagesUserSearchResults } from "./MessagesUserSearchResults";

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
            New conversation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <FacetList>
            <FacetListSection aria-label="Shortcuts">
              <FacetRow
                onClick={() => handleCreate(currentUserId)}
                disabled={isCreating}
                leading={
                  <span className="bg-tint text-on-tint flex size-9 items-center justify-center rounded-full">
                    <MessageSquare className="size-4" aria-hidden="true" />
                  </span>
                }
                title="Message myself"
                subtitle="Save notes and drafts"
              />
            </FacetListSection>
          </FacetList>

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

          <div className="max-h-64 overflow-y-auto">
            <MessagesUserSearchResults
              query={searchQuery}
              users={users as any[] | undefined}
              isLoading={isLoading}
              emptyLabel="No users found"
              disabled={isCreating}
              onPick={(userId) => handleCreate(userId, diplomatic)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
