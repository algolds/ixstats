"use client";

import { useSearchParams } from "next/navigation";
import type { RouterOutputs } from "~/trpc/react";
import { LorewardsView } from "~/components/lorewards/LorewardsView";
import { LorewardAchievements } from "./LorewardAchievements";

type AchievementRow = RouterOutputs["achievements"]["getAllWithStatus"][number];

/**
 * The Lorewards tab of the Vault achievements: the shared view, leading with the player's trophies, then their
 * Loreward achievements (`achievements`, the page's catalogue), today's race and the standings. `?trophy=` marks a
 * trophy card, since `?card=` opens the card sheet anywhere in the Vault; an older link's `?card=` still marks it, for
 * one release.
 */
export function VaultLorewardsPanel({
  achievements,
}: {
  achievements: AchievementRow[] | undefined;
}) {
  const params = useSearchParams();
  const trophy = params.get("trophy") ?? params.get("card") ?? undefined;
  return (
    <LorewardsView
      focus="you"
      highlightCardId={trophy}
      achievements={<LorewardAchievements achievements={achievements} />}
    />
  );
}
