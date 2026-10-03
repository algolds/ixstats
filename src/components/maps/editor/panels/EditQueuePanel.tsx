"use client";

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

const OPERATION_LABELS: Partial<Record<string, string>> = { create: "Create", update: "Update" };

export function EditQueuePanel() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [reviewNote, setReviewNote] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const utils = api.useUtils();

  const { data, isLoading } = api.geoEditor.getEditQueue.useQuery(
    { status: statusFilter, limit: 50 },
    { refetchInterval: statusFilter === "pending" ? 15000 : false }
  );

  const afterReview = () => {
    utils.geoEditor.getEditQueue.invalidate();
    setExpandedId(null);
    setReviewNote("");
  };

  const approveMutation = api.geoEditor.approveEdit.useMutation({
    onSuccess: () => {
      utils.geoCore.getMapStats.invalidate();
      afterReview();
    },
  });

  const rejectMutation = api.geoEditor.rejectEdit.useMutation({ onSuccess: afterReview });

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

      {!data?.edits.length ? (
        <div className="border-separator text-label-secondary rounded-row text-body border border-dashed p-8 text-center">
          No {statusFilter} edit requests
        </div>
      ) : (
        <div className="space-y-3">
          {data.edits.map((edit: MapEditItem) => (
            <div key={edit.id} className="border-separator bg-surface rounded-row border">
              <button
                type="button"
                aria-expanded={expandedId === edit.id}
                onClick={() => setExpandedId(expandedId === edit.id ? null : edit.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <OutlineBadge
                    label={edit.editType.replace("_", " ")}
                    className={EDIT_TYPE_COLORS[edit.editType]}
                  />
                  <div>
                    <div className="text-label text-body font-medium">
                      {OPERATION_LABELS[edit.operation] ?? "Delete"} {edit.editType}
                    </div>
                    <div className="text-label-secondary text-footnote">
                      {edit.countryName} &middot; {new Date(edit.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <OutlineBadge label={edit.status} className={STATUS_COLORS[edit.status]} />
              </button>

              {expandedId === edit.id && (
                <div className="border-separator border-t px-4 py-3">
                  <div className="mb-3">
                    <Eyebrow className="mb-1 block">Proposed changes</Eyebrow>
                    <JsonViewer
                      data={edit.proposedData ?? null}
                      defaultExpanded={2}
                      className="border-separator bg-surface"
                    />
                  </div>

                  {edit.currentData && (
                    <div className="mb-3">
                      <Eyebrow className="mb-1 block">Current data</Eyebrow>
                      <JsonViewer
                        data={edit.currentData}
                        defaultExpanded={2}
                        className="border-separator bg-surface"
                      />
                    </div>
                  )}

                  {edit.reviewNote && (
                    <div className="border-separator text-label rounded-control text-footnote mb-3 border p-3">
                      <strong>Review note:</strong> {edit.reviewNote}
                    </div>
                  )}

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
                          onClick={() =>
                            approveMutation.mutate({
                              editId: edit.id,
                              reviewNote: reviewNote || undefined,
                            })
                          }
                          disabled={approveMutation.isPending}
                        >
                          {approveMutation.isPending ? "Applying..." : "Approve & Apply"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            rejectMutation.mutate({
                              editId: edit.id,
                              reviewNote: reviewNote || undefined,
                            })
                          }
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

function OutlineBadge({ label, className = "" }: { label: string; className?: string }) {
  return (
    <Badge variant="outline" className={`capitalize ${className}`}>
      {label}
    </Badge>
  );
}

const EDIT_TYPE_COLORS: Partial<Record<string, string>> = {
  border_adjust: "border-destructive/30 text-destructive",
};

const STATUS_COLORS: Partial<Record<string, string>> = {
  pending: "border-yellow/30 text-yellow",
  approved: "border-green/30 text-green",
  rejected: "border-destructive/30 text-destructive",
};
