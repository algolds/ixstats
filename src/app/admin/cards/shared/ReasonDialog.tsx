"use client";
/** A confirmation that asks for a reason, which the action records in the audit trail. */
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { focusedElement, refocus } from "~/lib/utils/focus";

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: (reason: string) => void;
}

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending = false,
  onConfirm,
}: ReasonDialogProps) {
  const fieldId = useId();
  const opener = useRef<HTMLElement | null>(null);
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  // Each opening starts empty, however the last one ended (cancel, dismiss, or the parent closing it on success).
  useEffect(() => setReason(""), [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        // Opened from a row's button rather than a trigger, so focus goes back to that button by hand
        onOpenAutoFocus={() => {
          opener.current = focusedElement();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          refocus(opener.current);
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={fieldId}>Reason</Label>
          <Textarea
            id={fieldId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={trimmed.length < 3 || pending}
            onClick={() => onConfirm(trimmed)}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
