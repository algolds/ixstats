// src/app/(wikios)/w/special/diff/page.tsx
// WikiOS Diff Viewer — shows visual diff between two revisions with undo
"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";

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
          <div className="wikios-error glass-hierarchy-child rounded-lg p-6">
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
                      month: "short", day: "numeric", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
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
                      month: "short", day: "numeric", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                )}
                {data.to.comment && (
                  <span className="wikios-diff-comment">({data.to.comment})</span>
                )}
              </div>
            </div>

            {/* Undo action bar */}
            <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
              {!undoConfirm ? (
                <button
                  className="wikios-action-btn"
                  style={{ background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.3)", color: "#fbbf24", fontSize: "0.8125rem" }}
                  onClick={() => setUndoConfirm(true)}
                >
                  Undo this change (revert to r{data.from.revid})
                </button>
              ) : (
                <>
                  <button
                    className="wikios-action-btn"
                    style={{ background: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.3)", color: "#f87171", fontSize: "0.8125rem" }}
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
                    className="wikios-action-btn"
                    style={{ fontSize: "0.8125rem" }}
                    onClick={() => setUndoConfirm(false)}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>

            {revertMutation.isSuccess && (
              <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", fontSize: "0.875rem" }}>
                Successfully reverted to revision r{data.from.revid}.
              </div>
            )}
            {revertMutation.isError && (
              <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: "0.875rem" }}>
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
