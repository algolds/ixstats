"use client";

import { useRef } from "react";
import { focusedElement, refocus } from "~/lib/utils/focus";

/** Spread on a copy dialog's content. */
export interface DialogFocus {
  onOpenAutoFocus: () => void;
  onCloseAutoFocus: (event: Event) => void;
}

/**
 * Focus for the copy dialogs, which have no trigger of their own: it goes back to the button that opened one, unless
 * the action took that button away (a listed or signed copy loses it, a burned copy its whole row). `settle` names the
 * place focus goes instead, before the dialog closes.
 */
export function useDialogFocus(): {
  focus: DialogFocus;
  settle: (target: HTMLElement | null) => void;
} {
  const opener = useRef<HTMLElement | null>(null);
  const after = useRef<HTMLElement | null>(null);
  return {
    focus: {
      onOpenAutoFocus: () => {
        opener.current = focusedElement();
        after.current = null;
      },
      onCloseAutoFocus: (event) => {
        event.preventDefault();
        refocus(after.current ?? opener.current);
      },
    },
    settle: (target) => {
      after.current = target;
    },
  };
}
