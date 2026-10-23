// src/lib/cards/face/ns-provenance.ts
import type { Prisma } from "@prisma/client";
import { nsFactsOf } from "~/lib/cards/ns-facts";

/** The NationStates facts the sheet's About shows: provenance only, never stats (spec §2.1). */
export interface NsProvenance {
  nation: string;
  season: number | null;
  region: string | null;
  category: string | null;
}

/** A whole number above 0, or null: "42abc" and "1.5" are not seasons. */
function positiveInt(value: string | undefined): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** The card's own NS columns win; the facts stored at import (`metadata.nsData`) fill the gaps. */
export function nsProvenanceOf(card: {
  title: string;
  nsSeason: number | null;
  metadata: Prisma.JsonValue | null;
}): NsProvenance {
  const facts = nsFactsOf(card.metadata);
  return {
    nation: facts.name ?? card.title,
    season: card.nsSeason ?? positiveInt(facts.season),
    region: facts.region ?? null,
    category: facts.category ?? null,
  };
}
