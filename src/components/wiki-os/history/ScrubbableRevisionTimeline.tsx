"use client";
// src/components/wiki-os/history/ScrubbableRevisionTimeline.tsx
// Interactive Scrubbable Revision Timeline & Diff Inspection Suite

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
import { ParkedBadge } from "~/components/wiki-os/shared/ParkedBadge";
import { api } from "~/trpc/react";

interface RevisionItem {
  id: string;
  articleId: string;
  author: string | null;
  summary: string | null;
  minor: boolean;
  byteSize: number;
  byteDelta?: number;
  /** A MediaWiki edit that conflicted with WikiOS's head: in the history, never the live text. */
  parked?: boolean;
  createdAt: Date | string;
}

interface ScrubbableRevisionTimelineProps {
  title: string;
  slug: string;
  revisions: RevisionItem[];
  isLoading?: boolean;
}

/** Size change of a revision against its predecessor, e.g. "(+1,420)" or "(-320)". */
function ByteDelta({ delta }: { delta?: number }) {
  if (!delta) return null;
  return (
    <span className={`ml-1.5 ${delta > 0 ? "text-emerald-500" : "text-rose-500"}`}>
      ({delta > 0 ? "+" : ""}
      {delta.toLocaleString()})
    </span>
  );
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
  // Rollback works on the page's real revisions: a parked one never was the latest.
  const liveRevisions = revisions.filter((r) => !r.parked);

  // The server diffs the two revisions once and sends only the hunks (never both texts)
  const diff = api.wikios.getDiff.useQuery(
    { fromrev: compareRev?.id, torev: targetRev?.id ?? "" },
    { enabled: !!targetRev && !!compareRev, staleTime: 300_000 }
  );

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
              <span className="bg-secondary/80 text-foreground rounded-full px-2 py-0.5 text-xs font-medium">
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
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
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
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
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
            {liveRevisions.length >= 2 && liveRevisions[0]?.author === liveRevisions[1]?.author && (
              <button
                type="button"
                onClick={() => rollbackMutation.mutate({ title })}
                disabled={rollbackMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-red-500/20 active:scale-[0.98]"
              >
                <RotateLeft className="h-3.5 w-3.5" />
                {rollbackMutation.isPending
                  ? "Rolling back…"
                  : `Rollback ${liveRevisions[0]?.author}`}
              </button>
            )}
          </div>
        </div>

        {/* Rollback failure: the server's reason (e.g. a revision text that was never imported) */}
        {rollbackMutation.error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {rollbackMutation.error.message}
          </div>
        )}

        {/* Visual Timeline Scrubber Bar */}
        <div className="space-y-2 pt-2">
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>Current (Latest)</span>
            <span>Origin (Oldest)</span>
          </div>

          <div className="bg-secondary/30 border-border/30 relative flex h-8 items-center rounded-xl border px-2">
            {/* Timeline ticks */}
            <div className="pointer-events-none absolute inset-x-3 flex justify-between">
              {revisions.map((r, i) => (
                <div
                  key={r.id}
                  className={`h-3 w-1 rounded-full transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
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
              <span className="text-wiki text-xs font-semibold uppercase">
                Revision A (Newer)
              </span>
              <span className="text-foreground font-mono text-xs font-semibold">
                {targetRev?.byteSize?.toLocaleString()} bytes
                <ByteDelta delta={targetRev?.byteDelta} />
              </span>
            </div>
            <div className="text-foreground flex items-center gap-2 text-xs">
              <User className="text-muted-foreground h-3.5 w-3.5" />
              <span className="font-medium">{targetRev?.author || "Community Contributor"}</span>
              {targetRev?.minor && (
                <span className="py-0.2 rounded bg-amber-500/15 px-1 text-xs font-semibold text-amber-400">
                  m
                </span>
              )}
              {targetRev?.parked && <ParkedBadge />}
            </div>
            <div className="text-muted-foreground text-xs">
              {targetRev && new Date(targetRev.createdAt).toLocaleString()}
            </div>
            {targetRev &&
              (() => {
                const clean = targetRev.summary?.trim() || "";
                const isSync = !clean || /live sync/i.test(clean) || /mediawiki/i.test(clean);
                return isSync ? (
                  <div className="pt-0.5">
                    <span className="text-muted-foreground inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium">
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
              <span className="text-xs font-semibold text-amber-400 uppercase">
                Revision B (Older)
              </span>
              <select
                value={compareRevIndex}
                onChange={(e) => setCompareRevIndex(parseInt(e.target.value, 10))}
                className="border-border/40 bg-background text-foreground h-6 rounded-lg border px-2 text-xs focus:outline-none"
              >
                {revisions.map((r, idx) => (
                  <option key={r.id} value={idx}>
                    {idx === 0 ? "Latest" : `r${r.id}`} • {r.author}
                    {r.parked ? " (conflict — not live)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-foreground flex items-center gap-2 text-xs">
              <User className="text-muted-foreground h-3.5 w-3.5" />
              <span className="font-medium">{compareRev?.author || "Community Contributor"}</span>
              {compareRev?.parked && <ParkedBadge />}
            </div>
            <div className="text-muted-foreground text-xs">
              {compareRev && new Date(compareRev.createdAt).toLocaleString()}
            </div>
            {compareRev &&
              (() => {
                const clean = compareRev.summary?.trim() || "";
                const isSync = !clean || /live sync/i.test(clean) || /mediawiki/i.test(clean);
                return isSync ? (
                  <div className="pt-0.5">
                    <span className="text-muted-foreground inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium">
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
              onClick={() => {
                revertMutation.reset();
                setUndoTarget(compareRev);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-amber-500/20 active:scale-[0.98]"
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
            {revertMutation.error && (
              <p role="alert" className="flex items-center gap-2 text-xs font-medium text-red-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {revertMutation.error.message}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={revertMutation.isPending}
                onClick={() => {
                  revertMutation.mutate({
                    title,
                    revid: undoTarget.id,
                    summary: `Reverted to revision ${undoTarget.id} by ${undoTarget.author}`,
                  });
                }}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400 active:scale-[0.98]"
              >
                {revertMutation.isPending ? "Reverting…" : "Confirm Revert"}
              </button>
              <button
                type="button"
                onClick={() => {
                  revertMutation.reset();
                  setUndoTarget(null);
                }}
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
        {diff.error ? (
          <p className="text-xs font-medium text-red-400">
            Failed to load the comparison: {diff.error.message}
          </p>
        ) : diff.data ? (
          <DiffViewer
            hunks={diff.data.hunks}
            layout={layout}
            language="markdown"
            oldTitle={`Revision B (r${compareRev?.id || "origin"})`}
            newTitle={`Revision A (r${targetRev?.id || "current"})`}
          />
        ) : (
          <div className="flex h-24 items-center justify-center">
            <div className="border-wiki h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
