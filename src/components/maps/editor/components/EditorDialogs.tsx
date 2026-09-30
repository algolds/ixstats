"use client";

import React from "react";
import { ShieldAlert, SystemRestart as Loader2, WarningCircle as AlertCircle } from "iconoir-react";
import { SplitMergeDialog } from "~/components/maps/editor/SplitMergeDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button, buttonVariants } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import type { BorderEditorState } from "../types/editor-state";

interface EditorDialogsProps {
  showSplitDialog: boolean;
  setShowSplitDialog: (show: boolean) => void;
  borderState: BorderEditorState;
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

export const EditorDialogs = React.memo(function EditorDialogs({
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
      <AlertDialog
        open={showConfirmSaveModal}
        onOpenChange={(open) => !open && setShowConfirmSaveModal(false)}
      >
        <AlertDialogContent className="facet-modal sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-5 w-5 text-amber-500" aria-hidden />
              Confirm border changes
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              You are about to save changes to feature border geometry. These changes will be
              applied directly to the map database.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="border-save-reason" className="text-muted-foreground text-xs">
              Reason for edit
            </Label>
            <Textarea
              id="border-save-reason"
              value={saveReason}
              onChange={(e) => setSaveReason(e.target.value)}
              placeholder="e.g. Adjusted Caphiria boundary alignment..."
              className="min-h-[80px] text-xs"
              required
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleConfirmBorderSave} disabled={!saveReason.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
              Confirm & save
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exit confirmation modal */}
      <AlertDialog
        open={showExitConfirm}
        onOpenChange={(open) => !open && setShowExitConfirm(false)}
      >
        <AlertDialogContent className="facet-modal sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-5 w-5 text-amber-500" aria-hidden />
              Unsaved changes
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              You have unsaved changes in the editor. Exiting now will discard these modifications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                setShowExitConfirm(false);
                onExit();
              }}
            >
              Discard & leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
