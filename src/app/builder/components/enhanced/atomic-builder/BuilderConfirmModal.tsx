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
import { FacetContainer } from "~/components/ui/facet-container";

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
        <DialogHeader className="border-border border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shield aria-hidden="true" className="text-muted-foreground h-5 w-5" />
            {isEditMode ? "Save Changes" : "Confirm Country Creation"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {hasWarnings
              ? "Please review the warnings below before updating your country."
              : "Review your configuration before saving."}
          </p>

          <div className="space-y-2.5">
            {deltaWarning && (
              <FacetContainer
                depth={3}
                surface="solid"
                role="note"
                className="text-foreground flex items-start gap-2 rounded-lg border-amber-500/40 p-3 text-xs"
              >
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                />
                <span>{deltaWarning}</span>
              </FacetContainer>
            )}

            {currencyChangeWarning && (
              <FacetContainer
                depth={3}
                surface="solid"
                role="note"
                className="text-foreground flex items-start gap-2 rounded-lg border-amber-500/40 p-3 text-xs"
              >
                <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>{currencyChangeWarning}</span>
              </FacetContainer>
            )}

            {gdpCapWarning && (
              <FacetContainer
                depth={3}
                surface="solid"
                role="alert"
                className="text-foreground border-destructive/50 flex items-start gap-2 rounded-lg p-3 text-xs"
              >
                <AlertTriangle
                  aria-hidden="true"
                  className="text-destructive mt-0.5 h-4 w-4 shrink-0"
                />
                <span>{gdpCapWarning}</span>
              </FacetContainer>
            )}

            {!hasWarnings && (
              <FacetContainer
                depth={3}
                surface="solid"
                className="text-foreground flex items-start gap-2 rounded-lg p-3 text-xs"
              >
                <CheckCircle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                />
                <span>All settings look good and are ready to save.</span>
              </FacetContainer>
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

        <DialogFooter className="border-border border-t px-6 py-4">
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
