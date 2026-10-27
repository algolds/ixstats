"use client";
// Visual editing via Plate/Slate transforms. Preserves the original hook's
// public interface so toolbars and modal hosts need no changes.

import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "~/trpc/react";
import { fixEditorImageUrls } from "~/lib/wiki-os/transformers/fix-editor-images";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Transforms,
  Editor,
  Element as SlateElement,
  type Node,
  type Descendant,
  type Path,
} from "slate";
import { nanoid } from "platejs";
import { useNotify } from "~/hooks/useNotify";
import { previewFailureReason, TEMPLATE_PREVIEW_STALE_MS } from "./template-preview";

// The concrete plate editor type is deeply generic; the formatting layer only
// relies on Slate runtime APIs, so we keep the ref loose.
type PlateEditorLike = any;

interface EditingTemplateRef {
  id: string;
  name: string;
  params: Record<string, string>;
}

interface UseWikiVisualFormattingProps {
  title: string;
  editorRef: React.MutableRefObject<PlateEditorLike | null>;
  setIsDirty: (val: boolean) => void;
}

const MARK_COMMANDS: Record<string, string> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strikeThrough: "strike",
  superscript: "sup",
  subscript: "sub",
  code: "code",
};

/** Toolbar format names that each Slate mark (and its legacy alias) lights up. */
const MARK_GROUPS: ReadonlyArray<{ marks: readonly string[]; formats: readonly string[] }> = [
  { marks: ["bold"], formats: ["bold"] },
  { marks: ["italic"], formats: ["italic"] },
  { marks: ["underline"], formats: ["underline"] },
  { marks: ["strike", "strikethrough"], formats: ["strikethrough", "strike"] },
  { marks: ["sup", "superscript"], formats: ["superscript", "sup"] },
  { marks: ["sub", "subscript"], formats: ["subscript", "sub"] },
  { marks: ["code", "codeMark"], formats: ["code"] },
];

interface DomFormatRule {
  formats: readonly string[];
  tags: readonly string[];
  /** Substring of the element's class attribute. */
  className?: string;
  style?: (style: CSSStyleDeclaration) => boolean;
  /** Selector used to inspect a cloned selection fragment (defaults to the tags). */
  selector?: string | false;
}

const DOM_FORMAT_RULES: readonly DomFormatRule[] = [
  {
    formats: ["bold"],
    tags: ["strong", "b"],
    style: (s) => s.fontWeight === "bold" || parseInt(s.fontWeight, 10) >= 600,
  },
  { formats: ["italic"], tags: ["em", "i"], style: (s) => s.fontStyle === "italic" },
  { formats: ["underline"], tags: ["u"], style: (s) => !!s.textDecoration?.includes("underline") },
  {
    formats: ["strikethrough", "strike"],
    tags: ["s", "strike", "del"],
    style: (s) => !!s.textDecoration?.includes("line-through"),
  },
  { formats: ["superscript", "sup"], tags: ["sup"] },
  { formats: ["subscript", "sub"], tags: ["sub"] },
  { formats: ["code"], tags: ["code", "pre"], className: "font-mono" },
  { formats: ["blockquote"], tags: ["blockquote"] },
  { formats: ["ul"], tags: ["ul"] },
  { formats: ["ol"], tags: ["ol"] },
  { formats: ["table"], tags: ["table", "td", "th", "tr"], selector: "table" },
  { formats: ["link"], tags: ["a"] },
  ...["h1", "h2", "h3", "h4"].map((h) => ({
    formats: [h],
    tags: [h],
    className: `wikios-ve-${h}`,
    selector: `.wikios-ve-${h}, ${h}`,
  })),
  { formats: ["p", "paragraph"], tags: ["p"], className: "wikios-ve-p", selector: false },
];

/** Plate block types that light up a toolbar format when the selection is inside one. */
const BLOCK_PROBES: ReadonlyArray<{ types: readonly string[]; format: (type: string) => string }> =
  [
    { types: ["ul", "ol", "li"], format: (type) => (type === "ol" ? "ol" : "ul") },
    { types: ["table", "tr", "td", "th"], format: () => "table" },
    { types: ["link", "a"], format: () => "link" },
  ];

const noop = () => {};

const nodeType = (n: unknown) => (n as { type?: string }).type;
const isTypeIn =
  (...types: string[]) =>
  (n: Node) =>
    SlateElement.isElement(n) && types.includes(nodeType(n) ?? "");
const firstEntry = (
  editor: PlateEditorLike,
  match: (n: Node) => boolean,
  options: { mode?: "lowest"; at?: Path } = {}
) => Editor.nodes(editor, { match, ...options }).next().value as [Node, Path] | undefined;
const findNodeEntry = (editor: PlateEditorLike, id: string) =>
  firstEntry(editor, (n) => (n as { id?: string }).id === id, { at: [] });
const lowestLeaves = (editor: PlateEditorLike) =>
  Array.from(
    Editor.nodes(editor, {
      match: (n) => (n as { text?: unknown }).text !== undefined,
      mode: "lowest",
    })
  ).map(([node]) => node as unknown as Record<string, boolean | undefined>);
const isEditableBlock = (editor: PlateEditorLike) => (n: Node) =>
  SlateElement.isElement(n) && !editor.isInline(n) && !editor.isVoid(n);

const buildWikitext = (name: string, params: Record<string, string>) =>
  `{{${name}${Object.entries(params)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `|${k}=${v}`)
    .join("")}}}`;

const transclusionHtml = (dataMw: string, html: string) =>
  `<div typeof="mw:Transclusion" data-mw='${dataMw.replace(/'/g, "&#39;")}' class="wikios-ve-template">${fixEditorImageUrls(html)}</div>`;

function elementMatchesRule(el: HTMLElement, rule: DomFormatRule): boolean {
  return (
    rule.tags.includes(el.tagName.toLowerCase()) ||
    !!(rule.className && (el.className || "").includes(rule.className)) ||
    !!rule.style?.(el.style)
  );
}

/**
 * Inspect the browser's live DOM selection inside the visual editor to instantly
 * detect active formatting tags (<strong>, <em>, <u>, <s>, <code>, <h2>, etc.)
 * with zero latency and complete framework independence.
 */
function getDomActiveFormats(): Set<string> {
  const fmt = new Set<string>();
  if (typeof window === "undefined") return fmt;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return fmt;

  const editorEl =
    document.querySelector(".wikios-ve-content") ||
    document.querySelector("[contenteditable='true']");
  const anchorNode = sel.anchorNode;
  if (!editorEl || !anchorNode || !editorEl.contains(anchorNode)) return fmt;

  let curr: HTMLElement | null =
    anchorNode.nodeType === 1 ? (anchorNode as HTMLElement) : anchorNode.parentElement;

  while (curr && curr !== editorEl && editorEl.contains(curr)) {
    for (const rule of DOM_FORMAT_RULES) {
      if (elementMatchesRule(curr, rule)) rule.formats.forEach((f) => fmt.add(f));
    }
    curr = curr.parentElement;
  }

  // If text is selected (expanded range), inspect the contents of the range
  if (!sel.isCollapsed) {
    try {
      const fragment = sel.getRangeAt(0).cloneContents();
      for (const rule of DOM_FORMAT_RULES) {
        const selector = rule.selector ?? rule.tags.join(", ");
        if (selector && fragment.querySelector(selector)) rule.formats.forEach((f) => fmt.add(f));
      }
    } catch {
      /* best effort */
    }
  }

  return fmt;
}

function isFormatMarkActive(editor: PlateEditorLike, mark: string): boolean {
  if (!editor.selection) return false;
  const marks = (Editor.marks(editor) as Record<string, boolean> | null) ?? {};
  if (marks[mark]) return true;
  const names = MARK_GROUPS.find((g) => g.marks.includes(mark))?.marks ?? [];
  if (names.some((n) => marks[n])) return true;
  try {
    return lowestLeaves(editor).some((leaf) => names.some((n) => leaf[n]));
  } catch {
    return false; // best-effort fallback
  }
}

/** Formats implied by the Plate/Slate AST at the current selection. */
function getEditorActiveFormats(editor: PlateEditorLike, fmt: Set<string>) {
  const addGroups = (isOn: (names: readonly string[]) => boolean) => {
    for (const g of MARK_GROUPS) if (isOn(g.marks)) g.formats.forEach((f) => fmt.add(f));
  };
  try {
    // Direct editor marks (Plate editor.api or editor.marks or Slate Editor.marks)
    const marks: Record<string, boolean> =
      editor.api?.marks?.() ?? editor.marks ?? Editor.marks(editor) ?? {};
    addGroups((names) => names.some((n) => marks[n] || editor.api?.hasMark?.(n)));

    // Also inspect selected text leaf nodes in Plate/Slate
    if (editor.selection) {
      for (const leaf of lowestLeaves(editor)) addGroups((names) => names.some((n) => leaf[n]));
    }
  } catch {
    /* best effort */
  }
  if (!editor.selection) return;

  try {
    const blockEntry =
      editor.api?.block?.() ?? firstEntry(editor, isEditableBlock(editor), { mode: "lowest" });
    if (blockEntry) {
      const blockType = nodeType(blockEntry[0]) || "p";
      fmt.add(blockType);
      if (blockType === "p") fmt.add("paragraph");
      if (blockType === "paragraph") fmt.add("p");
    }

    for (const { types, format } of BLOCK_PROBES) {
      const entry = firstEntry(editor, isTypeIn(...types));
      if (entry) fmt.add(format(nodeType(entry[0]) ?? ""));
    }
  } catch {
    /* best-effort block detection */
  }
}

function toggleListBlock(editor: PlateEditorLike, targetType: "ul" | "ol") {
  Editor.withoutNormalizing(editor, () => {
    // If selection is null, focus editor start
    if (!editor.selection) {
      if (editor.children.length > 0) {
        Transforms.select(editor, Editor.start(editor, [0]));
      } else {
        Transforms.insertNodes(editor, { type: "p", children: [{ text: "" }] } as Descendant);
        Transforms.select(editor, [0, 0]);
      }
    }

    const isList = isTypeIn("ul", "ol");
    const listEntry = firstEntry(editor, isList);
    if (listEntry && nodeType(listEntry[0]) === targetType) {
      // Toggle off: unwrap ul/ol and convert li back to p
      Transforms.unwrapNodes(editor, { match: isList, split: true });
      Transforms.setNodes(editor, { type: "p" } as Partial<Descendant>, { match: isTypeIn("li") });
    } else if (listEntry) {
      // Switch list type (ul <-> ol)
      Transforms.setNodes(editor, { type: targetType } as Partial<Descendant>, {
        at: listEntry[1],
      });
    } else {
      // Not in list: convert matching selected blocks to li and wrap in ul/ol
      Transforms.setNodes(editor, { type: "li", level: 1 } as Partial<Descendant>, {
        match: (n) =>
          SlateElement.isElement(n) &&
          !editor.isInline(n) &&
          !["table", "tr", "td", "th"].includes(nodeType(n) ?? ""),
        mode: "lowest",
      });
      Transforms.wrapNodes(editor, { type: targetType, children: [] } as SlateElement, {
        match: isTypeIn("li"),
        mode: "lowest",
      });
    }
  });
}

function buildDataMw(name: string, params: Record<string, string>): string {
  return JSON.stringify({
    parts: [
      {
        template: {
          target: { wt: name },
          params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, { wt: v }])),
        },
      },
    ],
  });
}

export function useWikiVisualFormatting({
  title,
  editorRef,
  setIsDirty,
}: UseWikiVisualFormattingProps) {
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [editingTemplate, setEditingTemplate] = useState<EditingTemplateRef | null>(null);
  const lastActiveFormatsRef = useRef<Set<string>>(new Set());

  const previewMutation = api.wikios.previewWikitext.useMutation();
  const utils = api.useUtils();
  const notify = useNotify();

  const withEditor = useCallback(
    <T>(fn: (editor: PlateEditorLike) => T): T | undefined => {
      const editor = editorRef.current;
      if (!editor) return undefined;
      return fn(editor);
    },
    [editorRef]
  );

  /** Run an editor mutation and mark the document dirty. */
  const edit = useCallback(
    (fn: (editor: PlateEditorLike) => void) =>
      withEditor((editor) => {
        fn(editor);
        setIsDirty(true);
      }),
    [withEditor, setIsDirty]
  );

  const insertNode = useCallback(
    (node: Record<string, unknown>) =>
      edit((editor) => Transforms.insertNodes(editor, node as unknown as Descendant)),
    [edit]
  );

  /** Refresh toolbar highlight state from current marks + block type. */
  const refreshActiveFormats = useCallback(() => {
    // 1. First get formats from native browser DOM selection (immediate, zero latency)
    const fmt = getDomActiveFormats();

    // If DOM returned no selection inside editor, check if focus is in toolbar (preserve formats)
    if (fmt.size === 0) {
      const toolbarEl = document.querySelector(".wikios-ve-toolbar");
      if (toolbarEl && document.activeElement && toolbarEl.contains(document.activeElement)) return;
    }

    // 2. Supplement/validate with Plate/Slate editor AST state if available
    if (editorRef.current) getEditorActiveFormats(editorRef.current, fmt);

    const prev = lastActiveFormatsRef.current;
    if (prev.size === fmt.size && [...fmt].every((f) => prev.has(f))) return;

    lastActiveFormatsRef.current = fmt;
    setActiveFormats(fmt);
  }, [editorRef]);

  /** Refocus the editor and resync the toolbar after a command. */
  const settle = useCallback(() => {
    editorRef.current?.focus?.();
    refreshActiveFormats();
  }, [editorRef, refreshActiveFormats]);

  // Automatically listen to native selection changes anywhere in the document
  useEffect(() => {
    document.addEventListener("selectionchange", refreshActiveFormats);
    return () => document.removeEventListener("selectionchange", refreshActiveFormats);
  }, [refreshActiveFormats]);

  const toggleMark = useCallback(
    (mark: string) => {
      withEditor((editor) => {
        // 1. If Plate has native toggleMark on transforms
        if (editor.tf?.toggleMark) {
          editor.tf.toggleMark(mark);
        } else {
          // 2. Otherwise determine active state from isFormatMarkActive or DOM
          const active = isFormatMarkActive(editor, mark) || getDomActiveFormats().has(mark);
          const hasTf = editor.tf?.addMark && editor.tf?.removeMark;
          const addMark = (m: string) =>
            hasTf ? editor.tf.addMark(m, true) : Editor.addMark(editor, m, true);
          const removeMark = (m: string) =>
            hasTf ? editor.tf.removeMark(m) : Editor.removeMark(editor, m);
          try {
            if (!active) addMark(mark);
            else
              for (const m of MARK_GROUPS.find((g) => g.marks.includes(mark))?.marks ?? [mark])
                removeMark(m);
          } catch {
            /* best effort */
          }
        }
        setIsDirty(true);
        refreshActiveFormats();
      });
    },
    [withEditor, setIsDirty, refreshActiveFormats]
  );

  const setType = useCallback(
    (type: string) => {
      edit((editor) =>
        Transforms.setNodes(editor, { type } as Partial<Descendant>, {
          match: (n) => SlateElement.isElement(n) && !editor.isVoid(n),
          mode: "lowest",
        })
      );
      refreshActiveFormats();
    },
    [edit, refreshActiveFormats]
  );

  const shiftListLevel = useCallback(
    (delta: number) =>
      withEditor((editor) => {
        const liEntry = firstEntry(editor, isTypeIn("li"));
        if (!liEntry) return;
        const level = Math.min(
          6,
          Math.max(1, ((liEntry[0] as { level?: number }).level || 1) + delta)
        );
        Transforms.setNodes(editor, { level } as Partial<Descendant>, { at: liEntry[1] });
        setIsDirty(true);
      }),
    [withEditor, setIsDirty]
  );

  const exec = useCallback(
    (cmd: string, val?: string) => {
      const markCmd = MARK_COMMANDS[cmd];
      if (markCmd) {
        toggleMark(markCmd);
      } else {
        switch (cmd) {
          case "insertUnorderedList":
          case "insertOrderedList":
            edit((editor) => toggleListBlock(editor, cmd === "insertOrderedList" ? "ol" : "ul"));
            break;
          case "indent":
            shiftListLevel(1);
            break;
          case "outdent":
            shiftListLevel(-1);
            break;
          case "formatBlock":
            if (val === "blockquote") {
              withEditor((editor) =>
                setType(firstEntry(editor, isTypeIn("blockquote")) ? "p" : "blockquote")
              );
            }
            break;
          case "undo":
          case "redo":
            edit((editor) => editor[cmd]?.());
            break;
          case "removeFormat":
            edit((editor) =>
              Object.keys(Editor.marks(editor) ?? {}).forEach((m) => Editor.removeMark(editor, m))
            );
            break;
        }
      }
      settle();
    },
    [toggleMark, setType, shiftListLevel, edit, withEditor, settle]
  );

  const setHeading = useCallback(
    (level: number) => {
      edit((editor) => {
        const targetType = `h${Math.min(Math.max(level, 2), 4)}`;
        const blockEntry = firstEntry(editor, isEditableBlock(editor), { mode: "lowest" });
        Transforms.setNodes(
          editor,
          {
            type: nodeType(blockEntry?.[0]) === targetType ? "p" : targetType,
          } as Partial<Descendant>,
          { match: (n) => SlateElement.isElement(n) && !editor.isVoid(n), mode: "lowest" }
        );
      });
      settle();
    },
    [edit, settle]
  );

  const setParagraph = useCallback(() => {
    setType("p");
    settle();
  }, [setType, settle]);

  const insertLink = useCallback(() => {
    withEditor((editor) => {
      const selectedText = Editor.string(editor, editor.selection ?? []);
      const url = window.prompt(
        "Enter URL or wiki page name:",
        selectedText.startsWith("http") ? selectedText : ""
      );
      if (!url) return;
      const internal = !/^https?:/i.test(url);
      insertNode({
        type: "link",
        url: internal ? `/wiki/${encodeURIComponent(url.replace(/ /g, "_"))}` : url,
        internal,
        children: [{ text: selectedText || url }],
      });
    });
    editorRef.current?.focus?.();
  }, [withEditor, insertNode, editorRef]);

  const removeLink = useCallback(() => {
    edit((editor) => Transforms.unwrapNodes(editor, { match: isTypeIn("link") }));
    editorRef.current?.focus?.();
  }, [edit, editorRef]);

  const insertHR = useCallback(() => {
    edit((editor) => {
      Transforms.insertNodes(editor, { type: "hr", children: [{ text: "" }] } as Descendant);
      Transforms.insertNodes(editor, { type: "p", children: [{ text: "" }] } as Descendant);
    });
  }, [edit]);

  const insertTable = useCallback(() => {
    const cell = (type: "th" | "td", text: string) => ({ type, children: [{ text }] });
    const row = (type: "th" | "td", ...labels: string[]) => ({
      type: "tr",
      children: labels.map((label) => cell(type, label)),
    });
    insertNode({
      type: "table",
      attributes: 'class="wikitable"',
      children: [
        row("th", "Header 1", "Header 2", "Header 3"),
        row("td", "Data 1", "Data 2", "Data 3"),
        row("td", "Data 4", "Data 5", "Data 6"),
      ],
    });
  }, [insertNode]);

  const insertRef = useCallback(
    () => insertNode({ type: "ref", label: "Citation needed", children: [{ text: "" }] }),
    [insertNode]
  );

  /** Insert a prepared custom node (chips, coords, map embeds). */
  const insertChip = useCallback(
    (chip: Record<string, unknown>) => insertNode({ ...chip, id: nanoid() }),
    [insertNode]
  );

  const clearFormatting = useCallback(() => {
    exec("removeFormat");
    editorRef.current?.focus?.();
  }, [exec, editorRef]);

  const handleInsertTemplate = useCallback(
    async (templateName: string, params: Record<string, string>) => {
      const dataMw = buildDataMw(templateName, params);

      if (/^(MyCountry|CountryData|BusinessData):/.test(templateName)) {
        insertNode({
          type: "chip-engine",
          id: nanoid(),
          name: templateName,
          params,
          dataMw,
          label: params.label || templateName.split(":").pop() || templateName,
          wikitext: `{{${templateName}}}`,
          children: [{ text: "" }],
        });
        return;
      }

      // The server renders the preview (sanitized, cached in Redis): the browser never asks MediaWiki itself.
      // The template is the wikitext either way: when the preview cannot be had (rate limit, refused
      // parameters, signed out) it is inserted without one, and the author is told.
      const wikitext = buildWikitext(templateName, params);
      let preview = "";
      try {
        preview = await utils.wikios.getTemplatePreview.fetch(
          { template: templateName, params },
          { staleTime: TEMPLATE_PREVIEW_STALE_MS }
        );
      } catch (err) {
        console.error("Failed to render template:", err);
        notify.warning(
          "Template inserted without a preview",
          `{{${templateName}}} is in the page as written. ${previewFailureReason(err)}`.trim()
        );
      }
      insertNode({
        type: "raw-html",
        id: nanoid(),
        kind: /infobox/i.test(wikitext) ? "infobox" : "generic",
        name: templateName,
        params,
        dataMw,
        html: preview ? transclusionHtml(dataMw, preview) : "",
        wikitext,
        children: [{ text: "" }],
      });
    },
    [insertNode, utils, notify]
  );

  const handleInsertImage = useCallback(
    async (imageWikitext: string) => {
      try {
        const result = await previewMutation.mutateAsync({ wikitext: imageWikitext, title });
        const temp = document.createElement("div");
        temp.innerHTML = fixEditorImageUrls(result.html);
        const figure = temp.querySelector("figure, .thumb, img") ?? temp.firstElementChild;
        if (!figure) return;
        figure.setAttribute("contenteditable", "false");
        figure.classList?.add("wikios-ve-media");
        insertNode({
          type: "media",
          id: nanoid(),
          html: figure.outerHTML,
          filename: figure.querySelector("img")?.getAttribute("alt") ?? undefined,
          wikitext: imageWikitext,
          children: [{ text: "" }],
        });
      } catch (err) {
        console.error("Failed to render image:", err);
      }
    },
    [previewMutation, title, insertNode]
  );

  const handleTemplateUpdate = useCallback(
    async (newParams: Record<string, string>) => {
      if (!editingTemplate) return;
      const { id, name } = editingTemplate;

      withEditor((editor) => {
        const entry = findNodeEntry(editor, id);
        if (!entry) return;
        const [node, path] = entry;
        const dataMw = buildDataMw(name, newParams);
        const wikitext = buildWikitext(name, newParams);
        const update = (extra: Record<string, unknown>) =>
          Transforms.setNodes(
            editor,
            { params: newParams, dataMw, wikitext, ...extra } as Partial<Descendant>,
            { at: path }
          );

        if (nodeType(node) === "chip-engine") {
          update({});
        } else {
          void previewMutation
            .mutateAsync({ wikitext, title })
            .then((result) => update({ html: transclusionHtml(dataMw, result.html) }))
            .catch((err) => console.error("Failed to update template:", err));
        }
        setIsDirty(true);
      });
      setEditingTemplate(null);
    },
    [editingTemplate, previewMutation, title, withEditor, setIsDirty]
  );

  const removeEditingNode = useCallback(() => {
    if (!editingTemplate) return;
    const { id } = editingTemplate;
    withEditor((editor) => {
      const entry = findNodeEntry(editor, id);
      if (entry) {
        Transforms.removeNodes(editor, { at: entry[1] });
        setIsDirty(true);
      }
    });
    setEditingTemplate(null);
  }, [editingTemplate, withEditor, setIsDirty]);

  return {
    activeFormats,
    editingTemplate,
    setEditingTemplate,
    // Legacy DOM-selection shims: shared toolbar dropdowns still take onBeforeOpen handlers.
    saveSelection: noop,
    restoreSelection: noop,
    exec,
    setHeading,
    setParagraph,
    insertLink,
    removeLink,
    insertHR,
    insertTable,
    insertRef,
    clearFormatting,
    handleInsertTemplate,
    handleInsertImage,
    handleTemplateUpdate,
    removeEditingNode,
    refreshActiveFormats,
    insertChip,
  };
}
