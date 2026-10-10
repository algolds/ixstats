/**
 * Writing into the Canvas editor from outside it (the Quote button, Attach action). Plain Slate transforms on the
 * editor the host got from `onEditorReady`; wikitext is read back the way a save reads it, so nothing here is a
 * second source of truth.
 */
import { Editor, Transforms, type Descendant } from "slate";
import { ReactEditor } from "slate-react";
import { wikitextToAst, astToPlateNodes } from "~/lib/wiki-os/transformers/wiki-ast-converter";

const EMPTY_PARAGRAPH = { type: "p", children: [{ text: "" }] } as unknown as Descendant;

function isBlank(editor: Editor): boolean {
  return editor.children.length === 1 && Editor.string(editor, [0]) === "";
}

/** Puts the keyboard back in the editor after a popover or button took it; a no-op where the editor is not mounted. */
function focusSoon(editor: Editor): void {
  requestAnimationFrame(() => {
    try {
      ReactEditor.focus(editor as ReactEditor);
    } catch {
      // Not mounted (closed sheet, test): nothing to focus.
    }
  });
}

/** Inserts text at the caret, or at the end of the document when nothing is selected. */
export function insertAtCaret(editor: Editor, text: string): void {
  if (!editor.selection) Transforms.select(editor, Editor.end(editor, []));
  Transforms.insertText(editor, text);
  focusSoon(editor);
}

/** Adds wikitext as blocks at the end of the document (replacing an empty one) and puts the caret in a fresh paragraph after. */
export function appendWikitext(editor: Editor, wikitext: string): void {
  const blank = isBlank(editor);
  const blocks = astToPlateNodes(wikitextToAst(wikitext)) as Descendant[];
  Editor.withoutNormalizing(editor, () => {
    Transforms.insertNodes(editor, [...blocks, EMPTY_PARAGRAPH], { at: [editor.children.length] });
    if (blank) Transforms.removeNodes(editor, { at: [0] });
  });
  Transforms.select(editor, Editor.end(editor, []));
  focusSoon(editor);
}
