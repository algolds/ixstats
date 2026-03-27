"use client";

import { useState, useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  FileText,
  Plus,
  ChevronDown,
  ChevronRight,
  Tag,
  Calendar,
} from "lucide-react";
import { api } from "~/trpc/react";
import { PolicyCreatorSheet } from "./PolicyCreatorSheet";
import { PolicyDetailSheet } from "./PolicyDetailSheet";
import { IxTimeDate } from "~/components/ui/ix-time-date";
import { useLocalActions } from "~/hooks/useLocalActions";
import { ExecutiveItemCard } from "./ExecutiveItemCard";

interface PoliciesAndStrategyPanelProps {
  countryId: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "red",
  high: "amber",
  medium: "blue",
  low: "slate",
};

export function PoliciesAndStrategyPanel({ countryId }: PoliciesAndStrategyPanelProps) {
  const [showCreator, setShowCreator] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { getActions } = useLocalActions(countryId);

  const { data: serverPolicies = [], refetch: refetchPolicies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId },
  );

  const policies = useMemo(() => {
    const localPolicies = getActions("policy_created").map((a) => ({
      id: a.id,
      title: a.data.title as string,
      description: a.data.description as string,
      category: a.data.category as string,
      priority: a.data.priority as string,
      policyType: a.data.policyType as string | undefined,
      status: "draft",
      effectiveDate: null,
      createdAt: new Date(a.timestamp).toISOString(),
      _isLocal: true,
    }));
    return [...serverPolicies, ...localPolicies];
  }, [serverPolicies, getActions]);

  const { active, draft, archived } = useMemo(() => {
    return {
      active: policies
        .filter((p: any) => p.status === "active")
        .sort((a: any, b: any) => new Date(b.createdAt ?? b.effectiveDate).getTime() - new Date(a.createdAt ?? a.effectiveDate).getTime()),
      draft: policies
        .filter((p: any) => p.status === "draft")
        .sort((a: any, b: any) => new Date(b.createdAt ?? b.effectiveDate).getTime() - new Date(a.createdAt ?? a.effectiveDate).getTime()),
      archived: policies
        .filter((p: any) => p.status === "archived" || p.status === "expired" || p.status === "suspended" || p.status === "repealed")
        .sort((a: any, b: any) => new Date(b.createdAt ?? b.effectiveDate).getTime() - new Date(a.createdAt ?? a.effectiveDate).getTime()),
    };
  }, [policies]);

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active": return { label: "ACTIVE", colorClass: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" };
      case "draft": return { label: "DRAFT", colorClass: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400" };
      default: return { label: status?.toUpperCase() ?? "UNKNOWN", colorClass: "bg-slate-100 text-slate-700 dark:bg-slate-950/30 dark:text-slate-400" };
    }
  };

  const getPriorityBadge = (priority: string | undefined | null) => {
    if (!priority) return null;
    const p = priority.toLowerCase();
    const colorMap: Record<string, string> = {
      critical: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
      high: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
      medium: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
      low: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    };
    return { label: priority.toUpperCase(), colorClass: colorMap[p] ?? "bg-slate-100 text-slate-700" };
  };

  const renderPolicyCard = (policy: any) => {
    const priorityColor = PRIORITY_COLORS[policy.priority?.toLowerCase()] ?? "slate";
    const badges = [getStatusBadge(policy.status)];
    const priorityBadge = getPriorityBadge(policy.priority);
    if (priorityBadge) badges.push(priorityBadge);

    return (
      <ExecutiveItemCard
        key={policy.id}
        accentColor={priorityColor}
        icon={FileText}
        title={policy.title ?? policy.name ?? "Untitled Policy"}
        subtitle={
          <span className="flex items-center gap-1.5 flex-wrap">
            <span>{(policy.category ?? policy.policyType ?? "general").toUpperCase()}</span>
            <span className="text-muted-foreground">•</span>
            {(policy.effectiveDate ?? policy.createdAt) ? (
              <span>
                <IxTimeDate date={policy.effectiveDate ?? policy.createdAt} accentColor="amber" />
              </span>
            ) : (
              <span>Date: N/A</span>
            )}
          </span>
        }
        description={policy.description}
        badges={badges}
        isLocal={policy._isLocal}
        onClick={!policy._isLocal ? () => setSelectedPolicyId(policy.id) : undefined}
        metrics={[
          { icon: Tag, label: "Type", value: (policy.policyType ?? policy.category ?? "general") },
          ...(policy.effectiveDate ? [{ icon: Calendar, label: "Effective", value: new Date(policy.effectiveDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }] : []),
        ]}
      />
    );
  };

  return (
    <div className="space-y-3 mt-3">
      {/* Active Policies */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Policies</h4>
          <Button size="sm" variant="ghost" onClick={() => setShowCreator(true)} className="h-6 px-2 text-xs gap-1">
            <Plus className="h-3 w-3" /> New
          </Button>
        </div>
        {active.length > 0 ? (
          <div className="space-y-2">
            {active.slice(0, 5).map(renderPolicyCard)}
            {active.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{active.length - 5} more active policies
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/50 p-6 text-center">
            <FileText className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No active policies</p>
            <Button variant="outline" size="sm" onClick={() => setShowCreator(true)} className="gap-1.5 text-xs h-7">
              <Plus className="h-3 w-3" /> Create first policy
            </Button>
          </div>
        )}
      </div>

      {/* Draft Policies */}
      {draft.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Drafts</h4>
          <div className="space-y-2">
            {draft.map(renderPolicyCard)}
          </div>
        </div>
      )}

      {/* Archived Policies (collapsed) */}
      {archived.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 hover:text-foreground transition-colors"
          >
            {showArchived ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Archived
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{archived.length}</Badge>
          </button>
          {showArchived && (
            <div className="space-y-2">
              {archived.slice(0, 5).map(renderPolicyCard)}
              {archived.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  Showing 5 of {archived.length} archived
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sheets */}
      <PolicyCreatorSheet
        countryId={countryId}
        open={showCreator}
        onOpenChange={setShowCreator}
        onCreated={() => void refetchPolicies()}
      />

      <PolicyDetailSheet
        policyId={selectedPolicyId}
        onClose={() => setSelectedPolicyId(null)}
        countryId={countryId}
        onPolicyChanged={() => void refetchPolicies()}
      />
    </div>
  );
}
