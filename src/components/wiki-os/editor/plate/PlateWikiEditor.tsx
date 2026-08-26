/**
 * PlateWikiEditor.tsx — Unified Plate editor wrapper for WikiOS visual mode.
 *
 * Invariant 1: Wikitext is the persistence format.
 * Invariant 3: Plate is not a second source of truth.
 * Invariant 7: HTML is never used as serialization intermediary.
 */

"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { usePlateEditor, Plate, PlateContent, useValueVersion } from "platejs/react";
import { Transforms, type Descendant } from "slate";
import { deserializeParsoidHtml, serializePlateToHtml, valueToPlainText } from "./wiki-html";
// oxlint-disable-next-line eslint/no-unused-vars
import { wikitextToAst, astToPlateNodes, astToWikitext } from "~/lib/wiki-os/transformers/wiki-ast-converter";
import { createIxWikiPlugins, getIxWikiComponents } from "./plugins/createIxWikiPlugins";
import { useSlashMenuState } from "./slash-menu/useSlashMenuState";
import { WikiSlashMenu } from "./slash-menu/WikiSlashMenu";
import type { SlashItem } from "./slash-menu/slash-items";
import { PlateWikiCallbacksProvider, type PlateWikiCallbacks } from "./elements/PlateRawHtmlElement";

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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LeafRenderer(props: any) {
  const { attributes, children, leaf } = props as { attributes: any; children: React.ReactNode; leaf: any };
  let node = <>{children}</>;
  if (leaf.codeMark || leaf.code) node = <code className="rounded bg-secondary/60 px-1 font-mono text-[0.9em]">{node}</code>;
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
    element: { type: string; url?: string; internal?: boolean };
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
        <blockquote {...attributes} className="my-2 border-l-4 border-wiki/40 bg-wiki/5 px-3 py-1.5 text-muted-foreground italic">
          {children}
        </blockquote>
      );
    case "code-block":
      return (
        <pre {...attributes} className="my-2 overflow-x-auto rounded-xl bg-black/40 p-3 font-mono text-xs text-emerald-200">
          <code>{children}</code>
        </pre>
      );
    case "ul":
      return <ul {...attributes} className="my-1.5 list-disc pl-6">{children}</ul>;
    case "ol":
      return <ol {...attributes} className="my-1.5 list-decimal pl-6">{children}</ol>;
    case "li":
      return <li {...attributes}>{children}</li>;
    case "table":
      return (
        <table {...attributes} className="my-2 w-full border-collapse text-xs [&_td]:border [&_td]:border-border/40 [&_td]:px-2 [&_th]:border [&_th]:border-border/40 [&_th]:bg-secondary/50 [&_th]:px-2">
          <tbody>{children}</tbody>
        </table>
      );
    case "tr":
      return <tr {...attributes}>{children}</tr>;
    case "td":
    case "th":
      return <td {...attributes}>{children}</td>;
    case "hr":
      return (
        <div {...attributes} className="my-3">
          <div contentEditable={false} className="border-t border-border" />
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
      return <span {...attributes} className="align-super text-[10px] text-wiki">[{children}]</span>;
    default:
      return <p {...attributes} className="my-1 leading-relaxed">{children}</p>;
  }
}

export function PlateWikiEditor({
  initialHtml,
  initialWikitext,
  initialValue,
  onValueChange,
  onEditorReady,
  openTemplateEditor,
  deleteNode,
  updateInfoboxFields,
  onKeyDownExtra,
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

  const editor = usePlateEditor(
    {
      plugins: createIxWikiPlugins(),
      components: getIxWikiComponents(),
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

  return (
    <PlateWikiCallbacksProvider value={callbacks}>
      <Plate editor={editor}>
        <ValueReporter editor={editor} onValueChange={onValueChange} readyRef={readyFired} />
        <PlateContent
          className="wikios-ve-content min-h-[400px] outline-none"
          spellCheck
          renderElement={((props: any) => <ElementRenderer {...props} />) as never}
          renderLeaf={((props: any) => <LeafRenderer {...props} />) as never}
          onKeyDown={((e: React.KeyboardEvent) => {
            onKeyDownExtra?.(e);
            slash.handleKeyDown(e);
          }) as never}
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
}

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
  reportRef.current = onValueChange;

  useEffect(() => {
    if (!editor || !readyRef.current) return;
    reportRef.current(
      editor.children as Descendant[],
      serializePlateToHtml(editor.children as Descendant[]),
      valueToPlainText(editor.children as Descendant[])
    );
  }, [version, editor, readyRef]);

  return null;
}
