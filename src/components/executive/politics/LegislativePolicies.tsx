"use client";

import { useState } from "react";
import { Page as ScrollText, Plus, Page as FileText } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { PolicyCreatorSheet } from "~/components/executive/PolicyCreatorSheet";

interface LegislativePoliciesProps {
  countryId: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-green/10 text-green-ink border-0",
  },
  draft: {
    label: "Draft",
    className: "bg-yellow/10 text-yellow-ink border-0",
  },
  suspended: {
    label: "Suspended",
    className: "bg-orange/10 text-orange-ink border-0",
  },
  expired: { label: "Expired", className: "bg-fill-3 text-label-secondary border-0" },
  repealed: {
    label: "Repealed",
    className: "bg-red/10 text-red-ink border-0",
  },
};

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  critical: {
    label: "Critical",
    className: "bg-red/10 text-red-ink border-0",
  },
  high: {
    label: "High",
    className: "bg-orange/10 text-orange-ink border-0",
  },
  medium: {
    label: "Medium",
    className: "bg-blue/10 text-blue-ink border-0",
  },
  low: {
    label: "Low",
    className: "bg-surface-secondary text-label border-0",
  },
};

export function LegislativePolicies({ countryId }: LegislativePoliciesProps) {
  const [creatorOpen, setCreatorOpen] = useState(false);

  const { data: policies, refetch } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const visiblePolicies = (policies ?? []).slice(0, 6);
  const extraCount = (policies?.length ?? 0) - 6;

  return (
    <div className="border-separator rounded-row space-y-3 border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="text-green h-4 w-4" />
          <span className="text-headline">Laws & Active Policies</span>
          {policies && policies.length > 0 && (
            <Badge variant="outline" className="text-footnote">
              {policies.length} total
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-footnote h-7 gap-1"
          onClick={() => setCreatorOpen(true)}
        >
          <Plus className="h-3 w-3" />
          New Policy
        </Button>
      </div>

      {visiblePolicies.length > 0 ? (
        <div className="space-y-2">
          {visiblePolicies.map((policy) => {
            const statusMeta = STATUS_BADGE[policy.status] ?? STATUS_BADGE.draft!;
            const priorityMeta =
              PRIORITY_BADGE[policy.priority ?? "medium"] ?? PRIORITY_BADGE.medium!;
            return (
              <div
                key={policy.id}
                className="bg-fill-4 rounded-control-sm flex items-center gap-2 px-3 py-2"
              >
                <FileText className="text-label-secondary h-3.5 w-3.5 shrink-0" />
                <span className="text-body min-w-0 flex-1 truncate">{policy.name}</span>
                <span className="text-label-secondary text-footnote hidden capitalize sm:inline">
                  {policy.category}
                </span>
                <Badge className={`text-footnote px-2 py-0 ${priorityMeta.className}`}>
                  {priorityMeta.label}
                </Badge>
                <Badge className={`text-footnote px-2 py-0 ${statusMeta.className}`}>
                  {statusMeta.label}
                </Badge>
              </div>
            );
          })}
          {extraCount > 0 && (
            <p className="text-label-secondary text-footnote pt-1">
              + {extraCount} more {extraCount === 1 ? "policy" : "policies"}
            </p>
          )}
        </div>
      ) : (
        <div className="text-label-secondary flex flex-col items-center justify-center gap-2 py-6 text-center">
          <ScrollText className="h-8 w-8 opacity-30" />
          <p className="text-body">No policies enacted</p>
          <p className="text-footnote">Create your first bill using the button above.</p>
        </div>
      )}

      <PolicyCreatorSheet
        countryId={countryId}
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        onCreated={() => {
          void refetch();
        }}
      />
    </div>
  );
}
