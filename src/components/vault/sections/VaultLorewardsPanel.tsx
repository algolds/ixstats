"use client";

import { useSearchParams } from "next/navigation";
import { LorewardsView } from "~/components/lorewards/LorewardsView";

/**
 * The Lorewards tab of the Vault achievements: the shared view, leading with the player's trophies. `?trophy=` marks a
 * trophy card, since `?card=` opens the card sheet anywhere in the Vault; an older link's `?card=` still marks it, for
 * one release.
 */
export function VaultLorewardsPanel() {
  const params = useSearchParams();
  const trophy = params.get("trophy") ?? params.get("card") ?? undefined;
  return <LorewardsView focus="you" highlightCardId={trophy} />;
}
