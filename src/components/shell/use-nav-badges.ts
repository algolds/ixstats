"use client";
/** Live values for the source list's badge keys. Signed out, or still loading, means no badges. */
import { useMemo, useSyncExternalStore } from "react";
import { api } from "~/trpc/react";
import { useUserCountry } from "~/hooks/useUserCountry";
import { useDiplomacyInboxCount } from "~/components/mycountry/domains/diplomacy/inbox/useDiplomacyInbox";
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

  // The input is optional and the server reads the user from the session. The shell is the only
  // reader of this no-argument entry; the Messages hooks invalidate it when mail is read or moved,
  // which is how an unread change reaches this badge. New mail elsewhere arrives by polling.
  // ponytail: 15s poll (paused in background tabs); push it over a per-user socket room if that lags.
  const { data: folderCounts } = api.messages.getFolderCounts.useQuery(undefined, {
    enabled: signedIn,
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
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
    if (inbox.count > 0) badges["diplomacy-inbox"] = { kind: "count", value: inbox.count };
    const unread = folderCounts?.inbox ?? 0;
    if (unread > 0) badges["messages-unread"] = { kind: "count", value: unread };
    const issues = pendingIssues?.total ?? 0;
    if (issues > 0) badges["issues-pending"] = { kind: "count", value: issues };
    if (unseenBuild) badges["whats-new"] = { kind: "action", label: "New" };
    if (balance?.canClaimDailyBonus) {
      badges["daily-reward"] = {
        kind: "action",
        label: balance.loginStreak > 0 ? `${balance.loginStreak}d` : "New",
      };
    }
    return badges;
  }, [signedIn, inbox.count, balance, folderCounts?.inbox, pendingIssues?.total, unseenBuild]);
}
