"use client";

import { api } from "~/trpc/react";

/**
 * The credit line a realm's map shows when its borders come from an outside source (the realm's source sync
 * settings, e.g. a community map). Nothing for IxWorld or a realm without one.
 */
export function RealmMapAttribution({ realmSlug }: { realmSlug?: string }) {
  const { data: attribution } = api.realms.sourceSync.mapAttribution.useQuery(
    { slug: realmSlug ?? "" },
    { enabled: !!realmSlug, staleTime: 60 * 60_000 }
  );
  if (!realmSlug || !attribution) return null;
  return (
    <p className="bg-surface text-label-secondary text-caption rounded-control z-raised pointer-events-none absolute bottom-2 left-2 max-w-[70%] px-2 py-1">
      {attribution}
    </p>
  );
}
