"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WarningCircle } from "iconoir-react";
import type { RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { AllAchievementsTab } from "./tabs/AllAchievementsTab";
import { LeaderboardTab } from "./tabs/LeaderboardTab";
import { ShowcaseTab } from "./tabs/ShowcaseTab";

export type AchievementsTabId = "all" | "lorewards" | "showcase" | "leaderboard";

type AchievementRow = RouterOutputs["achievements"]["getAllWithStatus"][number];

interface AchievementsTabsProps {
  achievements: AchievementRow[] | undefined;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** The Lorewards view; the Lorewards tab exists only when this is given. */
  lorewardsPanel?: React.ReactNode;
}

const panelId = (tab: AchievementsTabId) => `achievements-panel-${tab}`;

function CatalogueSkeleton() {
  return (
    <div aria-busy className="space-y-4">
      <Skeleton className="rounded-card h-14" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="rounded-card h-48" />
        <Skeleton className="rounded-card h-48" />
        <Skeleton className="rounded-card h-48" />
      </div>
    </div>
  );
}

/**
 * The Vault achievements home: All, Lorewards (when a panel is passed), Showcase and Leaderboard.
 * The tab lives in `?tab=` (All is the bare path); `?a=<key>` opens that achievement in All.
 */
export function AchievementsTabs({
  achievements,
  isLoading,
  isError = false,
  onRetry,
  lorewardsPanel,
}: AchievementsTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const options = [
    { value: "all" as const, label: "All" },
    ...(lorewardsPanel ? [{ value: "lorewards" as const, label: "Lorewards" }] : []),
    { value: "showcase" as const, label: "Showcase" },
    { value: "leaderboard" as const, label: "Leaderboard" },
  ];

  const requested = searchParams.get("tab");
  const active: AchievementsTabId = options.find((o) => o.value === requested)?.value ?? "all";

  const selectTab = (tab: AchievementsTabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("a");
    if (tab === "all") params.delete("tab");
    else params.set("tab", tab);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const errorCard = (
    <Card>
      <EmptyState
        icon={<WarningCircle />}
        title="Achievements didn't load"
        message="Please try again in a moment."
        action={
          onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          ) : undefined
        }
      />
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Scrollable: the four tabs are wider than a 320px phone, so the track scrolls rather than the page. */}
      <SegmentedControl
        asTabs
        scrollable
        aria-label="Achievements sections"
        options={options}
        value={active}
        onValueChange={selectTab}
        getTabPanelId={panelId}
      />

      <div
        role="tabpanel"
        id={panelId(active)}
        aria-label={options.find((o) => o.value === active)?.label}
      >
        {active === "all" &&
          (isError ? (
            errorCard
          ) : isLoading ? (
            <CatalogueSkeleton />
          ) : (
            <AllAchievementsTab
              achievements={achievements}
              focusKey={searchParams.get("a") ?? undefined}
            />
          ))}
        {active === "showcase" &&
          (isError ? (
            errorCard
          ) : isLoading ? (
            <CatalogueSkeleton />
          ) : (
            <ShowcaseTab achievements={achievements} />
          ))}
        {active === "lorewards" && lorewardsPanel}
        {active === "leaderboard" && <LeaderboardTab />}
      </div>
    </div>
  );
}
