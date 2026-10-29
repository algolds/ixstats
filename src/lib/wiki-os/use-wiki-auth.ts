"use client";
// src/lib/wiki-os/use-wiki-auth.ts
// WikiOS CLIENT auth seam (Workstream C2).
//
// The ONLY place WikiOS client code touches the auth provider (Clerk today).
// Components consume useWikiAuth(), never @clerk directly. Swap providers by
// rewriting this one file. See plans/wikios-workstream-c-packaging.md.

import { useUser } from "@clerk/nextjs";
import { useHydrated } from "~/hooks/useHydrated";

interface WikiAuthUser {
  id: string;
  username: string | null;
  imageUrl: string | null;
}

interface WikiAuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: WikiAuthUser | null;
}

/**
 * The server never knows the reader (the root layout gives Clerk no auth state), so the hydrating pass reports
 * signed out too: a hydration retried after a chunk suspended it runs after Clerk loaded, and rendered the Edit tab
 * over signed-out HTML. The live state applies right after hydration (as in context/auth-context.tsx).
 */
export function useWikiAuth(): WikiAuthState {
  const { user, isSignedIn, isLoaded } = useUser();
  const live = useHydrated() && isLoaded;
  return {
    isLoaded: live,
    isSignedIn: live && Boolean(isSignedIn),
    user: live && user ? { id: user.id, username: user.username, imageUrl: user.imageUrl } : null,
  };
}
