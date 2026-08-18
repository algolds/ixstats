"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { api } from "~/trpc/react";

/**
 * "N new since last visit" chip. Counts diplomatic changes newer than the
 * timestamp we last stamped in localStorage, then re-stamps so the next visit
 * resets. Purely client-side — reuses the already-cached getRecentChanges query.
 */
export function ChangedSinceChip({ countryId }: { countryId: string }) {
  const storageKey = `ixstats:mycountry:lastSeen:${countryId}`;
  const [newCount, setNewCount] = useState(0);

  const { data } = api.diplomaticCore.getRecentChanges.useQuery(
    { countryId, hours: 168 },
    { enabled: !!countryId }
  );

  useEffect(() => {
    if (!data) return;
    let lastSeen = 0;
    try {
      lastSeen = Number(localStorage.getItem(storageKey) ?? 0);
    } catch {
      // ponytail: localStorage blocked (private mode) → treat as first visit
    }
    const count = (data as Array<{ updatedAt: string }>).filter(
      (c) => new Date(c.updatedAt).getTime() > lastSeen
    ).length;
    setNewCount(count);
    try {
      localStorage.setItem(storageKey, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, [data, storageKey]);

  if (newCount === 0) return null;

  return (
    <span
      title="Diplomatic changes since your last visit"
      className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-bold text-cyan-400"
    >
      <Zap className="h-2.5 w-2.5" />
      {newCount} new since last visit
    </span>
  );
}
