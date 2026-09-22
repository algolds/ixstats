"use client";
/**
 * PlateWikiEditor.tsx — Unified Plate editor wrapper for WikiOS visual mode.
 *
 * Invariant 1: Wikitext is the persistence format.
 * Invariant 3: Plate is not a second source of truth.
 * Invariant 7: HTML is never used as serialization intermediary.
 */

import React, { useEffect, useMemo, useRef, useCallback } from "react";
import { usePlateEditor, Plate, PlateContent, useValueVersion } from "platejs/react";
import {
  Transforms,
  Editor,
  Range,
  Element as SlateElement,
  Node as SlateNode,
  Path,
  type Descendant,
} from "slate";
import { deserializeParsoidHtml, serializePlateToHtml, valueToPlainText } from "./wiki-html";
// oxlint-disable-next-line eslint/no-unused-vars
import {
  wikitextToAst,
  astToPlateNodes,
} from "~/lib/wiki-os/transformers/wiki-ast-converter";
import { createIxWikiPlugins, getIxWikiComponents } from "./plugins/createIxWikiPlugins";
import { useSlashMenuState } from "./slash-menu/useSlashMenuState";
import { WikiSlashMenu } from "./slash-menu/WikiSlashMenu";
import type { SlashItem } from "./slash-menu/slash-items";
import {
  PlateWikiCallbacksProvider,
  type PlateWikiCallbacks,
} from "./elements/PlateRawHtmlElement";
import { PlateInteractiveTemplateElement } from "./elements/PlateInteractiveTemplateElement";
import { PlateEngineChipElement } from "./elements/PlateEngineChipElement";
import { PlateCoordChipElement, PlateMapEmbedChipElement } from "./elements/PlateCoordChipElement";
import { PlateMediaElement } from "./elements/PlateMediaElement";


export interface PlateWikiEditorProps {
  initialHtml?: string;
  initialWikitext?: string;
  initialValue?: any[];
  onValueChange: (nodes: Descendant[], html: string, plainText: string) => void;
  onEditorReady?: (editor: ReturnType<typeof usePlateEditor>) => void;
  openTemplateEditor: (id: string) => void;
  deleteNode: (id: string) => void;
  updateInfoboxFields?: (id: string, fields: Array<{ label: string; value: string }>) => void;
  onKeyDownExtra?: (e: React.KeyboardEvent) => void;
  onSelectionChange?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LeafRenderer(props: any) {
  const { attributes, children, leaf } = props as {
    attributes: any;
    children: React.ReactNode;
    leaf: any;
  };
  let node = <>{children}</>;
  if (leaf.codeMark || leaf.code)
    node = <code className="bg-secondary/60 rounded px-1 font-mono text-[0.9em]">{node}</code>;
  if (leaf.strike || leaf.strikethrough) node = <s>{node}</s>;
  if (leaf.underline) node = <u>{node}</u>;
  if (leaf.italic) node = <em>{node}</em>;
  if (leaf.bold) node = <strong>{node}</strong>;
  if (leaf.sup || leaf.superscript) node = <sup>{node}</sup>;
  if (leaf.sub || leaf.subscript) node = <sub>{node}</sub>;
  return <span {...attributes}>{node}</span>;
}

const BLOCK_CLASS: Record<string, string> = {
  h1: "wikios-ve-h1 mb-3 mt-6 border-b border-border/40 pb-1.5 text-2xl font-bold text-foreground",
  h2: "wikios-ve-h2 mb-2 mt-5 border-b border-border/30 pb-1 text-xl font-bold text-foreground",
  h3: "wikios-ve-h3 mb-1.5 mt-4 text-base font-bold text-foreground",
  h4: "wikios-ve-h4 mb-1 mt-3 text-sm font-bold text-foreground",
  h5: "wikios-ve-h5 mb-1 mt-2.5 text-xs font-bold text-foreground uppercase tracking-wider",
  h6: "wikios-ve-h6 mb-1 mt-2 text-xs font-semibold text-muted-foreground",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ElementRenderer(props: any) {
  const { attributes, children, element } = props as {
    attributes: any;
    children: React.ReactNode;
    element: { type: string; url?: string; internal?: boolean; templateName?: string; name?: string };
  };

  switch (element.type) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return (
        <div {...attributes} className={BLOCK_CLASS[element.type] || BLOCK_CLASS.h2} role="heading">
          {children}
        </div>
      );
    case "blockquote":
      return (
        <blockquote
          {...attributes}
          className="border-wiki/40 bg-wiki/5 text-muted-foreground my-2 border-l-4 px-3 py-1.5 italic"
        >
          {children}
        </blockquote>
      );
    case "code-block":
      return (
        <pre
          {...attributes}
          className="my-2 overflow-x-auto rounded-xl bg-black/40 p-3 font-mono text-xs text-emerald-200"
        >
          <code>{children}</code>
        </pre>
      );
    case "ul":
      return (
        <ul {...attributes} className="my-2 list-disc pl-6 space-y-1 text-sm leading-relaxed text-foreground/90">
          {children}
        </ul>
      );
    case "ol":
      return (
        <ol {...attributes} className="my-2 list-decimal pl-6 space-y-1 text-sm leading-relaxed text-foreground/90">
          {children}
        </ol>
      );
    case "li": {
      const level = (element as any).level || 1;
      const indentClass =
        level === 2 ? "ml-4" :
        level === 3 ? "ml-8" :
        level === 4 ? "ml-12" :
        level >= 5 ? "ml-16" : "";
      return (
        <li {...attributes} className={`list-item pl-1 min-h-[1.5em] leading-relaxed ${indentClass}`}>
          {children}
        </li>
      );
    }
    case "lic":
      return <span {...attributes}>{children}</span>;
    case "table":
      return (
        <div {...attributes} className="my-3 overflow-x-auto rounded-xl border border-border/60 bg-card/40 p-2 shadow-xs transition-colors">
          {(element as any).caption && (
            <div className="mb-2 px-1 text-xs font-semibold text-muted-foreground">
              {(element as any).caption}
            </div>
          )}
          <table className="w-full border-collapse text-xs">
            <tbody>{children}</tbody>
          </table>
        </div>
      );
    case "tr":
      return (
        <tr {...attributes} className="border-b border-border/40 last:border-0 hover:bg-secondary/20 transition-colors">
          {children}
        </tr>
      );
    case "th":
      return (
        <th
          {...attributes}
          className="border border-border/50 bg-secondary/80 p-2.5 text-left font-semibold text-foreground min-w-[90px] focus-within:ring-1 focus-within:ring-wiki/50 focus-within:bg-wiki/10 transition-colors"
        >
          {children}
        </th>
      );
    case "td":
      return (
        <td
          {...attributes}
          className="border border-border/40 p-2.5 text-foreground/90 min-w-[90px] focus-within:ring-1 focus-within:ring-wiki/50 focus-within:bg-wiki/5 transition-colors"
        >
          {children}
        </td>
      );
    case "hr":
      return (
        <div {...attributes} className="my-3">
          <div contentEditable={false} className="border-border border-t" />
          {children}
        </div>
      );
    case "a":
    case "link":
      return (
        <a {...attributes} href={element.url} className="text-wiki underline underline-offset-2">
          {children}
        </a>
      );
    case "ref":
      return (
        <span
          {...attributes}
          className="text-wiki align-super text-[10px] font-semibold cursor-pointer select-none hover:underline"
          title={(element as any).label ? `Reference: ${(element as any).label}` : "Citation"}
        >
          [{(element as any).label || (element as any).name || "ref"}]
          <span className="hidden">{children}</span>
        </span>
      );
    case "infobox":
    case "infobox-block":
    case "template":
    case "template-block":
    case "raw-html":
      return <PlateInteractiveTemplateElement {...props} />;
    case "chip-template":
    case "inline-template":
      return (
        <span
          {...attributes}
          contentEditable={false}
          className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md bg-secondary/80 border border-border/50 text-[11px] font-mono text-foreground select-none align-baseline hover:bg-secondary transition-colors"
        >
          <span className="text-wiki font-semibold">{"{{"}</span>
          <span>{element.templateName || (element as any).name || "template"}</span>
          <span className="text-wiki font-semibold">{"}}"}</span>
          {children}
        </span>
      );
    case "chip-engine":
      return <PlateEngineChipElement {...props} />;
    case "chip-coord":
      return <PlateCoordChipElement {...props} />;
    case "chip-mapembed":
      return <PlateMapEmbedChipElement {...props} />;
    case "media":
      return <PlateMediaElement {...props} />;
    default:
      return (
        <p {...attributes} className="my-1 leading-relaxed">
          {children}
        </p>
      );
  }
}


export const PlateWikiEditor = React.memo(function PlateWikiEditor({
  initialHtml,
  initialWikitext,
  initialValue,
  onValueChange,
  onEditorReady,
  openTemplateEditor,
  deleteNode,
  updateInfoboxFields,
  onKeyDownExtra,
  onSelectionChange,
}: PlateWikiEditorProps) {
  const computedInitialValue = useMemo(() => {
    if (initialValue && Array.isArray(initialValue) && initialValue.length > 0) {
      return initialValue;
    }
    if (initialWikitext !== undefined) {
      const ast = wikitextToAst(initialWikitext);
      return astToPlateNodes(ast);
    }
    if (initialHtml) {
      return deserializeParsoidHtml(initialHtml);
    }
    return [{ type: "p", children: [{ text: "" }] }];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const editorRef = useRef<ReturnType<typeof usePlateEditor> | null>(null);
  const readyFired = useRef(false);
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  const plugins = useMemo(() => createIxWikiPlugins(), []);
  const components = useMemo(() => getIxWikiComponents(), []);

  const editor = usePlateEditor(
    {
      plugins,
      components,
      value: computedInitialValue as never,
    } as never,
    [] as never
  );

  const slash = useSlashMenuState();

  const handleSlashSelect = (_item: SlashItem) => {
    if (editor && editor.selection) {
      try {
        Transforms.delete(editor as unknown as import("slate").BaseEditor, {
          distance: slash.query.length + 1,
          unit: "character",
          reverse: true,
        });
      } catch {
        /* best-effort cleanup */
      }
    }
    slash.close();
  };

  const callbacks: PlateWikiCallbacks = useMemo(
    () => ({
      openTemplateEditor,
      deleteNode,
      updateInfoboxFields,
    }),
    [openTemplateEditor, deleteNode, updateInfoboxFields]
  );

  useEffect(() => {
    if (editor && !readyFired.current) {
      editorRef.current = editor;
      readyFired.current = true;
      onEditorReady?.(editor);
      onValueChange(
        editor.children,
        serializePlateToHtml(editor.children),
        valueToPlainText(editor.children)
      );
    }
  }, [editor, onEditorReady, onValueChange]);

  // Intercept Slate operations to broadcast selection changes immediately
  useEffect(() => {
    if (!editor) return;
    const baseEditor = editor as unknown as import("slate").BaseEditor;
    const originalApply = baseEditor.apply;
    baseEditor.apply = (operation) => {
      originalApply(operation);
      if (
        operation.type === "set_selection" ||
        operation.type === "insert_text" ||
        operation.type === "remove_text" ||
        operation.type === "set_node"
      ) {
        onSelectionChangeRef.current?.();
      }
    };
    return () => {
      baseEditor.apply = originalApply;
    };
  }, [editor]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      onKeyDownExtra?.(e);
      slash.handleKeyDown(e);
      if (e.defaultPrevented || !editor) return;

      // ── 0. Markdown List Auto-conversion on Space ──
      if (e.key === " " && !e.shiftKey && editor.selection && Range.isCollapsed(editor.selection)) {
        try {
          const { anchor } = editor.selection;
          const [blockEntry] = Array.from(
            Editor.nodes(editor as unknown as import("slate").BaseEditor, {
              match: (n) =>
                SlateElement.isElement(n) &&
                !Editor.isInline(editor as any, n as any) &&
                (n as any).type === "p",
              mode: "lowest",
            })
          );
          if (blockEntry) {
            const [, blockPath] = blockEntry;
            const blockStart = Editor.start(editor as any, blockPath);
            const rangeBefore = { anchor: blockStart, focus: anchor };
            const textBefore = Editor.string(editor as any, rangeBefore);

            if (textBefore === "*" || textBefore === "-") {
              e.preventDefault();
              Editor.withoutNormalizing(editor as any, () => {
                Transforms.delete(editor as any, { at: rangeBefore });
                Transforms.setNodes(
                  editor as any,
                  { type: "li", level: 1 } as any,
                  { at: blockPath }
                );
                Transforms.wrapNodes(
                  editor as any,
                  { type: "ul", children: [] } as any,
                  { at: blockPath }
                );
              });
              return;
            }

            if (textBefore === "1.") {
              e.preventDefault();
              Editor.withoutNormalizing(editor as any, () => {
                Transforms.delete(editor as any, { at: rangeBefore });
                Transforms.setNodes(
                  editor as any,
                  { type: "li", level: 1 } as any,
                  { at: blockPath }
                );
                Transforms.wrapNodes(
                  editor as any,
                  { type: "ol", children: [] } as any,
                  { at: blockPath }
                );
              });
              return;
            }
          }
        } catch {
          /* best effort */
        }
      }

      // ── 1. Table Cell Navigation & Insertion ──
      try {
        const [cellEntry] = Editor.nodes(editor as unknown as import("slate").BaseEditor, {
          match: (n) =>
            SlateElement.isElement(n) && ((n as any).type === "td" || (n as any).type === "th"),
        });

        if (cellEntry) {
          const [, cellPath] = cellEntry;
          const [tableEntry] = Editor.nodes(editor as unknown as import("slate").BaseEditor, {
            match: (n) => SlateElement.isElement(n) && (n as any).type === "table",
          });

          if (tableEntry) {
            const [tableNode, tablePath] = tableEntry;

            if (e.key === "Backspace") {
              const selection = editor.selection;
              if (selection && Range.isCollapsed(selection)) {
                const isAtStart = Editor.isStart(editor as any, selection.anchor, cellPath);
                if (isAtStart) {
                  e.preventDefault();
                  return;
                }
              }
            }

            if (e.key === "Delete") {
              const selection = editor.selection;
              if (selection && Range.isCollapsed(selection)) {
                const isAtEnd = Editor.isEnd(editor as any, selection.anchor, cellPath);
                if (isAtEnd) {
                  e.preventDefault();
                  return;
                }
              }
            }

            if (e.key === "Tab") {
              e.preventDefault();
              const allCells = Array.from(
                Editor.nodes(editor as unknown as import("slate").BaseEditor, {
                  at: tablePath,
                  match: (n) =>
                    SlateElement.isElement(n) &&
                    ((n as any).type === "td" || (n as any).type === "th"),
                })
              );
              const currentIdx = allCells.findIndex(([, p]) => Path.equals(p, cellPath));

              if (!e.shiftKey) {
                if (currentIdx !== -1 && currentIdx < allCells.length - 1) {
                  const nextCell = allCells[currentIdx + 1]!;
                  Transforms.select(editor as any, Editor.end(editor as any, nextCell[1]));
                } else if (currentIdx === allCells.length - 1) {
                  // Last cell: append a new row
                  const rows = (tableNode as any).children || [];
                  const lastRow = rows[rows.length - 1];
                  const colCount = lastRow ? (lastRow.children || []).length : 2;
                  const newRow = {
                    type: "tr",
                    children: Array.from({ length: colCount }, () => ({
                      type: "td",
                      children: [{ text: "" }],
                    })),
                  };
                  const newRowPath = [...tablePath, rows.length];
                  Transforms.insertNodes(editor as any, newRow as any, { at: newRowPath });
                  Transforms.select(editor as any, Editor.start(editor as any, [...newRowPath, 0]));
                }
              } else {
                if (currentIdx > 0) {
                  const prevCell = allCells[currentIdx - 1]!;
                  Transforms.select(editor as any, Editor.end(editor as any, prevCell[1]));
                }
              }
              return;
            }

            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const rowIndex = cellPath[tablePath.length];
              const colIndex = cellPath[tablePath.length + 1];
              const rows = (tableNode as any).children || [];

              if (typeof rowIndex === "number" && typeof colIndex === "number") {
                if (rowIndex < rows.length - 1) {
                  const targetPath = [...tablePath, rowIndex + 1, colIndex];
                  try {
                    Transforms.select(editor as any, Editor.end(editor as any, targetPath));
                  } catch {
                    Transforms.select(editor as any, Editor.end(editor as any, [...tablePath, rowIndex + 1, 0]));
                  }
                } else {
                  // Last row: append row
                  const colCount = (rows[rowIndex]?.children || []).length || 2;
                  const newRow = {
                    type: "tr",
                    children: Array.from({ length: colCount }, () => ({
                      type: "td",
                      children: [{ text: "" }],
                    })),
                  };
                  const newRowPath = [...tablePath, rows.length];
                  Transforms.insertNodes(editor as any, newRow as any, { at: newRowPath });
                  const safeColIndex = Math.min(colIndex, colCount - 1);
                  Transforms.select(editor as any, Editor.start(editor as any, [...newRowPath, safeColIndex]));
                }
              }
              return;
            }
          }
        }
      } catch {}

      // ── 2. List Item Navigation & Exit ──
      try {
        const [liEntry] = Editor.nodes(editor as unknown as import("slate").BaseEditor, {
          match: (n) => SlateElement.isElement(n) && (n as any).type === "li",
        });

        if (liEntry) {
          const [liNode, liPath] = liEntry;
          const [listEntry] = Editor.nodes(editor as unknown as import("slate").BaseEditor, {
            match: (n) =>
              SlateElement.isElement(n) &&
              ((n as any).type === "ul" || (n as any).type === "ol"),
          });

          // ── Indent / Outdent on Tab / Shift+Tab ──
          if (e.key === "Tab") {
            e.preventDefault();
            const currentLevel = (liNode as any).level || 1;
            if (!e.shiftKey) {
              const newLevel = Math.min(currentLevel + 1, 6);
              Transforms.setNodes(editor as any, { level: newLevel } as any, { at: liPath });
            } else {
              const newLevel = Math.max(currentLevel - 1, 1);
              Transforms.setNodes(editor as any, { level: newLevel } as any, { at: liPath });
            }
            return;
          }

          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            const textContent = SlateNode.string(liNode).trim();

            if (textContent === "") {
              // Empty bullet: check if indented first
              const currentLevel = (liNode as any).level || 1;
              if (currentLevel > 1) {
                Transforms.setNodes(editor as any, { level: currentLevel - 1 } as any, { at: liPath });
                return;
              }

              // Level 1 empty bullet: exit list
              if (listEntry) {
                const [listNode, listPath] = listEntry;
                const items = (listNode as any).children || [];

                if (items.length <= 1) {
                  Transforms.removeNodes(editor as any, { at: listPath });
                  Transforms.insertNodes(editor as any, { type: "p", children: [{ text: "" }] } as any, { at: listPath });
                  Transforms.select(editor as any, Editor.end(editor as any, listPath));
                } else {
                  Transforms.removeNodes(editor as any, { at: liPath });
                  const nextBlockPath = Path.next(listPath);
                  Transforms.insertNodes(editor as any, { type: "p", children: [{ text: "" }] } as any, { at: nextBlockPath });
                  Transforms.select(editor as any, Editor.end(editor as any, nextBlockPath));
                }
              }
            } else {
              // Non-empty bullet: cleanly split node at cursor position
              Transforms.splitNodes(editor as any, { always: true });
            }
            return;
          }

          if (e.key === "Backspace") {
            const textContent = SlateNode.string(liNode);
            if (textContent === "" && listEntry) {
              e.preventDefault();
              const currentLevel = (liNode as any).level || 1;
              if (currentLevel > 1) {
                Transforms.setNodes(editor as any, { level: currentLevel - 1 } as any, { at: liPath });
                return;
              }

              const [listNode, listPath] = listEntry;
              const items = (listNode as any).children || [];

              if (items.length <= 1) {
                Transforms.removeNodes(editor as any, { at: listPath });
                Transforms.insertNodes(editor as any, { type: "p", children: [{ text: "" }] } as any, { at: listPath });
                Transforms.select(editor as any, Editor.end(editor as any, listPath));
              } else {
                Transforms.removeNodes(editor as any, { at: liPath });
                const nextBlockPath = Path.next(listPath);
                Transforms.insertNodes(editor as any, { type: "p", children: [{ text: "" }] } as any, { at: nextBlockPath });
                Transforms.select(editor as any, Editor.end(editor as any, nextBlockPath));
              }
              return;
            }
          }
        }
      } catch {}
    },
    [editor, onKeyDownExtra, slash]
  );

  return (
    <PlateWikiCallbacksProvider value={callbacks}>
      <Plate editor={editor}>
        <ValueReporter editor={editor} onValueChange={onValueChange} readyRef={readyFired} />
        <PlateContent
          className="wikios-ve-content wikios-ve-editable min-h-full flex-1 w-full outline-none p-6 pb-48 cursor-text"
          spellCheck
          renderElement={((props: any) => <ElementRenderer {...props} />) as never}
          renderLeaf={((props: any) => <LeafRenderer {...props} />) as never}
          onSelect={onSelectionChange as never}
          onKeyDown={handleKeyDown as never}
        />
        <WikiSlashMenu
          open={slash.open}
          query={slash.query}
          anchorRect={slash.anchorRect}
          editor={editor as never}
          onSelect={handleSlashSelect}
          onClose={slash.close}
        />
      </Plate>
    </PlateWikiCallbacksProvider>
  );
});

/** Lives inside <Plate> so it can subscribe to store updates. */
function ValueReporter({
  editor,
  onValueChange,
  readyRef,
}: {
  editor: ReturnType<typeof usePlateEditor>;
  onValueChange: (nodes: Descendant[], html: string, plainText: string) => void;
  readyRef: React.MutableRefObject<boolean>;
}) {
  const version = useValueVersion();
  const reportRef = useRef(onValueChange);
  // oxlint-disable-next-line
  reportRef.current = onValueChange;

  useEffect(() => {
    if (!editor || !readyRef.current) return;
    reportRef.current(
      editor.children as Descendant[],
      serializePlateToHtml(editor.children as Descendant[]),
      valueToPlainText(editor.children as Descendant[])
    );
    // oxlint-disable-next-line
  }, [version, editor, readyRef]);

  return null;
}
