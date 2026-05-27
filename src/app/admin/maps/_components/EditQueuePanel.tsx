// @ts-nocheck
"use client";

/**
 * EditQueuePanel - Review and approve/reject pending map edit requests.
 *
 * Shows a filterable list of user-submitted edits with diff previews.
 * Admins can approve (apply changes) or reject with a note.
 */

import { useState } from "react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { JsonViewer } from "~/components/json-viewer";

type StatusFilter = "pending" | "approved" | "rejected";

export function EditQueuePanel() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [reviewNote, setReviewNote] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const utils = api.useUtils();

  const { data, isLoading } = api.geoEditor.getEditQueue.useQuery(
    { status: statusFilter, limit: 50 },
    { refetchInterval: statusFilter === "pending" ? 15000 : false }
  );

  const approveMutation = api.geoEditor.approveEdit.useMutation({
    onSuccess: () => {
      utils.geoEditor.getEditQueue.invalidate();
      utils.geoCore.getMapStats.invalidate();
      setExpandedId(null);
      setReviewNote("");
    },
  });

  const rejectMutation = api.geoEditor.rejectEdit.useMutation({
    onSuccess: () => {
      utils.geoEditor.getEditQueue.invalidate();
      setExpandedId(null);
      setReviewNote("");
    },
  });

  const handleApprove = (editId: string) => {
    approveMutation.mutate({ editId, reviewNote: reviewNote || undefined });
  };

  const handleReject = (editId: string) => {
    rejectMutation.mutate({ editId, reviewNote: reviewNote || undefined });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="flex items-center gap-3">
        <div className="border-border flex rounded-lg border">
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? s === "pending"
                    ? "bg-amber-500 text-white"
                    : s === "approved"
                      ? "bg-emerald-500 text-white"
                      : "bg-red-500 text-white"
                  : "text-foreground/80 hover:bg-accent"
              } ${s === "pending" ? "rounded-l-lg" : ""} ${s === "rejected" ? "rounded-r-lg" : ""}`}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground text-sm">
          {data?.total ?? 0} {statusFilter} edits
        </span>
      </div>

      {/* Edit list */}
      {!data?.edits.length ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          No {statusFilter} edit requests
        </div>
      ) : (
        <div className="space-y-3">
          {data.edits.map((edit: any) => (
            <div key={edit.id} className="border-border bg-card rounded-xl border">
              {/* Header */}
              <button
                onClick={() => setExpandedId(expandedId === edit.id ? null : edit.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <EditTypeBadge type={edit.editType} />
                  <div>
                    <div className="text-foreground text-sm font-medium">
                      {edit.operation === "create"
                        ? "Create"
                        : edit.operation === "update"
                          ? "Update"
                          : "Delete"}{" "}
                      {edit.editType}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {edit.countryName} &middot; {new Date(edit.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <StatusBadge status={edit.status} />
              </button>

              {/* Expanded details */}
              {expandedId === edit.id && (
                <div className="border-border/50 border-t px-4 py-3">
                  {/* Proposed data */}
                  <div className="mb-3">
                    <span className="text-muted-foreground mb-1 block text-xs font-medium uppercase">
                      Proposed Changes
                    </span>
                    <JsonViewer
                      data={edit.proposedData}
                      defaultExpanded={2}
                      className="border-border/30 bg-card/20 backdrop-blur-md"
                    />
                  </div>

                  {/* Current data (if update/delete) */}
                  {edit.currentData && (
                    <div className="mb-3">
                      <span className="text-muted-foreground mb-1 block text-xs font-medium uppercase">
                        Current Data
                      </span>
                      <JsonViewer
                        data={edit.currentData}
                        defaultExpanded={2}
                        className="border-border/30 bg-card/20 backdrop-blur-md"
                      />
                    </div>
                  )}

                  {/* Review note (if already reviewed) */}
                  {edit.reviewNote && (
                    <div className="mb-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                      <strong>Review note:</strong> {edit.reviewNote}
                    </div>
                  )}

                  {/* Action buttons (only for pending) */}
                  {edit.status === "pending" && (
                    <div className="space-y-2">
                      <textarea
                        placeholder="Review note (optional)..."
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        className="border-border bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(edit.id)}
                          disabled={approveMutation.isPending}
                          className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                        >
                          {approveMutation.isPending ? "Applying..." : "Approve & Apply"}
                        </button>
                        <button
                          onClick={() => handleReject(edit.id)}
                          disabled={rejectMutation.isPending}
                          className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                        >
                          {rejectMutation.isPending ? "..." : "Reject"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    subdivision: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    city: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    poi: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    border_adjust: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[type] ?? "bg-muted text-foreground/80"}`}
    >
      {type.replace("_", " ")}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-muted text-foreground/80"}`}
    >
      {status}
    </span>
  );
}
