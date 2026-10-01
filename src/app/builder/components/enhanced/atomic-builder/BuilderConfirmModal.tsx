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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

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
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-separator border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Shield aria-hidden="true" className="text-label-secondary h-5 w-5" />
            {isEditMode ? "Save Changes" : "Confirm Country Creation"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <p className="text-body text-label-secondary">
            {hasWarnings
              ? "Please review the warnings below before updating your country."
              : "Review your configuration before saving."}
          </p>

          <div className="space-y-2">
            {deltaWarning && (
              <div
                role="note"
                className="bg-caution/10 rounded-row text-footnote text-label flex items-start gap-2 p-3"
              >
                <AlertTriangle
                  aria-hidden="true"
                  className="text-caution mt-0.5 h-4 w-4 shrink-0"
                />
                <span>{deltaWarning}</span>
              </div>
            )}

            {currencyChangeWarning && (
              <div
                role="note"
                className="bg-caution/10 rounded-row text-footnote text-label flex items-start gap-2 p-3"
              >
                <Info aria-hidden="true" className="text-caution mt-0.5 h-4 w-4 shrink-0" />
                <span>{currencyChangeWarning}</span>
              </div>
            )}

            {gdpCapWarning && (
              <div
                role="alert"
                className="bg-destructive/10 rounded-row text-footnote text-label flex items-start gap-2 p-3"
              >
                <AlertTriangle
                  aria-hidden="true"
                  className="text-destructive mt-0.5 h-4 w-4 shrink-0"
                />
                <span>{gdpCapWarning}</span>
              </div>
            )}

            {!hasWarnings && (
              <div className="bg-surface-secondary rounded-row text-footnote text-label flex items-start gap-2 p-3">
                <CheckCircle aria-hidden="true" className="text-green mt-0.5 h-4 w-4 shrink-0" />
                <span>All settings look good and are ready to save.</span>
              </div>
            )}
          </div>

          {(hasWarnings || isEditMode) && (
            <div className="flex items-start gap-2 pt-2 select-none">
              <Checkbox
                id="confirm-verify-checkbox"
                checked={isVerified}
                onCheckedChange={(checked) => onVerifiedChange(checked === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="confirm-verify-checkbox"
                className="text-label-secondary text-footnote cursor-pointer leading-normal"
              >
                I have reviewed these settings and want to proceed.
              </Label>
            </div>
          )}
        </div>

        <DialogFooter className="border-separator border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={
              ((hasWarnings || isEditMode) && !isVerified) || !!gdpCapWarning || isSubmitting
            }
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Processing..." : isEditMode ? "Save Changes" : "Create Nation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
