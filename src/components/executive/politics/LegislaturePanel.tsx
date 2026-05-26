// @ts-nocheck
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
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
import { TabHeroBanner } from "~/components/mycountry/primitives/TabHeroBanner";

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

  return (
    <div className="space-y-4">
      <TabHeroBanner
        context="politics_legislature" as any
        title="Legislature"
        subtitle="Parliamentary configuration, political metrics, laws & governance issues"
        icon={Landmark}
        accentColor="indigo"
      />

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
