"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { encodeSheetFrom, parseSheetFrom, type SheetFrom } from "~/lib/cards/face/sheet-link";
import { addressWith } from "~/lib/utils/address";
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
const shownAddressWith = (change: (query: URLSearchParams) => void) =>
  addressWith(window.location.href, change);

/** The address the browser shows now, as a path. */
const currentAddress = () => shownAddressWith(() => undefined);

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
  // Set by a close until the router's address changes, so a second Esc or click cannot step back twice or push again.
  const closing = useRef(false);
  const search = params?.toString() ?? "";
  useEffect(() => {
    closing.current = false;
  }, [search]);
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      // A step back Next.js follows changes the router's address, which releases the guard.
      if (!closing.current || event.state) return;
      // It ignores one onto an entry with no state (a #fragment link's, such as the skip link), so its address
      // still shows the card: release the guard, and tell it where the browser is (its history patch follows).
      closing.current = false;
      window.history.replaceState(null, "", currentAddress());
    };
    // A page back from the browser's page cache has left the entry it was closing from.
    const onPageShow = () => {
      closing.current = false;
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const open = useCallback((id: string, nextFrom?: SheetFrom | null) => {
    const shown = new URL(window.location.href).searchParams;
    const fromValue = nextFrom ? encodeSheetFrom(nextFrom) : null;
    // Already open there: another entry would only make close step back onto the same address.
    if (shown.get("card") === id && shown.get("from") === fromValue) return;
    sheetOpener = focusedElement();
    const address = shownAddressWith((query) => {
      query.set("card", id);
      if (fromValue) query.set("from", fromValue);
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
    const address = shownAddressWith((query) => {
      query.delete("card");
      query.delete("from");
    });
    window.history.pushState(null, "", address);
  }, []);

  return { cardId, from, open, close };
}

/** Whether the address holds an open card sheet (`?card=`), for anything that should wait rather than cover it. */
export function useCardSheetOpen(): boolean {
  return Boolean(useSearchParams()?.get("card"));
}
