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
  /** Which editor shows: the word count reads only the visual editor's serializations. */
  const [mode, setMode] = useState<"source" | "visual">("visual");
  /** The canvas reported a text other than the one it opened on: the author has written in this editor. */
  const [edited, setEdited] = useState(false);
  const readerRef = useRef<ContentReader>(null);
  /**
   * The text as the editor opened, to tell an edit from none: the visual editor's first serialization (which absorbs
   * the canvas's own normalising), else the text the bridge opened on.
   */
  const openedRef = useRef<string | null>(null);
  /** What the bridge opened on, and in which editor (`onEditorOpened`); null until it opens. */
  const openingRef = useRef<{ wikitext: string; mode: "source" | "visual" } | null>(null);
  const lastRef = useRef<string | null>(null);

  return {
    /** The prose word count, or null in the source editor, which reports none. */
    words: mode === "visual" ? words : null,
    edited,
    /** A new editor opens. */
    reset: () => {
      openedRef.current = null;
      setEdited(false);
    },
    /**
     * The editor's text now when the author changed it from what it opened on, or with `always` even unchanged; else
     * null. The baseline is the text as the editor opened (above), else `opening` (the prefill). With none, nothing
     * tells an edit from none, so it counts as none: no draft of an untouched page.
     */
    read: (opening: string | undefined, always: boolean): string | null => {
      const reader = readerRef.current;
      if (!reader) return null;
      const text = reader() ?? lastRef.current;
      const baseline = openedRef.current ?? openingRef.current?.wikitext ?? opening;
      if (text === null || (!always && (baseline === undefined || text === baseline))) return null;
      return text;
    },
    onSerializedWikitext: (result: { wikitext: string }) => {
      // An editor that opened in source mode has its baseline already: a later canvas serializes the author's edits.
      if (openingRef.current?.mode !== "source") openedRef.current ??= result.wikitext;
      if (result.wikitext !== (openedRef.current ?? openingRef.current?.wikitext)) setEdited(true);
      lastRef.current = result.wikitext;
      setWords(loreWordCount(result.wikitext));
    },
    onModeChange: setMode,
    onEditorOpened: (opened: { wikitext: string; mode: "source" | "visual" }) => {
      openingRef.current = opened;
    },
    registerContentReader: (read: ContentReader) => {
      readerRef.current = read;
    },
  };
}
