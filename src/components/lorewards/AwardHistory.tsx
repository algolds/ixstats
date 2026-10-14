"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { LorewardsSection } from "./LorewardsSection";
import { contestTone, wikiPageHref } from "./format";

/** A wiki user's Loreward wins and runner-up places, newest first. */
export function AwardHistory({ username }: { username: string }) {
  const { data, isLoading } = api.lorewards.getUserAwardHistory.useQuery(
    { username, limit: 20, offset: 0 },
    { enabled: Boolean(username), staleTime: 60_000 }
  );

  return (
    <LorewardsSection title="History">
      {isLoading && <Skeleton className="h-24" />}
      {data && data.entries.length === 0 && (
        <p className="text-label-secondary text-callout">No Loreward places recorded yet.</p>
      )}
      {data && data.entries.length > 0 && (
        <ul className="divide-separator divide-y">
          {data.entries.map((award) => (
            <li
              key={`${award.type}-${award.date}-${award.role}`}
              className="flex items-center gap-3 py-2"
            >
              <Badge variant={contestTone(award.type)} className="capitalize">
                {award.type}
              </Badge>
              <div className="min-w-0 flex-1">
                {award.page ? (
                  <Link
                    href={wikiPageHref(award.page)}
                    className="text-label text-headline block truncate hover:underline"
                  >
                    {award.page}
                  </Link>
                ) : (
                  <span className="text-label text-headline">Lore Laureate</span>
                )}
                <span className="text-label-secondary text-footnote tabular-nums">
                  {award.date},{" "}
                  <span
                    className={cn(
                      "capitalize",
                      award.role === "winner" && "text-label font-medium"
                    )}
                  >
                    {award.role}
                  </span>
                </span>
              </div>
              {award.score != null && (
                <span className="text-success-ink text-footnote shrink-0 font-medium tabular-nums">
                  {award.score.toLocaleString()} pts
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {data?.hasMore && (
        <p className="text-label-secondary text-footnote">
          Showing the latest {data.entries.length} of {data.total.toLocaleString()}.
        </p>
      )}
    </LorewardsSection>
  );
}
