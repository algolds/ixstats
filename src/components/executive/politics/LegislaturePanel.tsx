// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import {
  Landmark,
  BarChart2,
  ScrollText,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Separator } from "~/components/ui/separator";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

// ── Lazy-loaded sub-components (only mount when expanded) ─────────────────

const LegislatureConfig = dynamic(
  () =>
    import("~/components/executive/politics/LegislatureConfig").then((m) => ({
      default: m.LegislatureConfig,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    ),
  }
);

const GovernmentMetricsEditor = dynamic(
  () =>
    import("~/components/executive/politics/GovernmentMetricsEditor").then((m) => ({
      default: m.GovernmentMetricsEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    ),
  }
);

const LegislativePolicies = dynamic(
  () =>
    import("~/components/executive/politics/LegislativePolicies").then((m) => ({
      default: m.LegislativePolicies,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    ),
  }
);

const LegislativeIssues = dynamic(
  () =>
    import("~/components/executive/politics/LegislativeIssues").then((m) => ({
      default: m.LegislativeIssues,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    ),
  }
);

// ── Types ─────────────────────────────────────────────────────────────────

interface LegislaturePanelProps {
  countryId: string;
}

// ── Main component ────────────────────────────────────────────────────────

export function LegislaturePanel({ countryId }: LegislaturePanelProps) {
  const [setupExpanded, setSetupExpanded] = useState(true);
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [policiesExpanded, setPoliciesExpanded] = useState(false);
  const [issuesExpanded, setIssuesExpanded] = useState(false);

  // Current parliament data for the hemicycle
  const { data: parliament } = api.elections.getCurrentParliament.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const chambers = parliament?.legislature?.chambers ?? [];
  const [activeChamberTab, setActiveChamberTab] = useState<string>("");

  useEffect(() => {
    if (chambers.length > 0) {
      if (!activeChamberTab || !chambers.some((c) => c.name === activeChamberTab)) {
        setActiveChamberTab(chambers[0].name);
      }
    } else {
      setActiveChamberTab("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chambers]);

  const activeChamberSeats = useMemo(() => {
    if (!parliament) return [];
    if (chambers.length <= 1) return parliament.seats;
    return parliament.seats.filter((s: any) => s.chamber === activeChamberTab);
  }, [parliament, chambers, activeChamberTab]);

  const activeChamberSeatsCount = useMemo(() => {
    if (!parliament) return 0;
    if (chambers.length <= 1) return parliament.legislature.totalSeats;
    const activeChamber = chambers.find((c: any) => c.name === activeChamberTab);
    return activeChamber ? activeChamber.seats : activeChamberSeats.length;
  }, [parliament, chambers, activeChamberTab, activeChamberSeats]);

  // Lore-first: surface a non-default selection method (sortition, appointed, …) for the
  // active chamber. "elected" is the default and shown as nothing to avoid noise.
  const activeChamberSelectionLabel = useMemo(() => {
    const labels: Record<string, string> = {
      appointed: "Appointed",
      sortition: "Sortition (by lot)",
      hereditary: "Hereditary",
      "ex-officio": "Ex-officio",
      corporatist: "Corporatist",
    };
    const active =
      chambers.length <= 1 ? chambers[0] : chambers.find((c: any) => c.name === activeChamberTab);
    const method = (active as any)?.selectionMethod;
    return method && method !== "elected" ? (labels[method] ?? null) : null;
  }, [chambers, activeChamberTab]);

  const activeChamberPartySummary = useMemo(() => {
    if (!parliament) return [];
    if (chambers.length <= 1) return parliament.partySummary;
    const counts = new Map<string, { party: any; seats: number }>();
    for (const seat of activeChamberSeats) {
      if (seat.partyId) {
        const existing = counts.get(seat.partyId);
        if (existing) {
          existing.seats++;
        } else {
          const refSummary = parliament.partySummary.find(
            (ps: any) => ps.party.id === seat.partyId
          );
          counts.set(seat.partyId, {
            party: refSummary?.party ?? {
              id: seat.partyId,
              name: seat.partyName,
              shortName: null,
              color: seat.partyColor,
            },
            seats: 1,
          });
        }
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.seats - a.seats);
  }, [parliament, activeChamberSeats, chambers]);

  const hasParliamentData = parliament && parliament.seats.length > 0;

  return (
    <div className="space-y-4">



      {/* ─── Legislature Setup (default: expanded) ─── */}
      <section className="space-y-3">
        <div className="flex w-full items-center justify-between rounded-md px-1 py-0.5">
          <button
            className="hover:bg-muted/50 flex flex-1 items-center gap-2 rounded-md py-0.5 transition-colors"
            onClick={() => setSetupExpanded(!setupExpanded)}
          >
            <Landmark className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold">Legislature Setup</h3>
          </button>
          <div className="flex items-center gap-1">
            <SectionHelpIcon
              title="Legislature Setup"
              content="Configure your parliament's name, chamber structure, seat count, electoral system, term length, and election cycle type."
            />
            <button
              className="hover:bg-muted/50 rounded p-0.5 transition-colors"
              onClick={() => setSetupExpanded(!setupExpanded)}
            >
              {setupExpanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {setupExpanded && <LegislatureConfig countryId={countryId} />}
      </section>

      <Separator />

      {/* ─── Political Metrics (default: collapsed) ─── */}
      <section className="space-y-3">
        <div className="flex w-full items-center justify-between rounded-md px-1 py-0.5">
          <button
            className="hover:bg-muted/50 flex flex-1 items-center gap-2 rounded-md py-0.5 transition-colors"
            onClick={() => setMetricsExpanded(!metricsExpanded)}
          >
            <BarChart2 className="h-4 w-4 text-violet-600" />
            <h3 className="text-sm font-semibold">Political Metrics</h3>
          </button>
          <div className="flex items-center gap-1">
            <SectionHelpIcon
              title="Political Metrics"
              content="Baseline political indices drawn from your government structure — stability, democracy score, polarization, effectiveness, rule of law, and corruption. These are modified by in-game events."
            />
            <button
              className="hover:bg-muted/50 rounded p-0.5 transition-colors"
              onClick={() => setMetricsExpanded(!metricsExpanded)}
            >
              {metricsExpanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {metricsExpanded && <GovernmentMetricsEditor countryId={countryId} />}
      </section>

      <Separator />

      {/* ─── Laws & Active Policies (default: collapsed) ─── */}
      <section className="space-y-3">
        <div className="flex w-full items-center justify-between rounded-md px-1 py-0.5">
          <button
            className="hover:bg-muted/50 flex flex-1 items-center gap-2 rounded-md py-0.5 transition-colors"
            onClick={() => setPoliciesExpanded(!policiesExpanded)}
          >
            <ScrollText className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold">Laws & Active Policies</h3>
          </button>
          <div className="flex items-center gap-1">
            <SectionHelpIcon
              title="Laws & Active Policies"
              content="View enacted legislation and active policy bills. Create new policies to shape your nation's direction."
            />
            <button
              className="hover:bg-muted/50 rounded p-0.5 transition-colors"
              onClick={() => setPoliciesExpanded(!policiesExpanded)}
            >
              {policiesExpanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {policiesExpanded && <LegislativePolicies countryId={countryId} />}
      </section>

      <Separator />

      {/* ─── Governance Issues (default: collapsed) ─── */}
      <section className="space-y-3">
        <div className="flex w-full items-center justify-between rounded-md px-1 py-0.5">
          <button
            className="hover:bg-muted/50 flex flex-1 items-center gap-2 rounded-md py-0.5 transition-colors"
            onClick={() => setIssuesExpanded(!issuesExpanded)}
          >
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">Governance Issues</h3>
          </button>
          <div className="flex items-center gap-1">
            <SectionHelpIcon
              title="Governance Issues"
              content="Pending political and governance decisions requiring legislative attention. Filtered from your national issues inbox."
            />
            <button
              className="hover:bg-muted/50 rounded p-0.5 transition-colors"
              onClick={() => setIssuesExpanded(!issuesExpanded)}
            >
              {issuesExpanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {issuesExpanded && <LegislativeIssues countryId={countryId} />}
      </section>
    </div>
  );
}
