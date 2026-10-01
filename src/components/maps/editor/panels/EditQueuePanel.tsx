"use client";

/**
 * EditQueuePanel - Review and approve/reject pending map edit requests.
 *
 * Shows a filterable list of user-submitted edits with diff previews.
 * Admins can approve (apply changes) or reject with a note.
 */

import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { JsonViewer } from "~/components/shared/json-viewer";
import { SegmentedControl } from "~/components/ui/segmented-control";

type StatusFilter = "pending" | "approved" | "rejected";

interface MapEditItem {
  id: string;
  countryId: string;
  countryName: string;
  countryFlag?: string | null;
  userId: string;
  editType: string;
  targetId: string;
  operation: string;
  status: string;
  reviewNote?: string | null;
  createdAt: string | Date;
  proposedData?: Record<string, string | number | boolean | null> | null;
  currentData?: Record<string, string | number | boolean | null> | null;
}

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
        <SegmentedControl
          aria-label="Edit status"
          size="sm"
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          options={[
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
          ]}
        />
        <span className="text-label-secondary text-body">
          {data?.total ?? 0} {statusFilter} edits
        </span>
      </div>

      {/* Edit list */}
      {!data?.edits.length ? (
        <div className="border-separator text-label-secondary rounded-row text-body border border-dashed p-8 text-center">
          No {statusFilter} edit requests
        </div>
      ) : (
        <div className="space-y-3">
          {data.edits.map((edit: MapEditItem) => (
            <div key={edit.id} className="border-separator bg-surface rounded-row border">
              {/* Header */}
              <button
                type="button"
                aria-expanded={expandedId === edit.id}
                onClick={() => setExpandedId(expandedId === edit.id ? null : edit.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <EditTypeBadge type={edit.editType} />
                  <div>
                    <div className="text-label text-body font-medium">
                      {edit.operation === "create"
                        ? "Create"
                        : edit.operation === "update"
                          ? "Update"
                          : "Delete"}{" "}
                      {edit.editType}
                    </div>
                    <div className="text-label-secondary text-footnote">
                      {edit.countryName} &middot; {new Date(edit.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <StatusBadge status={edit.status} />
              </button>

              {/* Expanded details */}
              {expandedId === edit.id && (
                <div className="border-separator border-t px-4 py-3">
                  {/* Proposed data */}
                  <div className="mb-3">
                    <Eyebrow className="mb-1 block">Proposed Changes</Eyebrow>
                    <JsonViewer
                      data={edit.proposedData ?? null}
                      defaultExpanded={2}
                      className="border-separator bg-surface"
                    />
                  </div>

                  {/* Current data (if update/delete) */}
                  {edit.currentData && (
                    <div className="mb-3">
                      <Eyebrow className="mb-1 block">Current Data</Eyebrow>
                      <JsonViewer
                        data={edit.currentData}
                        defaultExpanded={2}
                        className="border-separator bg-surface"
                      />
                    </div>
                  )}

                  {/* Review note (if already reviewed) */}
                  {edit.reviewNote && (
                    <div className="border-separator text-label rounded-control text-footnote mb-3 border p-3">
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
                        className="border-separator bg-surface text-label rounded-control text-body focus:border-blue w-full border px-3 py-2 focus:outline-none"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApprove(edit.id)}
                          disabled={approveMutation.isPending}
                        >
                          {approveMutation.isPending ? "Applying..." : "Approve & Apply"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(edit.id)}
                          disabled={rejectMutation.isPending}
                        >
                          {rejectMutation.isPending ? "..." : "Reject"}
                        </Button>
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
    border_adjust: "border-destructive/30 text-destructive",
  };

  return (
    <Badge variant="outline" className={`capitalize ${colors[type] ?? ""}`}>
      {type.replace("_", " ")}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "border-yellow/30 text-yellow",
    approved: "border-green/30 text-green",
    rejected: "border-destructive/30 text-destructive",
  };

  return (
    <Badge variant="outline" className={`capitalize ${colors[status] ?? ""}`}>
      {status}
    </Badge>
  );
}
