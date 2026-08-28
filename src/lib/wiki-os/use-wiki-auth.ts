"use client";
// src/lib/wiki-os/use-wiki-auth.ts
// WikiOS CLIENT auth seam (Workstream C2).
//
// The ONLY place WikiOS client code touches the auth provider (Clerk today).
// Components consume useWikiAuth(), never @clerk directly. Swap providers by
// rewriting this one file. See plans/wikios-workstream-c-packaging.md.

import { useUser } from "@clerk/nextjs";

export interface WikiAuthUser {
  id: string;
  username: string | null;
  imageUrl: string | null;
}

export interface WikiAuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: WikiAuthUser | null;
}

export function useWikiAuth(): WikiAuthState {
  const { user, isSignedIn, isLoaded } = useUser();
  return {
    isLoaded,
    isSignedIn: !!isSignedIn,
    user: user ? { id: user.id, username: user.username, imageUrl: user.imageUrl } : null,
  };
}
