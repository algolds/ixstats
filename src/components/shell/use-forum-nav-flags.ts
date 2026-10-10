"use client";
/** The forum sections the sidebar lists beyond Forums ("Your realm", "Moderation"). Signed out, or loading, means neither. */
import { api } from "~/trpc/react";

const NONE = { realmMember: false, forumModerator: false } as const;

export function useForumNavFlags(signedIn: boolean): {
  realmMember: boolean;
  forumModerator: boolean;
} {
  const { data } = api.thinkpagesForum.navFlags.useQuery(undefined, {
    enabled: signedIn,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  return signedIn && data ? data : NONE;
}
