"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useAuth } from "~/context/auth-context";

const GameProviders = dynamic(() => import("./GameProviders").then((mod) => mod.GameProviders), {
  ssr: false,
  loading: () => null,
});

/**
 * Deferred provider wrapper.
 * Only mounts game-specific providers and polling plugins when a user is signed in.
 * Unauthenticated users (landing, sign-in, public wiki/countries) avoid mounting 11+ providers.
 */
export function LazyGameProviders({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded || !isSignedIn) {
    return <>{children}</>;
  }

  return <GameProviders>{children}</GameProviders>;
}
