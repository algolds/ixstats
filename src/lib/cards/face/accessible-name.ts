// src/lib/cards/face/accessible-name.ts
import { FINISH_LABEL, RARITY_LABEL } from "./labels";
import type { CardFaceData } from "./types";

/**
 * The face's accessible name: title, rarity, finish and realm (spec §2.3). NS and Nation cards add their season
 * (the same nation across seasons is a different card), and unowned or retired cards say so.
 */
export function cardFaceLabel(face: CardFaceData): string {
  const parts = [face.title, RARITY_LABEL[face.rarity]];
  if (face.copy) parts.push(FINISH_LABEL[face.copy.finish]);
  parts.push(face.realm.name);
  if (face.season !== null) parts.push(`season ${face.season}`);
  if (face.silhouette) parts.push("not collected");
  if (face.isRetired) parts.push("retired");
  return parts.join(", ");
}
