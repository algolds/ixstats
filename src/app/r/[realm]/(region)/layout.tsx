"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { RealmRegionHeader } from "../_components/RealmRegionHeader";

/** A realm's pages (Overview, Board, Nations, Manage) share its banner, stats strip and tab bar. */
export default function RealmRegionLayout({
  params,
  children,
}: {
  params: Promise<{ realm: string }>;
  children: React.ReactNode;
}) {
  const { realm: slug } = use(params);
  const { data: overview, isLoading } = api.realms.region.overview.useQuery({ slug });

  if (isLoading)
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
        <Skeleton className="rounded-card h-72 w-full" />
      </div>
    );
  if (!overview) notFound();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <RealmRegionHeader overview={overview} />
      {children}
    </div>
  );
}
