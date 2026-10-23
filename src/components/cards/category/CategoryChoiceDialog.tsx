"use client";
/** A category choice in a dialog, with an optional note: the review queue, a realm owner's edit, a suggestion. */
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { sameCategoryChoice, type CategoryChoice } from "~/lib/cards/category-taxonomy";
import { CategoryPicker } from "./CategoryPicker";

const NOTE_MAX = 500;

interface CategoryChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  initial: CategoryChoice;
  confirmLabel: string;
  pending: boolean;
  allowUncategorised?: boolean;
  withNote?: boolean;
  /** Confirm stays off until the pick differs from `initial`, for a choice the server refuses unchanged. */
  requireChange?: boolean;
  /** Shown above the picker, for example a `Signal` saying the player already suggested one. */
  notice?: ReactNode;
  /** The control that opens it, which gets focus back when it closes. */
  trigger?: ReactNode;
  /** The note comes trimmed, or null when empty. */
  onConfirm: (choice: CategoryChoice, note: string | null) => void;
}

export function CategoryChoiceDialog({
  open,
  onOpenChange,
  title,
  description,
  initial,
  confirmLabel,
  pending,
  allowUncategorised = true,
  withNote = false,
  requireChange = false,
  notice,
  trigger,
  onConfirm,
}: CategoryChoiceDialogProps) {
  const [draft, setDraft] = useState(initial);
  const [note, setNote] = useState("");
  // Each opening starts from `initial`, so a closed dialog's unsaved pick never comes back
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(initial);
      setNote("");
    }
  }
  const ready =
    !pending &&
    (allowUncategorised || draft.category !== null) &&
    !(requireChange && sameCategoryChoice(draft, initial));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (ready) onConfirm(draft, note.trim() || null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {/* With no description, an explicit undefined tells Radix there is none on purpose */}
      <DialogContent
        className="max-w-md"
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {notice}
          <CategoryPicker
            idPrefix="category-choice"
            value={draft}
            onChange={setDraft}
            allowUncategorised={allowUncategorised}
            disabled={pending}
          />
          {withNote && (
            <div className="space-y-1">
              <Label htmlFor="category-choice-note">Note</Label>
              <Textarea
                id="category-choice-note"
                rows={3}
                maxLength={NOTE_MAX}
                aria-describedby="category-choice-note-hint"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <p id="category-choice-note-hint" className="text-footnote text-label-secondary">
                Optional
              </p>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={!ready}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
