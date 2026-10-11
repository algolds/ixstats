"use client";

import { useEffect, useRef } from "react";
import type { BoardQuote } from "./types";

/** Puts a requested quote into the editor once per request (`quote.key`), then tells the page it is in. */
export function useQuoteInsert(
  quote: BoardQuote | null,
  insertText: (text: string) => void,
  onQuoteInserted: () => void
): void {
  const handled = useRef<number | null>(null);
  useEffect(() => {
    if (!quote || handled.current === quote.key) return;
    handled.current = quote.key;
    insertText(quote.text);
    onQuoteInserted();
  }, [quote, insertText, onQuoteInserted]);
}
