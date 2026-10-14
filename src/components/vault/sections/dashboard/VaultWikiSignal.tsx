"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Signal } from "~/components/ui/signal";

/** Asks an account with no verified IxWiki link to link one; quiet until the links have loaded. */
export function VaultWikiSignal() {
  const { data: links } = api.ixnayid.listWikiLinks.useQuery();
  if (!links || links.some((link) => link.source === "ixwiki" && link.verified)) return null;
  return (
    <Signal tone="info" title="Link your wiki account to earn from edits">
      <Button asChild variant="outline" size="sm" className="mt-1">
        <Link href="/settings?tab=account#ixnayid-card">Link account</Link>
      </Button>
    </Signal>
  );
}
