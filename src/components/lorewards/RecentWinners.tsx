"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import type { LorewardType } from "~/lib/vault/vault-bonus";
import { LorewardsSection } from "./LorewardsSection";
import { CONTEST_LABEL, contestTone, isContest, wikiPageHref, wikiUserHref } from "./format";

type Filter = "all" | LorewardType;

const FILTERS = [
  { value: "all" as const, label: "All" },
  { value: "daily" as const, label: "Daily" },
  { value: "weekly" as const, label: "Weekly" },
  { value: "monthly" as const, label: "Monthly" },
];

/** Recent winners, newest first, with the runner-up where one was recorded. */
export function RecentWinners() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading, isError } = api.lorewards.getRecentWinners.useQuery({
    limit: 20,
    ...(filter !== "all" && { type: filter }),
  });

  return (
    <LorewardsSection
      title="Recent winners"
      action={
        <SegmentedControl
          size="sm"
          aria-label="Contest"
          options={FILTERS}
          value={filter}
          onValueChange={setFilter}
        />
      }
    >
      {isLoading && <Skeleton className="h-40" />}
      {isError && (
        <p className="text-label-secondary text-callout">
          Recent winners are unavailable right now.
        </p>
      )}
      {data && data.length === 0 && (
        <p className="text-label-secondary text-callout">No winners recorded yet.</p>
      )}
      {data && data.length > 0 && (
        <ul className="divide-separator divide-y">
          {data.map((win) => (
            <li key={`${win.type}-${win.date}`} className="flex items-center gap-3 py-2">
              {isContest(win.type) && (
                <Badge variant={contestTone(win.type)}>{CONTEST_LABEL[win.type]}</Badge>
              )}
              <div className="min-w-0 flex-1">
                {win.winnerPage && (
                  <Link
                    href={wikiPageHref(win.winnerPage)}
                    className="text-label text-headline block truncate hover:underline"
                  >
                    {win.winnerPage}
                  </Link>
                )}
                <span className="text-label-secondary text-footnote tabular-nums">
                  {win.dateStart && win.dateEnd ? `${win.dateStart} to ${win.dateEnd}` : win.date}
                  {win.winnerUser && (
                    <>
                      {", "}
                      <Link href={wikiUserHref(win.winnerUser)} className="hover:underline">
                        {win.winnerUser}
                      </Link>
                    </>
                  )}
                  {win.runnerUpUser && `, runner-up ${win.runnerUpUser}`}
                </span>
              </div>
              {win.winnerScore != null && (
                <span className="text-success-ink text-footnote shrink-0 font-medium tabular-nums">
                  {win.winnerScore.toLocaleString()} pts
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </LorewardsSection>
  );
}
