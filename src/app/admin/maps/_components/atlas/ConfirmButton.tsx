"use client";

import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";

interface ConfirmButtonProps {
  label: string;
  title: string;
  description: ReactNode;
  /** The dialog's confirm button; defaults to the button's label */
  confirmLabel?: string;
  keepLabel?: string;
  disabled?: boolean;
  icon?: ReactNode;
  onConfirm: () => void;
}

/** An outline button that asks before it acts (the existing alert dialog pattern). */
export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  keepLabel = "Keep it",
  disabled,
  icon,
  onConfirm,
}: ConfirmButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          {icon}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{keepLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel ?? label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
