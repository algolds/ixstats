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
import type { FusionGroupView } from "~/hooks/cards/useSheetEconomy";
import { useCopyActions } from "~/hooks/cards/useCopyActions";
import { FINISH_LABEL } from "~/lib/cards/face/labels";
import type { CopyDialogProps } from "./ListCopyDialog";

/**
 * Confirm fusing a ready group into one copy at the next finish (the sheet's group, or Mine's selection). It stays open
 * until the fusion goes through.
 */
export function FuseDialog({
  group,
  ...props
}: Omit<CopyDialogProps, "ownershipId"> & { group: FusionGroupView }) {
  const { fuse } = useCopyActions();
  const from = FINISH_LABEL[group.finish];
  const to = FINISH_LABEL[group.next];
  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent {...props.focus}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Fuse {group.ownershipIds.length} {from} copies into one {to}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            You keep the copy with the lowest serial number, now {to}. The other copies of{" "}
            {props.cardTitle} are gone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction
            disabled={fuse.isPending}
            onClick={(event) => {
              event.preventDefault();
              fuse.mutate({ ownershipIds: group.ownershipIds }, { onSuccess: props.onDone });
            }}
          >
            Fuse
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
