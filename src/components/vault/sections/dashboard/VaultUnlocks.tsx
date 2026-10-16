"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { focusRing } from "~/components/ui/button";
import { CutoutCard } from "~/components/ui/cutout-card";
import { Progress } from "~/components/ui/progress";
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

interface AchievementFace {
  key: string;
  title: string;
  rarity: string;
  category: string;
  iconUrl: string | null;
}

/** One achievement on its art (aurora, and foil when an unlock is epic or better), linking to it. */
function UnlockSlide({
  achievement,
  unlocked,
  children,
}: {
  achievement: AchievementFace;
  unlocked: boolean;
  children: ReactNode;
}) {
  const theme = getCategoryTheme(achievement.category);
  const icon = getAchievementIcon(achievement.iconUrl, achievement.category);
  const epic = achievement.rarity === "Legendary" || achievement.rarity === "Epic";
  return (
    <Link
      href={`/vault/achievements?a=${encodeURIComponent(achievement.key)}`}
      className={cn(focusRing, "rounded-cutout block h-full w-full shrink-0 snap-center")}
    >
      <CutoutCard
        interactive
        style={facetAccentStyle(theme.accent)}
        className="flex h-full items-center gap-3 p-4"
      >
        <AchievementCardBackdrop
          categoryTheme={theme}
          isUnlocked={unlocked}
          isLegendaryOrEpic={unlocked && epic}
        />
        <div
          className={cn(
            "rounded-row relative flex size-11 shrink-0 items-center justify-center",
            theme.pedestal
          )}
        >
          <AchievementIcon icon={icon} isUnlocked={unlocked} className="size-6.5" />
        </div>
        <div className="relative flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-headline text-label truncate">{achievement.title}</span>
          {children}
        </div>
      </CutoutCard>
    </Link>
  );
}

/**
 * The player's achievements as a swipeable deck: the three newest unlocks, newest first, then the locked one
 * they are nearest to. Absent until there is either.
 */
export function VaultUnlocks() {
  const { data: summary } = api.achievements.getMySummary.useQuery();
  const { data: next } = api.achievements.getNextUnlock.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const recent = summary?.recent ?? [];
  const count = recent.length + (next ? 1 : 0);
  if (count === 0) return null;

  const show = (index: number) => {
    const el = track.current;
    el?.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Achievements"
      data-slot="vault-unlocks"
      className="flex h-full flex-col gap-2"
    >
      <div
        ref={track}
        onScroll={(e) =>
          setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))
        }
        className="flex flex-1 snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden"
      >
        {recent.map((unlock, index) => (
          <UnlockSlide key={unlock.key} achievement={unlock} unlocked>
            <span className="text-footnote text-label-secondary">
              {index === 0 ? "Newest" : "Earned"}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant={getRarityBadgeVariant(unlock.rarity)}>{unlock.rarity}</Badge>
              {unlock.reward !== null && (
                <span className="text-footnote text-label-secondary inline-flex items-center gap-1 tabular-nums">
                  +<Credits amount={unlock.reward} />
                </span>
              )}
            </span>
          </UnlockSlide>
        ))}
        {next && (
          <UnlockSlide achievement={next} unlocked={false}>
            <span className="text-footnote text-label-secondary tabular-nums">
              Next up, {next.current.toLocaleString()} of {next.target.toLocaleString()}
            </span>
            <Progress
              value={next.current}
              max={next.target}
              aria-label={`${next.title} progress`}
              className="h-1.5"
            />
          </UnlockSlide>
        )}
      </div>
      {count > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: count }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Show achievement ${index + 1} of ${count}`}
              aria-current={index === active}
              onClick={() => show(index)}
              className={cn(
                focusRing,
                "size-1.5 rounded-full transition-colors",
                index === active ? "bg-tint" : "bg-fill-2"
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
