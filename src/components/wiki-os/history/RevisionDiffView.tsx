"use client";
// src/components/wiki-os/history/RevisionDiffView.tsx
// WikiOS Native Revision Diff Comparator with DiffViewer. Shared by /util/diff and the in-place
// `/wiki/<title>?diff=` view of the `/wiki/[...slug]` route.

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ViewColumns2 as Columns2,
  AlignLeft,
  Undo,
  Check,
  WarningTriangle,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { DiffViewer } from "~/components/diff-viewer";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";

export interface RevisionDiffViewProps {
  /** The older revision's reference; undefined means "the revision before `torev`". */
  fromrev?: string;
  /** The newer revision's reference; empty shows the "no revisions selected" hint. */
  torev: string;
  /** App-relative path of the link at the top, and its text. */
  backHref: string;
  backLabel: string;
}

export function RevisionDiffView({ fromrev, torev, backHref, backLabel }: RevisionDiffViewProps) {
  const [layout, setLayout] = useState<"unified" | "split">("unified");
  const [undoConfirm, setUndoConfirm] = useState(false);

  const { data, isLoading, error } = api.wikios.getDiff.useQuery(
    { fromrev: fromrev || undefined, torev },
    { enabled: torev.length > 0, staleTime: 60_000 }
  );

  const effectiveFromRev = data?.from?.revid || fromrev || "";

  const { data: revContent } = api.wikios.getRevisionContent.useQuery(
    { revid: effectiveFromRev },
    { enabled: effectiveFromRev.length > 0 && undoConfirm, staleTime: 300_000 }
  );

  const revertMutation = api.wikios.revertToRevision.useMutation({
    onSuccess: () => setUndoConfirm(false),
  });

  return (
    <WikiOSLayout title="Revision Diff">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        {/* Back Link */}
        <div>
          <Link
            href={backHref}
            className="text-label-secondary hover:text-tint text-caption inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Link>
        </div>

        {isLoading && (
          <div className="border-separator bg-surface rounded-card flex h-64 items-center justify-center border">
            <div className="border-tint h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="rounded-card border-red/30 bg-red/10 text-footnote text-red border p-6">
            Failed to load revision comparison: {error.message}
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {/* Diff Meta Card */}
            <div className="border-separator bg-surface rounded-card space-y-4 border p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-tint text-eyebrow">Comparing Revisions</span>
                  <h2 className="text-label text-title-3 mt-1">
                    r{data.from.revid} &rarr; r{data.to.revid}
                  </h2>
                </div>

                {/* Layout Switcher */}
                <div className="flex items-center gap-2">
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

                  {/* Undo Button (a parked revision was never the page's text: nothing to go back to) */}
                  {data.from.parked ? (
                    <span className="text-label-secondary text-caption">
                      r{data.from.revid} never went live, so it cannot be restored.
                    </span>
                  ) : !undoConfirm ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        revertMutation.reset();
                        setUndoConfirm(true);
                      }}
                      className="bg-yellow/10 text-yellow hover:bg-yellow/20"
                    >
                      <Undo className="h-3.5 w-3.5" />
                      Revert to r{data.from.revid}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={revertMutation.isPending || !revContent}
                        onClick={() => {
                          if (revContent) {
                            revertMutation.mutate({
                              title: revContent.title,
                              revid: data.from.revid,
                              summary: `Reverted revision ${data.to.revid}${data.to.user ? ` by ${data.to.user}` : ""}`,
                            });
                          }
                        }}
                        className="bg-yellow hover:bg-yellow/80 text-black"
                      >
                        {revertMutation.isPending ? "Reverting…" : "Confirm Revert"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          revertMutation.reset();
                          setUndoConfirm(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Status alerts */}
              {revertMutation.error && (
                <div
                  role="alert"
                  className="rounded-row border-red/30 bg-red/10 text-caption text-red flex items-center gap-2 border px-3 py-2"
                >
                  <WarningTriangle className="h-4 w-4 shrink-0" />
                  {revertMutation.error.message}
                </div>
              )}
              {revertMutation.isSuccess && (
                <div className="rounded-row border-green/30 bg-green/10 text-caption text-green flex items-center gap-2 border px-3 py-2">
                  <Check className="h-4 w-4" />
                  Successfully reverted to revision r{data.from.revid}.
                </div>
              )}
            </div>

            {/* DiffViewer Component */}
            <div className="border-separator bg-surface rounded-card overflow-hidden border p-4">
              <DiffViewer
                hunks={data.hunks}
                trailingSkipped={data.trailingSkipped}
                tooLarge={data.tooLarge}
                truncated={data.truncated}
                added={data.added}
                removed={data.removed}
                layout={layout}
                language="markdown"
                oldTitle={`Revision r${data.from.revid} (${data.from.user ?? "hidden user"})`}
                newTitle={`Revision r${data.to.revid} (${data.to.user ?? "hidden user"})`}
              />
            </div>
          </div>
        )}

        {!isLoading && !data && !torev && (
          <div className="border-separator bg-surface text-label-secondary rounded-card text-footnote border border-dashed p-12 text-center">
            No revisions selected for comparison. Specify <code>?to=REV</code> or{" "}
            <code>?from=REV&to=REV</code> in the URL.
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}
