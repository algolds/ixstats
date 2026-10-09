"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { FormError, ReasonField } from "../ReasonField";

interface NoteDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  /** Called with the trimmed text, or undefined when an optional note was left empty. */
  onConfirm: (text: string | undefined) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  /** @default "Note for the moderation log (optional)" */
  label?: string;
  /** The text must not be empty (an appeal's response). */
  required?: boolean;
  /** @default 1000 */
  max?: number;
  destructive?: boolean;
  /** Offer the note field; false for a change the server takes no note for (it is only confirmed). @default true */
  withNote?: boolean;
}

/**
 * Confirms a moderator action with a note: optional for the log, or required (an appeal's response), or none for a
 * change the server takes no note for. A refusal
 * stays in the dialog; it closes once the action succeeds. Mount it while open, so each opening starts empty.
 */
export function NoteDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onOpenChange,
  label = "Note for the moderation log (optional)",
  required = false,
  max = 1000,
  destructive = false,
  withNote = true,
}: NoteDialogProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = text.trim();
  const invalid = (required && trimmed.length === 0) || trimmed.length > max;

  const confirm = () => {
    setBusy(true);
    setError(null);
    onConfirm(trimmed || undefined)
      .then(() => onOpenChange(false))
      .catch((e: Error) => setError(e.message || "That did not work. Try again."))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {withNote ? (
          <ReasonField label={label} value={text} onChange={setText} max={max} disabled={busy} />
        ) : null}
        <FormError message={error} />
        <DialogFooter>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={confirm}
            disabled={busy || invalid}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
