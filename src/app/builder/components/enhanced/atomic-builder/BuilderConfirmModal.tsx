"use client";

import React from "react";
import {
  Shield,
  WarningTriangle as AlertTriangle,
  InfoCircle as Info,
  CheckCircle,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";

interface BuilderConfirmModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isEditMode: boolean;
  isSubmitting: boolean;
  isVerified: boolean;
  onVerifiedChange: (verified: boolean) => void;
  onSubmit: () => void;
  warnings: {
    deltaWarning?: string | null;
    currencyChangeWarning?: string | null;
    gdpCapWarning?: string | null;
  };
}

export function BuilderConfirmModal({
  isOpen,
  onOpenChange,
  isEditMode,
  isSubmitting,
  isVerified,
  onVerifiedChange,
  onSubmit,
  warnings,
}: BuilderConfirmModalProps) {
  const { deltaWarning, currencyChangeWarning, gdpCapWarning } = warnings;
  const hasWarnings = Boolean(deltaWarning || currencyChangeWarning || gdpCapWarning);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/60 bg-background/95 max-w-md border p-0 shadow-2xl backdrop-blur-3xl">
        <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2 text-base font-bold">
              <Shield className="h-5 w-5 text-primary" />
              {isEditMode ? "Save Changes" : "Confirm Country Creation"}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-4">
          <p className="text-muted-foreground text-xs leading-relaxed">
            {hasWarnings
              ? "Please review the warnings below before updating your country."
              : "Review your configuration before saving."}
          </p>

          <div className="space-y-2.5">
            {deltaWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-800 dark:bg-amber-500/5 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
                <span>{deltaWarning}</span>
              </div>
            )}

            {currencyChangeWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-800 dark:bg-amber-500/5 dark:text-amber-200">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
                <span>{currencyChangeWarning}</span>
              </div>
            )}

            {gdpCapWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-800 dark:bg-red-500/5 dark:text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
                <span>{gdpCapWarning}</span>
              </div>
            )}

            {!hasWarnings && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:bg-emerald-500/5 dark:text-emerald-200">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>All settings look good and are ready to save.</span>
              </div>
            )}
          </div>

          {(hasWarnings || isEditMode) && (
            <div className="flex items-start gap-2.5 pt-2 select-none">
              <Checkbox
                id="confirm-verify-checkbox"
                checked={isVerified}
                onCheckedChange={(checked) => onVerifiedChange(checked === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="confirm-verify-checkbox"
                className="text-muted-foreground cursor-pointer text-xs leading-normal"
              >
                I have reviewed these settings and want to proceed.
              </Label>
            </div>
          )}
        </div>

        <div className="border-border/40 flex justify-end gap-2 border-t bg-white/[0.01] px-6 py-4 dark:bg-black/[0.05]">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-lg text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={((hasWarnings || isEditMode) && !isVerified) || !!gdpCapWarning || isSubmitting}
            className="h-9 rounded-lg text-xs font-semibold shadow-sm"
          >
            {isSubmitting ? "Processing..." : isEditMode ? "Save Changes" : "Create Nation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
