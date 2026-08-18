"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { BarChart3, Globe, Send, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Separator } from "~/components/ui/separator";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { TabHeroBanner } from "~/components/mycountry/shared/primitives/TabHeroBanner";

// Lazy-load heavy analytics panels (only mount when section is expanded)
const AnalyticsDashboard = dynamic(
  () =>
    import("~/app/mycountry/intelligence/_components/AnalyticsDashboard").then((m) => ({
      default: m.AnalyticsDashboard,
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

const DiplomaticAnalytics = dynamic(
  () =>
    import("~/app/mycountry/intelligence/_components/DiplomaticAnalytics").then((m) => ({
      default: m.DiplomaticAnalytics,
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

const PolicyAnalytics = dynamic(
  () =>
    import("~/app/mycountry/intelligence/_components/PolicyAnalytics").then((m) => ({
      default: m.PolicyAnalytics,
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

interface IntelligenceAnalysisPanelProps {
  countryId: string;
  countryName: string;
  userId: string;
}

export function IntelligenceAnalysisPanel({
  countryId,
  countryName,
  userId,
}: IntelligenceAnalysisPanelProps) {
  // Default: economic expanded, others collapsed (lazy load pattern)
  const [economicExpanded, setEconomicExpanded] = useState(true);
  const [diplomaticExpanded, setDiplomaticExpanded] = useState(false);
  const [policyExpanded, setPolicyExpanded] = useState(false);

  return (
    <div className="space-y-4">
      <TabHeroBanner
        context="intel_economic"
        title="Intelligence Analysis"
        subtitle="Economic, diplomatic, and policy deep-dives"
        icon={BarChart3}
        accentColor="purple"
      />

      {/* ─── Economic Analysis (default: expanded) ─── */}
      <section className="space-y-3">
        <div className="flex w-full items-center justify-between rounded-md px-1 py-0.5">
          <button
            className="hover:bg-muted/50 flex flex-1 items-center gap-2 rounded-md py-0.5 transition-colors"
            onClick={() => setEconomicExpanded(!economicExpanded)}
          >
            <BarChart3 className="h-4 w-4 text-purple-600" />
            <h3 className="text-sm font-semibold">Economic Analysis</h3>
          </button>
          <div className="flex items-center gap-1">
            <SectionHelpIcon
              title="Economic Analysis"
              content="GDP trends, sector breakdowns, and key economic indicators for your nation."
            />
            <button
              className="hover:bg-muted/50 rounded p-0.5 transition-colors"
              onClick={() => setEconomicExpanded(!economicExpanded)}
            >
              {economicExpanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {economicExpanded && <AnalyticsDashboard userId={userId} countryId={countryId} />}
      </section>

      <Separator />

      {/* ─── Diplomatic Analysis (default: collapsed) ─── */}
      <section className="space-y-3">
        <div className="flex w-full items-center justify-between rounded-md px-1 py-0.5">
          <button
            className="hover:bg-muted/50 flex flex-1 items-center gap-2 rounded-md py-0.5 transition-colors"
            onClick={() => setDiplomaticExpanded(!diplomaticExpanded)}
          >
            <Globe className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold">Diplomatic Analysis</h3>
          </button>
          <div className="flex items-center gap-1">
            <SectionHelpIcon
              title="Diplomatic Analysis"
              content="Relationship trends, network growth timelines, and influence distribution across your diplomatic network."
            />
            <button
              className="hover:bg-muted/50 rounded p-0.5 transition-colors"
              onClick={() => setDiplomaticExpanded(!diplomaticExpanded)}
            >
              {diplomaticExpanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {diplomaticExpanded && (
          <DiplomaticAnalytics countryId={countryId} countryName={countryName} />
        )}
      </section>

      <Separator />

      {/* ─── Policy Analysis (default: collapsed) ─── */}
      <section className="space-y-3">
        <div className="flex w-full items-center justify-between rounded-md px-1 py-0.5">
          <button
            className="hover:bg-muted/50 flex flex-1 items-center gap-2 rounded-md py-0.5 transition-colors"
            onClick={() => setPolicyExpanded(!policyExpanded)}
          >
            <Send className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold">Policy Analysis</h3>
          </button>
          <div className="flex items-center gap-1">
            <SectionHelpIcon
              title="Policy Analysis"
              content="Policy effectiveness metrics, government synergy analysis, and comparative policy impact assessments."
            />
            <button
              className="hover:bg-muted/50 rounded p-0.5 transition-colors"
              onClick={() => setPolicyExpanded(!policyExpanded)}
            >
              {policyExpanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {policyExpanded && <PolicyAnalytics countryId={countryId} userId={userId} />}
      </section>
    </div>
  );
}
