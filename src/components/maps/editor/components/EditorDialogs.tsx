"use client";

import React from "react";
import { ShieldAlert, Loader2, AlertCircle } from "lucide-react";
import { SplitMergeDialog } from "~/components/maps/editor/SplitMergeDialog";

interface EditorDialogsProps {
  showSplitDialog: boolean;
  setShowSplitDialog: (show: boolean) => void;
  borderState: any;
  displayName: string;
  handleSplitConfirm: (nameA: string, nameB: string) => void;
  isSubmitting: boolean;
  showMergeDialog: boolean;
  setShowMergeDialog: (show: boolean) => void;
  handleMergeConfirm: (name: string) => void;
  showConfirmSaveModal: boolean;
  setShowConfirmSaveModal: (show: boolean) => void;
  saveReason: string;
  setSaveReason: (reason: string) => void;
  handleConfirmBorderSave: () => void;
  showExitConfirm: boolean;
  setShowExitConfirm: (show: boolean) => void;
  onExit: () => void;
}

export function EditorDialogs({
  showSplitDialog,
  setShowSplitDialog,
  borderState,
  displayName,
  handleSplitConfirm,
  isSubmitting,
  showMergeDialog,
  setShowMergeDialog,
  handleMergeConfirm,
  showConfirmSaveModal,
  setShowConfirmSaveModal,
  saveReason,
  setSaveReason,
  handleConfirmBorderSave,
  showExitConfirm,
  setShowExitConfirm,
  onExit,
}: EditorDialogsProps) {
  return (
    <>
      {/* Split Dialog */}
      {showSplitDialog && borderState.featureId && (
        <SplitMergeDialog
          type="split"
          featureName={displayName || borderState.featureId || ""}
          onConfirm={handleSplitConfirm}
          onCancel={() => setShowSplitDialog(false)}
          isLoading={isSubmitting}
        />
      )}

      {/* Merge Dialog */}
      {showMergeDialog && borderState.featureId && (
        <SplitMergeDialog
          type="merge"
          featureNames={[displayName || borderState.featureId || "", ...borderState.mergeTargets]}
          onConfirm={handleMergeConfirm}
          onCancel={() => setShowMergeDialog(false)}
          isLoading={isSubmitting}
        />
      )}

      {/* Confirmation modal for border saving */}
      {showConfirmSaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="border-border/40 bg-card/95 w-full max-w-md space-y-4 rounded-2xl border p-6 shadow-2xl backdrop-blur-md">
            <div className="border-border/30 flex items-center gap-2 border-b pb-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <h3 className="text-foreground text-lg font-bold">Confirm Border Changes</h3>
            </div>

            <p className="text-muted-foreground text-xs leading-relaxed">
              You are about to save changes to feature border geometry. These changes will be
              applied directly to the map database.
            </p>

            <div className="space-y-1.5">
              <label className="text-muted-foreground block text-xs font-semibold uppercase">
                Reason for Edit
              </label>
              <textarea
                value={saveReason}
                onChange={(e) => setSaveReason(e.target.value)}
                placeholder="e.g. Adjusted Caphiria boundary alignment..."
                className="border-border/40 bg-background text-foreground min-h-[80px] w-full rounded-lg border px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                required
              />
            </div>

            <div className="border-border/30 flex justify-end gap-2 border-t pt-3">
              <button
                onClick={() => setShowConfirmSaveModal(false)}
                className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg px-3 py-2 text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBorderSave}
                disabled={!saveReason.trim() || isSubmitting}
                className="disabled:text-muted-foreground/50 flex items-center gap-1.5 rounded-lg bg-blue-650 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-600/40"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit confirmation modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[100] flex animate-[fadeIn_0.15s_ease-out] items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="border-border/40 bg-card/95 w-full max-w-sm space-y-4 rounded-2xl border p-6 shadow-2xl backdrop-blur-md">
            <div className="border-border/30 flex items-center gap-2 border-b pb-2">
              <AlertCircle className="h-5 w-5 animate-pulse text-amber-500" />
              <h3 className="text-foreground text-lg font-bold">Unsaved Changes</h3>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              You have unsaved changes in the editor. Exiting now will discard these modifications.
            </p>
            <div className="border-border/30 flex justify-end gap-2 border-t pt-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg px-3 py-2 text-xs transition-colors"
              >
                Keep Editing
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  onExit();
                }}
                className="bg-red-650 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700"
              >
                Discard & Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
