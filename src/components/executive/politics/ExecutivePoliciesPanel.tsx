"use client";

import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { RepealPolicyButton } from "./RepealPolicyButton";

interface ExecutivePoliciesPanelProps {
  countryId: string;
}

/**
 * Executive policies in force (enacted from Directives, "Draft a custom policy"), each repealable.
 * Laws passed by the legislature are listed with their bills.
 */
export function ExecutivePoliciesPanel({ countryId }: ExecutivePoliciesPanelProps) {
  const { data, isLoading, refetch } = api.policies.getPolicies.useQuery(
    { countryId, status: "active" },
    { enabled: !!countryId }
  );
  const policies = (data ?? []).filter((p) => p.policyType !== "legislative_bill");

  return (
    <Card className="flex flex-col gap-6 py-6">
      <CardHeader className="pb-0">
        <CardTitle className="text-body">Executive policies in force</CardTitle>
        <CardDescription className="text-body">
          Enacted from Directives. Repealing one ends its effects from now on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {isLoading ? (
          <Skeleton className="rounded-row h-16" />
        ) : policies.length === 0 ? (
          <p className="text-label-secondary text-footnote">No executive policies in force.</p>
        ) : (
          policies.map((policy) => (
            <div
              key={policy.id}
              className="bg-fill-4 border-separator rounded-row flex items-center justify-between gap-3 border p-3"
            >
              <div className="min-w-0">
                <p className="text-body truncate font-medium">{policy.name}</p>
                <p className="text-label-secondary text-footnote tabular-nums">
                  {policy.category}
                  {policy.gdpEffect
                    ? `, ${policy.gdpEffect > 0 ? "+" : ""}${policy.gdpEffect}% GDP`
                    : ""}
                </p>
              </div>
              <RepealPolicyButton
                policyId={policy.id}
                policyName={policy.name}
                onRepealed={() => void refetch()}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
