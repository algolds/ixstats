"use client";

import React, { useState } from "react";
import {
  WarningTriangle as AlertTriangle,
  CheckCircle as CheckCircle2,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
  InfoCircle as Info,
  SystemRestart as Loader2,
  Refresh as RefreshCw,
  Shield,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import type { ComplianceIssue, ComplianceSeverity } from "~/lib/country-geo";

interface GeoCompliancePanelProps {
  countryId: string;
  /** Optional callback to re-run validation after a relevant change. */
  onRefresh?: () => void;
}

/**
 * GeoCompliancePanel — surfaces geographic data integrity issues for the
 * country (population/GDP rollup inconsistencies, capital integrity, founded
 * year sanity, coordinate-bounds checks). Click "Run check" to execute the
 * pure-function validator against the current geo bundle; expand the panel
 * to see per-issue details with the offending entity.
 */
export function GeoCompliancePanel({ countryId, onRefresh }: GeoCompliancePanelProps) {
  const [open, setOpen] = useState(false);
  const query = api.countryGeo.getGeoCompliance.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  const issues = query.data?.issues ?? [];
  const summary = query.data?.summary ?? { errors: 0, warnings: 0, info: 0 };

  return (
    <FacetCard className="overflow-hidden rounded-2xl">
      <Collapsible
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next && !query.data && !query.isLoading) query.refetch();
        }}
      >
        <CollapsibleTrigger
          data-cuelume-press="toggle"
          className="hover:bg-accent/30 focus-visible:ring-ring flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          <span className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
            {open ? (
              <ChevronDown aria-hidden="true" className="text-muted-foreground h-3.5 w-3.5" />
            ) : (
              <ChevronRight aria-hidden="true" className="text-muted-foreground h-3.5 w-3.5" />
            )}
            <Shield aria-hidden="true" className="text-muted-foreground h-3.5 w-3.5" />
            Geographic Data Compliance
          </span>
          <span className="flex items-center gap-1.5">
            <ComplianceBadge count={summary.errors} tone="critical" label="errors" />
            <ComplianceBadge count={summary.warnings} tone="warning" label="warnings" />
            <ComplianceBadge count={summary.info} tone="neutral" label="info" />
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-2 px-4 pb-4">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>
                {issues.length === 0
                  ? "All checks passed. The geographic data is internally consistent."
                  : `${issues.length} issue${issues.length === 1 ? "" : "s"} found.`}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  query.refetch();
                  onRefresh?.();
                }}
                className="h-11 shrink-0 sm:h-7"
                disabled={query.isRefetching}
              >
                {query.isRefetching ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <RefreshCw aria-hidden="true" />
                )}
                Re-run
              </Button>
            </div>

            {query.isLoading && (
              <div className="text-muted-foreground flex items-center justify-center gap-1.5 py-3 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Running compliance checks…
              </div>
            )}

            {!query.isLoading && query.error && (
              <div className="text-muted-foreground flex items-center justify-center gap-1.5 py-3 text-xs">
                <AlertTriangle className="h-3 w-3" />
                {query.error.message}
              </div>
            )}

            {!query.isLoading && !query.error && issues.length > 0 && (
              <ul className="space-y-1.5">
                {issues.map((issue) => (
                  <li key={issue.id}>
                    <ComplianceIssueRow issue={issue} />
                  </li>
                ))}
              </ul>
            )}

            {!query.isLoading && !query.error && issues.length === 0 && (
              <div className="text-muted-foreground flex items-center justify-center gap-1.5 py-3 text-xs">
                <CheckCircle2 aria-hidden="true" className="h-3 w-3 text-emerald-600" />
                No issues. Population, GDP, capitals, and coordinates all check out.
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </FacetCard>
  );
}

function ComplianceBadge({
  count,
  tone,
  label,
}: {
  count: number;
  tone: "critical" | "warning" | "neutral";
  label: string;
}) {
  const cls = {
    critical: count > 0 ? "text-destructive" : "text-muted-foreground",
    warning: count > 0 ? "text-orange-600" : "text-muted-foreground",
    neutral: "text-muted-foreground",
  }[tone];
  return (
    <Badge
      variant="outline"
      className={cn("font-mono tabular-nums", cls)}
      title={`${count} ${label}`}
      aria-label={`${count} ${label}`}
    >
      {count}
    </Badge>
  );
}

function ComplianceIssueRow({ issue }: { issue: ComplianceIssue }) {
  const Icon = iconFor(issue.severity);
  return (
    <FacetCard surface="solid" className="flex items-start gap-2 rounded-xl px-2.5 py-2 text-xs">
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", colorFor(issue.severity))}
      />
      <div className="flex-1">
        <div className="text-foreground leading-snug">{issue.message}</div>
        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="capitalize">{issue.category}</span>
          {issue.entityRef && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {issue.entityRef.kind}: {issue.entityRef.name}
              </span>
            </>
          )}
        </div>
      </div>
    </FacetCard>
  );
}

function iconFor(severity: ComplianceSeverity) {
  switch (severity) {
    case "error":
      return AlertTriangle;
    case "warning":
      return AlertTriangle;
    case "info":
    default:
      return Info;
  }
}

/** Severity → icon colour (semantic status only). */
function colorFor(severity: ComplianceSeverity) {
  switch (severity) {
    case "error":
      return "text-destructive";
    case "warning":
      return "text-orange-600";
    case "info":
    default:
      return "text-muted-foreground";
  }
}
