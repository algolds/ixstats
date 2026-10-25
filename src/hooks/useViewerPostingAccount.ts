"use client";

import { api } from "~/trpc/react";
import { pickPostingAccount } from "~/lib/thinkpages/posting-account";

/** The viewer's ThinkPages account that posts for `countryId`, or null when they have none (or are signed out). */
export function useViewerPostingAccount(countryId: string | null | undefined, enabled = true) {
  const { data: accounts } = api.thinkpages.getMyAccounts.useQuery(undefined, {
    enabled: enabled && !!countryId,
    staleTime: 60_000,
  });
  return accounts ? pickPostingAccount(accounts, countryId) : null;
}
