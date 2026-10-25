import { useRef, useState } from "react";
import { loreWordCount } from "~/lib/lore/word-count";

type ContentReader = (() => string | null) | null;

/**
 * What the lore writer knows of the text in WikiOS's editor: its word count, the text as it opened, and the text as it
 * is now (the editor's own reader, else its last serialization when some content cannot all be converted to
 * wikitext yet). Nothing once the editor has gone.
 */
export function useLoreEditorText() {
  const [words, setWords] = useState(0);
  /** The canvas reported a text other than the one it opened on: the author has written in this editor. */
  const [edited, setEdited] = useState(false);
  const readerRef = useRef<ContentReader>(null);
  /** The text as the editor opened (its first serialization), to tell an edit from none. */
  const openedRef = useRef<string | null>(null);
  const lastRef = useRef<string | null>(null);

  return {
    words,
    edited,
    /** A new editor opens. */
    reset: () => {
      openedRef.current = null;
      setEdited(false);
    },
    /**
     * The editor's text now when the author changed it from what it opened on (`opening` for an editor that reports
     * no serialization), or with `always` even unchanged; else null.
     */
    read: (opening: string | undefined, always: boolean): string | null => {
      const reader = readerRef.current;
      if (!reader) return null;
      const text = reader() ?? lastRef.current;
      if (text === null || (!always && text === (openedRef.current ?? opening))) return null;
      return text;
    },
    onSerializedWikitext: (result: { wikitext: string }) => {
      openedRef.current ??= result.wikitext;
      if (result.wikitext !== openedRef.current) setEdited(true);
      lastRef.current = result.wikitext;
      setWords(loreWordCount(result.wikitext));
    },
    registerContentReader: (read: ContentReader) => {
      readerRef.current = read;
    },
  };
}
