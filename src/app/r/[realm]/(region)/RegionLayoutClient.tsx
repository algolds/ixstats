"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { RealmRegionHeader } from "../_components/RealmRegionHeader";

/** A realm's pages (Overview, Board, Nations, Manage) share its banner, stats strip and tab bar. */
export function RegionLayoutClient({
  params,
  children,
}: {
  params: Promise<{ realm: string }>;
  children: React.ReactNode;
}) {
  const { realm: slug } = use(params);
  const {
    data: overview,
    isLoading,
    error,
    refetch,
  } = api.realms.region.overview.useQuery({ slug });
  // Shared with the Overview and Nations tabs: what is still open to claim.
  const { data: hub } = api.realms.getBySlug.useQuery({ slug });

  if (isLoading)
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
        <Skeleton className="rounded-card h-72 w-full" />
      </div>
    );
  // A missing or hidden realm is a 404; a failed load (network, rate limit) is not.
  if (error && error.data?.code !== "NOT_FOUND")
    return (
      <div className="mx-auto w-full max-w-6xl p-4 md:p-8">
        <EmptyState
          title="This realm could not be loaded"
          message={error.message}
          action={
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  if (!overview) notFound();
  const openToClaim = hub?.claimsOpen
    ? hub.nationPages.length + hub.countries.filter((c) => !c.claimed).length
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <RealmRegionHeader overview={overview} openToClaim={openToClaim} />
      {children}
    </div>
  );
}
