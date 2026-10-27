// src/lib/cards/face/copy-pick.ts
/**
 * Which of the viewer's copies of one card the sheet acts on: their copies best first, the best one picked until they
 * pick another, and whether picking needs chips or a dropdown.
 */
import { FINISH_ORDER } from "./labels";
import type { CardCopyFacts } from "./types";

/** Up to this many copies are picked from chips; more from one dropdown. */
const COPY_CHIPS_MAX = 5;

/** A held copy and the facts its face carries. */
export interface HeldCopy<T> {
  copy: T;
  facts: CardCopyFacts;
}

/** The schema lists the finishes from Standard up to Serialised, so a later finish is the better one. */
const finishRank = (facts: CardCopyFacts) => FINISH_ORDER.indexOf(facts.finish);

const better = (a: CardCopyFacts, b: CardCopyFacts) =>
  finishRank(b) - finishRank(a) || b.level - a.level || a.serialNumber - b.serialNumber;

/** Best first: Serialised, Holo, Foil, then Standard; within a finish the higher level, then the lower serial. */
export function copiesBestFirst<T extends { face: { copy: CardCopyFacts | null } }>(
  copies: readonly T[]
): HeldCopy<T>[] {
  return copies
    .flatMap((copy) => (copy.face.copy ? [{ copy, facts: copy.face.copy }] : []))
    .sort((a, b) => better(a.facts, b.facts));
}

/** The copy the viewer picked, else the best one (also once the picked copy is burned or traded away). */
export function pickedCopy<T>(held: readonly HeldCopy<T>[], ownershipId: string | null) {
  return held.find((h) => h.facts.ownershipId === ownershipId) ?? held[0] ?? null;
}

/** A single copy needs no picking. */
export function copyPicker(count: number): "none" | "chips" | "menu" {
  if (count < 2) return "none";
  return count > COPY_CHIPS_MAX ? "menu" : "chips";
}
