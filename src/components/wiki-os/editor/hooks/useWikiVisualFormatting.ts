// src/components/wiki-os/editor/hooks/useWikiVisualFormatting.ts
// Visual editing via Plate/Slate transforms. Preserves the original hook's
// public interface so toolbars and modal hosts need no changes.

"use client";

import { useState, useRef, useCallback } from "react";
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
  const savedRangeRef = useRef<Range | null>(null);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [editingTemplate, setEditingTemplate] = useState<EditingTemplateRef | null>(null);

  const previewMutation = api.wikios.previewWikitext.useMutation();

  const withEditor = useCallback(
    <T,>(fn: (editor: PlateEditorLike) => T): T | undefined => {
      const editor = editorRef.current;
      if (!editor) return undefined;
      return fn(editor);
    },
    [editorRef]
  );

  // ── Marks ────────────────────────────────────────────────────────────────

  const toggleMark = useCallback(
    (mark: string) => {
      withEditor((editor) => {
        const marks = (Editor.marks(editor) ?? {}) as any;
        const active = Boolean(marks[mark]);
        if (active) {
          Editor.removeMark(editor, mark);
        } else {
          Editor.addMark(editor, mark, true);
        }
        setIsDirty(true);
      });
    },
    [withEditor, setIsDirty]
  );

  /** Refresh toolbar highlight state from current marks + block type. */
  const refreshActiveFormats = useCallback(() => {
    withEditor((editor) => {
      const fmt = new Set<string>();
      const marks = Editor.marks(editor) as any ?? {};
      for (const m of ["bold", "italic", "underline", "strike", "sup", "sub"]) {
        if (marks[m]) fmt.add(m === "strike" ? "strikethrough" : m);
      }
      const [entry] = Editor.nodes(editor, {
        match: (n) => SlateElement.isElement(n) && ["ul", "ol"].includes((n as unknown as { type?: string }).type ?? ""),
      });
      if (entry) fmt.add(((entry[0] as unknown as { type?: string }).type) ?? "");
      setActiveFormats(fmt);
    });
  }, [withEditor]);

  // ── Block transforms ─────────────────────────────────────────────────────

  const setType = useCallback(
    (type: string) => {
      withEditor((editor) => {
        Transforms.setNodes(
          editor,
          { type } as Partial<Descendant>,
          { match: (n) => SlateElement.isElement(n) && !editor.isVoid(n as unknown as import("slate").Element), mode: "lowest" }
        );
        setIsDirty(true);
      });
    },
    [withEditor, setIsDirty]
  );

  const exec = useCallback(
    (cmd: string) => {
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
        case "insertUnorderedList":
          setType("ul");
          break;
        case "insertOrderedList":
         setType("ol");
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
    },
    [toggleMark, setType, withEditor, editorRef]
  );

  const setHeading = useCallback(
    (level: number) => {
      setType(`h${Math.min(Math.max(level, 2), 4)}`);
      editorRef.current?.focus?.();
    },
    [setType, editorRef]
  );

  const setParagraph = useCallback(() => {
    setType("p");
    editorRef.current?.focus?.();
  }, [setType, editorRef]);

  // ── Links ────────────────────────────────────────────────────────────────

  const insertLink = useCallback(() => {
    withEditor((editor) => {
      const selectedText = Editor.string(editor, editor.selection ?? []);
      const url = window.prompt("Enter URL or wiki page name:", selectedText.startsWith("http") ? selectedText : "");
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
      Transforms.unwrapNodes(editor, { match: (n) => SlateElement.isElement(n) && (n as unknown as { type?: string }).type === "link" });
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
        children: [
          row([cell("th", "Header 1"), cell("th", "Header 2")]),
          row([cell("td", "Cell 1"), cell("td", "Cell 2")]),
        ],
      } as Descendant);
      setIsDirty(true);
    });
  }, [withEditor, setIsDirty]);

  const insertRef = useCallback(() => {
    withEditor((editor) => {
      Transforms.insertNodes(editor, { type: "ref", label: "Citation needed", children: [{ text: "" }] } as Descendant);
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

  // Legacy DOM-selection shims — retained so existing toolbar wiring keeps working.
  const saveSelection = useCallback(() => {}, []);
  const restoreSelection = useCallback(() => {}, []);
  const insertNodeAtCursor = useCallback((_node: Node) => {}, []);

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
        const entries = Array.from(Editor.nodes(editor, { at: [], match: (n) => (n as unknown as { id?: string }).id === id }));
        if (entries.length === 0) return;
        const [node, path] = entries[0]! as [Node, import("slate").Path];
        const dataMw = buildDataMw(name, newParams);
        const rebuiltWikitext = `{{${name}${Object.entries(newParams).filter(([, v]) => v.trim()).map(([k, v]) => `|${k}=${v}`).join("")}}}`;

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
      const entries = Array.from(Editor.nodes(editor, { at: [], match: (n) => (n as unknown as { id?: string }).id === id }));
      if (entries.length > 0) {
        Transforms.removeNodes(editor, { at: entries[0]![1] });
        setIsDirty(true);
      }
    });
    setEditingTemplate(null);
  }, [editingTemplate, withEditor, setIsDirty]);

  return {
    savedRangeRef,
    activeFormats,
    editingTemplate,
    setEditingTemplate,
    saveSelection,
    restoreSelection,
    insertNodeAtCursor,
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
