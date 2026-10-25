"use client";

import { api } from "~/trpc/react";

/** Shared query options so the nav badge and the inbox read the same cache entries. */
export const INBOX_QUERY_OPTIONS = { retry: false, staleTime: 60_000 } as const;

/**
 * Count of incoming items awaiting this country's answer: cooperative foreign-policy
 * proposals plus alliance invites. Both procedures require write access to the country,
 * so this is only meaningful for the owner's own country.
 */
export function useDiplomacyInboxCount(countryId: string | null | undefined, enabled = true) {
  const opts = { ...INBOX_QUERY_OPTIONS, enabled: !!countryId && enabled };
  const input = { countryId: countryId ?? "" };
  const proposals = api.diplomaticPolicies.getForeignPolicyProposals.useQuery(input, opts);
  const invites = api.diplomaticPolicies.getAllianceInvites.useQuery(input, opts);
  return {
    count: (proposals.data?.length ?? 0) + (invites.data?.length ?? 0),
    isLoading: proposals.isLoading || invites.isLoading,
    isError: proposals.isError || invites.isError,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Expires in 5 days" / "Expires within a day" / "Expired" for a pending item. */
export function formatExpiry(expiresAt: Date | string, now: number = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / DAY_MS);
  if (days < 1) return "Expires within a day";
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

export const FP_PROPOSAL_LABELS: Record<string, string> = {
  free_trade: "Free trade agreement",
  military_alliance: "Military alliance",
};

export const HOSTILE_ACTION_LABELS: Record<string, string> = {
  sanction: "Sanctions",
  embargo: "Trade embargo",
  blockade: "Blockade",
};

/** What lifting ends, with its verb: plural sanctions "end", one embargo or blockade "ends". */
const LIFT_SUBJECTS: Record<string, string> = {
  sanction: "The sanctions on {target} end now.",
  embargo: "The trade embargo on {target} ends now.",
  blockade: "The blockade on {target} ends now.",
};

/** The lift confirm's first sentence, naming the target as it is displayed ("The sanctions on E2E Bravoland end now."). */
export function liftConfirmSentence(
  actionType: string,
  targetName: string | null | undefined
): string {
  const target = targetName ? targetName.replace(/_/g, " ") : "the other nation";
  return (LIFT_SUBJECTS[actionType] ?? "This action on {target} ends now.").replace(
    "{target}",
    target
  );
}
