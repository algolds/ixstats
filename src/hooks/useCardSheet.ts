"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { encodeSheetFrom, parseSheetFrom, type SheetFrom } from "~/lib/cards/face/sheet-link";
import { focusedElement, refocus } from "~/lib/utils/focus";

/** Marks the history entry that `open` pushed, so `close` can step back over it. */
const OPENED_HERE = "cardSheetOpened";

/** What `history.state` can hold: any value a script stored there. */
type HistoryValue = object | string | number | bigint | boolean | null | undefined;

/** True only for the entry `open` pushed: Next.js adds its own keys there, and other scripts can store anything. */
function isOpenedHere(state: HistoryValue): state is { [OPENED_HERE]: true } {
  return (
    typeof state === "object" &&
    state !== null &&
    OPENED_HERE in state &&
    state[OPENED_HERE] === true
  );
}

/**
 * What had focus when the sheet opened, to give it back when the sheet closes: the sheet opens from the address, so
 * Radix has no trigger to return to. One at a time, since only one sheet is open.
 */
let sheetOpener: HTMLElement | null = null;

/** Gives focus back to whatever opened the sheet, while it is still on the page. */
export function returnFocusToSheetOpener(): void {
  const opener = sheetOpener;
  sheetOpener = null;
  refocus(opener);
}

/** The current address with its query changed, keeping the path, the page's own query and the hash. */
function addressWith(change: (query: URLSearchParams) => void): string {
  const url = new URL(window.location.href);
  change(url.searchParams);
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

/**
 * The card sheet lives in the address (`?card=<id>`, with `?from=` for where it was opened), so a copied link opens
 * it and the back button closes it. Opening keeps the page and its own query. Closing a sheet this page opened steps
 * back, so Back afterwards does not open it again; a sheet that came in on a link writes the address without it.
 */
export function useCardSheet(): {
  cardId: string | null;
  from: SheetFrom | null;
  open: (cardId: string, from?: SheetFrom | null) => void;
  close: () => void;
} {
  const params = useSearchParams();
  const cardId = params?.get("card") || null;
  const from = parseSheetFrom(params?.get("from"));
  // Set by a close until the address changes, so a second Esc or click cannot step back twice or push again.
  const closing = useRef(false);
  const search = params?.toString() ?? "";
  useEffect(() => {
    closing.current = false;
  }, [search]);

  const open = useCallback((id: string, nextFrom?: SheetFrom | null) => {
    sheetOpener = focusedElement();
    const address = addressWith((query) => {
      query.set("card", id);
      if (nextFrom) query.set("from", encodeSheetFrom(nextFrom));
      else query.delete("from");
    });
    window.history.pushState({ [OPENED_HERE]: true }, "", address);
  }, []);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (isOpenedHere(window.history.state)) {
      window.history.back();
      return;
    }
    const address = addressWith((query) => {
      query.delete("card");
      query.delete("from");
    });
    window.history.pushState(null, "", address);
  }, []);

  return { cardId, from, open, close };
}
