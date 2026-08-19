"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  RefreshCw,
  Shield,
} from "lucide-react";
import { api } from "~/trpc/react";
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
    <div className={`border-border bg-card/30 overflow-hidden rounded-lg border`}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!query.data && !query.isLoading) query.refetch();
        }}
        className="hover:bg-accent/30 flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          {open ? (
            <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
          )}
          <Shield className="text-muted-foreground h-3.5 w-3.5" />
          Geographic Data Compliance
        </span>
        <span className="flex items-center gap-1.5">
          <ComplianceBadge count={summary.errors} tone="red" label="errors" />
          <ComplianceBadge count={summary.warnings} tone="amber" label="warnings" />
          <ComplianceBadge count={summary.info} tone="slate" label="info" />
        </span>
      </button>

      {open && (
        <div className="space-y-2 px-3 pb-3">
          <div className="text-muted-foreground flex items-center justify-between text-[10px]">
            <span>
              {issues.length === 0
                ? "All checks passed. The geographic data is internally consistent."
                : `${issues.length} issue${issues.length === 1 ? "" : "s"} found.`}
            </span>
            <button
              type="button"
              onClick={() => {
                query.refetch();
                onRefresh?.();
              }}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[10px]"
              disabled={query.isRefetching}
            >
              {query.isRefetching ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Re-run
            </button>
          </div>

          {query.isLoading && (
            <div className="text-muted-foreground flex items-center justify-center gap-1.5 py-3 text-[11px]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Running compliance checks…
            </div>
          )}

          {!query.isLoading && query.error && (
            <div className="text-muted-foreground flex items-center justify-center gap-1.5 py-3 text-[11px]">
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
            <div className="text-muted-foreground flex items-center justify-center gap-1.5 py-3 text-[11px]">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              No issues. Population, GDP, capitals, and coordinates all check out.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComplianceBadge({
  count,
  tone,
  label,
}: {
  count: number;
  tone: "red" | "amber" | "slate" | "emerald";
  label: string;
}) {
  const cls = {
    red: "bg-red-600/20 text-red-500",
    amber: "bg-amber-600/20 text-amber-500",
    slate: "bg-slate-600/20 text-slate-400",
    emerald: "bg-emerald-600/20 text-emerald-500",
  }[tone];
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium ${cls}`}
      title={`${count} ${label}`}
    >
      {count}
    </span>
  );
}

function ComplianceIssueRow({ issue }: { issue: ComplianceIssue }) {
  const Icon = iconFor(issue.severity);
  const color = colorFor(issue.severity);
  return (
    <div className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-[11px] ${color}`}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="flex-1">
        <div className="leading-snug">{issue.message}</div>
        <div className="text-muted-foreground/70 mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] uppercase">
          <span>{issue.category}</span>
          {issue.entityRef && (
            <>
              <span>·</span>
              <span>
                {issue.entityRef.kind}: {issue.entityRef.name}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
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

function colorFor(severity: ComplianceSeverity) {
  switch (severity) {
    case "error":
      return "border-red-500/30 bg-red-500/10 text-red-400";
    case "warning":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    case "info":
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-400";
  }
}
