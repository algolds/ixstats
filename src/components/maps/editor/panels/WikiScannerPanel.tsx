"use client";

/**
 * WikiScannerPanel — the editor's "Wiki" tab.
 *
 * Scans features without a wiki link against IxWiki search, offers the best
 * matches as one-click links, then compares linked features with their wiki
 * infoboxes (population, coordinates, area) and lists disagreements.
 */

import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { memo, useState } from "react";
import {
  OpenBook as BookOpen,
  Link as LinkIcon,
  WarningTriangle,
  Refresh,
  Check,
} from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { useNotify } from "~/hooks/useNotify";
import type { UseWikiScannerReturn } from "~/hooks/useWikiScanner";

/** Feature types the editor can write a wiki link for (see handleLinkFeature). */
const LINKABLE_TYPES = new Set(["city", "poi", "storyPin", "mapLabel"]);

interface WikiScannerPanelProps {
  scanner: UseWikiScannerReturn;
  onFocusFeature?: (featureId: string) => void;
}

export const WikiScannerPanel = memo(function WikiScannerPanel({
  scanner,
  onFocusFeature,
}: WikiScannerPanelProps) {
  const notify = useNotify();
  const [linked, setLinked] = useState<Set<string>>(() => new Set());
  const {
    unlinkedFeatures,
    scanning,
    scanProgress,
    totalLinked,
    totalUnlinked,
    startScan,
    acceptSuggestion,
    conflicts,
    scanningConflicts,
  } = scanner;

  const withSuggestions = unlinkedFeatures.filter(
    (r) => r.suggestions.length > 0 && LINKABLE_TYPES.has(r.featureType) && !linked.has(r.featureId)
  );
  const hasScanned = scanProgress === 100 && !scanning;

  return (
    <div className="flex flex-col gap-3 px-3 py-3 text-xs">
      <div className="flex items-start gap-2">
        <BookOpen className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-foreground font-semibold">Wiki links</p>
          <p className="text-muted-foreground">
            {totalLinked} linked · {totalUnlinked} without a page
          </p>
        </div>
        <Button
          size="xs"
          className="shrink-0"
          type="button"
          onClick={() => startScan()}
          disabled={scanning || scanningConflicts}
        >
          <Refresh className={`h-3 w-3 ${scanning ? "animate-spin" : ""}`} />
          {hasScanned ? "Rescan" : "Scan"}
        </Button>
      </div>

      {(scanning || scanningConflicts) && (
        <div className="space-y-1.5" aria-live="polite">
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-[width] duration-200"
              style={{ width: `${scanning ? scanProgress : 100}%` }}
            />
          </div>
          <p className="text-muted-foreground">
            {scanning
              ? `Searching IxWiki… ${scanProgress}%`
              : "Checking linked pages for conflicts…"}
          </p>
          {scanning && (
            <div className="space-y-1">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-4/5" />
            </div>
          )}
        </div>
      )}

      {!scanning && !hasScanned && (
        <p className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center">
          Scan to find IxWiki pages for features that are not linked yet. Searches run three at a
          time, so large maps take a moment.
        </p>
      )}

      {hasScanned && (
        <section className="space-y-1.5">
          <Eyebrow className="block">Suggested links ({withSuggestions.length})</Eyebrow>
          {withSuggestions.length === 0 ? (
            <p className="text-muted-foreground italic">No new matches found.</p>
          ) : (
            <ul className="space-y-1">
              {withSuggestions.map((r) => {
                const best = r.suggestions[0]!;
                return (
                  <li
                    key={r.featureId}
                    className="border-border/60 hover:bg-accent/40 flex items-center gap-2 rounded-md border px-2 py-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => onFocusFeature?.(r.featureId)}
                      className="min-w-0 flex-1 text-left"
                      title="Show on map"
                    >
                      <span className="text-foreground block truncate font-medium">
                        {r.featureName}
                      </span>
                      <span className="text-muted-foreground block truncate">
                        → {best.title}{" "}
                        <span className="tabular-nums">({Math.round(best.confidence * 100)}%)</span>
                      </span>
                    </button>
                    <Button
                      size="xs"
                      className="shrink-0"
                      type="button"
                      onClick={() => {
                        acceptSuggestion(r.featureId, best.title);
                        setLinked((prev) => new Set(prev).add(r.featureId));
                        notify.success("Wiki page linked", `${r.featureName} → ${best.title}`);
                      }}
                      title={`Link "${r.featureName}" to ${best.title}`}
                    >
                      <LinkIcon className="h-3 w-3" />
                      Link
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {linked.size > 0 && (
            <p className="flex items-center gap-1 text-emerald-500">
              <Check className="h-3 w-3" /> {linked.size} linked this session
            </p>
          )}
        </section>
      )}

      {hasScanned && !scanningConflicts && (
        <section className="space-y-1.5">
          <Eyebrow className="block">Map vs wiki conflicts ({conflicts.length})</Eyebrow>
          {conflicts.length === 0 ? (
            <p className="text-muted-foreground italic">
              Linked features agree with their infoboxes.
            </p>
          ) : (
            <ul className="space-y-1">
              {conflicts.map((c) => (
                <li
                  key={`${c.featureId}-${c.field}`}
                  className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5"
                >
                  <WarningTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                  <button
                    type="button"
                    onClick={() => onFocusFeature?.(c.featureId)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="text-foreground block truncate font-medium">
                      {c.featureName} · {c.field}
                    </span>
                    <span className="text-muted-foreground block truncate">
                      Map {c.mapValue} · Wiki {c.wikiValue}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
});
