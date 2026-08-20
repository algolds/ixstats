// src/app/(wiki-os)/wiki/history/[slug]/page.tsx
// WikiOS Page History — shows revision history with diff links, undo, and rollback
"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "~/trpc/react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import Link from "next/link";
import { withBasePath } from "~/lib/base-path";

export default function HistoryPage() {
  const params = useParams<{ slug: string }>();
  const title = decodeURIComponent(params.slug).replace(/_/g, " ");

  const { data, isLoading } = api.wikios.getHistory.useQuery(
    { title, limit: 50 },
    { staleTime: 30_000 }
  );

  const [selectedFrom, setSelectedFrom] = useState<number | null>(null);
  const [selectedTo, setSelectedTo] = useState<number | null>(null);
  const [undoTarget, setUndoTarget] = useState<{ revid: number; user: string } | null>(null);
  const [rollbackPending, setRollbackPending] = useState(false);

  const utils = api.useUtils();

  const revertMutation = api.wikios.revertToRevision.useMutation({
    onSuccess: () => {
      setUndoTarget(null);
      void utils.wikios.getHistory.invalidate({ title });
    },
  });

  const rollbackMutation = api.wikios.rollback.useMutation({
    onSuccess: () => {
      setRollbackPending(false);
      void utils.wikios.getHistory.invalidate({ title });
    },
    onError: () => {
      setRollbackPending(false);
    },
  });

  const revisions = data?.revisions ?? [];

  return (
    <WikiOSLayout title={`History: ${title}`}>
      <div className="wikios-special-page">
        <p className="wikios-history-subtitle">
          <Link href={withBasePath(`/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`)}>
            &larr; Back to article
          </Link>
        </p>

        {/* Compare button */}
        {selectedFrom && selectedTo && (
          <div className="wikios-history-compare">
            <Link
              href={withBasePath(`/wiki/diff?from=${selectedFrom}&to=${selectedTo}`)}
              className="wikios-action-btn"
            >
              Compare selected revisions
            </Link>
          </div>
        )}

        {/* Rollback button — reverts all consecutive edits by the last editor */}
        {revisions.length >= 2 && revisions[0]!.user === revisions[1]?.user && (
          <div style={{ marginBottom: 12 }}>
            <button
              className="wikios-action-btn"
              style={{
                background: "rgba(239,68,68,0.15)",
                borderColor: "rgba(239,68,68,0.3)",
                color: "#f87171",
              }}
              disabled={rollbackPending || rollbackMutation.isPending}
              onClick={() => {
                if (confirm(`Rollback all recent edits by "${revisions[0]!.user}"?`)) {
                  setRollbackPending(true);
                  rollbackMutation.mutate({ title });
                }
              }}
            >
              {rollbackMutation.isPending
                ? "Rolling back..."
                : `Rollback edits by ${revisions[0]!.user}`}
            </button>
          </div>
        )}

        {rollbackMutation.isSuccess && (
          <div
            className="wikios-notice"
            style={{
              borderColor: "rgba(34,197,94,0.3)",
              background: "rgba(34,197,94,0.08)",
              color: "#4ade80",
              marginBottom: 12,
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: "0.875rem",
            }}
          >
            Rollback successful.
          </div>
        )}
        {rollbackMutation.isError && (
          <div
            className="wikios-notice"
            style={{
              borderColor: "rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.08)",
              color: "#f87171",
              marginBottom: 12,
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: "0.875rem",
            }}
          >
            Rollback failed: {rollbackMutation.error.message}
          </div>
        )}

        {/* Undo confirmation dialog */}
        {undoTarget && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm backdrop-blur-sm">
            <p className="mb-2 text-amber-400">
              Revert to revision <strong>r{undoTarget.revid}</strong> by {undoTarget.user}?
            </p>
            <div className="flex gap-2">
              <button
                className="wikios-action-btn border-amber-500/40 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 active:scale-95"
                disabled={revertMutation.isPending}
                onClick={() => revertMutation.mutate({ title, revid: undoTarget.revid })}
              >
                {revertMutation.isPending ? "Reverting..." : "Confirm Revert"}
              </button>
              <button className="wikios-action-btn active:scale-95" onClick={() => setUndoTarget(null)}>
                Cancel
              </button>
            </div>
            {revertMutation.isError && (
              <p className="text-destructive mt-2 text-xs">
                Error: {revertMutation.error.message}
              </p>
            )}
          </div>
        )}

        {isLoading && (
          <div className="wikios-loading" style={{ minHeight: 200 }}>
            <div className="wikios-loading-spinner" />
          </div>
        )}

        {revisions.length > 0 && (
          <ul className="wikios-history-list">
            {revisions.map((rev, idx) => {
              const prevRev = revisions[idx + 1];
              const sizeChange = prevRev ? rev.size - prevRev.size : rev.size;
              const sizeClass =
                sizeChange > 0 ? "wikios-size-pos" : sizeChange < 0 ? "wikios-size-neg" : "";

              return (
                <li key={rev.revid} className="wikios-history-item">
                  <div className="wikios-history-radios">
                    <input
                      type="radio"
                      name="from"
                      checked={selectedFrom === rev.revid}
                      onChange={() => setSelectedFrom(rev.revid)}
                    />
                    <input
                      type="radio"
                      name="to"
                      checked={selectedTo === rev.revid}
                      onChange={() => setSelectedTo(rev.revid)}
                    />
                  </div>

                  {prevRev && (
                    <Link
                      href={withBasePath(`/wiki/diff?from=${prevRev.revid}&to=${rev.revid}`)}
                      className="wikios-history-diff-link"
                    >
                      diff
                    </Link>
                  )}

                  {/* Undo button — revert to this specific revision */}
                  {idx > 0 && (
                    <button
                      className="wikios-history-diff-link"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      onClick={() => setUndoTarget({ revid: rev.revid, user: rev.user })}
                      title={`Revert to this revision (r${rev.revid})`}
                    >
                      undo
                    </button>
                  )}

                  <span className="wikios-history-date">
                    {new Date(rev.timestamp).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  <Link
                    href={withBasePath(`/wiki/contributions/${encodeURIComponent(rev.user)}`)}
                    className="wikios-history-user"
                  >
                    {rev.user}
                  </Link>

                  <span className={`wikios-history-size ${sizeClass}`}>
                    {sizeChange > 0 ? "+" : ""}
                    {sizeChange.toLocaleString()}
                  </span>

                  {rev.minor && (
                    <span className="wikios-history-minor" title="Minor edit">
                      m
                    </span>
                  )}

                  {rev.comment && <span className="wikios-history-comment">({rev.comment})</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </WikiOSLayout>
  );
}
