/**
 * Writing into the Canvas editor from outside it (the Quote button, Attach action). Plate transforms on the editor the
 * host got from `onEditorReady`; the document is read back the way a save reads it, so nothing here is a second source
 * of truth.
 */
import type { TElement, TSlateEditor } from "platejs";
import { quoteWikitext, type QuoteRequest } from "./QuoteInsert";

const EMPTY_PARAGRAPH: TElement = { type: "p", children: [{ text: "" }] };

/** Puts the keyboard back in the editor after a popover or button took it; a no-op where the editor is not mounted. */
function focusSoon(editor: TSlateEditor): void {
  requestAnimationFrame(() => {
    try {
      editor.tf.focus();
    } catch {
      // Not mounted (closed sheet, test): nothing to focus.
    }
  });
}

function selectEnd(editor: TSlateEditor): void {
  const end = editor.api.end([]);
  if (end) editor.tf.select(end);
}

/** Inserts text at the caret, or at the end of the document when nothing is selected. */
export function insertAtCaret(editor: TSlateEditor, text: string): void {
  if (!editor.selection) selectEnd(editor);
  editor.tf.insertText(text);
  focusSoon(editor);
}

/**
 * The quote as one atomic block: the read-only wikitext block the Canvas already has for source it must not touch,
 * shown as who wrote what (never as tags) and saved exactly as `quoteWikitext` wrote it, whatever the author types
 * around it.
 */
function quoteBlock(quote: QuoteRequest): TElement {
  return {
    type: "raw-wikitext",
    construct: "forum-quote",
    rawWikitext: quoteWikitext(quote).trimEnd(),
    label: quote.author,
    caption: quote.text,
    children: [{ text: "" }],
  };
}

/** Adds the quote at the end of the document (replacing an empty one) and puts the caret in a fresh paragraph after it. */
export function appendQuote(editor: TSlateEditor, quote: QuoteRequest): void {
  const blank = editor.children.length === 1 && editor.api.string([0]) === "";
  editor.tf.withoutNormalizing(() => {
    editor.tf.insertNodes([quoteBlock(quote), EMPTY_PARAGRAPH], { at: [editor.children.length] });
    if (blank) editor.tf.removeNodes({ at: [0] });
  });
  selectEnd(editor);
  focusSoon(editor);
}
