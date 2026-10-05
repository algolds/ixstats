"use client";
/** Live values for the source list's badge keys. Signed out, or still loading, means no badges. */
import { useMemo } from "react";
import { api } from "~/trpc/react";
import { useUserCountry } from "~/hooks/useUserCountry";
import { useDiplomacyInboxCount } from "~/components/mycountry/domains/diplomacy/inbox/useDiplomacyInbox";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import type { NavBadges } from "~/lib/navigation/app-sections";

export function useNavBadges(signedIn: boolean): NavBadges {
  const { country } = useUserCountry();
  const inbox = useDiplomacyInboxCount(country?.id, signedIn);
  const { data: balance } = api.vault.getBalance.useQuery(undefined, { enabled: signedIn });

  return useMemo(() => {
    if (!signedIn) return {};
    const badges: NavBadges = {};
    const flag = normalizeFlagUrl(country?.flag);
    if (flag && country) {
      badges["mycountry-flag"] = { kind: "icon", src: flag, alt: country.name };
    }
    if (inbox.count > 0) badges["diplomacy-inbox"] = { kind: "count", value: inbox.count };
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
  }, [signedIn, country, inbox.count, balance]);
}
