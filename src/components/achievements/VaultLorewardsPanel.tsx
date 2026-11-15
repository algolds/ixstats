"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Book, Calendar, Crown, Medal, PageEdit, Star } from "iconoir-react";
import type { RouterOutputs } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { LensCard } from "~/components/ui/lens-card";
import { LorewardsView } from "~/components/lorewards/LorewardsView";
import { CONTEST_PATH } from "~/components/lorewards/format";
import { LorewardAchievements } from "~/components/vault/sections/LorewardAchievements";

type AchievementRow = RouterOutputs["achievements"]["getAllWithStatus"][number];

const ANNUAL_CYCLES = [
  {
    id: "daily",
    title: "Daily Loreward",
    subtitle: "Scored UTC day writing runs across WikiOS · Mints a one-of-one winner trophy card",
    cadence: "Every 24h UTC",
    icon: Calendar,
  },
  {
    id: "weekly-monthly",
    title: "Weekly and monthly cycles",
    subtitle: "Sustained worldbuilding depth · Conveys Silver Order of the Lore medals",
    cadence: "Weekly · Monthly",
    icon: Book,
  },
  {
    id: "annual",
    title: "Annual Lore Laureate",
    subtitle: "Community peer nominations and yearly honours · Conveys the Burg Cross medal",
    cadence: "Annual cycle",
    icon: Crown,
  },
  {
    id: "citations",
    title: "Wiki citations and milestones",
    subtitle: "Featured article selections and 50k+ byte expansions recorded on your Passport",
    cadence: "Rolling review",
    icon: PageEdit,
  },
] as const;

function parseOwnedMedalCount(metadata: AchievementRow["metadata"]): number {
  if (!metadata) return 0;
  try {
    const parsed: { count?: number } =
      typeof metadata === "string" ? (JSON.parse(metadata) as { count?: number }) : metadata;
    return typeof parsed.count === "number" ? parsed.count : 0;
  } catch {
    return 0;
  }
}

export function VaultLorewardsPanel({
  achievements,
}: {
  achievements: AchievementRow[] | undefined;
}) {
  const params = useSearchParams();
  const trophy = params?.get("trophy") ?? params?.get("card") ?? undefined;

  const { oolMedals, earnedHonoursCount, totalHonoursPoints } = useMemo(() => {
    const list = achievements ?? [];
    const loreRelated = list.filter(
      (row) =>
        row.category === "Lorewards" ||
        row.category === "Order of the Lore" ||
        row.category === "Wiki Milestones"
    );
    const medals = list.filter((row) => row.category === "Order of the Lore");
    const earned = loreRelated.filter((row) => row.isUnlocked);
    const points = earned.reduce((sum, row) => sum + (row.points ?? 0), 0);
    return {
      oolMedals: medals,
      earnedHonoursCount: earned.length,
      totalHonoursPoints: points,
    };
  }, [achievements]);

  return (
    <div className="space-y-6">
      <LensCard app="vault" content="data" padding="md" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-1">
            <div className="flex items-center gap-2">
              <Medal aria-hidden className="text-tint size-5 shrink-0" />
              <h2 className="text-headline text-label">Order of the Lore and writing honours</h2>
            </div>
            <p className="text-footnote text-label-secondary">
              Every daily, weekly, monthly, and annual Loreward placement mints a serialised
              one-of-one Vault card and advances your Order of the Lore medal standing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="text-right">
              <div className="text-title-3 text-tint font-bold tabular-nums">
                {earnedHonoursCount.toLocaleString()} earned
              </div>
              <div className="text-caption text-label-secondary tabular-nums">
                {totalHonoursPoints.toLocaleString()} honour pts
              </div>
            </div>

            <Link
              href={CONTEST_PATH}
              className="bg-fill-3 text-label hover:bg-fill-4 rounded-control-sm text-footnote duration-fast inline-flex min-h-9 items-center gap-1.5 px-3 py-1.5 font-medium transition-colors"
            >
              <span>Contest archive</span>
              <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          </div>
        </div>
      </LensCard>

      <FacetList>
        <FacetListSection header="Annual cycles and recognition categories">
          {ANNUAL_CYCLES.map((cycle) => {
            const CycleIcon = cycle.icon;
            return (
              <FacetRow
                key={cycle.id}
                href={CONTEST_PATH}
                leading={
                  <span className="facet-recess bg-tint-fill text-tint rounded-control flex size-9 shrink-0 items-center justify-center">
                    <CycleIcon aria-hidden className="size-5" />
                  </span>
                }
                title={cycle.title}
                subtitle={cycle.subtitle}
                trailing={
                  <span className="text-footnote text-label-secondary tabular-nums">
                    {cycle.cadence}
                  </span>
                }
              />
            );
          })}
        </FacetListSection>

        {oolMedals.length > 0 && (
          <FacetListSection header="Order of the Lore medal ladder">
            {oolMedals.map((medal) => {
              const earned = Boolean(medal.isUnlocked);
              const ownedCount = parseOwnedMedalCount(medal.metadata);
              return (
                <FacetRow
                  key={medal.key}
                  href={`/vault/achievements?a=${encodeURIComponent(medal.key)}`}
                  leading={
                    <span
                      className={cn(
                        "facet-recess rounded-control flex size-9 shrink-0 items-center justify-center",
                        earned ? "bg-tint-fill text-tint" : "text-label-tertiary"
                      )}
                    >
                      <Star aria-hidden className="size-5" />
                    </span>
                  }
                  title={medal.title}
                  subtitle={medal.description}
                  trailing={
                    earned ? (
                      <span className="flex items-center gap-2">
                        {ownedCount > 0 && (
                          <span className="text-footnote text-label-secondary tabular-nums">
                            ×{ownedCount}
                          </span>
                        )}
                        <span className="text-footnote text-tint font-medium tabular-nums">
                          +{medal.points ?? 0} pts
                        </span>
                        <Badge variant="success">Earned</Badge>
                      </span>
                    ) : (
                      <span className="text-footnote text-label-tertiary tabular-nums">
                        {medal.points ?? 0} pts
                      </span>
                    )
                  }
                />
              );
            })}
          </FacetListSection>
        )}
      </FacetList>

      <LorewardsView
        focus="you"
        highlightCardId={trophy}
        achievements={<LorewardAchievements achievements={achievements} />}
      />
    </div>
  );
}
