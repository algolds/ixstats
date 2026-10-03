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
import { buttonVariants } from "~/components/ui/button";
import { soundEffects } from "~/lib/sound/cuelume";

interface BuilderResetConfirmDialogProps {
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
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-label">
            {isEdit ? "Discard changes and exit?" : "Restart the builder?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">
            {isEdit
              ? "Your unsaved edits will be lost."
              : "This clears your progress and returns you to the first step."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-2 sm:gap-2">
          <AlertDialogCancel onClick={() => soundEffects.press()}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              soundEffects.press();
              onConfirm();
            }}
            className={buttonVariants({ variant: "destructive" })}
          >
            {isEdit ? "Discard and exit" : "Reset"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
