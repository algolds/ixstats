"use client";

/**
 * BulkActions Component
 *
 * Provides bulk operations for map submission review.
 * Allows admins to approve or reject multiple submissions at once.
 *
 * Features:
 * - Bulk approve with confirmation
 * - Bulk reject (not implemented - requires individual reasons)
 * - Selection summary
 * - Clear selection
 *
 * @module components/maps/admin/BulkActions
 */

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface SelectedItems {
  subdivisions: Set<string>;
  cities: Set<string>;
  pois: Set<string>;
}

interface BulkActionsProps {
  selectedItems: SelectedItems;
  onClearSelection: () => void;
  onRefetch: () => void;
}

/**
 * BulkActions Component
 *
 * Provides bulk approve/reject controls for selected items
 */
export function BulkActions({
  selectedItems,
  onClearSelection,
  onRefetch,
}: BulkActionsProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mutations for bulk operations
  const bulkApproveSubdivisions = api.mapEditor.bulkApprove.useMutation({
    onSuccess: () => {
      onRefetch();
    },
  });

  const bulkApproveCities = api.mapEditor.bulkApprove.useMutation({
    onSuccess: () => {
      onRefetch();
    },
  });

  const bulkApprovePOIs = api.mapEditor.bulkApprove.useMutation({
    onSuccess: () => {
      onRefetch();
    },
  });

  // Calculate totals
  const totalSelected =
    selectedItems.subdivisions.size +
    selectedItems.cities.size +
    selectedItems.pois.size;

  const handleBulkApprove = async () => {
    setIsSubmitting(true);

    try {
      // Approve subdivisions
      if (selectedItems.subdivisions.size > 0) {
        await bulkApproveSubdivisions.mutateAsync({
          entityType: "subdivision",
          entityIds: Array.from(selectedItems.subdivisions),
        });
      }

      // Approve cities
      if (selectedItems.cities.size > 0) {
        await bulkApproveCities.mutateAsync({
          entityType: "city",
          entityIds: Array.from(selectedItems.cities),
        });
      }

      // Approve POIs
      if (selectedItems.pois.size > 0) {
        await bulkApprovePOIs.mutateAsync({
          entityType: "poi",
          entityIds: Array.from(selectedItems.pois),
        });
      }

      // Success - close dialog and clear selection
      setShowConfirmDialog(false);
      onClearSelection();
    } catch (error) {
      console.error("Bulk approve failed:", error);
      alert("Failed to approve some items. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        {/* Selection Summary */}
        <div className="flex items-center gap-3">
          <div className="text-sm text-white font-medium">
            {totalSelected} items selected
          </div>
          <div className="flex gap-2">
            {selectedItems.subdivisions.size > 0 && (
              <Badge variant="outline" className="gap-1">
                {selectedItems.subdivisions.size} Subdivisions
              </Badge>
            )}
            {selectedItems.cities.size > 0 && (
              <Badge variant="outline" className="gap-1">
                {selectedItems.cities.size} Cities
              </Badge>
            )}
            {selectedItems.pois.size > 0 && (
              <Badge variant="outline" className="gap-1">
                {selectedItems.pois.size} POIs
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onClearSelection}
            className="gap-2"
          >
            <XCircle className="h-4 w-4" />
            Clear Selection
          </Button>
          <Button
            size="sm"
            onClick={() => setShowConfirmDialog(true)}
            className="bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30 gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Bulk Approve ({totalSelected})
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirm Bulk Approval
            </DialogTitle>
            <DialogDescription>
              You are about to approve {totalSelected} submissions. This action
              will make these features visible on the public map.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <p className="text-sm text-slate-400">
              The following items will be approved:
            </p>
            <div className="space-y-2">
              {selectedItems.subdivisions.size > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Subdivisions</Badge>
                  <span className="text-sm text-white">
                    {selectedItems.subdivisions.size} items
                  </span>
                </div>
              )}
              {selectedItems.cities.size > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Cities</Badge>
                  <span className="text-sm text-white">
                    {selectedItems.cities.size} items
                  </span>
                </div>
              )}
              {selectedItems.pois.size > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">POIs</Badge>
                  <span className="text-sm text-white">
                    {selectedItems.pois.size} items
                  </span>
                </div>
              )}
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-4">
              <p className="text-sm text-yellow-300">
                Make sure you have reviewed all selected items before approving.
                This action cannot be easily undone.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkApprove}
              disabled={isSubmitting}
              className="bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30"
            >
              {isSubmitting ? "Approving..." : `Approve ${totalSelected} Items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
