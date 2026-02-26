"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  FileText,
  Plus,
  Layers,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  HardDrive,
} from "lucide-react";
import { api } from "~/trpc/react";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { PolicyCreatorSheet } from "./PolicyCreatorSheet";
import { PolicyDetailSheet } from "./PolicyDetailSheet";
import { IxTimeDate } from "~/components/ui/ix-time-date";
import { useLocalActions } from "~/hooks/useLocalActions";

interface PoliciesAndStrategyPanelProps {
  countryId: string;
}

export function PoliciesAndStrategyPanel({ countryId }: PoliciesAndStrategyPanelProps) {
  const [showCreator, setShowCreator] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { getActions } = useLocalActions(countryId);

  // Fetch policies
  const { data: serverPolicies = [], refetch: refetchPolicies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId },
  );

  // Merge server policies with locally-saved policies
  const policies = useMemo(() => {
    const localPolicies = getActions("policy_created").map((a) => ({
      id: a.id,
      title: a.data.title as string,
      description: a.data.description as string,
      category: a.data.category as string,
      priority: a.data.priority as string,
      status: "draft",
      effectiveDate: null,
      createdAt: new Date(a.timestamp).toISOString(),
      _isLocal: true,
    }));
    return [...serverPolicies, ...localPolicies];
  }, [serverPolicies, getActions]);

  // Categorize policies
  const { active, draft, archived } = useMemo(() => {
    return {
      active: policies
        .filter((p: any) => p.status === "active")
        .sort((a: any, b: any) => new Date(b.createdAt ?? b.effectiveDate).getTime() - new Date(a.createdAt ?? a.effectiveDate).getTime()),
      draft: policies
        .filter((p: any) => p.status === "draft")
        .sort((a: any, b: any) => new Date(b.createdAt ?? b.effectiveDate).getTime() - new Date(a.createdAt ?? a.effectiveDate).getTime()),
      archived: policies
        .filter((p: any) => p.status === "archived" || p.status === "expired")
        .sort((a: any, b: any) => new Date(b.createdAt ?? b.effectiveDate).getTime() - new Date(a.createdAt ?? a.effectiveDate).getTime()),
    };
  }, [policies]);

  const getStatusBadge = (policy: any) => {
    const status = policy.status?.toLowerCase() || "draft";
    if (status === "active") {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-green-50 text-green-700 dark:bg-green-950/20">
          <CheckCircle className="h-3 w-3" />
          ACTIVE
        </Badge>
      );
    }
    if (status === "draft") {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/20">
          <Clock className="h-3 w-3" />
          DRAFT
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string | undefined | null) => {
    if (!priority) return null;
    const priorityLower = priority.toLowerCase();
    let colorClass = "";
    if (priorityLower === "critical" || priorityLower === "high") {
      colorClass = "bg-red-50 text-red-700 dark:bg-red-950/20";
    } else if (priorityLower === "medium") {
      colorClass = "bg-orange-50 text-orange-700 dark:bg-orange-950/20";
    } else {
      colorClass = "bg-blue-50 text-blue-700 dark:bg-blue-950/20";
    }
    return (
      <Badge variant="secondary" className={`flex items-center gap-1 text-xs ${colorClass}`}>
        <AlertCircle className="h-3 w-3" />
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const PolicyCard = ({ policy }: { policy: any }) => (
    <div
      className="border-border/40 bg-muted/40 cursor-pointer rounded-lg border p-3 transition-all hover:shadow-sm hover:ring-1 hover:ring-indigo-400/30"
      onClick={() => !policy._isLocal && setSelectedPolicyId(policy.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 flex-shrink-0 text-indigo-500" />
            <span className="truncate text-sm font-semibold">{policy.title}</span>
            {getStatusBadge(policy)}
            {getPriorityBadge(policy.priority)}
            {policy._isLocal && (
              <Badge variant="outline" className="gap-1 border-blue-500/30 text-[10px] text-blue-600 dark:text-blue-400">
                <HardDrive className="h-2.5 w-2.5" />
                LOCAL
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span>{policy.category ? policy.category.toUpperCase() : "GENERAL"}</span>
            <span>&middot;</span>
            {(policy.effectiveDate ?? policy.createdAt) ? (
              <span>Effective: <IxTimeDate date={policy.effectiveDate ?? policy.createdAt} accentColor="amber" /></span>
            ) : (
              <span>Effective: N/A</span>
            )}
          </div>
        </div>
      </div>
      {policy.description && (
        <div className="text-muted-foreground mt-1.5 line-clamp-2 text-xs">
          {policy.description}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-semibold">Policies & Strategy</h3>
          <SectionHelpIcon
            title="Policies & Strategy"
            content="Create and manage national policies. Policies shape your country's governance, economy, and society. New policies start as drafts."
          />
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreator(true)}
          className="gap-1.5"
        >
          <Plus className="h-3 w-3" />
          New Policy
        </Button>
      </div>

      {/* Policy Stats Strip */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="glass-hierarchy-child rounded-lg bg-green-50 p-2.5 dark:bg-green-950/20">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
            <span className="text-muted-foreground text-xs font-medium">Active</span>
          </div>
          <div className="mt-0.5 text-lg font-bold">{active.length}</div>
        </div>
        <div className="glass-hierarchy-child rounded-lg bg-yellow-50 p-2.5 dark:bg-yellow-950/20">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 flex-shrink-0 text-yellow-600" />
            <span className="text-muted-foreground text-xs font-medium">Draft</span>
          </div>
          <div className="mt-0.5 text-lg font-bold">{draft.length}</div>
        </div>
        <div className="glass-hierarchy-child rounded-lg bg-indigo-50 p-2.5 dark:bg-indigo-950/20">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 flex-shrink-0 text-indigo-600" />
            <span className="text-muted-foreground text-xs font-medium">Total</span>
          </div>
          <div className="mt-0.5 text-lg font-bold">{policies.length}</div>
        </div>
      </div>

      {/* Active Policies */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Active Policies
          </CardTitle>
        </CardHeader>
        <CardContent>
          {active.length > 0 ? (
            <div className="space-y-3">
              {active.map((policy: any) => (
                <PolicyCard key={policy.id} policy={policy} />
              ))}
            </div>
          ) : (
            <div className="border-border/50 text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm">
              <FileText className="text-muted-foreground/70 h-6 w-6" />
              <p>No active policies.</p>
              <Button variant="outline" onClick={() => setShowCreator(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create first policy
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Draft Policies */}
      {draft.length > 0 && (
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Draft Policies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {draft.map((policy: any) => (
                <PolicyCard key={policy.id} policy={policy} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Archived Policies (collapsed by default) */}
      {archived.length > 0 && (
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex w-full items-center justify-between"
            >
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-gray-600" />
                Archived Policies
                <Badge variant="secondary" className="ml-1">{archived.length}</Badge>
              </CardTitle>
              {showArchived ? <ChevronDown className="text-muted-foreground h-4 w-4" /> : <ChevronRight className="text-muted-foreground h-4 w-4" />}
            </button>
          </CardHeader>
          {showArchived && (
            <CardContent>
              <div className="space-y-3">
                {archived.slice(0, 5).map((policy: any) => (
                  <PolicyCard key={policy.id} policy={policy} />
                ))}
                {archived.length > 5 && (
                  <div className="text-muted-foreground pt-2 text-center text-sm">
                    Showing 5 of {archived.length} archived policies
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
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
