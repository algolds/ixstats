"use client";
/** Live values for the source list's badge keys. Signed out, or still loading, means no badges. */
import { useMemo, useSyncExternalStore } from "react";
import { api } from "~/trpc/react";
import { useUserCountry } from "~/hooks/useUserCountry";
import { useDiplomacyInboxCount } from "~/components/mycountry/domains/diplomacy/inbox/useDiplomacyInbox";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import type { NavBadges } from "~/lib/navigation/app-sections";
import {
  currentVersionKey,
  readSeenVersion,
  subscribeSeenVersion,
} from "~/lib/navigation/seen-version";

export function useNavBadges(signedIn: boolean): NavBadges {
  const { country } = useUserCountry();
  const inbox = useDiplomacyInboxCount(country?.id, signedIn);
  const { data: balance } = api.vault.getBalance.useQuery(undefined, { enabled: signedIn });

  // The input is optional and the server reads the user from the session. The Messages page calls
  // this with `{ userId }`, so it is a separate cache entry; both are refreshed by a no-argument
  // invalidate, which is how an unread change there reaches this badge. Polled lightly, as other
  // unread badges.
  const { data: folderCounts } = api.messages.getFolderCounts.useQuery(undefined, {
    enabled: signedIn,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  // Pending issues, as the old dashboard player widget counted them (shown on Directives).
  const countryId = signedIn ? country?.id : undefined;
  const forCountry = {
    enabled: Boolean(countryId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  };
  const { data: pendingIssues } = api.nationalIssues.getPendingCount.useQuery(
    { countryId: countryId ?? "" },
    forCountry
  );
  // The server snapshot is the running build, so the flag never renders (or mismatches) before hydration.
  const seenVersion = useSyncExternalStore(
    subscribeSeenVersion,
    readSeenVersion,
    currentVersionKey
  );
  const unseenBuild = seenVersion !== currentVersionKey();

  return useMemo(() => {
    if (!signedIn) return {};
    const badges: NavBadges = {};
    const flag = normalizeFlagUrl(country?.flag);
    if (flag && country) {
      badges["mycountry-flag"] = { kind: "icon", src: flag, alt: country.name };
    }
    if (inbox.count > 0) badges["diplomacy-inbox"] = { kind: "count", value: inbox.count };
    const unread = folderCounts?.inbox ?? 0;
    if (unread > 0) badges["messages-unread"] = { kind: "count", value: unread };
    const issues = pendingIssues?.total ?? 0;
    if (issues > 0) badges["issues-pending"] = { kind: "count", value: issues };
    if (unseenBuild) badges["whats-new"] = { kind: "action", label: "New" };
    if (balance) {
      badges["vault-balance"] = {
        kind: "value",
        label: `${Math.floor(balance.credits).toLocaleString()} IxC`,
      };
      if (balance.canClaimDailyBonus) {
        badges["daily-reward"] = {
          kind: "action",
          label: balance.loginStreak > 0 ? `${balance.loginStreak}d` : "New",
        };
      }
    }
    return badges;
  }, [
    signedIn,
    country,
    inbox.count,
    balance,
    folderCounts?.inbox,
    pendingIssues?.total,
    unseenBuild,
  ]);
}
