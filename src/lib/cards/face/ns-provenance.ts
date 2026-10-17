// src/lib/cards/face/ns-provenance.ts
import type { Prisma } from "@prisma/client";
import { nsFactsOf, nsNationKey } from "~/lib/cards/ns-facts";

/** The NationStates facts a card's back and sheet show: provenance only, never stats (spec §2.1). */
export interface NsProvenance {
  nation: string;
  season: number | null;
  region: string | null;
  category: string | null;
  /** The card's page on NationStates, when its id and season are known. */
  cardUrl: string | null;
  nationUrl: string;
}

function positiveInt(value: string | undefined): number | null {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The card's own NS columns win; the facts stored at import (`metadata.nsData`) fill the gaps. */
export function nsProvenanceOf(card: {
  title: string;
  nsCardId: number | null;
  nsSeason: number | null;
  metadata: Prisma.JsonValue | null;
}): NsProvenance {
  const facts = nsFactsOf(card.metadata);
  const nation = facts.name ?? card.title;
  const id = card.nsCardId ?? positiveInt(facts.id);
  const season = card.nsSeason ?? positiveInt(facts.season);
  return {
    nation,
    season,
    region: facts.region ?? null,
    category: facts.category ?? null,
    cardUrl:
      id && season ? `https://www.nationstates.net/page=deck/card=${id}/season=${season}` : null,
    nationUrl: `https://www.nationstates.net/nation=${encodeURIComponent(nsNationKey(nation))}`,
  };
}
