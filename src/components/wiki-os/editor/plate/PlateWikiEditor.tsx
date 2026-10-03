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
import { Transforms, type Descendant } from "slate";
import { deserializeParsoidHtml, serializePlateToHtml, valueToPlainText } from "./wiki-html";
import { wikitextToAst, astToPlateNodes } from "~/lib/wiki-os/transformers/wiki-ast-converter";
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
import { handleEditorKeyDown } from "./plate-key-handlers";

interface PlateWikiEditorProps {
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

/** Leaf marks (and their legacy aliases) mapped to the element that renders them, innermost first. */
const LEAF_MARKS: ReadonlyArray<
  readonly [
    keys: string[],
    tag: "code" | "s" | "u" | "em" | "strong" | "sup" | "sub",
    className?: string,
  ]
> = [
  [["codeMark", "code"], "code", "bg-fill-3 rounded-control-sm px-1 text-[0.9em] tabular-nums"],
  [["strike", "strikethrough"], "s"],
  [["underline"], "u"],
  [["italic"], "em"],
  [["bold"], "strong"],
  [["sup", "superscript"], "sup"],
  [["sub", "subscript"], "sub"],
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LeafRenderer({ attributes, children, leaf }: any) {
  const marked = LEAF_MARKS.reduce(
    (node, [keys, Tag, className]) =>
      keys.some((k) => leaf[k]) ? <Tag className={className}>{node}</Tag> : node,
    <>{children}</>
  );
  return <span {...attributes}>{marked}</span>;
}

const HEADING_CLASS: Record<string, string> = {
  h1: "wikios-ve-h1 mb-3 mt-6 border-b border-separator pb-2 text-title-1 text-label",
  h2: "wikios-ve-h2 mb-2 mt-5 border-b border-separator pb-1 text-title-2 text-label",
  h3: "wikios-ve-h3 mb-2 mt-4 text-title-3 text-label",
  h4: "wikios-ve-h4 mb-1 mt-3 text-headline text-label",
  h5: "wikios-ve-h5 mb-1 mt-2 text-eyebrow text-label",
  h6: "wikios-ve-h6 mb-1 mt-2 text-caption font-semibold text-label-secondary",
};

type SimpleTag = "blockquote" | "ul" | "ol" | "span" | "tr" | "th" | "td" | "div";

/** Elements that render as one tag with fixed classes around their children. */
const SIMPLE_ELEMENTS: Record<string, readonly [tag: SimpleTag, className?: string]> = {
  blockquote: [
    "blockquote",
    "border-tint/40 bg-tint/5 text-label-secondary my-2 border-l-4 px-3 py-2 italic",
  ],
  ul: ["ul", "text-body text-label my-2 list-disc space-y-1 pl-6 leading-relaxed"],
  ol: ["ol", "text-body text-label my-2 list-decimal space-y-1 pl-6 leading-relaxed"],
  lic: ["span"],
  tr: ["tr", "border-separator hover:bg-fill-4 border-b transition-colors last:border-0"],
  th: [
    "th",
    "border-separator bg-fill-2 text-label focus-within:ring-tint/50 focus-within:bg-tint/10 min-w-[90px] border p-3 text-left font-semibold transition-colors focus-within:ring-1",
  ],
  td: [
    "td",
    "border-separator text-label focus-within:ring-tint/50 focus-within:bg-tint/5 min-w-[90px] border p-3 transition-colors focus-within:ring-1",
  ],
};

/** Atomic blocks and chips that own their rendering. */
const ATOMIC_ELEMENTS: Record<string, React.ComponentType<any>> = {
  infobox: PlateInteractiveTemplateElement,
  "infobox-block": PlateInteractiveTemplateElement,
  template: PlateInteractiveTemplateElement,
  "template-block": PlateInteractiveTemplateElement,
  "raw-html": PlateInteractiveTemplateElement,
  "chip-engine": PlateEngineChipElement,
  "chip-coord": PlateCoordChipElement,
  "chip-mapembed": PlateMapEmbedChipElement,
  media: PlateMediaElement,
};

const SELECTION_AFFECTING_OPS = new Set([
  "set_selection",
  "insert_text",
  "remove_text",
  "set_node",
]);

const LIST_INDENT = ["", "ml-4", "ml-8", "ml-12", "ml-16"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ElementRenderer(props: any) {
  const { attributes, children, element } = props;
  const type: string = element.type;

  if (Object.hasOwn(ATOMIC_ELEMENTS, type)) {
    const Atomic = ATOMIC_ELEMENTS[type]!;
    return <Atomic {...props} />;
  }
  if (Object.hasOwn(SIMPLE_ELEMENTS, type)) {
    const [Tag, className] = SIMPLE_ELEMENTS[type]!;
    return (
      <Tag {...attributes} className={className}>
        {children}
      </Tag>
    );
  }
  if (Object.hasOwn(HEADING_CLASS, type)) {
    return (
      <div
        {...attributes}
        className={HEADING_CLASS[type]}
        role="heading"
        aria-level={Number(type.slice(1))}
      >
        {children}
      </div>
    );
  }

  switch (type) {
    case "code-block":
      return (
        <pre
          {...attributes}
          className="rounded-row text-footnote text-green my-2 overflow-x-auto bg-black/40 p-3 tabular-nums"
        >
          <code>{children}</code>
        </pre>
      );
    case "li": {
      const indentClass = LIST_INDENT[Math.min((element.level || 1) - 1, 4)] ?? "";
      return (
        <li
          {...attributes}
          className={`list-item min-h-[1.5em] pl-1 leading-relaxed ${indentClass}`}
        >
          {children}
        </li>
      );
    }
    case "table":
      return (
        <div
          {...attributes}
          className="rounded-row border-separator bg-surface my-3 overflow-x-auto border p-2 transition-colors"
        >
          {element.caption && (
            <div className="text-caption text-label-secondary mb-2 px-1 font-semibold">
              {element.caption}
            </div>
          )}
          <table className="text-footnote w-full border-collapse">
            <tbody>{children}</tbody>
          </table>
        </div>
      );
    case "hr":
      return (
        <div {...attributes} className="my-3">
          <div contentEditable={false} className="border-separator border-t" />
          {children}
        </div>
      );
    case "a":
    case "link":
      return (
        <a {...attributes} href={element.url} className="text-tint underline underline-offset-2">
          {children}
        </a>
      );
    case "ref":
      return (
        <span
          {...attributes}
          className="text-tint text-caption cursor-pointer align-super font-semibold select-none hover:underline"
          title={element.label ? `Reference: ${element.label}` : "Citation"}
        >
          [{element.label || element.name || "ref"}]<span className="hidden">{children}</span>
        </span>
      );
    case "chip-template":
    case "inline-template":
      return (
        <span
          {...attributes}
          contentEditable={false}
          className="rounded-control-sm bg-fill-2 border-separator text-footnote text-label hover:bg-fill-3 mx-0.5 inline-flex items-center gap-1 border px-2 py-0.5 align-baseline tabular-nums transition-colors select-none"
        >
          <span className="text-tint font-semibold">{"{{"}</span>
          <span>{element.templateName || element.name || "template"}</span>
          <span className="text-tint font-semibold">{"}}"}</span>
          {children}
        </span>
      );
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
      if (SELECTION_AFFECTING_OPS.has(operation.type)) {
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
      if (!e.defaultPrevented && editor) handleEditorKeyDown(editor, e);
    },
    [editor, onKeyDownExtra, slash]
  );

  return (
    <PlateWikiCallbacksProvider value={callbacks}>
      <Plate editor={editor}>
        <ValueReporter editor={editor} onValueChange={onValueChange} readyRef={readyFired} />
        <PlateContent
          className="wikios-ve-content wikios-ve-editable min-h-full w-full flex-1 cursor-text p-6 pb-48 outline-none"
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
