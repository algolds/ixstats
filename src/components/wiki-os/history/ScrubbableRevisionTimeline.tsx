// src/components/wiki-os/history/ScrubbableRevisionTimeline.tsx
// Interactive Scrubbable Revision Timeline & Diff Inspection Suite
"use client";

import * as React from "react";
import {
  Clock,
  User,
  Restart as RotateLeft,
  Undo,
  ViewColumns2 as Columns2,
  AlignLeft,
  WarningTriangle as AlertTriangle,
} from "iconoir-react";
import { DiffViewer } from "~/components/diff-viewer";
import { api } from "~/trpc/react";

interface RevisionItem {
  id: string;
  articleId: string;
  author: string | null;
  summary: string | null;
  minor: boolean;
  byteSize: number;
  byteDelta?: number;
  createdAt: Date | string;
  wikitext?: string;
}

interface ScrubbableRevisionTimelineProps {
  title: string;
  slug: string;
  revisions: RevisionItem[];
  isLoading?: boolean;
}

export function ScrubbableRevisionTimeline({
  title,
  // oxlint-disable-next-line eslint/no-unused-vars
  slug,
  revisions,
  isLoading,
}: ScrubbableRevisionTimelineProps) {
  // Indices into revisions array (0 = latest, revisions.length - 1 = oldest)
  const [targetRevIndex, setTargetRevIndex] = React.useState<number>(0);
  const [compareRevIndex, setCompareRevIndex] = React.useState<number>(
    Math.min(1, Math.max(0, revisions.length - 1))
  );
  const [layout, setLayout] = React.useState<"unified" | "split">("unified");
  const [undoTarget, setUndoTarget] = React.useState<RevisionItem | null>(null);

  const utils = api.useUtils();

  const revertMutation = api.wikios.revertToRevision.useMutation({
    onSuccess: () => {
      setUndoTarget(null);
      void utils.wikios.getHistory.invalidate({ title });
    },
  });

  const rollbackMutation = api.wikios.rollback.useMutation({
    onSuccess: () => {
      void utils.wikios.getHistory.invalidate({ title });
    },
  });

  const targetRev = revisions[targetRevIndex];
  const compareRev = revisions[compareRevIndex];

  // Fetch full wikitext for both revisions if needed
  const { data: targetContent } = api.wikios.getRevisionContent.useQuery(
    { revid: targetRev?.id ? parseInt(targetRev.id.replace(/^mw-/, ""), 10) : 0 },
    { enabled: !!targetRev && !targetRev.wikitext, staleTime: 300_000 }
  );

  const { data: compareContent } = api.wikios.getRevisionContent.useQuery(
    { revid: compareRev?.id ? parseInt(compareRev.id.replace(/^mw-/, ""), 10) : 0 },
    { enabled: !!compareRev && !compareRev.wikitext, staleTime: 300_000 }
  );

  const targetWikitext = targetRev?.wikitext || targetContent?.wikitext || "";
  const compareWikitext = compareRev?.wikitext || compareContent?.wikitext || "";

  if (isLoading) {
    return (
      <div className="border-border/40 bg-card/50 flex h-64 items-center justify-center rounded-2xl border">
        <div className="border-wiki h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (revisions.length === 0) {
    return (
      <div className="border-border/60 bg-card/30 rounded-2xl border border-dashed p-12 text-center">
        <Clock className="text-muted-foreground/40 mx-auto mb-3 h-10 w-10" />
        <h3 className="text-foreground text-sm font-semibold">No revision history found</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          This article does not have recorded historical revisions yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline Controls & Scrubber Card */}
      <div className="border-border/40 bg-card/75 space-y-5 rounded-2xl border p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-wiki text-xs font-semibold tracking-wider uppercase">
                Revision Timeline
              </span>
              <span className="bg-secondary/80 text-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                {revisions.length} revision{revisions.length > 1 ? "s" : ""}
              </span>
            </div>
            <h2 className="text-foreground mt-1 text-lg font-bold">{title}</h2>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            {/* Split / Unified Layout Toggle */}
            <div className="border-border/40 bg-secondary/50 flex rounded-xl border p-0.5">
              <button
                type="button"
                onClick={() => setLayout("unified")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  layout === "unified"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <AlignLeft className="h-3.5 w-3.5" />
                Unified
              </button>
              <button
                type="button"
                onClick={() => setLayout("split")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  layout === "split"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Columns2 className="h-3.5 w-3.5" />
                Split
              </button>
            </div>

            {/* Rollback Latest Author */}
            {revisions.length >= 2 && revisions[0]?.author === revisions[1]?.author && (
              <button
                type="button"
                onClick={() => rollbackMutation.mutate({ title })}
                disabled={rollbackMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20 active:scale-[0.98]"
              >
                <RotateLeft className="h-3.5 w-3.5" />
                {rollbackMutation.isPending ? "Rolling back…" : `Rollback ${revisions[0]?.author}`}
              </button>
            )}
          </div>
        </div>

        {/* Visual Timeline Scrubber Bar */}
        <div className="space-y-2 pt-2">
          <div className="text-muted-foreground flex justify-between text-[11px]">
            <span>Current (Latest)</span>
            <span>Origin (Oldest)</span>
          </div>

          <div className="bg-secondary/30 border-border/30 relative flex h-8 items-center rounded-xl border px-2">
            {/* Timeline ticks */}
            <div className="pointer-events-none absolute inset-x-3 flex justify-between">
              {revisions.map((r, i) => (
                <div
                  key={r.id}
                  className={`h-3 w-1 rounded-full transition-all ${
                    i === targetRevIndex
                      ? "bg-wiki h-4"
                      : i === compareRevIndex
                        ? "h-4 bg-amber-400"
                        : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            {/* Slider */}
            <input
              type="range"
              min={0}
              max={revisions.length - 1}
              value={targetRevIndex}
              onChange={(e) => setTargetRevIndex(parseInt(e.target.value, 10))}
              className="accent-wiki relative w-full cursor-pointer opacity-70 transition-opacity hover:opacity-100"
            />
          </div>
        </div>

        {/* Selected Revisions Metadata Comparison */}
        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
          {/* Target Revision (Current Selection) */}
          <div className="border-wiki/30 bg-wiki/5 space-y-1 rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <span className="text-wiki text-[11px] font-semibold uppercase">
                Revision A (Newer)
              </span>
              <span className="text-foreground font-mono text-xs font-semibold">
                {targetRev?.byteSize?.toLocaleString()} bytes
              </span>
            </div>
            <div className="text-foreground flex items-center gap-2 text-xs">
              <User className="text-muted-foreground h-3.5 w-3.5" />
              <span className="font-medium">{targetRev?.author || "Community Contributor"}</span>
              {targetRev?.minor && (
                <span className="py-0.2 rounded bg-amber-500/15 px-1 text-[10px] font-semibold text-amber-400">
                  m
                </span>
              )}
            </div>
            <div className="text-muted-foreground text-[11px]">
              {targetRev && new Date(targetRev.createdAt).toLocaleString()}
            </div>
            {targetRev &&
              (() => {
                const clean = targetRev.summary?.trim() || "";
                const isSync = !clean || /live sync/i.test(clean) || /mediawiki/i.test(clean);
                return isSync ? (
                  <div className="pt-0.5">
                    <span className="text-muted-foreground inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium">
                      {targetRev.minor ? "Minor edit" : "Updated content"}
                    </span>
                  </div>
                ) : (
                  <p className="text-foreground/80 text-xs italic">&ldquo;{clean}&rdquo;</p>
                );
              })()}
          </div>

          {/* Compare Revision (Base Selection) */}
          <div className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-400 uppercase">
                Revision B (Older)
              </span>
              <select
                value={compareRevIndex}
                onChange={(e) => setCompareRevIndex(parseInt(e.target.value, 10))}
                className="border-border/40 bg-background text-foreground h-6 rounded-lg border px-2 text-[11px] focus:outline-none"
              >
                {revisions.map((r, idx) => (
                  <option key={r.id} value={idx}>
                    {idx === 0 ? "Latest" : `r${r.id}`} • {r.author}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-foreground flex items-center gap-2 text-xs">
              <User className="text-muted-foreground h-3.5 w-3.5" />
              <span className="font-medium">{compareRev?.author || "Community Contributor"}</span>
            </div>
            <div className="text-muted-foreground text-[11px]">
              {compareRev && new Date(compareRev.createdAt).toLocaleString()}
            </div>
            {compareRev &&
              (() => {
                const clean = compareRev.summary?.trim() || "";
                const isSync = !clean || /live sync/i.test(clean) || /mediawiki/i.test(clean);
                return isSync ? (
                  <div className="pt-0.5">
                    <span className="text-muted-foreground inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium">
                      {compareRev.minor ? "Minor edit" : "Updated content"}
                    </span>
                  </div>
                ) : (
                  <p className="text-foreground/80 text-xs italic">&ldquo;{clean}&rdquo;</p>
                );
              })()}
          </div>
        </div>

        {/* Undo Action Bar */}
        {compareRev && targetRev && compareRevIndex !== targetRevIndex && (
          <div className="border-border/30 flex items-center justify-between border-t pt-2">
            <span className="text-muted-foreground text-xs">
              Comparing <strong>r{targetRev.id}</strong> against <strong>r{compareRev.id}</strong>
            </span>
            <button
              type="button"
              onClick={() => setUndoTarget(compareRev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 transition-all hover:bg-amber-500/20 active:scale-[0.98]"
            >
              <Undo className="h-3.5 w-3.5" />
              Revert to this version
            </button>
          </div>
        )}

        {/* Undo Confirmation Modal */}
        {undoTarget && (
          <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <h4 className="text-xs font-bold">Confirm Revert Action</h4>
            </div>
            <p className="text-muted-foreground text-xs">
              Are you sure you want to restore the article to revision{" "}
              <strong>{undoTarget.id}</strong> authored by <strong>{undoTarget.author}</strong>?
              This will create a new revision restoring the exact text.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={revertMutation.isPending}
                onClick={() => {
                  revertMutation.mutate({
                    title,
                    revid: parseInt(undoTarget.id.replace(/^mw-/, ""), 10) || 0,
                    summary: `Reverted to revision ${undoTarget.id} by ${undoTarget.author}`,
                  });
                }}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400 active:scale-[0.98]"
              >
                {revertMutation.isPending ? "Reverting…" : "Confirm Revert"}
              </button>
              <button
                type="button"
                onClick={() => setUndoTarget(null)}
                className="border-border/50 bg-secondary/60 text-foreground hover:bg-secondary rounded-lg border px-3 py-1.5 text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Embedded DiffViewer */}
      <div className="border-border/40 bg-card/60 overflow-hidden rounded-2xl border p-4">
        <DiffViewer
          oldCode={compareWikitext}
          newCode={targetWikitext}
          layout={layout}
          language="markdown"
          oldTitle={`Revision B (r${compareRev?.id || "origin"})`}
          newTitle={`Revision A (r${targetRev?.id || "current"})`}
        />
      </div>
    </div>
  );
}
