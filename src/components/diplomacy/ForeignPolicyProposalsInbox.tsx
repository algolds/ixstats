"use client";

/**
 * ForeignPolicyProposalsInbox — Statecraft S2.C (foreign consent).
 *
 * Cooperative foreign-policy actions (free trade, alliance) proposed *to* this country
 * land here for the target to accept (→ enacted) or decline. Renders nothing when empty.
 * See plans/statecraft-stage2.md.
 */

import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Handshake, Check, X } from "lucide-react";

const ACTION_LABEL: Record<string, string> = {
  free_trade: "Free Trade Agreement",
  military_alliance: "Military Alliance",
};

export function ForeignPolicyProposalsInbox({
  countryId,
  onResponded,
}: {
  countryId: string;
  onResponded?: () => void;
}) {
  const notify = useNotify();
  const utils = api.useUtils();

  const { data: proposals } = api.diplomaticPolicies.getForeignPolicyProposals.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const respond = api.diplomaticPolicies.respondToForeignPolicyProposal.useMutation({
    onSuccess: (res) => {
      notify.success(res.status === "active" ? "Proposal accepted" : "Proposal declined");
      void utils.diplomaticPolicies.getForeignPolicyProposals.invalidate({ countryId });
      void utils.diplomaticPolicies.getActiveForeignPolicies.invalidate({ countryId });
      onResponded?.();
    },
    onError: (e) => notify.error("Could not respond", e.message),
  });

  if (!proposals || proposals.length === 0) return null;

  return (
    <div className="glass-hierarchy-child rounded-lg border border-amber-500/20 p-3">
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
        <Handshake className="h-3.5 w-3.5 text-amber-500" />
        Incoming Proposals ({proposals.length})
      </h4>
      <div className="space-y-2">
        {proposals.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-md bg-white/[0.03] p-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">
                {ACTION_LABEL[p.actionType] ?? p.actionType}
              </p>
              <p className="text-muted-foreground truncate text-[10px]">
                from {p.initiator.name}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-emerald-500"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ actionId: p.id, choice: "accept" })}
            >
              <Check className="h-3 w-3" /> Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground h-7 gap-1"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ actionId: p.id, choice: "decline" })}
            >
              <X className="h-3 w-3" /> Decline
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
