"use client";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { assetUrl } from "~/lib/base-path";
import { Skeleton } from "~/components/ui/skeleton";

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
            key={user.id || user.clerkUserId}
            onClick={() => onPick(user.clerkUserId || user.id)}
            disabled={disabled}
            leading={
              <Avatar className="size-8">
                <AvatarImage src={assetUrl(user.country?.flag) ?? undefined} />
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
