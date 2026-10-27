// src/lib/cards/face/reveal.ts
import { rarityRank } from "./labels";
import type { CardRarity } from "./types";

/** How long a turned card holds the stage before the next can turn: rarer cards get a longer beat. */
export function revealBeatMs(rarity: CardRarity): number {
  return 250 + rarityRank(rarity) * 150;
}

/** Rare and rarer play the site's reveal sound; Epic and rarer also give a light buzz. */
export function revealFeedbackFor(rarity: CardRarity): { sound: boolean; haptic: boolean } {
  const rank = rarityRank(rarity);
  return { sound: rank >= rarityRank("RARE"), haptic: rank >= rarityRank("EPIC") };
}

/** Rare and rarer pulls tilt and catch the light in the reveal's summary (never under Reduce Motion). */
export function revealShines(rarity: CardRarity): boolean {
  return rarityRank(rarity) >= rarityRank("RARE");
}

/** The next card still face down after `from`, wrapping round; -1 when every card is up. */
export function nextFaceDown(revealed: readonly boolean[], from: number): number {
  for (let step = 1; step <= revealed.length; step += 1) {
    const index = (from + step) % revealed.length;
    if (!revealed[index]) return index;
  }
  return -1;
}

/** The rarest of `faces` (the first of a tie), or null when there are none. */
export function rarestFace<T extends { rarity: CardRarity }>(faces: readonly T[]): T | null {
  return faces.reduce<T | null>(
    (top, face) => (!top || rarityRank(face.rarity) > rarityRank(top.rarity) ? face : top),
    null
  );
}
