"use client";

import { useRef } from "react";
import { CardSuggestionForm } from "~/components/cards/suggest/CardSuggestionForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { focusedElement, refocus } from "~/lib/utils/focus";

/** Suggesting a lore card from Explore: anyone signed in may suggest an article with no card yet. */
export function SuggestCardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // The address opens this dialog, not a Radix trigger, so it gives focus back to what had it.
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto"
        onOpenAutoFocus={() => {
          opener.current = focusedElement();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          refocus(opener.current);
          opener.current = null;
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-title-3">Suggest a lore card</DialogTitle>
          <DialogDescription>
            Pick a wiki article with no card yet. An admin reviews every suggestion.
          </DialogDescription>
        </DialogHeader>
        <CardSuggestionForm />
      </DialogContent>
    </Dialog>
  );
}
