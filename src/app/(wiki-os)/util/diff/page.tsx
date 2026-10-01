"use client";
// src/app/(wiki-os)/wiki/diff/page.tsx
// WikiOS Native Revision Diff Comparator with DiffViewer

import { cn } from "~/lib/utils";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ViewColumns2 as Columns2, AlignLeft, Undo, Check } from "iconoir-react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { DiffViewer } from "~/components/diff-viewer";
import { withBasePath } from "~/lib/base-path";

export default function DiffPage() {
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from") || searchParams.get("oldid") || "";
  const toParam =
    searchParams.get("to") || searchParams.get("diff") || searchParams.get("revid") || "";
  // Revision ids are opaque history `revid`s; "prev" and "0" mean "the previous revision".
  const fromrev = fromParam && fromParam !== "prev" && fromParam !== "0" ? fromParam : undefined;
  const torev = toParam === "0" ? "" : toParam;
  const [layout, setLayout] = useState<"unified" | "split">("unified");
  const [undoConfirm, setUndoConfirm] = useState(false);

  const { data, isLoading, error } = api.wikios.getDiff.useQuery(
    { fromrev, torev },
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
            href={withBasePath("/util")}
            className="text-label-secondary hover:text-tint text-caption inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Utilities
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
                  <div className="border-separator bg-fill-3 rounded-row flex border p-0.5">
                    <button
                      type="button"
                      onClick={() => setLayout("unified")}
                      className={cn(
                        "rounded-control text-caption flex items-center gap-1.5 px-2.5 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                        layout === "unified"
                          ? "bg-background text-label shadow-card"
                          : "text-label-secondary hover:text-label"
                      )}
                    >
                      <AlignLeft className="h-3.5 w-3.5" />
                      Unified
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayout("split")}
                      className={cn(
                        "rounded-control text-caption flex items-center gap-1.5 px-2.5 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                        layout === "split"
                          ? "bg-background text-label shadow-card"
                          : "text-label-secondary hover:text-label"
                      )}
                    >
                      <Columns2 className="h-3.5 w-3.5" />
                      Split
                    </button>
                  </div>

                  {/* Undo Button */}
                  {!undoConfirm ? (
                    <button
                      type="button"
                      onClick={() => setUndoConfirm(true)}
                      className="rounded-row border-yellow/30 bg-yellow/10 text-caption text-yellow hover:bg-yellow/20 inline-flex items-center gap-1.5 border px-3 py-1.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
                    >
                      <Undo className="h-3.5 w-3.5" />
                      Revert to r{data.from.revid}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={revertMutation.isPending || !revContent}
                        onClick={() => {
                          if (revContent) {
                            revertMutation.mutate({
                              title: revContent.title,
                              revid: data.from.revid,
                              summary: `Reverted revision ${data.to.revid} by ${data.to.user}`,
                            });
                          }
                        }}
                        className="rounded-row bg-yellow text-caption hover:bg-yellow/70 px-3 py-1.5 font-semibold text-black active:scale-[0.98]"
                      >
                        {revertMutation.isPending ? "Reverting…" : "Confirm Revert"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setUndoConfirm(false)}
                        className="border-separator bg-fill-3 text-label hover:bg-fill-2 rounded-row text-caption border px-3 py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Status alerts */}
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
                oldCode={data.oldWikitext ?? ""}
                newCode={data.newWikitext ?? ""}
                layout={layout}
                language="markdown"
                oldTitle={`Revision r${data.from.revid} (${data.from.user})`}
                newTitle={`Revision r${data.to.revid} (${data.to.user})`}
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
