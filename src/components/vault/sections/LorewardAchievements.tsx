"use client";

import type { RouterOutputs } from "~/trpc/react";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Skeleton } from "~/components/ui/skeleton";
import { LorewardsSection } from "~/components/lorewards/LorewardsSection";

type AchievementRow = RouterOutputs["achievements"]["getAllWithStatus"][number];

/** The player's Loreward achievements in the Vault's Lorewards tab, each opening in All. */
export function LorewardAchievements({
  achievements,
}: {
  achievements: AchievementRow[] | undefined;
}) {
  if (!achievements) return <Skeleton className="rounded-card h-40" />;
  const rows = achievements.filter((row) => row.category === "Lorewards");
  if (rows.length === 0) return null;
  return (
    <LorewardsSection title="Lorewards achievements">
      <FacetList>
        <FacetListSection aria-label="Lorewards achievements">
          {rows.map((row) => (
            <FacetRow
              key={row.key}
              href={`/vault/achievements?a=${encodeURIComponent(row.key)}`}
              title={row.title}
              subtitle={row.description}
              trailing={
                <span className="text-footnote text-label-secondary tabular-nums">
                  {row.unlockedAt
                    ? `Unlocked ${new Date(row.unlockedAt).toLocaleDateString()}`
                    : "Not yet"}
                </span>
              }
            />
          ))}
        </FacetListSection>
      </FacetList>
    </LorewardsSection>
  );
}
