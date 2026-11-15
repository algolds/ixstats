"use client";

import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
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
    <Card content="data" padding="none">
      <CardHeader className="border-separator/60 border-b p-4">
        <CardTitle className="text-headline">Executive policies in force</CardTitle>
        <CardDescription className="text-footnote mt-0.5">
          Enacted from Directives. Repealing one ends its effects from now on.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4">
            <Skeleton className="rounded-control h-16" />
          </div>
        ) : policies.length === 0 ? (
          <div className="p-4">
            <EmptyState compact title="No executive policies in force" />
          </div>
        ) : (
          <ul className="divide-separator/60 divide-y">
            {policies.map((policy) => (
              <li
                key={policy.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-label text-body truncate font-medium">{policy.name}</p>
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
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
