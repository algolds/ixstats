"use client";

import { useMemo } from "react";
import { WarningTriangle as AlertTriangle, CheckCircle as CheckCircle2 } from "iconoir-react";
import { api } from "~/trpc/react";
import { IssueCard } from "~/components/executive/issues";

interface LegislativeIssuesProps {
  countryId: string;
}

export function LegislativeIssues({ countryId }: LegislativeIssuesProps) {
  const { data: issueData } = api.nationalIssues.getMyIssues.useQuery(
    { countryId, status: "active", limit: 50 },
    { enabled: !!countryId }
  );

  const governanceIssues = useMemo(() => {
    const issues = issueData?.issues ?? [];
    return issues
      .filter((issue) => {
        const dom = (issue.domain ?? "").toLowerCase();
        const cat = (issue.category ?? "").toLowerCase();
        return dom === "political" || cat === "governance";
      })
      .slice()
      .sort((a, b) => {
        const aSev = String(a.severity ?? "").toLowerCase();
        const bSev = String(b.severity ?? "").toLowerCase();
        const sevRank = (s: string) =>
          s === "critical" ? 4 : s === "high" ? 3 : s === "medium" ? 2 : 1;
        const scoreA = sevRank(aSev) * 100 + (a.urgency ?? 0);
        const scoreB = sevRank(bSev) * 100 + (b.urgency ?? 0);
        return scoreB - scoreA;
      })
      .slice(0, 5);
  }, [issueData]);

  return (
    <div className="facet-hierarchy-child border-border space-y-3 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-semibold">Governance Issues</span>
        {governanceIssues.length > 0 && (
          <span className="ml-auto text-xs font-medium text-amber-600 dark:text-amber-400">
            {governanceIssues.length} pending
          </span>
        )}
      </div>

      {governanceIssues.length > 0 ? (
        <div className="space-y-2">
          {governanceIssues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              variant="compact"
              onView={() => {
                /* Respond via the main issues inbox */
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
          <p className="text-sm">No active governance issues</p>
          <p className="text-xs">Your legislative agenda is clear.</p>
        </div>
      )}
    </div>
  );
}
