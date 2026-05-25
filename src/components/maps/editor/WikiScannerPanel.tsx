"use client";

/**
 * WikiScannerPanel — Scans map features against IxWiki to find unlinked
 * wiki pages and detect data conflicts.
 *
 * Sections:
 * 1. Header with scan button and progress bar
 * 2. Stats summary
 * 3. Unlinked features with suggestions
 * 4. Conflicts with resolution buttons
 * 5. Missing from Map (placeholder)
 */

import React, { useState } from "react";
import {
  Search,
  MapPin,
  Hexagon,
  Landmark,
  BookMarked,
  Type,
  ChevronDown,
  Link2,
  AlertTriangle,
  Check,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type { UseWikiScannerReturn, WikiScanResult, WikiConflict } from "~/hooks/useWikiScanner";

interface WikiScannerPanelProps {
  scanner: UseWikiScannerReturn;
}

const FEATURE_ICONS = {
  city: MapPin,
  subdivision: Hexagon,
  poi: Landmark,
  storyPin: BookMarked,
  mapLabel: Type,
} as const;

const FEATURE_COLORS = {
  city: "text-blue-500",
  subdivision: "text-purple-500",
  poi: "text-amber-500",
  storyPin: "text-amber-500",
  mapLabel: "text-slate-500",
} as const;

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color =
    confidence >= 0.8
      ? "bg-green-500/15 text-green-600 dark:text-green-400"
      : confidence >= 0.5
        ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
        : "bg-gray-500/15 text-gray-500";

  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${color}`}>
      {Math.round(confidence * 100)}%
    </span>
  );
}

// ── Unlinked Feature Row ──

function UnlinkedFeatureRow({
  result,
  onAccept,
}: {
  result: WikiScanResult;
  onAccept: (featureId: string, wikiTitle: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = FEATURE_ICONS[result.featureType as keyof typeof FEATURE_ICONS] ?? MapPin;
  const colorClass =
    FEATURE_COLORS[result.featureType as keyof typeof FEATURE_COLORS] ?? "text-gray-500";
  const topSuggestion = result.suggestions[0];

  return (
    <div className="border-border bg-background/50 rounded-lg border p-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${colorClass}`} />
        <span className="text-foreground flex-1 truncate text-sm">{result.featureName}</span>
        {result.suggestions.length > 1 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground rounded p-0.5"
            title={expanded ? "Collapse" : "Show all suggestions"}
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform ${expanded ? "" : "-rotate-90"}`}
            />
          </button>
        )}
      </div>

      {topSuggestion ? (
        <div className="mt-1.5 flex items-center gap-1.5 pl-5">
          <Link2 className="text-muted-foreground h-3 w-3 shrink-0" />
          <span className="text-muted-foreground flex-1 truncate text-xs">
            {topSuggestion.title}
          </span>
          <ConfidenceBadge confidence={topSuggestion.confidence} />
          <button
            onClick={() => onAccept(result.featureId, topSuggestion.title)}
            className="bg-primary/10 text-primary hover:bg-primary/20 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors"
          >
            Link
          </button>
        </div>
      ) : (
        <div className="text-muted-foreground mt-1 pl-5 text-[11px]">No wiki pages found</div>
      )}

      {expanded && result.suggestions.length > 1 && (
        <div className="mt-1.5 space-y-1 pl-5">
          {result.suggestions.slice(1).map((suggestion) => (
            <div key={suggestion.title} className="flex items-center gap-1.5">
              <Link2 className="text-muted-foreground/50 h-3 w-3 shrink-0" />
              <span className="text-muted-foreground flex-1 truncate text-xs">
                {suggestion.title}
              </span>
              <ConfidenceBadge confidence={suggestion.confidence} />
              <button
                onClick={() => onAccept(result.featureId, suggestion.title)}
                className="bg-muted text-foreground hover:bg-accent rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors"
              >
                Link
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Conflict Row ──

function ConflictRow({
  conflict,
  onResolve,
}: {
  conflict: WikiConflict;
  onResolve: (featureId: string, field: string, useWiki: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="text-foreground flex-1 truncate text-sm">{conflict.featureName}</span>
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]">
          {conflict.field}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2 pl-5 text-xs">
        <div className="flex-1 space-y-0.5">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Map:</span>
            <span className="text-foreground font-mono">{conflict.mapValue}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Wiki:</span>
            <span className="text-foreground font-mono">{conflict.wikiValue}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onResolve(conflict.featureId, conflict.field, true)}
            className="flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 transition-colors hover:bg-blue-500/20 dark:text-blue-400"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            Use Wiki
          </button>
          <button
            onClick={() => onResolve(conflict.featureId, conflict.field, false)}
            className="bg-muted text-foreground hover:bg-accent flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors"
          >
            <Check className="h-2.5 w-2.5" />
            Keep Map
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ──

export function WikiScannerPanel({ scanner }: WikiScannerPanelProps) {
  const [showUnlinked, setShowUnlinked] = useState(true);
  const [showConflicts, setShowConflicts] = useState(true);
  const [showMissing, setShowMissing] = useState(false);

  const {
    unlinkedFeatures,
    scanning,
    scanProgress,
    totalUnlinked,
    totalLinked,
    startScan,
    acceptSuggestion,
    conflicts,
    scanningConflicts,
  } = scanner;

  const unlinkedWithSuggestions = unlinkedFeatures.filter((r) => r.suggestions.length > 0);

  return (
    <div className="space-y-3 px-3 py-3">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground text-sm font-semibold">Wiki Scanner</h3>
          <button
            onClick={startScan}
            disabled={scanning}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50"
          >
            {scanning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Search className="h-3 w-3" />
            )}
            {scanning ? "Scanning..." : "Scan"}
          </button>
        </div>

        {/* Progress bar */}
        {scanning && (
          <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3 text-green-500" />
          {totalLinked} linked
        </span>
        <span className="text-border">|</span>
        <span className="flex items-center gap-1">
          <X className="h-3 w-3 text-red-400" />
          {totalUnlinked} unlinked
        </span>
        {conflicts.length > 0 && (
          <>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              {conflicts.length} conflicts
            </span>
          </>
        )}
      </div>

      {/* Unlinked Section */}
      {unlinkedFeatures.length > 0 && (
        <div>
          <button
            onClick={() => setShowUnlinked(!showUnlinked)}
            className="hover:bg-accent flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left transition-colors"
          >
            <ChevronDown
              className={`text-muted-foreground h-3 w-3 transition-transform ${showUnlinked ? "" : "-rotate-90"}`}
            />
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Unlinked Features
            </span>
            <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[10px] font-medium tabular-nums">
              {unlinkedWithSuggestions.length}/{unlinkedFeatures.length}
            </span>
          </button>
          {showUnlinked && (
            <div className="mt-1 space-y-1.5">
              {unlinkedFeatures.map((result) => (
                <UnlinkedFeatureRow
                  key={result.featureId}
                  result={result}
                  onAccept={acceptSuggestion}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conflicts Section */}
      {(conflicts.length > 0 || scanningConflicts) && (
        <div>
          <button
            onClick={() => setShowConflicts(!showConflicts)}
            className="hover:bg-accent flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left transition-colors"
          >
            <ChevronDown
              className={`text-muted-foreground h-3 w-3 transition-transform ${showConflicts ? "" : "-rotate-90"}`}
            />
            <span className="text-[10px] font-semibold tracking-wider text-amber-500 uppercase">
              Conflicts
            </span>
            {scanningConflicts ? (
              <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
            ) : (
              <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-medium text-amber-600 tabular-nums dark:text-amber-400">
                {conflicts.length}
              </span>
            )}
          </button>
          {showConflicts && (
            <div className="mt-1 space-y-1.5">
              {conflicts.map((conflict, i) => (
                <ConflictRow
                  key={`${conflict.featureId}-${conflict.field}-${i}`}
                  conflict={conflict}
                  onResolve={() => {
                    // Remove from conflicts list (resolution is informational for now)
                    // In a full implementation, "Use Wiki" would update the feature data
                  }}
                />
              ))}
              {scanningConflicts && (
                <div className="text-muted-foreground flex items-center gap-2 py-2 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Scanning linked features for conflicts...
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Missing from Map (placeholder) */}
      <div>
        <button
          onClick={() => setShowMissing(!showMissing)}
          className="hover:bg-accent flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left transition-colors"
        >
          <ChevronDown
            className={`text-muted-foreground h-3 w-3 transition-transform ${showMissing ? "" : "-rotate-90"}`}
          />
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Missing from Map
          </span>
        </button>
        {showMissing && (
          <div className="border-border bg-muted/30 text-muted-foreground mt-1 rounded-lg border border-dashed px-3 py-4 text-center text-xs">
            Reverse wiki scanning coming soon. This will find wiki pages that reference locations
            not yet on your map.
          </div>
        )}
      </div>

      {/* Empty state */}
      {!scanning && unlinkedFeatures.length === 0 && conflicts.length === 0 && (
        <div className="border-border bg-muted/30 rounded-lg border border-dashed px-3 py-6 text-center">
          <Search className="text-muted-foreground/50 mx-auto mb-2 h-6 w-6" />
          <p className="text-muted-foreground text-xs">
            Click &ldquo;Scan&rdquo; to find matching wiki pages for your map features.
          </p>
        </div>
      )}
    </div>
  );
}
