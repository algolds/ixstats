import { useMemo } from "react";
import type { ActionCardData } from "~/components/action-links";
import { parseActionTokens } from "~/lib/action-links";
import { api } from "~/trpc/react";

/** actionLinks.activityCards accepts at most this many ids per call. */
const MAX_IDS = 50;

export interface ThreadActionCards {
  cards: ReadonlyMap<string, ActionCardData>;
  /** The batch settled successfully, or no post has a token. A missing card is only "unverified" when ready. */
  ready: boolean;
  /** The batch request failed, so absent cards say nothing about verification. */
  errored: boolean;
}

/** One batched activityCards query for every action token across a page of posts. */
export function useThreadActionCards(
  posts: ReadonlyArray<{ contentHtml: string }>
): ThreadActionCards {
  const ids = useMemo(
    // Slice to the router's cap; tokens past it render as "Unverified action".
    () => [...new Set(posts.flatMap((p) => parseActionTokens(p.contentHtml)))].slice(0, MAX_IDS),
    [posts]
  );
  const { data, isSuccess, isError } = api.actionLinks.activityCards.useQuery(
    { ids },
    { enabled: ids.length > 0 }
  );
  const cards = useMemo(() => new Map((data ?? []).map((card) => [card.id, card])), [data]);
  return { cards, ready: ids.length === 0 || isSuccess, errored: isError };
}
