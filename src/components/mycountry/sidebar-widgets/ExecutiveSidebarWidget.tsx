"use client";

import { useMemo } from "react";
import { CheckCircle, FileText, Calendar, Gavel } from "lucide-react";
import { api } from "~/trpc/react";
import { useIssueCount } from "~/hooks/useNationalIssues";
import {
  SectionContextWidget,
  type ContextStat,
  type ContextActivityEntry,
} from "~/components/mycountry/primitives";

interface ExecutiveSidebarWidgetProps {
  countryId: string;
}

/**
 * Executive context widget — a thin adapter that feeds the unified
 * SectionContextWidget with quick stats (issues / policies / meetings)
 * and a recent-activity log (meetings, policies, action items).
 */
export function ExecutiveSidebarWidget({ countryId }: ExecutiveSidebarWidgetProps) {
  const { data: meetings } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { total: issueCount } = useIssueCount(countryId);

  const stats = useMemo<ContextStat[]>(() => {
    const activePolicies = policies?.filter((p: any) => p.status === "active").length ?? 0;
    const meetingCount = meetings?.length ?? 0;
    return [
      { label: "Issues", value: issueCount, accentText: true },
      { label: "Policies", value: activePolicies, accentText: true },
      { label: "Meetings", value: meetingCount, accentText: true },
    ];
  }, [policies, meetings, issueCount]);

  const activity = useMemo<ContextActivityEntry[]>(() => {
    const entries: ContextActivityEntry[] = [];

    // Completed meetings → "Held session: {title}"
    meetings?.forEach((m: any) => {
      if (m.status === "completed") {
        entries.push({
          id: `meeting-${m.id}`,
          icon: Calendar,
          iconColor: "text-blue-500",
          text: `Held session: ${m.title}`,
          time: new Date(m.scheduledDate ?? m.updatedAt ?? m.createdAt),
        });
      }
    });

    // Active policies → "Enacted: {name}"
    policies?.forEach((p: any) => {
      if (p.status === "active" && p.effectiveDate) {
        entries.push({
          id: `policy-active-${p.id}`,
          icon: Gavel,
          iconColor: "text-green-500",
          text: `Enacted: ${p.name ?? p.title}`,
          time: new Date(p.effectiveDate),
        });
      }
    });

    // Draft policies → "Drafted: {name}"
    policies?.forEach((p: any) => {
      if (p.status === "draft") {
        entries.push({
          id: `policy-draft-${p.id}`,
          icon: FileText,
          iconColor: "text-amber-500",
          text: `Drafted: ${p.name ?? p.title}`,
          time: new Date(p.createdAt),
        });
      }
    });

    // Completed action items → "Completed: {title}"
    meetings?.forEach((m: any) => {
      m.actionItems?.forEach((a: any) => {
        if (a.status === "completed") {
          entries.push({
            id: `action-${a.id}`,
            icon: CheckCircle,
            iconColor: "text-emerald-500",
            text: `Completed: ${a.title}`,
            time: new Date(a.updatedAt ?? a.createdAt),
          });
        }
      });
    });

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5);
  }, [meetings, policies]);

  return (
    <SectionContextWidget
      accent="amber"
      title="Command Log"
      stats={stats}
      activity={activity}
      emptyMessage="No executive actions yet"
    />
  );
}
