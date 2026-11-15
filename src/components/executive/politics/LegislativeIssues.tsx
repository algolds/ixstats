"use client";

import { useState } from "react";
import { CheckCircle as CheckCircle2 } from "iconoir-react";
import { api } from "~/trpc/react";
import { IssueCard } from "~/components/executive/issues";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { IssueDetailBrief } from "~/components/mycountry/shared/headers/IssueDetailBrief";

interface LegislativeIssuesProps {
  countryId: string;
  onSelectIssue?: (issueId: string) => void;
}

export function LegislativeIssues({ countryId, onSelectIssue }: LegislativeIssuesProps) {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  const { data: issueData } = api.nationalIssues.getMyIssues.useQuery(
    { countryId, status: "active", limit: 50 },
    { enabled: !!countryId }
  );

  const governanceIssues = (issueData?.issues ?? [])
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

  const handleView = (id: string) => {
    if (onSelectIssue) {
      onSelectIssue(id);
    } else {
      setSelectedIssueId(id);
    }
  };

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-headline">Governance issues</span>
        {governanceIssues.length > 0 && (
          <span className="text-caption text-label-secondary ml-auto">
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
              onView={() => handleView(issue.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState compact icon={<CheckCircle2 />} title="No active governance issues" />
      )}

      <Sheet open={!!selectedIssueId} onOpenChange={(open) => !open && setSelectedIssueId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Resolve governance issue</SheetTitle>
            <SheetDescription>Review and resolve this governance issue</SheetDescription>
          </SheetHeader>
          {selectedIssueId && (
            <IssueDetailBrief issueId={selectedIssueId} onClose={() => setSelectedIssueId(null)} />
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
