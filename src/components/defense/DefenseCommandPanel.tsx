"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  Users,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
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
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
            className="flex flex-1 items-center gap-2 transition-colors hover:bg-muted/50 rounded-md py-0.5"
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
              className="p-0.5 transition-colors hover:bg-muted/50 rounded"
              onClick={() => setBudgetExpanded(!budgetExpanded)}
            >
              {budgetExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
            className="flex flex-1 items-center gap-2 transition-colors hover:bg-muted/50 rounded-md py-0.5"
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
              className="p-0.5 transition-colors hover:bg-muted/50 rounded"
              onClick={() => setStabilityExpanded(!stabilityExpanded)}
            >
              {stabilityExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {stabilityExpanded && <StabilityPanel countryId={countryId} />}
      </section>
    </div>
  );
}
