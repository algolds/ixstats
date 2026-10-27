"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { DiscussionTally } from "~/lib/discussed-in";
import { api, type RouterOutputs } from "~/trpc/react";

type Counts = RouterOutputs["actionLinks"]["discussionCounts"];

/** The router's limit per request; the first 50 ids of a list (in the order they are shown) get their counts. */
export const MAX_COUNT_IDS = 50;

const NONE: Counts = {};
const CountsContext = createContext<Counts>(NONE);

/**
 * One counts request for a list of actions (a thread page, a page of board messages, the Home feed, a country's activity):
 * the badges under it read from this context instead of asking one by one. Outside a provider a badge shows nothing.
 * The ids are cut to the first 50 in display order before they are sorted (the sort only keeps the query key stable),
 * so the counts asked for are the ones for the cards at the top of the list.
 */
export function DiscussionCountsProvider({
  activityIds,
  children,
}: {
  activityIds: readonly string[];
  children: ReactNode;
}) {
  const ids = useMemo(
    () => [...new Set(activityIds)].slice(0, MAX_COUNT_IDS).sort(),
    [activityIds]
  );
  const { data } = api.actionLinks.discussionCounts.useQuery(
    { activityIds: ids },
    {
      enabled: ids.length > 0,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      // Counts are keyed by id: while a new id set loads, the last answer still reads right for the ids it has.
      placeholderData: keepPreviousData,
    }
  );
  return <CountsContext.Provider value={data ?? NONE}>{children}</CountsContext.Provider>;
}

/** The visible discussion tally of an action; undefined while loading or outside a provider. */
export function useDiscussionCount(activityId: string): DiscussionTally | undefined {
  const counts = useContext(CountsContext);
  // An own-property read, so an id such as "constructor" cannot reach a prototype member.
  return Object.prototype.hasOwnProperty.call(counts, activityId) ? counts[activityId] : undefined;
}
