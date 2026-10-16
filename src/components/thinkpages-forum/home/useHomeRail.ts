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
 * The Forums home's side data, each part `undefined` when it has nothing to show: the New across ThinkPages feed (main
 * column), then the rail's Trending, open Find a Realm adverts, ThinkTanks (the member's own, else the most recently
 * active) and the member's standing.
 */
export function useHomeRail(signedIn: boolean) {
  const { data: activity } = api.thinkpagesForum.latestActivity.useQuery();
  const { data: trending } = api.thinkpagesForum.trending.useQuery();
  const { data: realmAds } = api.thinkpagesForum.category.useQuery({
    key: FIND_A_REALM,
    page: 1,
    sort: "latest",
  });
  // `all` is the list the ThinkTanks page shows (realm boards left out); `isMember` marks the viewer's own.
  const { data: thinktanks } = api.thinkpages.getThinktanks.useQuery({ type: "all" });
  const { data: standing } = api.thinkpagesForum.myStanding.useQuery(undefined, {
    enabled: signedIn,
  });

  const adverts = realmAds?.threads
    .filter((t) => t.advert?.claimsOpen && !t.locked)
    .slice(0, ADVERTS_SHOWN);
  const own = thinktanks?.filter((t) => t.isMember) ?? [];
  const joined = signedIn && own.length > 0;
  const tanks = [...(joined ? own : (thinktanks ?? []))]
    .sort(newestFirst)
    .slice(0, THINKTANKS_SHOWN);

  return {
    activity: nonEmpty(activity),
    trending: nonEmpty(trending),
    adverts: nonEmpty(adverts),
    thinktanks: nonEmpty(tanks),
    thinktanksJoined: joined,
    standing: signedIn && hasStanding(standing) ? standing : undefined,
  };
}
