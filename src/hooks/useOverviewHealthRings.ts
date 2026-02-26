"use client";

import { useMemo } from "react";
import { Crown, Globe, Brain, Shield } from "lucide-react";
import type { RingConfig } from "~/components/mycountry/primitives/VitalityRings";
import type { MyCountrySection } from "~/components/mycountry/MyCountrySidebarNav";
import { api } from "~/trpc/react";

interface UseOverviewHealthRingsOptions {
  countryId: string | undefined;
  onNavigate?: (section: MyCountrySection) => void;
}

interface UseOverviewHealthRingsResult {
  rings: RingConfig[];
  isLoading: boolean;
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/**
 * Computes 4 section-health VitalityRings for the Overview page.
 * Each ring maps to a MyCountry section tab (Executive, Diplomacy, Intelligence, Defense),
 * computed from the same real tRPC data each section page uses.
 * Clicking a ring navigates to that section via onNavigate.
 */
export function useOverviewHealthRings({
  countryId,
  onNavigate,
}: UseOverviewHealthRingsOptions): UseOverviewHealthRingsResult {
  const enabled = !!countryId;

  // ---- Executive data ----
  const { data: meetings, isLoading: l1 } = api.meetings.getMeetings.useQuery(
    { countryId: countryId ?? "" },
    { enabled }
  );
  const { data: policies, isLoading: l2 } = api.policies.getPolicies.useQuery(
    { countryId: countryId ?? "" },
    { enabled }
  );
  const { data: issueCount, isLoading: l3 } = api.nationalIssues.getPendingCount.useQuery(
    { countryId: countryId ?? "" },
    { enabled }
  );

  // ---- Diplomacy data ----
  const { data: embassies, isLoading: l4 } = api.diplomatic.getEmbassies.useQuery(
    { countryId: countryId ?? "" },
    { enabled }
  );
  const { data: relations, isLoading: l5 } = api.diplomatic.getRelationships.useQuery(
    { countryId: countryId ?? "" },
    { enabled }
  );

  // ---- Intelligence data ----
  const { data: defenseOverview, isLoading: l6 } = api.security.getDefenseOverview.useQuery(
    { countryId: countryId ?? "" },
    { enabled }
  );
  const { data: intelligenceOverview, isLoading: l7 } = api.unifiedIntelligence.getOverview.useQuery(
    { countryId: countryId ?? "" },
    { enabled }
  );

  // ---- Defense data ----
  const { data: securityAssessment, isLoading: l8 } = api.security.getSecurityAssessment.useQuery(
    { countryId: countryId ?? "" },
    { enabled }
  );
  const { data: militaryBranches, isLoading: l9 } = api.security.getMilitaryBranches.useQuery(
    { countryId: countryId ?? "" },
    { enabled }
  );

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8 || l9;

  const rings = useMemo((): RingConfig[] => {
    // ---- Executive Health ----
    const activePolicies = policies?.filter((p) => p.status === "active").length ?? 0;
    const activeMeetings = meetings?.filter((m) => m.status === "in_progress").length ?? 0;
    const totalIssues = issueCount?.total ?? 0;
    const urgentIssues = issueCount?.urgent ?? 0;
    const pendingActions = meetings?.flatMap((m) => m.actionItems).filter((a) => a.status === "pending").length ?? 0;

    const executiveHealth = clamp(
      50
      + Math.min(activePolicies * 4, 20)
      + Math.min(activeMeetings * 5, 10)
      - Math.min(totalIssues * 3, 15)
      - Math.min(urgentIssues * 5, 15)
      - Math.min(pendingActions * 2, 10)
    );

    // ---- Diplomatic Health ----
    const activeEmbassies = embassies?.filter((e: any) => e.status === "ACTIVE" || e.status === "active").length ?? 0;
    const totalEmbassies = embassies?.length ?? 0;
    const totalRelations = relations?.length ?? 0;
    const avgStrength = totalRelations > 0
      ? relations!.reduce((sum, r) => sum + (r.strength ?? 0), 0) / totalRelations
      : 0;

    const embassyRatio = totalEmbassies > 0 ? activeEmbassies / totalEmbassies : 0;
    const diplomaticHealth = clamp(
      avgStrength * 0.5
      + embassyRatio * 30
      + Math.min(totalRelations * 2, 20)
    );

    // ---- Intelligence Health ----
    const defOverviewScore = defenseOverview?.overallScore ?? 50;
    const criticalAlerts = intelligenceOverview?.alerts?.critical ?? 0;
    const totalAlerts = intelligenceOverview?.alerts?.total ?? 0;
    const otherAlerts = Math.max(totalAlerts - criticalAlerts, 0);

    const intelligenceHealth = clamp(
      defOverviewScore
      - Math.min(criticalAlerts * 10, 20)
      - Math.min(otherAlerts * 2, 10)
    );

    // ---- Defense Health ----
    const overallSecurityScore = securityAssessment?.overallSecurityScore ?? 50;
    const branchCount = militaryBranches?.length ?? 0;
    const avgReadiness = branchCount > 0
      ? militaryBranches!.reduce((sum, b) => sum + (b.readinessLevel ?? 0), 0) / branchCount
      : 0;

    const defenseHealth = clamp(
      overallSecurityScore * 0.6
      + avgReadiness * 0.4
    );

    // ---- Build ring configs ----
    const execSubtitle = executiveHealth >= 70 ? "well-managed" : executiveHealth >= 40 ? "needs attention" : "critical";
    const diploSubtitle = diplomaticHealth >= 70 ? "strong ties" : diplomaticHealth >= 40 ? "developing" : "isolated";
    const intelSubtitle = intelligenceHealth >= 70 ? "secure" : intelligenceHealth >= 40 ? "monitoring" : "at risk";
    const defSubtitle = defenseHealth >= 70 ? "combat ready" : defenseHealth >= 40 ? "operational" : "vulnerable";

    return [
      {
        key: "executive-health",
        label: "Executive",
        subtitle: execSubtitle,
        color: "#f59e0b",
        icon: Crown,
        value: executiveHealth,
        target: 100,
        displayValue: `${executiveHealth}/100`,
        onClick: () => onNavigate?.("executive"),
      },
      {
        key: "diplomatic-health",
        label: "Diplomacy",
        subtitle: diploSubtitle,
        color: "#06b6d4",
        icon: Globe,
        value: diplomaticHealth,
        target: 100,
        displayValue: `${diplomaticHealth}/100`,
        onClick: () => onNavigate?.("diplomacy"),
      },
      {
        key: "intelligence-health",
        label: "Intelligence",
        subtitle: intelSubtitle,
        color: "#3b82f6",
        icon: Brain,
        value: intelligenceHealth,
        target: 100,
        displayValue: `${intelligenceHealth}/100`,
        onClick: () => onNavigate?.("intelligence"),
      },
      {
        key: "defense-health",
        label: "Defense",
        subtitle: defSubtitle,
        color: "#ef4444",
        icon: Shield,
        value: defenseHealth,
        target: 100,
        displayValue: `${defenseHealth}/100`,
        onClick: () => onNavigate?.("defense"),
      },
    ];
  }, [meetings, policies, issueCount, embassies, relations, defenseOverview, intelligenceOverview, securityAssessment, militaryBranches, onNavigate]);

  return { rings, isLoading };
}
