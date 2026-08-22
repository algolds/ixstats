"use client";

import React, { useState } from "react";
import { Compass, Loader2, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { api } from "~/trpc/react";
import type { EntityKind, ParseWikiResult } from "~/lib/wiki-os/adapters/ixstates/entity-parser";

interface PopulateFromWikiButtonProps {
  countryId: string;
  kind: EntityKind;
  id: string;
  /** Optional wiki title for display. Falls back to entity name. */
  wikiTitle?: string | null;
  /** Called after a successful apply so the parent can refetch. */
  onApplied?: () => void;
  /** Compact mode hides the descriptive subtitle (used in dense list rows). */
  compact?: boolean;
}

/**
 * "Populate from Wiki" button — fetches the entity's linked wiki page,
 * parses the infobox, and applies mappable fields to the entity.
 *
 * Renders a small inline result alert (applied / skipped fields) so the
 * user can see what was filled in without leaving the page. When a parsed
 * leader photo URL is available, the alert includes a "Use Photo" button.
 */
export function PopulateFromWikiButton({
  countryId,
  kind,
  id,
  wikiTitle,
  onApplied,
  compact = false,
}: PopulateFromWikiButtonProps) {
  const [result, setResult] = useState<ParseWikiResult | null>(null);

  const mutate = api.countryGeo.populateFromWiki.useMutation({
    onSuccess: (data: any) => {
      setResult(data as ParseWikiResult);
      if (data?.appliedCount > 0 || (data?.applied && data.applied.length > 0)) {
        onApplied?.();
      }
    },
  });

  if (result) {
    return <WikiParseResult result={result} onDismiss={() => setResult(null)} />;
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() =>
          mutate.mutate({ countryId, kind: kind as "city" | "subdivision" | "poi", id })
        }
        disabled={mutate.isPending}
        title={`Pull population, leader, and other attributes from the linked wiki page (${wikiTitle ?? "entity name"}).`}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-violet-500/15 disabled:opacity-50"
      >
        {mutate.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Compass className="h-3 w-3" />
        )}
        {mutate.isPending ? "Parsing wiki…" : compact ? "Wiki" : "Populate from Wiki"}
      </button>
    </div>
  );
}

function WikiParseResult({
  result,
  onDismiss,
}: {
  result: ParseWikiResult;
  onDismiss: () => void;
}) {
  const isError = !!result.error;
  const isEmpty = !isError && result.applied.length === 0 && result.skipped.length === 0;

  const matches = result.applied.filter((a) => a.verdict === "match" || a.verdict === "new");
  const softMismatches = result.applied.filter((a) => a.verdict === "soft-mismatch");
  const hardMismatches = result.applied.filter((a) => a.verdict === "hard-mismatch");

  return (
    <div
      className={`mt-1.5 flex flex-col gap-1 rounded-md border px-2 py-1.5 text-[10px] ${
        isError
          ? "border-red-500/30 bg-red-500/10 text-red-400"
          : hardMismatches.length > 0
            ? "border-red-500/30 bg-red-500/10 text-red-400"
            : softMismatches.length > 0
              ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
              : result.hasChanges
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-400"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 items-start gap-1.5">
          {hardMismatches.length > 0 || isError ? (
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
          )}
          <div className="flex-1 space-y-0.5">
            {isError && <div className="font-medium">{result.error}</div>}
            {isEmpty && (
              <div className="font-medium">No mappable fields found on the wiki infobox.</div>
            )}
            {matches.length > 0 && (
              <div>
                <span className="font-medium">
                  {matches.length} field{matches.length === 1 ? "" : "s"} in sync:
                </span>{" "}
                <span className="text-foreground/80">{matches.map((a) => a.label).join(", ")}</span>
              </div>
            )}
            {softMismatches.length > 0 && (
              <div>
                <span className="font-medium">
                  {softMismatches.length} soft contradiction
                  {softMismatches.length === 1 ? "" : "s"} (within tolerance):
                </span>{" "}
                <span className="text-foreground/80">
                  {softMismatches.map((a) => a.label).join(", ")}
                </span>
              </div>
            )}
            {hardMismatches.length > 0 && (
              <div className="font-medium">
                {hardMismatches.length} hard contradiction
                {hardMismatches.length === 1 ? "" : "s"} (wiki differs from stored value):
                <ul className="mt-1 space-y-0.5 pl-3 text-[10px] font-normal">
                  {hardMismatches.map((a) => (
                    <li key={a.field} className="flex flex-wrap items-baseline gap-1.5">
                      <span className="text-foreground/80 font-medium">{a.label}:</span>
                      <span className="line-through opacity-70">{formatVal(a.oldValue)}</span>
                      <span>→</span>
                      <span className="font-semibold">{formatVal(a.newValue)}</span>
                      <span className="text-muted-foreground/70 text-[9px]">(from {a.source})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.skipped.length > 0 && !isError && (
              <div className="text-muted-foreground/80">
                Skipped: {result.skipped.map((s) => s.field).join(", ")}
              </div>
            )}
            {result.templateName && (
              <div className="text-muted-foreground/60 font-mono text-[9px]">
                via {result.templateName} on {result.wikiTitle}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function formatVal(v: number | string | null | undefined): string {
  if (v == null) return "—";
  if (typeof v === "number") {
    if (Math.abs(v) >= 1000) return v.toLocaleString("en-US");
    return String(v);
  }
  return String(v);
}
