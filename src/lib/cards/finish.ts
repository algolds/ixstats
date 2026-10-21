/** A copy's finish (client-safe): the roll at mint and the fusion path. */
import type { CardFinish } from "@prisma/client";
import type { CardEconomyConfig } from "./economy-config";

/** The fusion path. Serialised is never rolled or fused into: it marks limited runs, nation copy #1 and trophies. */
const NEXT: Partial<Record<CardFinish, CardFinish>> = { STANDARD: "FOIL", FOIL: "HOLO" };

export function nextFinish(finish: CardFinish): CardFinish | null {
  return NEXT[finish] ?? null;
}

/** A new copy's finish, from the Economy tab's odds. */
export function rollFinish(
  cfg: Pick<CardEconomyConfig, "finishFoilPct" | "finishHoloPct">,
  random: () => number = Math.random
): CardFinish {
  const roll = random() * 100;
  if (roll < cfg.finishHoloPct) return "HOLO";
  if (roll < cfg.finishHoloPct + cfg.finishFoilPct) return "FOIL";
  return "STANDARD";
}
