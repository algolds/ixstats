"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import {
  Bank as Landmark,
  StatsReport as BarChart2,
  Page as ScrollText,
  WarningTriangle as AlertTriangle,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
  SystemRestart as Loader2,
} from "iconoir-react";
import { Separator } from "~/components/ui/separator";
import { SectionHelpIcon } from "~/components/ui/help-icon";
// oxlint-disable-next-line eslint/no-unused-vars
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

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
        <Loader2 className="text-label-secondary h-5 w-5 animate-spin" />
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
        <Loader2 className="text-label-secondary h-5 w-5 animate-spin" />
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
        <Loader2 className="text-label-secondary h-5 w-5 animate-spin" />
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
    // oxlint-disable-next-line
  }, [parliament, chambers, activeChamberTab]);

  // oxlint-disable-next-line eslint/no-unused-vars
  const activeChamberSeatsCount = useMemo(() => {
    if (!parliament) return 0;
    if (chambers.length <= 1) return parliament.legislature.totalSeats;
    const activeChamber = chambers.find((c: any) => c.name === activeChamberTab);
    return activeChamber ? activeChamber.seats : activeChamberSeats.length;
    // oxlint-disable-next-line
  }, [parliament, chambers, activeChamberTab, activeChamberSeats]);

  // Lore-first: surface a non-default selection method (sortition, appointed, …) for the
  // active chamber. "elected" is the default and shown as nothing to avoid noise.
  // oxlint-disable-next-line eslint/no-unused-vars
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
    // oxlint-disable-next-line
  }, [chambers, activeChamberTab]);

  // oxlint-disable-next-line eslint/no-unused-vars
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
    // oxlint-disable-next-line
  }, [parliament, activeChamberSeats, chambers]);

  return (
    <div className="space-y-4">
      {/* ─── Legislature setup (default: expanded) ─── */}
      <section className="space-y-3">
        <div className="rounded-control-sm flex w-full items-center justify-between px-1 py-0.5">
          <button
            type="button"
            aria-expanded={setupExpanded}
            className="hover:bg-fill-3 rounded-control-sm flex flex-1 items-center gap-2 py-0.5 transition-colors"
            onClick={() => setSetupExpanded(!setupExpanded)}
          >
            <Landmark aria-hidden className="text-label-secondary h-4 w-4" />
            <h3 className="text-headline">Legislature setup</h3>
          </button>
          <div className="flex items-center gap-1">
            <SectionHelpIcon
              title="Legislature setup"
              content="Set the legislature's name, chambers, seat count, electoral system, term length and election cycle."
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-expanded={setupExpanded}
              aria-label={setupExpanded ? "Collapse legislature setup" : "Expand legislature setup"}
              className="size-6"
              onClick={() => setSetupExpanded(!setupExpanded)}
            >
              {setupExpanded ? (
                <ChevronDown className="text-label-secondary h-4 w-4" />
              ) : (
                <ChevronRight className="text-label-secondary h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {setupExpanded && <LegislatureConfig countryId={countryId} />}
      </section>

      <Separator />

      {/* ─── Political metrics (default: collapsed) ─── */}
      <section className="space-y-3">
        <div className="rounded-control-sm flex w-full items-center justify-between px-1 py-0.5">
          <button
            type="button"
            aria-expanded={metricsExpanded}
            className="hover:bg-fill-3 rounded-control-sm flex flex-1 items-center gap-2 py-0.5 transition-colors"
            onClick={() => setMetricsExpanded(!metricsExpanded)}
          >
            <BarChart2 aria-hidden className="text-label-secondary h-4 w-4" />
            <h3 className="text-headline">Political metrics</h3>
          </button>
          <div className="flex items-center gap-1">
            <SectionHelpIcon
              title="Political metrics"
              content="Baseline indices from your government structure: stability, democracy, polarization, effectiveness, rule of law and corruption. Events change them over time."
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-expanded={metricsExpanded}
              aria-label={
                metricsExpanded ? "Collapse political metrics" : "Expand political metrics"
              }
              className="size-6"
              onClick={() => setMetricsExpanded(!metricsExpanded)}
            >
              {metricsExpanded ? (
                <ChevronDown className="text-label-secondary h-4 w-4" />
              ) : (
                <ChevronRight className="text-label-secondary h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {metricsExpanded && <GovernmentMetricsEditor countryId={countryId} />}
      </section>

      <Separator />

      {/* ─── Governance issues (default: collapsed) ─── */}
      <section className="space-y-3">
        <div className="rounded-control-sm flex w-full items-center justify-between px-1 py-0.5">
          <button
            type="button"
            aria-expanded={issuesExpanded}
            className="hover:bg-fill-3 rounded-control-sm flex flex-1 items-center gap-2 py-0.5 transition-colors"
            onClick={() => setIssuesExpanded(!issuesExpanded)}
          >
            <AlertTriangle aria-hidden className="text-label-secondary h-4 w-4" />
            <h3 className="text-headline">Governance issues</h3>
          </button>
          <div className="flex items-center gap-1">
            <SectionHelpIcon
              title="Governance issues"
              content="Pending political decisions that need the legislature, taken from your national issues."
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-expanded={issuesExpanded}
              aria-label={
                issuesExpanded ? "Collapse governance issues" : "Expand governance issues"
              }
              className="size-6"
              onClick={() => setIssuesExpanded(!issuesExpanded)}
            >
              {issuesExpanded ? (
                <ChevronDown className="text-label-secondary h-4 w-4" />
              ) : (
                <ChevronRight className="text-label-secondary h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {issuesExpanded && <LegislativeIssues countryId={countryId} />}
      </section>
    </div>
  );
}
