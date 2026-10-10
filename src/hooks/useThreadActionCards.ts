import { useMemo } from "react";
import type { ActionCardData } from "~/components/action-links";
import { parseTextActionTokens } from "~/lib/action-links";
import { api } from "~/trpc/react";

/** actionLinks.activityCards accepts at most this many ids per call. */
const MAX_IDS = 50;

export interface ThreadActionCards {
  cards: ReadonlyMap<string, ActionCardData>;
  /** Every batch settled successfully, or no post has a token. A missing card is only "unverified" when ready. */
  ready: boolean;
  /** A batch request failed, so absent cards say nothing about verification. */
  errored: boolean;
}

interface CardsResult {
  data?: readonly ActionCardData[];
  isSuccess: boolean;
  isError: boolean;
}

function chunked(ids: readonly string[]): string[][] {
  const chunks: string[][] = [];
  for (let at = 0; at < ids.length; at += MAX_IDS) chunks.push(ids.slice(at, at + MAX_IDS));
  return chunks;
}

/** The batches' cards in one Map; ready when every batch succeeded (none asked is ready too). */
function combineCards(results: readonly CardsResult[]): ThreadActionCards {
  return {
    cards: new Map(results.flatMap((r) => r.data ?? []).map((card) => [card.id, card])),
    ready: results.every((r) => r.isSuccess),
    errored: results.some((r) => r.isError),
  };
}

/**
 * The action cards for a page of posts: the tokens in their text (never in tags or attribute values, which never
 * render, I7), asked for in batches of the router's maximum so every rendered token gets its card.
 */
export function useThreadActionCards(
  posts: ReadonlyArray<{ contentHtml: string }>
): ThreadActionCards {
  const chunks = useMemo(
    () => chunked([...new Set(posts.flatMap((p) => parseTextActionTokens(p.contentHtml)))]),
    [posts]
  );
  return api.useQueries((t) => chunks.map((ids) => t.actionLinks.activityCards({ ids })), {
    combine: combineCards,
  });
}
