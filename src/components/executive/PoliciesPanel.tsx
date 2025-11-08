"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { FileText, Plus, Layers, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { api } from "~/trpc/react";
import { PolicyCreator } from "~/components/quickactions/PolicyCreator";
import { SectionHelpIcon } from "~/components/ui/help-icon";

interface PoliciesPanelProps {
  countryId: string;
}

export function PoliciesPanel({ countryId }: PoliciesPanelProps) {
  const [policyCreatorOpen, setPolicyCreatorOpen] = useState(false);

  // Fetch policies
  const { data: policies = [], refetch: refetchPolicies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

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
    let variant: "default" | "destructive" | "secondary" = "secondary";
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

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const PolicyCard = ({ policy }: { policy: any }) => {
    return (
      <div className="border-border/40 bg-muted/40 rounded-lg border p-4 transition-all hover:shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-50 p-2 dark:bg-indigo-950/20">
              <FileText className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <div className="text-foreground font-semibold">{policy.title}</div>
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
                <span>{policy.category ? policy.category.toUpperCase() : "GENERAL"}</span>
                <span>•</span>
                <span>Effective: {formatDate(policy.effectiveDate ?? policy.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            {getStatusBadge(policy)}
            {getPriorityBadge(policy.priority)}
          </div>
        </div>

        {policy.description && (
          <div className="text-muted-foreground mt-3 line-clamp-2 text-sm">
            {policy.description}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Policy Creator Modal */}
      <PolicyCreator
        countryId={countryId}
        open={policyCreatorOpen}
        onOpenChange={(open) => {
          setPolicyCreatorOpen(open);
          if (!open) {
            void refetchPolicies();
          }
        }}
        onSuccess={() => {
          void refetchPolicies();
        }}
      />

      <div className="space-y-6">
        {/* Header Card */}
        <Card className="glass-hierarchy-child border-border">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Executive Policy Management
                <SectionHelpIcon
                  title="Policy Management"
                  content="Create and manage national policies that guide your country's governance. Policies can affect economic development, social programs, foreign relations, and more. Draft policies for review, activate them to implement changes, and archive outdated policies to maintain an organized policy framework."
                />
              </CardTitle>
              <CardDescription>
                Create, review, and manage national policies and directives
              </CardDescription>
            </div>
            <Button onClick={() => setPolicyCreatorOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Policy
            </Button>
          </CardHeader>
        </Card>

        {/* Policy Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="glass-hierarchy-child">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Active</p>
                  <p className="mt-2 text-3xl font-bold">{active.length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-hierarchy-child">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Draft</p>
                  <p className="mt-2 text-3xl font-bold">{draft.length}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="glass-hierarchy-child">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Total</p>
                  <p className="mt-2 text-3xl font-bold">{policies.length}</p>
                </div>
                <Layers className="h-8 w-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Policies */}
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Active Policies
              <SectionHelpIcon
                title="Active Policies"
                content="Policies currently in effect across your nation. These policies are actively shaping your country's governance, economy, and society. Review active policies regularly to ensure they align with your current strategic goals. Policies can be archived when they're no longer needed or relevant."
              />
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
              <div className="border-border/50 text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center text-sm">
                <FileText className="text-muted-foreground/70 h-8 w-8" />
                <p>No active policies.</p>
                <Button variant="outline" onClick={() => setPolicyCreatorOpen(true)} className="gap-2">
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

        {/* Archived Policies */}
        {archived.length > 0 && (
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-gray-600" />
                Archived Policies
              </CardTitle>
            </CardHeader>
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
          </Card>
        )}
      </div>
    </>
  );
}
