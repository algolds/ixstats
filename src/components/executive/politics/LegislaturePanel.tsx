"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Bank as Landmark,
  StatsReport as BarChart2,
  WarningTriangle as AlertTriangle,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
  SystemRestart as Loader2,
} from "iconoir-react";
import { Separator } from "~/components/ui/separator";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { Button } from "~/components/ui/button";

// Sections only mount (and load) when expanded.
const loading = () => (
  <div className="flex items-center justify-center py-8">
    <Loader2 className="text-label-secondary h-5 w-5 animate-spin" />
  </div>
);

const LegislatureConfig = dynamic(
  () =>
    import("~/components/executive/politics/LegislatureConfig").then((m) => ({
      default: m.LegislatureConfig,
    })),
  { ssr: false, loading }
);

const GovernmentMetricsEditor = dynamic(
  () =>
    import("~/components/executive/politics/GovernmentMetricsEditor").then((m) => ({
      default: m.GovernmentMetricsEditor,
    })),
  { ssr: false, loading }
);

const LegislativeIssues = dynamic(
  () =>
    import("~/components/executive/politics/LegislativeIssues").then((m) => ({
      default: m.LegislativeIssues,
    })),
  { ssr: false, loading }
);

interface LegislaturePanelProps {
  countryId: string;
}

function CollapsibleSection({
  icon: Icon,
  title,
  help,
  defaultExpanded = false,
  children,
}: {
  icon: typeof Landmark;
  title: string;
  help: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toggle = () => setExpanded(!expanded);
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <section className="space-y-3">
      <div className="rounded-control-sm flex w-full items-center justify-between px-1 py-0.5">
        <button
          type="button"
          aria-expanded={expanded}
          className="hover:bg-fill-3 rounded-control-sm flex flex-1 items-center gap-2 py-0.5 transition-colors"
          onClick={toggle}
        >
          <Icon aria-hidden className="text-label-secondary h-4 w-4" />
          <h3 className="text-headline">{title}</h3>
        </button>
        <div className="flex items-center gap-1">
          <SectionHelpIcon title={title} content={help} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${title.toLowerCase()}`}
            className="size-6"
            onClick={toggle}
          >
            <Chevron className="text-label-secondary h-4 w-4" />
          </Button>
        </div>
      </div>

      {expanded && children}
    </section>
  );
}

export function LegislaturePanel({ countryId }: LegislaturePanelProps) {
  return (
    <div className="space-y-4">
      <CollapsibleSection
        icon={Landmark}
        title="Legislature setup"
        help="Set the legislature's name, chambers, seat count, electoral system, term length and election cycle."
        defaultExpanded
      >
        <LegislatureConfig countryId={countryId} />
      </CollapsibleSection>

      <Separator />

      <CollapsibleSection
        icon={BarChart2}
        title="Political metrics"
        help="Baseline indices from your government structure: stability, democracy, polarization, effectiveness, rule of law and corruption. Events change them over time."
      >
        <GovernmentMetricsEditor countryId={countryId} />
      </CollapsibleSection>

      <Separator />

      <CollapsibleSection
        icon={AlertTriangle}
        title="Governance issues"
        help="Pending political decisions that need the legislature, taken from your national issues."
      >
        <LegislativeIssues countryId={countryId} />
      </CollapsibleSection>
    </div>
  );
}
