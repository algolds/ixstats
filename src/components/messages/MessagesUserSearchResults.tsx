"use client";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";

interface MessagesUserSearchResultsProps {
  query: string;
  users: any[] | undefined;
  isLoading: boolean;
  emptyLabel: string;
  disabled: boolean;
  onPick: (userId: string) => void;
}

/** Result list shared by the "new conversation" and "add participant" dialogs. */
export function MessagesUserSearchResults({
  query,
  users,
  isLoading,
  emptyLabel,
  disabled,
  onPick,
}: MessagesUserSearchResultsProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <div className="border-tint size-5 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  const hint =
    query.length <= 2 ? "Type at least 3 characters to search" : !users?.length && emptyLabel;
  if (hint) {
    return <p className="text-body text-label-secondary py-6 text-center">{hint}</p>;
  }

  return (
    <FacetList variant="plain">
      <FacetListSection aria-label="Users">
        {users?.map((user) => (
          <FacetRow
            key={user.id || user.clerkUserId}
            onClick={() => onPick(user.clerkUserId || user.id)}
            disabled={disabled}
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
  );
}
