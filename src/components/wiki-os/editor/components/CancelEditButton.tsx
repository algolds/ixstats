"use client";
// The editor's Cancel. With unsaved changes it asks before closing: an in-app close gets no leave-page warning
// from the browser, and the author's text would be gone.

import type { ComponentProps } from "react";
import { Xmark as X } from "iconoir-react";
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

interface CancelEditButtonProps {
  isDirty: boolean;
  onCancel: () => void;
}

function CancelIconButton(props: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      title="Cancel"
      aria-label="Cancel"
      className="border-red/25 text-red hover:border-red hover:bg-red/10 rounded-full"
      {...props}
    >
      <X className="h-4 w-4" />
    </Button>
  );
}

export function CancelEditButton({ isDirty, onCancel }: CancelEditButtonProps) {
  if (!isDirty) return <CancelIconButton onClick={onCancel} />;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <CancelIconButton />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
          <AlertDialogDescription>
            Your unsaved changes to this page will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onCancel}>
            Discard changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
