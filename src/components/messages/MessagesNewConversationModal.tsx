"use client";

import { useState } from "react";
import { ChatBubble as MessageSquare } from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Checkbox } from "~/components/ui/checkbox";
import { SearchField } from "~/components/ui/search-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { api } from "~/trpc/react";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";

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
                title="Message Myself"
                subtitle="Save notes and drafts"
              />
            </FacetListSection>
          </FacetList>

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
              <FacetList variant="plain">
                <FacetListSection aria-label="Users">
                  {(users as any[]).map((user: any) => (
                    <FacetRow
                      key={user.id || user.clerkUserId}
                      onClick={() => handleCreate(user.clerkUserId || user.id, diplomatic)}
                      disabled={isCreating}
                      leading={
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
                      }
                      title={user.country?.name ?? user.displayName ?? "Unknown"}
                      subtitle={user.country?.slug ? `@${user.country.slug}` : undefined}
                    />
                  ))}
                </FacetListSection>
              </FacetList>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
