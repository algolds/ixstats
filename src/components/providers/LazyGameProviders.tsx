"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useAuth } from "~/context/auth-context";
import { DIPluginProvider } from "~/components/halo/plugin-context";

const GameSidecar = dynamic(() => import("./GameProviders").then((mod) => mod.GameSidecar), {
  ssr: false,
  loading: () => null,
});

/**
 * Deferred game wrapper.
 * `DIPluginProvider` is always mounted (it is a cheap registry) so `children` keeps the same tree
 * position when auth resolves — swapping wrappers would unmount and remount the whole app.
 * Only the signed-in side effects (title badge polling, live sports plugin) load lazily, as a sibling.
 */
export function LazyGameProviders({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <DIPluginProvider>
      {isLoaded && isSignedIn ? <GameSidecar /> : null}
      {children}
    </DIPluginProvider>
  );
}
