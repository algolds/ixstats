"use client";
// src/components/wiki-os/editor/WikiEditGate.tsx
// The editor opens only for someone who may edit the page (MediaWiki shows "View source" to everyone
// else). A signed-out reader never can; a signed-in one is checked by the server against the gate a save
// passes (block, namespace, protection, right). If that check itself fails the editor opens: the save is
// checked again, and a failed check must not lock out an editor.

import type { ReactNode } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { api } from "~/trpc/react";
import { WikiViewSource } from "./WikiViewSource";

export interface WikiEditGateProps {
  title: string;
  /** Back to the page, from the read-only view. */
  onClose: () => void;
  /** The editor. */
  children: ReactNode;
}

export function WikiEditGate({ title, onClose, children }: WikiEditGateProps) {
  const { isSignedIn, isLoaded } = useWikiAuth();
  const access = api.wikios.getEditAccess.useQuery(
    { title },
    { enabled: isLoaded && isSignedIn, retry: false, staleTime: 0, refetchOnWindowFocus: false }
  );

  if (!isLoaded || access.isLoading) {
    return <Skeleton role="status" aria-label="Checking edit access" className="h-64 w-full rounded-xl" />;
  }
  if (!isSignedIn) return <WikiViewSource title={title} signedIn={false} reason={null} onClose={onClose} />;
  if (access.data?.allowed === false) {
    return <WikiViewSource title={title} signedIn reason={access.data.reason} onClose={onClose} />;
  }
  return <>{children}</>;
}
