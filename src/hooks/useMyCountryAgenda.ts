"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { useIssueCount } from "./useNationalIssues";
import { useMessageUnreadCount } from "./useMessageUnreadCount";
import { buildAgendaItems, type AgendaItem } from "~/components/mycountry/shared/headers/SmartStack";

/**
 * Fetches the MyCountry daily agenda for a country and returns the same Smart
 * Stack items the OverviewHero builds. Used by the expanded Halo.
 */
export function useMyCountryAgenda(
  countryId: string | undefined,
  isPremium: boolean
): AgendaItem[] {
  const enabled = !!countryId && countryId.trim() !== "";

  const { total: issueCount, urgent: urgentIssueCount } = useIssueCount(countryId);
  const { totalUnread: messageUnreadCount = 0 } = useMessageUnreadCount();

  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId: countryId! },
    { enabled }
  );
  const { data: meetings } = api.meetings.getMeetings.useQuery(
    { countryId: countryId! },
    { enabled }
  );
  const { data: embassies } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId: countryId! },
    { enabled }
  );
  const { data: elections } = api.elections.getElections.useQuery(
    { countryId: countryId! },
    { enabled }
  );
  const { data: intelligenceOverview } = api.intelCore.getOverview.useQuery(
    { countryId: countryId! },
    { enabled: enabled && isPremium }
  );
  const { data: securityData } = api.security.getSecurityAssessment.useQuery(
    { countryId: countryId! },
    { enabled: enabled && isPremium }
  );

  return useMemo(() => {
    const activePolicies = policies?.filter((p) => p.status === "active").length ?? 0;
    const pendingActions =
      meetings
        ?.flatMap((m) => m.actionItems ?? [])
        .filter((a) => a.status === "pending" || a.status === "PENDING").length ?? 0;
    const activeEmbassies =
      embassies?.filter((e) => e.status === "ACTIVE" || e.status === "active").length ?? 0;
    const pendingElections =
      elections?.filter(
        (e: any) =>
          e.status === "SCHEDULED" ||
          e.status === "scheduled" ||
          e.status === "IN_PROGRESS" ||
          e.status === "in_progress"
      ).length ?? 0;

    return buildAgendaItems({
      urgentIssueCount,
      issueCount,
      policiesTotal: policies?.length ?? 0,
      activePolicies,
      pendingActions,
      messageUnreadCount,
      threats: securityData?.activeThreatCount ?? 0,
      securityScore: securityData?.overallSecurityScore ?? 50,
      critAlerts: intelligenceOverview?.alerts?.critical ?? 0,
      pendingElections,
      noEmbassies: activeEmbassies === 0 && embassies?.length === 0,
    });
  }, [
    urgentIssueCount,
    issueCount,
    policies,
    meetings,
    embassies,
    elections,
    intelligenceOverview,
    securityData,
    messageUnreadCount,
  ]);
}
