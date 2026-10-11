"use client";

import { Suspense } from "react";
import { RealmCard } from "~/components/realms/RealmCard";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

/** The card's footprint while the page settles, so the feed below does not jump. */
function AdvertCardSkeleton() {
  return <Skeleton aria-hidden className="rounded-card h-72" />;
}

/**
 * The realm's live card, read from `realms.region.overview` (never a stored snapshot). It mounts nothing while the read
 * is loading or when the realm is hidden from the viewer (the thread itself is already hidden then). It joins no
 * presence room, so it shows no online figure.
 */
function AdvertCardBody({ realmSlug }: { realmSlug: string }) {
  const { data: overview } = api.realms.region.overview.useQuery({ slug: realmSlug });
  if (!overview) return null;
  return <RealmCard variant="advert" overview={overview} />;
}

/**
 * The head of a Find a Realm advert thread. The card reads `?via=` for an invite, which suspends the render, so it sits
 * in its own boundary: the thread page around it keeps rendering on the server.
 */
export function AdvertCard({ realmSlug }: { realmSlug: string }) {
  return (
    <Suspense fallback={<AdvertCardSkeleton />}>
      <AdvertCardBody realmSlug={realmSlug} />
    </Suspense>
  );
}
