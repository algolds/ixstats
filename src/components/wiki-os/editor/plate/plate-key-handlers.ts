import type React from "react";
import {
  Transforms,
  Editor,
  Range,
  Element as SlateElement,
  Node as SlateNode,
  Path,
  type Node,
} from "slate";

/** The Plate editor is deeply generic; these handlers only rely on Slate runtime APIs. */
type Ed = any;
type Loose = any;

const MARKDOWN_LISTS = new Map([
  ["*", "ul"],
  ["-", "ul"],
  ["1.", "ol"],
]);

const typeOf = (n: Node) => (n as { type?: string }).type;

const isTypeIn =
  (...types: string[]) =>
  (n: Node) =>
    SlateElement.isElement(n) && types.includes(typeOf(n) ?? "");

const firstEntry = (editor: Ed, match: (n: Node) => boolean, mode?: "lowest") =>
  Editor.nodes(editor, { match, mode }).next().value as [Loose, Path] | undefined;

const emptyParagraph = () => ({ type: "p", children: [{ text: "" }] });

const levelOf = (node: Loose): number => node.level || 1;

const setLevel = (editor: Ed, at: Path, level: number) =>
  Transforms.setNodes(editor, { level } as Loose, { at });

/** `*`, `-` or `1.` followed by Space at the start of a paragraph becomes a list item. */
function convertMarkdownList(editor: Ed, e: React.KeyboardEvent): boolean {
  if (e.key !== " " || e.shiftKey || !editor.selection || !Range.isCollapsed(editor.selection)) {
    return false;
  }
  const blockEntry = firstEntry(
    editor,
    (n) => SlateElement.isElement(n) && !Editor.isInline(editor, n) && typeOf(n) === "p",
    "lowest"
  );
  if (!blockEntry) return false;

  const blockPath = blockEntry[1];
  const rangeBefore = { anchor: Editor.start(editor, blockPath), focus: editor.selection.anchor };
  const listType = MARKDOWN_LISTS.get(Editor.string(editor, rangeBefore));
  if (!listType) return false;

  e.preventDefault();
  Editor.withoutNormalizing(editor, () => {
    Transforms.delete(editor, { at: rangeBefore });
    Transforms.setNodes(editor, { type: "li", level: 1 } as Loose, { at: blockPath });
    Transforms.wrapNodes(editor, { type: listType, children: [] } as Loose, { at: blockPath });
  });
  return true;
}

function appendTableRow(editor: Ed, tablePath: Path, rowCount: number, colCount: number): Path {
  const newRowPath = [...tablePath, rowCount];
  const newRow = {
    type: "tr",
    children: Array.from({ length: colCount }, () => ({ type: "td", children: [{ text: "" }] })),
  };
  Transforms.insertNodes(editor, newRow as Loose, { at: newRowPath });
  return newRowPath;
}

function tabThroughCells(
  editor: Ed,
  e: React.KeyboardEvent,
  tableEntry: [Loose, Path],
  cellPath: Path
) {
  const [tableNode, tablePath] = tableEntry;
  const allCells = Array.from(Editor.nodes(editor, { at: tablePath, match: isTypeIn("td", "th") }));
  const currentIdx = allCells.findIndex(([, p]) => Path.equals(p, cellPath));

  if (e.shiftKey) {
    if (currentIdx > 0) Transforms.select(editor, Editor.end(editor, allCells[currentIdx - 1]![1]));
  } else if (currentIdx !== -1 && currentIdx < allCells.length - 1) {
    Transforms.select(editor, Editor.end(editor, allCells[currentIdx + 1]![1]));
  } else if (currentIdx === allCells.length - 1) {
    // Last cell: append a new row
    const rows = tableNode.children || [];
    const colCount = rows.at(-1) ? (rows.at(-1).children || []).length : 2;
    const newRowPath = appendTableRow(editor, tablePath, rows.length, colCount);
    Transforms.select(editor, Editor.start(editor, [...newRowPath, 0]));
  }
}

function enterTableCell(editor: Ed, tableEntry: [Loose, Path], cellPath: Path) {
  const [tableNode, tablePath] = tableEntry;
  const rowIndex = cellPath[tablePath.length];
  const colIndex = cellPath[tablePath.length + 1];
  const rows = tableNode.children || [];
  if (typeof rowIndex !== "number" || typeof colIndex !== "number") return;

  if (rowIndex < rows.length - 1) {
    try {
      Transforms.select(editor, Editor.end(editor, [...tablePath, rowIndex + 1, colIndex]));
    } catch {
      Transforms.select(editor, Editor.end(editor, [...tablePath, rowIndex + 1, 0]));
    }
    return;
  }
  // Last row: append row
  const colCount = (rows[rowIndex]?.children || []).length || 2;
  const newRowPath = appendTableRow(editor, tablePath, rows.length, colCount);
  Transforms.select(
    editor,
    Editor.start(editor, [...newRowPath, Math.min(colIndex, colCount - 1)])
  );
}

/** Cell navigation (Tab/Enter) and cell-edge guards (Backspace/Delete). True when handled. */
function handleTableKey(editor: Ed, e: React.KeyboardEvent): boolean {
  const cellEntry = firstEntry(editor, isTypeIn("td", "th"));
  const tableEntry = cellEntry && firstEntry(editor, isTypeIn("table"));
  if (!cellEntry || !tableEntry) return false;
  const cellPath = cellEntry[1];

  const selection = editor.selection;
  if ((e.key === "Backspace" || e.key === "Delete") && selection && Range.isCollapsed(selection)) {
    const { anchor } = selection;
    if (
      e.key === "Backspace"
        ? Editor.isStart(editor, anchor, cellPath)
        : Editor.isEnd(editor, anchor, cellPath)
    ) {
      e.preventDefault();
      return true;
    }
  }
  if (e.key === "Tab") {
    e.preventDefault();
    tabThroughCells(editor, e, tableEntry, cellPath);
    return true;
  }
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    enterTableCell(editor, tableEntry, cellPath);
    return true;
  }
  return false;
}

/** Remove an empty bullet and leave the list, replacing a one-item list with a paragraph. */
function exitList(editor: Ed, [listNode, listPath]: [Loose, Path], liPath: Path) {
  const onlyItem = (listNode.children || []).length <= 1;
  Transforms.removeNodes(editor, { at: onlyItem ? listPath : liPath });
  const paragraphPath = onlyItem ? listPath : Path.next(listPath);
  Transforms.insertNodes(editor, emptyParagraph() as Loose, { at: paragraphPath });
  Transforms.select(editor, Editor.end(editor, paragraphPath));
}

/** Indent/outdent on Tab, and Enter/Backspace behaviour on empty bullets. True when handled. */
function handleListKey(editor: Ed, e: React.KeyboardEvent): boolean {
  const liEntry = firstEntry(editor, isTypeIn("li"));
  if (!liEntry) return false;
  const [liNode, liPath] = liEntry;
  const listEntry = firstEntry(editor, isTypeIn("ul", "ol"));
  const level = levelOf(liNode);

  if (e.key === "Tab") {
    e.preventDefault();
    setLevel(editor, liPath, Math.min(6, Math.max(1, level + (e.shiftKey ? -1 : 1))));
    return true;
  }

  const isEnter = e.key === "Enter" && !e.shiftKey;
  const isEmptyBackspace = e.key === "Backspace" && !!listEntry && SlateNode.string(liNode) === "";
  if (!isEnter && !isEmptyBackspace) return false;

  e.preventDefault();
  if (isEnter && SlateNode.string(liNode).trim() !== "") {
    // Non-empty bullet: cleanly split node at cursor position
    Transforms.splitNodes(editor, { always: true });
  } else if (level > 1) {
    setLevel(editor, liPath, level - 1);
  } else if (listEntry) {
    exitList(editor, listEntry, liPath);
  }
  return true;
}

/** Markdown shortcuts, table navigation and list editing for the visual editor. */
export function handleEditorKeyDown(editor: Ed, e: React.KeyboardEvent): void {
  try {
    if (convertMarkdownList(editor, e)) return;
  } catch {
    /* best effort */
  }
  try {
    if (handleTableKey(editor, e)) return;
  } catch (err) {
    console.warn("[PlateWikiEditor] Table keyboard navigation failed:", err);
  }
  try {
    handleListKey(editor, e);
  } catch (err) {
    console.warn("[PlateWikiEditor] List keyboard navigation failed:", err);
  }
}
