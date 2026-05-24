"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Activity, Users, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Separator } from "~/components/ui/separator";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { TabHeroBanner } from "~/components/mycountry/primitives/TabHeroBanner";

// Lazy-load heavy panels (only mount when section is expanded)
const CommandPanel = dynamic(
  () =>
    import("~/components/defense/CommandPanel").then((m) => ({
      default: m.CommandPanel,
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

const StabilityPanel = dynamic(
  () =>
    import("~/components/defense/StabilityPanel").then((m) => ({
      default: m.StabilityPanel,
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

interface DefenseCommandPanelProps {
  countryId: string;
}

export function DefenseCommandPanel({ countryId }: DefenseCommandPanelProps) {
  // Default: budget expanded, stability collapsed (lazy load pattern)
  const [budgetExpanded, setBudgetExpanded] = useState(true);
  const [stabilityExpanded, setStabilityExpanded] = useState(false);

  return (
    <div className="space-y-4">
      <TabHeroBanner
        context="defense"
        title="Command Center"
        subtitle="Budget allocation, readiness, and internal stability"
        icon={Activity}
        accentColor="red"
      />

      {/* ─── Budget & Readiness (default: expanded) ─── */}
      <section className="space-y-3">
        <div className="flex w-full items-center justify-between rounded-md px-1 py-0.5">
          <button
            className="hover:bg-muted/50 flex flex-1 items-center gap-2 rounded-md py-0.5 transition-colors"
            onClick={() => setBudgetExpanded(!budgetExpanded)}
          >
            <Activity className="h-4 w-4 text-red-600" />
            <h3 className="text-sm font-semibold">Budget & Readiness</h3>
          </button>
          <div className="flex items-center gap-1">
            <SectionHelpIcon
              title="Budget & Readiness"
              content="Manage defense budget allocation, personnel distribution, and overall military readiness across branches."
            />
            <button
              className="hover:bg-muted/50 rounded p-0.5 transition-colors"
              onClick={() => setBudgetExpanded(!budgetExpanded)}
            >
              {budgetExpanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {budgetExpanded && <CommandPanel countryId={countryId} />}
      </section>

      <Separator />

      {/* ─── Internal Stability (default: collapsed) ─── */}
      <section className="space-y-3">
        <div className="flex w-full items-center justify-between rounded-md px-1 py-0.5">
          <button
            className="hover:bg-muted/50 flex flex-1 items-center gap-2 rounded-md py-0.5 transition-colors"
            onClick={() => setStabilityExpanded(!stabilityExpanded)}
          >
            <Users className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">Internal Stability</h3>
          </button>
          <div className="flex items-center gap-1">
            <SectionHelpIcon
              title="Internal Stability"
              content="Monitor civil order, crime metrics, public order, and social cohesion. Respond to domestic security events."
            />
            <button
              className="hover:bg-muted/50 rounded p-0.5 transition-colors"
              onClick={() => setStabilityExpanded(!stabilityExpanded)}
            >
              {stabilityExpanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {stabilityExpanded && <StabilityPanel countryId={countryId} />}
      </section>
    </div>
  );
}
