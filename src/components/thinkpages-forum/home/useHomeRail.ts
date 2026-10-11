"use client";

import { api } from "~/trpc/react";
import { hasStanding } from "../StandingPanel";

const FIND_A_REALM = "find-a-realm";
const ADVERTS_SHOWN = 3;
const THINKTANKS_SHOWN = 4;

function nonEmpty<T>(list: readonly T[] | undefined): readonly T[] | undefined {
  return list && list.length > 0 ? list : undefined;
}

const newestFirst = (a: { lastActivity: Date }, b: { lastActivity: Date }) =>
  new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();

/**
 * The Forums home rail's data, each panel `undefined` when it has nothing to show: Latest activity, Trending, open
 * Find a Realm adverts, ThinkTanks (the member's own, else the most recently active) and the member's standing.
 */
export function useHomeRail(signedIn: boolean) {
  const { data: activity } = api.thinkpagesForum.latestActivity.useQuery();
  const { data: trending } = api.thinkpagesForum.trending.useQuery();
  const { data: realmAds } = api.thinkpagesForum.category.useQuery({
    key: FIND_A_REALM,
    page: 1,
    sort: "latest",
  });
  const { data: joined } = api.thinkpages.getThinktanks.useQuery(
    { type: "joined" },
    { enabled: signedIn }
  );
  const fallBack = !signedIn || (joined !== undefined && joined.length === 0);
  const { data: all } = api.thinkpages.getThinktanks.useQuery(
    { type: "all" },
    { enabled: fallBack }
  );
  const { data: standing } = api.thinkpagesForum.myStanding.useQuery(undefined, {
    enabled: signedIn,
  });

  const adverts = realmAds?.threads
    .filter((t) => t.advert?.claimsOpen && !t.locked)
    .slice(0, ADVERTS_SHOWN);
  const tanks = [...((fallBack ? all : joined) ?? [])].sort(newestFirst).slice(0, THINKTANKS_SHOWN);

  return {
    activity: nonEmpty(activity),
    trending: nonEmpty(trending),
    adverts: nonEmpty(adverts),
    thinktanks: nonEmpty(tanks),
    thinktanksJoined: !fallBack,
    standing: signedIn && hasStanding(standing) ? standing : undefined,
  };
}
