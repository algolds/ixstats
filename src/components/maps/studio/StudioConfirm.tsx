"use client";

import { useState, type ComponentProps } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";

interface StudioConfirmProps {
  /** The button that opens the question */
  label: string;
  title: string;
  description: string;
  /** The answer that goes ahead (default: the button's label) */
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  /** The opening button's style */
  variant?: ComponentProps<typeof Button>["variant"];
  /** The answer's style: destructive for what retires or replaces work */
  confirmVariant?: ComponentProps<typeof Button>["variant"];
}

/** A button that asks before it acts: for the writes that publish, replace or retire something others rely on. */
export function StudioConfirm({
  label,
  title,
  description,
  confirmLabel = label,
  onConfirm,
  disabled,
  variant = "outline",
  confirmVariant = "default",
}: StudioConfirmProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant={variant} disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant={confirmVariant}
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
