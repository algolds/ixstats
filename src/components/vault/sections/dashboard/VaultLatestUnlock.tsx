"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { focusRing } from "~/components/ui/button";
import { CutoutCard } from "~/components/ui/cutout-card";
import {
  AchievementCardBackdrop,
  AchievementIcon,
} from "~/components/achievements/AchievementDecorations";
import {
  getAchievementIcon,
  getCategoryTheme,
  getRarityBadgeVariant,
} from "~/components/achievements/constants";
import { facetAccentStyle } from "~/lib/design/identity";
import { cn } from "~/lib/utils/cn";
import { Credits } from "./credits";

/** The player's newest unlock on its achievement art (aurora, and foil when epic or better). Absent until there is one. */
export function VaultLatestUnlock() {
  const { data: summary } = api.achievements.getMySummary.useQuery();
  const latest = summary?.latest;
  if (!latest) return null;

  const theme = getCategoryTheme(latest.category);
  const icon = getAchievementIcon(latest.iconUrl, latest.category);
  return (
    <Link
      href={`/vault/achievements?a=${encodeURIComponent(latest.key)}`}
      data-slot="vault-latest-unlock"
      className={cn(focusRing, "rounded-cutout block h-full")}
    >
      <CutoutCard
        interactive
        style={facetAccentStyle(theme.accent)}
        className="flex h-full items-center gap-3 p-4"
      >
        <AchievementCardBackdrop
          categoryTheme={theme}
          isUnlocked
          isLegendaryOrEpic={latest.rarity === "Legendary" || latest.rarity === "Epic"}
        />
        <div
          className={cn(
            "rounded-row relative flex size-11 shrink-0 items-center justify-center",
            theme.pedestal
          )}
        >
          <AchievementIcon icon={icon} isUnlocked className="size-6.5" />
        </div>
        <div className="relative flex min-w-0 flex-col gap-1">
          <span className="text-headline text-label truncate">{latest.title}</span>
          <span className="text-footnote text-label-secondary">Latest unlock</span>
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={getRarityBadgeVariant(latest.rarity)}>{latest.rarity}</Badge>
            {latest.reward !== null && (
              <span className="text-footnote text-label-secondary inline-flex items-center gap-1 tabular-nums">
                +<Credits amount={latest.reward} />
              </span>
            )}
          </span>
        </div>
      </CutoutCard>
    </Link>
  );
}
