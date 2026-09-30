"use client";

import React from "react";
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
import { soundEffects } from "~/lib/sound/cuelume";

export interface BuilderResetConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  onConfirm: () => void;
}

export function BuilderResetConfirmDialog({
  open,
  onOpenChange,
  mode,
  onConfirm,
}: BuilderResetConfirmDialogProps) {
  const isEdit = mode === "edit";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-border bg-card/95 backdrop-blur-xl sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground text-lg font-semibold">
            {isEdit ? "Discard Changes & Exit?" : "Reset Builder Progress?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground text-sm leading-relaxed">
            {isEdit
              ? "Are you sure you want to discard your current edits and exit the editor? Any unsaved changes will be lost."
              : "Are you sure you want to restart the builder? This will clear all current progress and return you to the beginning."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-2 sm:gap-2">
          <AlertDialogCancel
            onClick={() => soundEffects.press()}
            className="border-border text-foreground hover:bg-accent active:scale-[0.98]"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              soundEffects.press();
              onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-transform active:scale-[0.98]"
          >
            {isEdit ? "Discard & Exit" : "Reset Everything"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
