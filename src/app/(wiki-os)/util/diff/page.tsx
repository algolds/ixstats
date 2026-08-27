// src/app/(wiki-os)/wiki/diff/page.tsx
// WikiOS Native Revision Diff Comparator with DiffViewer
"use client";

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
  const fromParam = searchParams.get("from") || searchParams.get("oldid") || "0";
  const toParam =
    searchParams.get("to") || searchParams.get("diff") || searchParams.get("revid") || "0";
  const fromrev = fromParam !== "prev" ? parseInt(fromParam, 10) || 0 : 0;
  const torev = parseInt(toParam, 10) || 0;
  const [layout, setLayout] = useState<"unified" | "split">("unified");
  const [undoConfirm, setUndoConfirm] = useState(false);

  const { data, isLoading, error } = api.wikios.getDiff.useQuery(
    { fromrev, torev },
    { enabled: torev > 0, staleTime: 60_000 }
  );

  const effectiveFromRev = data?.from?.revid ?? fromrev;

  const { data: revContent } = api.wikios.getRevisionContent.useQuery(
    { revid: effectiveFromRev },
    { enabled: effectiveFromRev > 0 && undoConfirm, staleTime: 300_000 }
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
            className="text-muted-foreground hover:text-wiki inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Utilities
          </Link>
        </div>

        {isLoading && (
          <div className="border-border/40 bg-card/50 flex h-64 items-center justify-center rounded-2xl border">
            <div className="border-wiki h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-xs text-red-400">
            Failed to load revision comparison: {error.message}
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {/* Diff Meta Card */}
            <div className="border-border/40 bg-card/75 space-y-4 rounded-2xl border p-6 backdrop-blur-xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-wiki text-xs font-semibold tracking-wider uppercase">
                    Comparing Revisions
                  </span>
                  <h2 className="text-foreground mt-1 text-lg font-bold">
                    r{data.from.revid} &rarr; r{data.to.revid}
                  </h2>
                </div>

                {/* Layout Switcher */}
                <div className="flex items-center gap-2">
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

                  {/* Undo Button */}
                  {!undoConfirm ? (
                    <button
                      type="button"
                      onClick={() => setUndoConfirm(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 transition-all hover:bg-amber-500/20 active:scale-[0.98]"
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
                        className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400 active:scale-[0.98]"
                      >
                        {revertMutation.isPending ? "Reverting…" : "Confirm Revert"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setUndoConfirm(false)}
                        className="border-border/50 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl border px-3 py-1.5 text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Status alerts */}
              {revertMutation.isSuccess && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">
                  <Check className="h-4 w-4" />
                  Successfully reverted to revision r{data.from.revid}.
                </div>
              )}
            </div>

            {/* DiffViewer Component */}
            <div className="border-border/40 bg-card/60 overflow-hidden rounded-2xl border p-4">
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

        {!isLoading && !data && torev === 0 && (
          <div className="border-border/50 bg-card/30 text-muted-foreground rounded-2xl border border-dashed p-12 text-center text-xs">
            No revisions selected for comparison. Specify <code>?to=REV</code> or{" "}
            <code>?from=REV&to=REV</code> in the URL.
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}
