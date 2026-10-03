"use client";

import { cn } from "~/lib/utils";
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
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

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
  revisions: RevisionItem[];
  isLoading?: boolean;
}

/** Size change of a revision against its predecessor, e.g. "(+1,420)" or "(-320)". */
function ByteDelta({ delta }: { delta?: number }) {
  if (!delta) return null;
  return (
    <span className={`ml-2 ${delta > 0 ? "text-green" : "text-red"}`}>
      ({delta > 0 ? "+" : ""}
      {delta.toLocaleString()})
    </span>
  );
}

/** Edit summary, or a neutral chip for empty / auto-generated sync summaries. */
function RevisionSummary({ rev }: { rev: RevisionItem }) {
  const clean = rev.summary?.trim() || "";
  if (!clean || /live sync/i.test(clean) || /mediawiki/i.test(clean)) {
    return (
      <div className="pt-0.5">
        <span className="text-label-secondary border-separator bg-fill-4 text-caption inline-flex items-center rounded-full border px-2 py-0.5">
          {rev.minor ? "Minor edit" : "Updated content"}
        </span>
      </div>
    );
  }
  return <p className="text-label-secondary text-footnote italic">&ldquo;{clean}&rdquo;</p>;
}

export function ScrubbableRevisionTimeline({
  title,
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
    { revid: targetRev?.id ?? "" },
    { enabled: !!targetRev && !targetRev.wikitext, staleTime: 300_000 }
  );

  const { data: compareContent } = api.wikios.getRevisionContent.useQuery(
    { revid: compareRev?.id ?? "" },
    { enabled: !!compareRev && !compareRev.wikitext, staleTime: 300_000 }
  );

  const targetWikitext = targetRev?.wikitext || targetContent?.wikitext || "";
  const compareWikitext = compareRev?.wikitext || compareContent?.wikitext || "";

  if (isLoading) {
    return (
      <div className="border-separator bg-surface rounded-card flex h-64 items-center justify-center border">
        <div className="border-tint h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (revisions.length === 0) {
    return (
      <div className="border-separator bg-surface rounded-card border border-dashed p-12 text-center">
        <Clock className="text-label-secondary mx-auto mb-3 h-10 w-10" />
        <h3 className="text-label text-headline">No revision history found</h3>
        <p className="text-label-secondary text-footnote mt-1">
          This article does not have recorded historical revisions yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline Controls & Scrubber Card */}
      <div className="border-separator bg-surface rounded-card space-y-5 border p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-tint text-subhead">Revision timeline</span>
              <span className="bg-fill-2 text-label text-caption rounded-full px-2 py-0.5">
                {revisions.length} revision{revisions.length > 1 ? "s" : ""}
              </span>
            </div>
            <h2 className="text-label text-title-3 mt-1">{title}</h2>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            {/* Split / Unified Layout Toggle */}
            <SegmentedControl
              size="sm"
              aria-label="Diff layout"
              value={layout}
              onValueChange={setLayout}
              options={[
                { value: "unified", label: "Unified", icon: <AlignLeft /> },
                { value: "split", label: "Split", icon: <Columns2 /> },
              ]}
            />

            {/* Rollback Latest Author */}
            {revisions.length >= 2 && revisions[0]?.author === revisions[1]?.author && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => rollbackMutation.mutate({ title })}
                disabled={rollbackMutation.isPending}
                className="bg-red/10 text-red hover:bg-red/20"
              >
                <RotateLeft className="h-3.5 w-3.5" />
                {rollbackMutation.isPending ? "Rolling back…" : `Rollback ${revisions[0]?.author}`}
              </Button>
            )}
          </div>
        </div>

        {/* Visual Timeline Scrubber Bar */}
        <div className="space-y-2 pt-2">
          <div className="text-label-secondary text-footnote flex justify-between">
            <span>Current (Latest)</span>
            <span>Origin (Oldest)</span>
          </div>

          <div className="bg-fill-4 border-separator rounded-row relative flex h-8 items-center border px-2">
            {/* Timeline ticks */}
            <div className="pointer-events-none absolute inset-x-3 flex justify-between">
              {revisions.map((r, i) => (
                <div
                  key={r.id}
                  className={cn(
                    "duration-fast w-1 rounded-full transition-[height,background-color]",
                    i === targetRevIndex
                      ? "bg-tint h-4"
                      : i === compareRevIndex
                        ? "bg-yellow h-4"
                        : "bg-fill h-3"
                  )}
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
          <div className="border-tint/30 bg-tint/5 rounded-row space-y-1 border p-3">
            <div className="flex items-center justify-between">
              <span className="text-tint text-eyebrow">Revision A (Newer)</span>
              <span className="text-label text-caption font-semibold tabular-nums">
                {targetRev?.byteSize?.toLocaleString()} bytes
                <ByteDelta delta={targetRev?.byteDelta} />
              </span>
            </div>
            <div className="text-label text-footnote flex items-center gap-2">
              <User className="text-label-secondary h-3.5 w-3.5" />
              <span className="font-medium">{targetRev?.author || "Community Contributor"}</span>
              {targetRev?.minor && (
                <span className="py-0.2 rounded-control-sm bg-yellow/15 text-caption text-yellow px-1 font-semibold">
                  m
                </span>
              )}
            </div>
            <div className="text-label-secondary text-footnote">
              {targetRev && new Date(targetRev.createdAt).toLocaleString()}
            </div>
            {targetRev && <RevisionSummary rev={targetRev} />}
          </div>

          {/* Compare Revision (Base Selection) */}
          <div className="rounded-row border-yellow/30 bg-yellow/5 space-y-1 border p-3">
            <div className="flex items-center justify-between">
              <span className="text-eyebrow text-yellow">Revision B (Older)</span>
              <Select
                value={String(compareRevIndex)}
                onValueChange={(v) => setCompareRevIndex(parseInt(v, 10))}
              >
                <SelectTrigger size="sm" aria-label="Compare revision" className="max-w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {revisions.map((r, idx) => (
                    <SelectItem key={r.id} value={String(idx)}>
                      {idx === 0 ? "Latest" : `r${r.id}`} • {r.author}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-label text-footnote flex items-center gap-2">
              <User className="text-label-secondary h-3.5 w-3.5" />
              <span className="font-medium">{compareRev?.author || "Community Contributor"}</span>
            </div>
            <div className="text-label-secondary text-footnote">
              {compareRev && new Date(compareRev.createdAt).toLocaleString()}
            </div>
            {compareRev && <RevisionSummary rev={compareRev} />}
          </div>
        </div>

        {/* Undo Action Bar */}
        {compareRev && targetRev && compareRevIndex !== targetRevIndex && (
          <div className="border-separator flex items-center justify-between border-t pt-2">
            <span className="text-label-secondary text-footnote">
              Comparing <strong>r{targetRev.id}</strong> against <strong>r{compareRev.id}</strong>
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setUndoTarget(compareRev)}
              className="bg-yellow/10 text-yellow hover:bg-yellow/20"
            >
              <Undo className="h-3.5 w-3.5" />
              Revert to this version
            </Button>
          </div>
        )}

        {/* Undo Confirmation Modal */}
        {undoTarget && (
          <div className="rounded-row border-yellow/40 bg-yellow/10 space-y-3 border p-4">
            <div className="text-yellow flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <h4 className="text-caption font-semibold">Confirm revert action</h4>
            </div>
            <p className="text-label-secondary text-footnote">
              Are you sure you want to restore the article to revision{" "}
              <strong>{undoTarget.id}</strong> authored by <strong>{undoTarget.author}</strong>?
              This will create a new revision restoring the exact text.
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={revertMutation.isPending}
                onClick={() => {
                  revertMutation.mutate({
                    title,
                    revid: undoTarget.id,
                    summary: `Reverted to revision ${undoTarget.id} by ${undoTarget.author}`,
                  });
                }}
                className="bg-yellow hover:bg-yellow/80 text-black"
              >
                {revertMutation.isPending ? "Reverting…" : "Confirm revert"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setUndoTarget(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Embedded DiffViewer */}
      <div className="border-separator bg-surface rounded-card overflow-hidden border p-4">
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
