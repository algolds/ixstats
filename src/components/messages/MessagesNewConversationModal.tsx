"use client";

import { useState } from "react";
import { ChatBubble as MessageSquare } from "iconoir-react";
import { Checkbox } from "~/components/ui/checkbox";
import { SearchField } from "~/components/ui/search-field";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
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
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="text-tint size-5" aria-hidden="true" />
            New conversation
          </SheetTitle>
        </SheetHeader>

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
            placeholder="Search by nation or handle"
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
              users={users}
              isLoading={isLoading}
              emptyLabel="No users found"
              disabled={isCreating}
              onPick={(clerkUserId) => handleCreate(clerkUserId, diplomatic)}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
