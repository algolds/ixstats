"use client";
// src/components/wiki-os/editor/hooks/useWikiVisualFormatting.ts
// Visual editing via Plate/Slate transforms. Preserves the original hook's
// public interface so toolbars and modal hosts need no changes.

import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "~/trpc/react";
import { fixEditorImageUrls } from "~/lib/wiki-os/transformers/fix-editor-images";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Transforms, Editor, Element as SlateElement, type Node, type Descendant } from "slate";
import { nanoid } from "platejs";
import { renderTemplateCached } from "~/lib/wiki-os/templates/preview-service";

// The concrete plate editor type is deeply generic; the formatting layer only
// relies on Slate runtime APIs, so we keep the ref loose.
type PlateEditorLike = any;

export interface EditingTemplateRef {
  id: string;
  name: string;
  params: Record<string, string>;
}

export interface UseWikiVisualFormattingProps {
  title: string;
  editorRef: React.MutableRefObject<PlateEditorLike | null>;
  setIsDirty: (val: boolean) => void;
}

const MARK_MAP: Record<string, string> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strikeThrough: "strike",
};

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
  if (!editorEl) return fmt;

  const anchorNode = sel.anchorNode;
  if (!anchorNode || !editorEl.contains(anchorNode)) return fmt;

  let curr: HTMLElement | null =
    anchorNode.nodeType === 1
      ? (anchorNode as HTMLElement)
      : anchorNode.parentElement;

  while (curr && curr !== editorEl && editorEl.contains(curr)) {
    const tag = curr.tagName.toLowerCase();
    const cl = curr.className || "";

    if (
      tag === "strong" ||
      tag === "b" ||
      curr.style.fontWeight === "bold" ||
      parseInt(curr.style.fontWeight, 10) >= 600
    ) {
      fmt.add("bold");
    }
    if (tag === "em" || tag === "i" || curr.style.fontStyle === "italic") {
      fmt.add("italic");
    }
    if (tag === "u" || curr.style.textDecoration?.includes("underline")) {
      fmt.add("underline");
    }
    if (
      tag === "s" ||
      tag === "strike" ||
      tag === "del" ||
      curr.style.textDecoration?.includes("line-through")
    ) {
      fmt.add("strikethrough");
      fmt.add("strike");
    }
    if (tag === "sup") {
      fmt.add("superscript");
      fmt.add("sup");
    }
    if (tag === "sub") {
      fmt.add("subscript");
      fmt.add("sub");
    }
    if (tag === "code" || tag === "pre" || cl.includes("font-mono")) {
      fmt.add("code");
    }
    if (tag === "blockquote") {
      fmt.add("blockquote");
    }
    if (tag === "ul") {
      fmt.add("ul");
    }
    if (tag === "ol") {
      fmt.add("ol");
    }
    if (tag === "table" || tag === "td" || tag === "th" || tag === "tr") {
      fmt.add("table");
    }
    if (tag === "a") {
      fmt.add("link");
    }
    if (tag === "h1" || cl.includes("wikios-ve-h1")) {
      fmt.add("h1");
    }
    if (tag === "h2" || cl.includes("wikios-ve-h2")) {
      fmt.add("h2");
    }
    if (tag === "h3" || cl.includes("wikios-ve-h3")) {
      fmt.add("h3");
    }
    if (tag === "h4" || cl.includes("wikios-ve-h4")) {
      fmt.add("h4");
    }
    if (tag === "p" || cl.includes("wikios-ve-p")) {
      fmt.add("p");
      fmt.add("paragraph");
    }

    curr = curr.parentElement;
  }

  // If text is selected (expanded range), inspect the contents of the range
  if (!sel.isCollapsed && sel.rangeCount > 0) {
    try {
      const range = sel.getRangeAt(0);
      const fragment = range.cloneContents();
      if (fragment.querySelector("strong, b")) fmt.add("bold");
      if (fragment.querySelector("em, i")) fmt.add("italic");
      if (fragment.querySelector("u")) fmt.add("underline");
      if (fragment.querySelector("s, strike, del")) {
        fmt.add("strikethrough");
        fmt.add("strike");
      }
      if (fragment.querySelector("sup")) {
        fmt.add("superscript");
        fmt.add("sup");
      }
      if (fragment.querySelector("sub")) {
        fmt.add("subscript");
        fmt.add("sub");
      }
      if (fragment.querySelector("code, pre")) fmt.add("code");
      if (fragment.querySelector("a")) fmt.add("link");
      if (fragment.querySelector(".wikios-ve-h1, h1")) fmt.add("h1");
      if (fragment.querySelector(".wikios-ve-h2, h2")) fmt.add("h2");
      if (fragment.querySelector(".wikios-ve-h3, h3")) fmt.add("h3");
      if (fragment.querySelector(".wikios-ve-h4, h4")) fmt.add("h4");
      if (fragment.querySelector("blockquote")) fmt.add("blockquote");
      if (fragment.querySelector("ul")) fmt.add("ul");
      if (fragment.querySelector("ol")) fmt.add("ol");
      if (fragment.querySelector("table")) fmt.add("table");
    } catch {
      /* best effort */
    }
  }

  return fmt;
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

  const withEditor = useCallback(
    <T>(fn: (editor: PlateEditorLike) => T): T | undefined => {
      const editor = editorRef.current;
      if (!editor) return undefined;
      return fn(editor);
    },
    [editorRef]
  );

  // ── Marks ────────────────────────────────────────────────────────────────

  const isFormatMarkActive = useCallback((editor: PlateEditorLike, mark: string): boolean => {
    if (!editor.selection) return false;
    const marks = ((Editor.marks(editor) as Record<string, boolean> | null) ?? {});
    if (marks[mark]) return true;
    if ((mark === "strike" || mark === "strikethrough") && (marks.strike || marks.strikethrough)) return true;
    if ((mark === "sup" || mark === "superscript") && (marks.sup || marks.superscript)) return true;
    if ((mark === "sub" || mark === "subscript") && (marks.sub || marks.subscript)) return true;
    if ((mark === "code" || mark === "codeMark") && (marks.code || marks.codeMark)) return true;

    try {
      const textNodes = Array.from(
        Editor.nodes(editor, {
          match: (n) => (n as { text?: unknown }).text !== undefined,
          mode: "lowest",
        })
      );
      for (const [node] of textNodes) {
        const leaf = node as unknown as Record<string, boolean | undefined>;
        if (mark === "bold" && leaf.bold) return true;
        if (mark === "italic" && leaf.italic) return true;
        if (mark === "underline" && leaf.underline) return true;
        if ((mark === "strike" || mark === "strikethrough") && (leaf.strike || leaf.strikethrough)) return true;
        if ((mark === "sup" || mark === "superscript") && (leaf.sup || leaf.superscript)) return true;
        if ((mark === "sub" || mark === "subscript") && (leaf.sub || leaf.subscript)) return true;
        if ((mark === "code" || mark === "codeMark") && (leaf.code || leaf.codeMark)) return true;
      }
    } catch {
      /* best-effort fallback */
    }
    return false;
  }, []);

  /** Refresh toolbar highlight state from current marks + block type. */
  const refreshActiveFormats = useCallback(() => {
    // 1. First get formats from native browser DOM selection (immediate, zero latency)
    const domFmt = getDomActiveFormats();
    const fmt = new Set<string>(domFmt);

    // If DOM returned no selection inside editor, check if focus is in toolbar (preserve formats)
    if (fmt.size === 0 && typeof window !== "undefined") {
      const activeEl = document.activeElement;
      const toolbarEl = document.querySelector(".wikios-ve-toolbar");
      if (toolbarEl && activeEl && toolbarEl.contains(activeEl)) {
        return;
      }
    }

    // 2. Supplement/validate with Plate/Slate editor AST state if available
    const editor = editorRef.current;
    if (editor) {
      try {
        // Direct editor marks (Plate editor.api or editor.marks or Slate Editor.marks)
        const marks =
          editor.api?.marks?.() ??
          editor.marks ??
          (Editor.marks(editor) as Record<string, boolean> | null) ??
          {};

        if (marks.bold || editor.api?.hasMark?.("bold")) fmt.add("bold");
        if (marks.italic || editor.api?.hasMark?.("italic")) fmt.add("italic");
        if (marks.underline || editor.api?.hasMark?.("underline")) fmt.add("underline");
        if (
          marks.strike ||
          marks.strikethrough ||
          editor.api?.hasMark?.("strike") ||
          editor.api?.hasMark?.("strikethrough")
        ) {
          fmt.add("strikethrough");
          fmt.add("strike");
        }
        if (
          marks.sup ||
          marks.superscript ||
          editor.api?.hasMark?.("sup") ||
          editor.api?.hasMark?.("superscript")
        ) {
          fmt.add("superscript");
          fmt.add("sup");
        }
        if (
          marks.sub ||
          marks.subscript ||
          editor.api?.hasMark?.("sub") ||
          editor.api?.hasMark?.("subscript")
        ) {
          fmt.add("subscript");
          fmt.add("sub");
        }
        if (marks.code || marks.codeMark || editor.api?.hasMark?.("code")) {
          fmt.add("code");
        }

        // Also inspect selected text leaf nodes in Plate/Slate
        try {
          if (editor.selection) {
            const textNodes = Array.from(
              Editor.nodes(editor, {
                match: (n) => (n as { text?: unknown }).text !== undefined,
                mode: "lowest",
              })
            );
            for (const [node] of textNodes) {
              const leaf = node as unknown as Record<string, boolean | undefined>;
              if (leaf.bold) fmt.add("bold");
              if (leaf.italic) fmt.add("italic");
              if (leaf.underline) fmt.add("underline");
              if (leaf.strike || leaf.strikethrough) {
                fmt.add("strikethrough");
                fmt.add("strike");
              }
              if (leaf.sup || leaf.superscript) {
                fmt.add("superscript");
                fmt.add("sup");
              }
              if (leaf.sub || leaf.subscript) {
                fmt.add("subscript");
                fmt.add("sub");
              }
              if (leaf.code || leaf.codeMark) {
                fmt.add("code");
              }
            }
          }
        } catch {
          /* best effort */
        }

        // Enclosing block element
        if (editor.selection) {
          try {
            const blockEntry =
              editor.api?.block?.() ??
              Array.from(
                Editor.nodes(editor, {
                  match: (n) =>
                    SlateElement.isElement(n) &&
                    !editor.isInline(n as unknown as import("slate").Element) &&
                    !editor.isVoid(n as unknown as import("slate").Element),
                  mode: "lowest",
                })
              )[0];

            if (blockEntry) {
              const blockType = (blockEntry[0] as unknown as { type?: string }).type || "p";
              fmt.add(blockType);
              if (blockType === "p") fmt.add("paragraph");
              if (blockType === "paragraph") fmt.add("p");
            }
          } catch {
            /* best-effort block detection */
          }

          // Lists (ul, ol, li)
          try {
            const [listEntry] = Array.from(
              Editor.nodes(editor, {
                match: (n) =>
                  SlateElement.isElement(n) &&
                  ["ul", "ol", "li"].includes((n as unknown as { type?: string }).type ?? ""),
              })
            );
            if (listEntry) {
              const listType = (listEntry[0] as unknown as { type?: string }).type;
              if (listType === "ul" || listType === "ol") {
                fmt.add(listType);
              } else {
                fmt.add("ul");
              }
            }
          } catch {
            /* best-effort list detection */
          }

          // Table
          try {
            const [tableEntry] = Array.from(
              Editor.nodes(editor, {
                match: (n) =>
                  SlateElement.isElement(n) &&
                  ["table", "tr", "td", "th"].includes((n as unknown as { type?: string }).type ?? ""),
              })
            );
            if (tableEntry) {
              fmt.add("table");
            }
          } catch {
            /* best-effort table detection */
          }

          // Link
          try {
            const [linkEntry] = Array.from(
              Editor.nodes(editor, {
                match: (n) =>
                  SlateElement.isElement(n) &&
                  ["link", "a"].includes((n as unknown as { type?: string }).type ?? ""),
              })
            );
            if (linkEntry) {
              fmt.add("link");
            }
          } catch {
            /* best-effort link detection */
          }
        }
      } catch {
        /* best-effort editor AST inspection */
      }
    }

    const prev = lastActiveFormatsRef.current;
    if (prev.size === fmt.size) {
      let identical = true;
      for (const item of fmt) {
        if (!prev.has(item)) {
          identical = false;
          break;
        }
      }
      if (identical) {
        return;
      }
    }

    lastActiveFormatsRef.current = fmt;
    setActiveFormats(fmt);
  }, [editorRef]);

  // Automatically listen to native selection changes anywhere in the document
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleDocSelection = () => {
      refreshActiveFormats();
    };
    document.addEventListener("selectionchange", handleDocSelection);
    return () => {
      document.removeEventListener("selectionchange", handleDocSelection);
    };
  }, [refreshActiveFormats]);

  const toggleMark = useCallback(
    (mark: string) => {
      withEditor((editor) => {
        // 1. If Plate has native toggleMark on transforms
        if (editor.tf?.toggleMark) {
          editor.tf.toggleMark(mark);
          setIsDirty(true);
          refreshActiveFormats();
          return;
        }

        // 2. Otherwise determine active state from isFormatMarkActive or DOM
        const active = isFormatMarkActive(editor, mark) || getDomActiveFormats().has(mark);
        if (editor.tf?.addMark && editor.tf?.removeMark) {
          if (active) {
            editor.tf.removeMark(mark);
            if (mark === "strike") editor.tf.removeMark("strikethrough");
            if (mark === "sup") editor.tf.removeMark("superscript");
            if (mark === "sub") editor.tf.removeMark("subscript");
            if (mark === "code") editor.tf.removeMark("codeMark");
          } else {
            editor.tf.addMark(mark, true);
          }
        } else {
          try {
            if (active) {
              Editor.removeMark(editor, mark);
              if (mark === "strike") Editor.removeMark(editor, "strikethrough");
              if (mark === "sup") Editor.removeMark(editor, "superscript");
              if (mark === "sub") Editor.removeMark(editor, "subscript");
              if (mark === "code") Editor.removeMark(editor, "codeMark");
            } else {
              Editor.addMark(editor, mark, true);
            }
          } catch {
            /* best effort */
          }
        }
        setIsDirty(true);
        refreshActiveFormats();
      });
    },
    [withEditor, isFormatMarkActive, setIsDirty, refreshActiveFormats]
  );

  // ── Block transforms ─────────────────────────────────────────────────────

  const setType = useCallback(
    (type: string) => {
      withEditor((editor) => {
        Transforms.setNodes(editor, { type } as Partial<Descendant>, {
          match: (n) =>
            SlateElement.isElement(n) && !editor.isVoid(n as unknown as import("slate").Element),
          mode: "lowest",
        });
        setIsDirty(true);
      });
      refreshActiveFormats();
    },
    [withEditor, setIsDirty, refreshActiveFormats]
  );

  const toggleListBlock = useCallback(
    (editor: any, targetType: "ul" | "ol") => {
      if (!editor) return;

      Editor.withoutNormalizing(editor, () => {
        // If selection is null, focus editor start
        if (!editor.selection) {
          if (editor.children.length > 0) {
            Transforms.select(editor, Editor.start(editor, [0]));
          } else {
            Transforms.insertNodes(editor, { type: "p", children: [{ text: "" }] } as any);
            Transforms.select(editor, [0, 0]);
          }
        }

        // Check if currently inside a list
        const [existingListEntry] = Array.from(
          Editor.nodes(editor, {
            match: (n) =>
              SlateElement.isElement(n) && ((n as any).type === "ul" || (n as any).type === "ol"),
          })
        );

        if (existingListEntry) {
          const [listNode, listPath] = existingListEntry;
          const currentType = (listNode as any).type;

          if (currentType === targetType) {
            // Toggle off: unwrap ul/ol and convert li back to p
            Transforms.unwrapNodes(editor, {
              match: (n) =>
                SlateElement.isElement(n) &&
                ((n as any).type === "ul" || (n as any).type === "ol"),
              split: true,
            });
            Transforms.setNodes(
              editor,
              { type: "p" } as any,
              {
                match: (n) => SlateElement.isElement(n) && (n as any).type === "li",
              }
            );
          } else {
            // Switch list type (ul <-> ol)
            Transforms.setNodes(editor, { type: targetType } as any, { at: listPath });
          }
          return;
        }

        // Not in list: convert matching selected blocks to li and wrap in ul/ol
        Transforms.setNodes(
          editor,
          { type: "li", level: 1 } as any,
          {
            match: (n) =>
              SlateElement.isElement(n) &&
              !editor.isInline(n) &&
              (n as any).type !== "table" &&
              (n as any).type !== "tr" &&
              (n as any).type !== "td" &&
              (n as any).type !== "th",
            mode: "lowest",
          }
        );

        Transforms.wrapNodes(
          editor,
          { type: targetType, children: [] } as any,
          {
            match: (n) => SlateElement.isElement(n) && (n as any).type === "li",
            mode: "lowest",
          }
        );
      });
    },
    []
  );

  const exec = useCallback(
    (cmd: string, val?: string) => {
      switch (cmd) {
        case "bold":
        case "italic":
        case "underline":
        case "strikeThrough":
          toggleMark(MARK_MAP[cmd] ?? cmd);
          break;
        case "superscript":
          toggleMark("sup");
          break;
        case "subscript":
          toggleMark("sub");
          break;
        case "code":
          toggleMark("code");
          break;
        case "insertUnorderedList": {
          withEditor((editor) => {
            toggleListBlock(editor, "ul");
            setIsDirty(true);
          });
          break;
        }
        case "insertOrderedList": {
          withEditor((editor) => {
            toggleListBlock(editor, "ol");
            setIsDirty(true);
          });
          break;
        }
        case "indent": {
          withEditor((editor) => {
            const [liEntry] = Array.from(
              Editor.nodes(editor, {
                match: (n) => SlateElement.isElement(n) && (n as any).type === "li",
              })
            );
            if (liEntry) {
              const [liNode, liPath] = liEntry;
              const currentLevel = (liNode as any).level || 1;
              const newLevel = Math.min(currentLevel + 1, 6);
              Transforms.setNodes(editor, { level: newLevel } as any, { at: liPath });
              setIsDirty(true);
            }
          });
          break;
        }
        case "outdent": {
          withEditor((editor) => {
            const [liEntry] = Array.from(
              Editor.nodes(editor, {
                match: (n) => SlateElement.isElement(n) && (n as any).type === "li",
              })
            );
            if (liEntry) {
              const [liNode, liPath] = liEntry;
              const currentLevel = (liNode as any).level || 1;
              const newLevel = Math.max(currentLevel - 1, 1);
              Transforms.setNodes(editor, { level: newLevel } as any, { at: liPath });
              setIsDirty(true);
            }
          });
          break;
        }
        case "formatBlock": {
          if (val === "blockquote") {
            withEditor((editor) => {
              const [quoteEntry] = Editor.nodes(editor, {
                match: (n) => SlateElement.isElement(n) && (n as any).type === "blockquote",
              });
              setType(quoteEntry ? "p" : "blockquote");
            });
          }
          break;
        }
        case "undo":
          withEditor((editor) => {
            (editor as any).undo?.();
            setIsDirty(true);
          });
          break;
        case "redo":
          withEditor((editor) => {
            (editor as any).redo?.();
            setIsDirty(true);
          });
          break;
        case "removeFormat":
          withEditor((editor) => {
            const marks = Object.keys(Editor.marks(editor) ?? {});
            marks.forEach((m) => Editor.removeMark(editor, m));
            setIsDirty(true);
          });
          break;
        default:
          break;
      }
      editorRef.current?.focus?.();
      refreshActiveFormats();
    },
    [toggleMark, setType, toggleListBlock, withEditor, editorRef, setIsDirty, refreshActiveFormats]
  );

  const setHeading = useCallback(
    (level: number) => {
      withEditor((editor) => {
        const targetType = `h${Math.min(Math.max(level, 2), 4)}`;
        const [blockEntry] = Editor.nodes(editor, {
          match: (n) =>
            SlateElement.isElement(n) &&
            !editor.isInline(n as unknown as import("slate").Element) &&
            !editor.isVoid(n as unknown as import("slate").Element),
          mode: "lowest",
        });
        const currentType = (blockEntry?.[0] as unknown as { type?: string })?.type;
        const newType = currentType === targetType ? "p" : targetType;

        Transforms.setNodes(editor, { type: newType } as Partial<Descendant>, {
          match: (n) =>
            SlateElement.isElement(n) && !editor.isVoid(n as unknown as import("slate").Element),
          mode: "lowest",
        });
        setIsDirty(true);
      });
      editorRef.current?.focus?.();
      refreshActiveFormats();
    },
    [withEditor, setIsDirty, editorRef, refreshActiveFormats]
  );

  const setParagraph = useCallback(() => {
    setType("p");
    editorRef.current?.focus?.();
    refreshActiveFormats();
  }, [setType, editorRef, refreshActiveFormats]);

  // ── Links ────────────────────────────────────────────────────────────────

  const insertLink = useCallback(() => {
    withEditor((editor) => {
      const selectedText = Editor.string(editor, editor.selection ?? []);
      const url = window.prompt(
        "Enter URL or wiki page name:",
        selectedText.startsWith("http") ? selectedText : ""
      );
      if (!url) return;
      const internal = !/^https?:/i.test(url);
      const href = internal ? `/wiki/${encodeURIComponent(url.replace(/ /g, "_"))}` : url;
      Transforms.insertNodes(editor, {
        type: "link",
        url: href,
        internal,
        children: selectedText ? [{ text: selectedText }] : [{ text: url }],
      } as Descendant);
      setIsDirty(true);
    });
    editorRef.current?.focus?.();
  }, [withEditor, setIsDirty, editorRef]);

  const removeLink = useCallback(() => {
    withEditor((editor) => {
      Transforms.unwrapNodes(editor, {
        match: (n) =>
          SlateElement.isElement(n) && (n as unknown as { type?: string }).type === "link",
      });
      setIsDirty(true);
    });
    editorRef.current?.focus?.();
  }, [withEditor, setIsDirty, editorRef]);

  // ── Insertions ───────────────────────────────────────────────────────────

  const insertHR = useCallback(() => {
    withEditor((editor) => {
      Transforms.insertNodes(editor, { type: "hr", children: [{ text: "" }] } as Descendant);
      Transforms.insertNodes(editor, { type: "p", children: [{ text: "" }] } as Descendant);
      setIsDirty(true);
    });
  }, [withEditor, setIsDirty]);

  const insertTable = useCallback(() => {
    withEditor((editor) => {
      const cell = (t: "th" | "td", text: string) =>
        ({ type: t, children: [{ text }] }) as Descendant;
      const row = (cells: Descendant[]) => ({ type: "tr", children: cells }) as Descendant;
      Transforms.insertNodes(editor, {
        type: "table",
        attributes: 'class="wikitable"',
        children: [
          row([cell("th", "Header 1"), cell("th", "Header 2"), cell("th", "Header 3")]),
          row([cell("td", "Data 1"), cell("td", "Data 2"), cell("td", "Data 3")]),
          row([cell("td", "Data 4"), cell("td", "Data 5"), cell("td", "Data 6")]),
        ],
      } as Descendant);
      setIsDirty(true);
    });
  }, [withEditor, setIsDirty]);

  const insertRef = useCallback(() => {
    withEditor((editor) => {
      Transforms.insertNodes(editor, {
        type: "ref",
        label: "Citation needed",
        children: [{ text: "" }],
      } as Descendant);
      setIsDirty(true);
    });
  }, [withEditor, setIsDirty]);

  /** Insert a prepared custom node (chips, coords, map embeds). */
  const insertChip = useCallback(
    (chip: Record<string, unknown>) => {
      withEditor((editor) => {
        const node = { ...chip, id: nanoid() };
        Transforms.insertNodes(editor, node as unknown as Descendant);
        setIsDirty(true);
      });
    },
    [withEditor, setIsDirty]
  );

  const clearFormatting = useCallback(() => {
    exec("removeFormat");
    editorRef.current?.focus?.();
  }, [exec, editorRef]);

  // Legacy DOM-selection shims — retained because shared toolbar dropdowns
  // (StashDropdown / TemplateDropdown) still take onBeforeOpen handlers.
  const saveSelection = useCallback(() => {}, []);
  const restoreSelection = useCallback(() => {}, []);

  const insertHtmlAtCursor = useCallback(
    (html: string) => {
      withEditor((editor) => {
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const text = parsed.body.textContent ?? "";
        Transforms.insertNodes(editor, { text } as Descendant);
        setIsDirty(true);
      });
    },
    [withEditor, setIsDirty]
  );

  // ── Templates & media ────────────────────────────────────────────────────

  const handleInsertTemplate = useCallback(
    async (templateName: string, params: Record<string, string>) => {
      const dataMw = buildDataMw(templateName, params);

      if (
        templateName.startsWith("MyCountry:") ||
        templateName.startsWith("CountryData:") ||
        templateName.startsWith("BusinessData:")
      ) {
        withEditor((editor) => {
          const node: Record<string, unknown> = {
            type: "chip-engine",
            id: nanoid(),
            name: templateName,
            params,
            dataMw,
            label: params.label || templateName.split(":").pop() || templateName,
            wikitext: `{{${templateName}}}`,
            children: [{ text: "" }],
          };
          Transforms.insertNodes(editor, node as unknown as Descendant);
          setIsDirty(true);
        });
        return;
      }

      try {
        const paramParts = Object.entries(params)
          .filter(([, v]) => v.trim())
          .map(([k, v]) => `|${k}=${v}`);
        const wikitext = `{{${templateName}${paramParts.join("")}}}`;
        const preview = await renderTemplateCached(templateName, params);
        const result = { html: preview.html };
        withEditor((editor) => {
          Transforms.insertNodes(editor, {
            type: "raw-html",
            id: nanoid(),
            kind: /infobox/i.test(wikitext) ? "infobox" : "generic",
            name: templateName,
            params,
            dataMw,
            html: `<div typeof="mw:Transclusion" data-mw='${dataMw.replace(/'/g, "&#39;")}' class="wikios-ve-template">${fixEditorImageUrls(result.html)}</div>`,
            wikitext,
            children: [{ text: "" }],
          } as Descendant);
          setIsDirty(true);
        });
      } catch (err) {
        console.error("Failed to render template:", err);
      }
    },
    // oxlint-disable-next-line
    [previewMutation, title, withEditor, setIsDirty]
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
        withEditor((editor) => {
          Transforms.insertNodes(editor, {
            type: "media",
            id: nanoid(),
            html: figure.outerHTML,
            filename: figure.querySelector("img")?.getAttribute("alt") ?? undefined,
            wikitext: imageWikitext,
            children: [{ text: "" }],
          } as Descendant);
          setIsDirty(true);
        });
      } catch (err) {
        console.error("Failed to render image:", err);
      }
    },
    [previewMutation, title, withEditor, setIsDirty]
  );

  const handleTemplateUpdate = useCallback(
    async (newParams: Record<string, string>) => {
      if (!editingTemplate) return;
      const { id, name } = editingTemplate;

      withEditor((editor) => {
        const entries = Array.from(
          Editor.nodes(editor, {
            at: [],
            match: (n) => (n as unknown as { id?: string }).id === id,
          })
        );
        if (entries.length === 0) return;
        const [node, path] = entries[0]! as [Node, import("slate").Path];
        const dataMw = buildDataMw(name, newParams);
        const rebuiltWikitext = `{{${name}${Object.entries(newParams)
          .filter(([, v]) => v.trim())
          .map(([k, v]) => `|${k}=${v}`)
          .join("")}}}`;

        if ((node as unknown as { type?: string }).type === "chip-engine") {
          Transforms.setNodes(
            editor,
            { params: newParams, dataMw, wikitext: rebuiltWikitext } as Partial<Descendant>,
            { at: path }
          );
        } else {
          void previewMutation
            .mutateAsync({ wikitext: rebuiltWikitext, title })
            .then((result) => {
              Transforms.setNodes(
                editor,
                {
                  params: newParams,
                  dataMw,
                  wikitext: rebuiltWikitext,
                  html: `<div typeof="mw:Transclusion" data-mw='${buildDataMw(name, newParams).replace(/'/g, "&#39;")}' class="wikios-ve-template">${fixEditorImageUrls(result.html)}</div>`,
                } as Partial<Descendant>,
                { at: path }
              );
            })
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
      const entries = Array.from(
        Editor.nodes(editor, { at: [], match: (n) => (n as unknown as { id?: string }).id === id })
      );
      if (entries.length > 0) {
        Transforms.removeNodes(editor, { at: entries[0]![1] });
        setIsDirty(true);
      }
    });
    setEditingTemplate(null);
  }, [editingTemplate, withEditor, setIsDirty]);

  return {
    activeFormats,
    editingTemplate,
    setEditingTemplate,
    saveSelection,
    restoreSelection,
    insertHtmlAtCursor,
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
