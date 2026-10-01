"use client";

import React, { useState } from "react";
import {
  Compass,
  SystemRestart as Loader2,
  WarningTriangle as AlertTriangle,
  CheckCircle as CheckCircle2,
  Xmark as X,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
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
    onSuccess: (data: ParseWikiResult) => {
      setResult(data);
      if (data?.hasChanges || (data?.applied && data.applied.length > 0)) {
        onApplied?.();
      }
    },
  });

  if (result) {
    return <WikiParseResult result={result} onDismiss={() => setResult(null)} />;
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() =>
          mutate.mutate({ countryId, kind: kind as "city" | "subdivision" | "poi", id })
        }
        disabled={mutate.isPending}
        aria-busy={mutate.isPending}
        title={`Pull population, leader, and other attributes from the linked wiki page (${wikiTitle ?? "entity name"}).`}
        className="text-label-secondary gap-1"
      >
        {mutate.isPending ? (
          <Loader2 aria-hidden="true" className="size-3 animate-spin" />
        ) : (
          <Compass aria-hidden="true" className="size-3" />
        )}
        {mutate.isPending ? "Parsing wiki…" : compact ? "Wiki" : "Populate from Wiki"}
      </Button>
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
    <Alert
      variant={isError || hardMismatches.length > 0 ? "destructive" : "default"}
      className="text-footnote mt-2 flex flex-col gap-1 px-2 py-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 items-start gap-2">
          {/* Colour marks the outcome only: destructive, warning (soft contradiction) or success. */}
          {hardMismatches.length > 0 || isError ? (
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          ) : (
            <CheckCircle2
              aria-hidden="true"
              className={cn(
                "mt-0.5 size-3 shrink-0",
                softMismatches.length > 0 || !result.hasChanges ? "text-orange" : "text-green"
              )}
            />
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
                <span className="text-label-secondary">
                  {matches.map((a) => a.label).join(", ")}
                </span>
              </div>
            )}
            {softMismatches.length > 0 && (
              <div>
                <span className="font-medium">
                  {softMismatches.length} soft contradiction
                  {softMismatches.length === 1 ? "" : "s"} (within tolerance):
                </span>{" "}
                <span className="text-label-secondary">
                  {softMismatches.map((a) => a.label).join(", ")}
                </span>
              </div>
            )}
            {hardMismatches.length > 0 && (
              <div className="font-medium">
                {hardMismatches.length} hard contradiction
                {hardMismatches.length === 1 ? "" : "s"} (wiki differs from stored value):
                <ul className="text-footnote mt-1 space-y-0.5 pl-3 font-normal">
                  {hardMismatches.map((a) => (
                    <li key={a.field} className="flex flex-wrap items-baseline gap-2">
                      <span className="text-label-secondary font-medium">{a.label}:</span>
                      <span className="line-through opacity-70">{formatVal(a.oldValue)}</span>
                      <span>→</span>
                      <span className="font-semibold">{formatVal(a.newValue)}</span>
                      <span className="text-label-secondary text-footnote">(from {a.source})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.skipped.length > 0 && !isError && (
              <div className="text-label-secondary">
                Skipped: {result.skipped.map((s) => s.field).join(", ")}
              </div>
            )}
            {result.templateName && (
              <div className="text-label-tertiary text-footnote tabular-nums">
                via {result.templateName} on {result.wikiTitle}
              </div>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="text-label-secondary size-6 shrink-0"
          aria-label="Dismiss"
        >
          <X aria-hidden="true" className="size-3" />
        </Button>
      </div>
    </Alert>
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
