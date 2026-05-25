"use client";

import { useState } from "react";
import { ScrollText, Plus, FileText } from "lucide-react";
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
    className: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 border-0",
  },
  draft: {
    label: "Draft",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-0",
  },
  suspended: {
    label: "Suspended",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400 border-0",
  },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground border-0" },
  repealed: {
    label: "Repealed",
    className: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 border-0",
  },
};

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  critical: {
    label: "Critical",
    className: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 border-0",
  },
  high: {
    label: "High",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400 border-0",
  },
  medium: {
    label: "Medium",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border-0",
  },
  low: {
    label: "Low",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-400 border-0",
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
    <div className="glass-hierarchy-child border-border space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold">Laws & Active Policies</span>
          {policies && policies.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {policies.length} total
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          onClick={() => setCreatorOpen(true)}
        >
          <Plus className="h-3 w-3" />
          New Policy
        </Button>
      </div>

      {visiblePolicies.length > 0 ? (
        <div className="space-y-1.5">
          {visiblePolicies.map((policy) => {
            const statusMeta = STATUS_BADGE[policy.status] ?? STATUS_BADGE.draft!;
            const priorityMeta =
              PRIORITY_BADGE[policy.priority ?? "medium"] ?? PRIORITY_BADGE.medium!;
            return (
              <div
                key={policy.id}
                className="bg-muted/30 flex items-center gap-2 rounded-md px-2.5 py-1.5"
              >
                <FileText className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm">{policy.name}</span>
                <span className="text-muted-foreground hidden text-[10px] capitalize sm:inline">
                  {policy.category}
                </span>
                <Badge className={`px-1.5 py-0 text-[10px] ${priorityMeta.className}`}>
                  {priorityMeta.label}
                </Badge>
                <Badge className={`px-1.5 py-0 text-[10px] ${statusMeta.className}`}>
                  {statusMeta.label}
                </Badge>
              </div>
            );
          })}
          {extraCount > 0 && (
            <p className="text-muted-foreground pt-1 text-xs">
              + {extraCount} more {extraCount === 1 ? "policy" : "policies"}
            </p>
          )}
        </div>
      ) : (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-6 text-center">
          <ScrollText className="h-8 w-8 opacity-30" />
          <p className="text-sm">No policies enacted</p>
          <p className="text-xs">Create your first bill using the button above.</p>
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
