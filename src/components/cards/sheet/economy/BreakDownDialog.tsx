"use client";

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
import { useCopyActions } from "~/hooks/cards/useCopyActions";
import type { CopyDialogProps } from "./ListCopyDialog";

/** Confirm breaking one copy down for its realm's dust. It stays open until the break-down goes through. */
export function BreakDownDialog({ dust, ...props }: CopyDialogProps & { dust: number }) {
  const { breakDown } = useCopyActions();
  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent {...props.focus}>
        <AlertDialogHeader>
          <AlertDialogTitle>Break down this copy for {dust} dust?</AlertDialogTitle>
          <AlertDialogDescription>
            This copy of {props.cardTitle} is gone for good. The dust belongs to the card&apos;s
            realm and can craft that realm&apos;s cards.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={breakDown.isPending}
            onClick={(event) => {
              event.preventDefault();
              breakDown.mutate({ ownershipIds: [props.ownershipId] }, { onSuccess: props.onDone });
            }}
          >
            Break down
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
