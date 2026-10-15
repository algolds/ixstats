"use client";
/** The viewer's forum standing: a realm member (the forum's Your realm panel) and a moderator (the Moderation row). Signed out, or loading, means neither. */
import { api, type RouterOutputs } from "~/trpc/react";

/** The viewer's realm as Your realm draws it: its emblem, then thumbnail, in place of the realms icon. */
export type NavRealm = NonNullable<RouterOutputs["thinkpagesForum"]["navFlags"]["realm"]>;

interface ForumNavFlags {
  realmMember: boolean;
  forumModerator: boolean;
  realm: NavRealm | null;
}

const NONE: ForumNavFlags = { realmMember: false, forumModerator: false, realm: null };

export function useForumNavFlags(signedIn: boolean): ForumNavFlags {
  const { data } = api.thinkpagesForum.navFlags.useQuery(undefined, {
    enabled: signedIn,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  return signedIn && data ? { ...data, realm: data.realm ?? null } : NONE;
}
