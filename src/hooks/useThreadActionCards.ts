import { useMemo } from "react";
import type { ActionCardData } from "~/components/action-links";
import { parseActionTokens } from "~/lib/action-links";
import { api } from "~/trpc/react";

/** actionLinks.activityCards accepts at most this many ids per call. */
const MAX_IDS = 50;

/** One batched activityCards query for every action token across a page of posts. */
export function useThreadActionCards(
  posts: ReadonlyArray<{ contentHtml: string }>
): ReadonlyMap<string, ActionCardData> {
  const ids = useMemo(
    // Slice to the router's cap; tokens past it render as "Unverified action".
    () => [...new Set(posts.flatMap((p) => parseActionTokens(p.contentHtml)))].slice(0, MAX_IDS),
    [posts]
  );
  const { data } = api.actionLinks.activityCards.useQuery({ ids }, { enabled: ids.length > 0 });
  return useMemo(() => new Map((data ?? []).map((card) => [card.id, card])), [data]);
}
