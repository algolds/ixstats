"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { TSlateEditor } from "platejs";
import { appendQuote } from "./canvas-ops";
import type { QuoteRequest } from "./QuoteInsert";

/**
 * Adds a quote request to the draft once. The quote may arrive before the editor has loaded (a phone sheet that has
 * just opened): it waits for the editor. Returns the editor-ready handler to hand to the editor.
 */
export function useCanvasQuote(
  editorRef: RefObject<TSlateEditor | null>,
  quoteRequest: QuoteRequest | null,
  onQuoteInserted: (() => void) | undefined
) {
  const quotedRef = useRef<QuoteRequest | null>(null);
  const insertedRef = useRef(onQuoteInserted);
  insertedRef.current = onQuoteInserted;

  const apply = useCallback(
    (quote: QuoteRequest) => {
      if (!editorRef.current || quotedRef.current === quote) return;
      quotedRef.current = quote;
      appendQuote(editorRef.current, quote);
      insertedRef.current?.();
    },
    [editorRef]
  );

  useEffect(() => {
    if (quoteRequest) apply(quoteRequest);
  }, [quoteRequest, apply]);

  return useCallback(
    (editor: TSlateEditor) => {
      editorRef.current = editor;
      if (quoteRequest) apply(quoteRequest);
    },
    [editorRef, quoteRequest, apply]
  );
}
