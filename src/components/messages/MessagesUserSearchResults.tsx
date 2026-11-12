"use client";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { assetUrl } from "~/lib/base-path";
import { Skeleton } from "~/components/ui/skeleton";
import type { RouterOutputs } from "~/trpc/react";

/** A person found by `messages.searchUsers`; `clerkUserId` is how a conversation names its participants. */
export type MessagesSearchUser = RouterOutputs["messages"]["searchUsers"][number];

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .substring(0, 2)
    .toUpperCase();

function subtitleOf(user: MessagesSearchUser) {
  const countryName = user.country?.name;
  const parts = [
    countryName && countryName !== user.displayName ? countryName : null,
    user.handle ? `@${user.handle}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

interface MessagesUserSearchResultsProps {
  query: string;
  users: MessagesSearchUser[] | undefined;
  isLoading: boolean;
  emptyLabel: string;
  disabled: boolean;
  /** Called with the person's `clerkUserId`. */
  onPick: (clerkUserId: string) => void;
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
      <div className="flex flex-col gap-1 py-2" aria-busy="true">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
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
            key={user.clerkUserId}
            onClick={() => onPick(user.clerkUserId)}
            disabled={disabled}
            leading={
              <Avatar className="size-8">
                <AvatarImage src={assetUrl(user.country?.flag) ?? undefined} alt="" />
                <AvatarFallback className="bg-fill-3 text-caption text-label-secondary">
                  {initialsOf(user.displayName) || "?"}
                </AvatarFallback>
              </Avatar>
            }
            title={user.displayName}
            subtitle={subtitleOf(user)}
          />
        ))}
      </FacetListSection>
    </FacetList>
  );
}
