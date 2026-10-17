"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { encodeSheetFrom, parseSheetFrom, type SheetFrom } from "~/lib/cards/face/sheet-link";

/** Marks the history entry that `open` pushed, so `close` can step back over it. */
const OPENED_HERE = "cardSheetOpened";

function openedHere(): boolean {
  const state: Record<string, boolean> | null = window.history.state;
  return state?.[OPENED_HERE] === true;
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

  const open = useCallback((id: string, nextFrom?: SheetFrom | null) => {
    const address = addressWith((query) => {
      query.set("card", id);
      if (nextFrom) query.set("from", encodeSheetFrom(nextFrom));
      else query.delete("from");
    });
    window.history.pushState({ [OPENED_HERE]: true }, "", address);
  }, []);

  const close = useCallback(() => {
    if (openedHere()) {
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
