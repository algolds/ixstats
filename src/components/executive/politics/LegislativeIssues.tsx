"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "~/trpc/react";
import { IssueCard } from "~/components/national-issues";

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
      .slice(0, 5);
  }, [issueData]);

  return (
    <div className="glass-hierarchy-child rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-semibold">Governance Issues</span>
        {governanceIssues.length > 0 && (
          <span className="ml-auto text-xs text-amber-600 dark:text-amber-400 font-medium">
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
              onView={() => { /* Respond via the main issues inbox */ }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground gap-2">
          <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
          <p className="text-sm">No active governance issues</p>
          <p className="text-xs">Your legislative agenda is clear.</p>
        </div>
      )}
    </div>
  );
}
