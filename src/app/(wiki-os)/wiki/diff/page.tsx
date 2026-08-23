// src/app/(wiki-os)/wiki/diff/page.tsx
// WikiOS Diff Viewer — shows visual diff between two revisions with undo
"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";

export default function DiffPage() {
  const searchParams = useSearchParams();
  const fromrev = parseInt(searchParams.get("from") ?? "0", 10);
  const torev = parseInt(searchParams.get("to") ?? "0", 10);
  const [undoConfirm, setUndoConfirm] = useState(false);

  const { data, isLoading, error } = api.wikios.getDiff.useQuery(
    { fromrev, torev },
    { enabled: fromrev > 0 && torev > 0, staleTime: 60_000 }
  );

  // We need to get the title from the revision to perform undo
  const { data: revContent } = api.wikios.getRevisionContent.useQuery(
    { revid: fromrev },
    { enabled: fromrev > 0 && undoConfirm, staleTime: 300_000 }
  );

  const revertMutation = api.wikios.revertToRevision.useMutation({
    onSuccess: () => setUndoConfirm(false),
  });

  return (
    <WikiOSLayout title="Revision diff">
      <div className="wikios-special-page">
        {isLoading && (
          <div className="wikios-loading" style={{ minHeight: 200 }}>
            <div className="wikios-loading-spinner" />
          </div>
        )}

        {error && (
          <div className="wikios-error facet-hierarchy-child rounded-lg p-6">
            <p className="text-sm text-red-400">Failed to load diff: {error.message}</p>
          </div>
        )}

        {data && (
          <>
            <div className="wikios-diff-meta">
              <div className="wikios-diff-rev wikios-diff-rev--from">
                <span className="wikios-diff-label">From:</span>
                <span className="wikios-diff-revid">r{data.from.revid}</span>
                <span className="wikios-diff-user">{data.from.user}</span>
                {data.from.timestamp && (
                  <span className="wikios-diff-time">
                    {new Date(data.from.timestamp).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                {data.from.comment && (
                  <span className="wikios-diff-comment">({data.from.comment})</span>
                )}
              </div>
              <div className="wikios-diff-rev wikios-diff-rev--to">
                <span className="wikios-diff-label">To:</span>
                <span className="wikios-diff-revid">r{data.to.revid}</span>
                <span className="wikios-diff-user">{data.to.user}</span>
                {data.to.timestamp && (
                  <span className="wikios-diff-time">
                    {new Date(data.to.timestamp).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                {data.to.comment && (
                  <span className="wikios-diff-comment">({data.to.comment})</span>
                )}
              </div>
            </div>

            {/* Undo action bar */}
            <div className="my-3 flex items-center gap-2">
              {!undoConfirm ? (
                <button
                  type="button"
                  className="wikios-action-btn border-amber-500/30 bg-amber-500/10 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 active:scale-95"
                  onClick={() => setUndoConfirm(true)}
                >
                  Undo this change (revert to r{data.from.revid})
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="wikios-action-btn border-red-500/30 bg-red-500/15 text-xs font-semibold text-red-400 hover:bg-red-500/25 active:scale-95 disabled:opacity-50"
                    disabled={revertMutation.isPending || !revContent}
                    onClick={() => {
                      if (revContent) {
                        revertMutation.mutate({
                          title: revContent.title,
                          revid: data.from.revid,
                          summary: `Undid revision ${data.to.revid} by ${data.to.user}`,
                        });
                      }
                    }}
                  >
                    {revertMutation.isPending ? "Reverting..." : "Confirm Undo"}
                  </button>
                  <button
                    type="button"
                    className="wikios-action-btn text-xs active:scale-95"
                    onClick={() => setUndoConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {revertMutation.isSuccess && (
              <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">
                Successfully reverted to revision r{data.from.revid}.
              </div>
            )}
            {revertMutation.isError && (
              <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400">
                Revert failed: {revertMutation.error.message}
              </div>
            )}

            <div className="wikios-diff-table-wrapper">
              <table
                className="wikios-diff-table"
                dangerouslySetInnerHTML={{ __html: data.diffHtml }}
              />
            </div>
          </>
        )}

        {!isLoading && (!fromrev || !torev) && (
          <p className="text-zinc-400">No revisions selected for comparison.</p>
        )}
      </div>
    </WikiOSLayout>
  );
}
