"use client";

import { useSearchParams } from "next/navigation";
import { LorewardsView } from "~/components/lorewards/LorewardsView";

/** The Lorewards tab of the Vault achievements: the shared view, leading with the player's trophies. */
export function VaultLorewardsPanel() {
  const card = useSearchParams().get("card") ?? undefined;
  return <LorewardsView focus="you" highlightCardId={card} />;
}
