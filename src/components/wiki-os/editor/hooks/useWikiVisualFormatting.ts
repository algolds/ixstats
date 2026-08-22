// src/components/wiki-os/editor/hooks/useWikiVisualFormatting.ts
// Visual editing DOM manipulation, formatting commands, and Parsoid data-mw protection.

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { api } from "~/trpc/react";
import { fixEditorImageUrls } from "~/lib/wiki-os/transformers/fix-editor-images";
import { getChipClassName, getChipInnerHTML } from "../utils/wiki-chips";

export interface UseWikiVisualFormattingProps {
  title: string;
  editableRef: React.RefObject<HTMLDivElement | null>;
  setIsDirty: (val: boolean) => void;
}

export function useWikiVisualFormatting({
  title,
  editableRef,
  setIsDirty,
}: UseWikiVisualFormattingProps) {
  const savedRangeRef = useRef<Range | null>(null);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [editingTemplate, setEditingTemplate] = useState<{
    element: HTMLElement;
    name: string;
    params: Record<string, string>;
  } | null>(null);

  const previewMutation = api.wikios.previewWikitext.useMutation();

  // Protect template transclusions and custom chips in the contenteditable DOM
  const protectTemplatesAndImages = useCallback((el: HTMLElement) => {
    const protectedAbouts = new Set<string>();
    el.querySelectorAll('[typeof*="mw:Transclusion"]').forEach((tmpl) => {
      const htmlEl = tmpl as HTMLElement;
      htmlEl.contentEditable = "false";

      try {
        const dataMw = JSON.parse(htmlEl.getAttribute("data-mw") ?? "{}");
        const wtName = dataMw.parts?.[0]?.template?.target?.wt ?? "";
        if (
          wtName.startsWith("MyCountry:") ||
          wtName.startsWith("CountryData:") ||
          wtName.startsWith("BusinessData:")
        ) {
          htmlEl.className = getChipClassName(wtName);
          htmlEl.innerHTML = getChipInnerHTML(wtName);
          return;
        }
      } catch {
        // ignore
      }

      const about = htmlEl.getAttribute("about");
      if (about) protectedAbouts.add(about);
    });

    protectedAbouts.forEach((about) => {
      el.querySelectorAll(`[about="${about}"]`).forEach((member) => {
        const htmlEl = member as HTMLElement;
        htmlEl.contentEditable = "false";

        if (
          htmlEl.tagName === "TABLE" &&
          (htmlEl.classList.contains("infobox") || htmlEl.className.includes("infobox"))
        ) {
          htmlEl.classList.add("wikios-ve-infobox");
        } else if (htmlEl.tagName !== "STYLE" && htmlEl.tagName !== "LINK") {
          htmlEl.classList.add("wikios-ve-template");
        }
      });
    });

    el.querySelectorAll('[typeof*="mw:Transclusion"]:not([about])').forEach((tmpl) => {
      const htmlEl = tmpl as HTMLElement;
      if (htmlEl.classList.contains("wikios-ve-custom-chip")) return;
      htmlEl.contentEditable = "false";
      htmlEl.classList.add("wikios-ve-template");
    });

    el.querySelectorAll("a").forEach((anchor) => {
      const href = anchor.getAttribute("href") || "";
      const titleAttr = anchor.getAttribute("title") || "";
      let decodedHref: string;
      try {
        decodedHref = decodeURIComponent(href);
      } catch {
        decodedHref = href;
      }
      let decodedTitle: string;
      try {
        decodedTitle = decodeURIComponent(titleAttr);
      } catch {
        decodedTitle = titleAttr;
      }

      if (decodedHref.includes("Coords:") || decodedTitle.includes("Coords:")) {
        const coordsMatch =
          decodedHref.match(/Coords:([^?#&]+)/i) || decodedTitle.match(/Coords:([^?#&]+)/i);
        if (coordsMatch && coordsMatch[1]) {
          anchor.contentEditable = "false";
          anchor.className = "wikios-ve-custom-chip chip-coords";
          const label = anchor.innerText.trim() || "Location";
          anchor.innerHTML = `<span class="opacity-70">📍</span> ${label}`;
        }
      } else if (decodedHref.includes("MapEmbed:") || decodedTitle.includes("MapEmbed:")) {
        const embedMatch =
          decodedHref.match(/MapEmbed:([^?#&]+)/i) || decodedTitle.match(/MapEmbed:([^?#&]+)/i);
        if (embedMatch && embedMatch[1]) {
          anchor.contentEditable = "false";
          anchor.className = "wikios-ve-custom-chip chip-mapembed";
          anchor.innerHTML = `<span class="opacity-70">🗺️</span> Map Embed`;
        }
      }
    });

    el.querySelectorAll('[typeof*="mw:File"]').forEach((fig) => {
      (fig as HTMLElement).contentEditable = "false";
      fig.classList.add("wikios-ve-media");
    });
  }, []);

  // Track selection state for active toolbar highlights
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (
        !sel ||
        sel.rangeCount === 0 ||
        !editableRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)
      ) {
        return;
      }
      const fmt = new Set<string>();
      try {
        if (document.queryCommandState("bold")) fmt.add("bold");
        if (document.queryCommandState("italic")) fmt.add("italic");
        if (document.queryCommandState("underline")) fmt.add("underline");
        if (document.queryCommandState("strikeThrough")) fmt.add("strikethrough");
        if (document.queryCommandState("superscript")) fmt.add("superscript");
        if (document.queryCommandState("subscript")) fmt.add("subscript");
        if (document.queryCommandState("insertUnorderedList")) fmt.add("ul");
        if (document.queryCommandState("insertOrderedList")) fmt.add("ol");
      } catch {
        /* ignore */
      }
      setActiveFormats(fmt);
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [editableRef]);

  // Event delegation for clicking templates and infoboxes
  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const clickTarget = e.target as HTMLElement;

      let tmplEl = clickTarget.closest('[typeof*="mw:Transclusion"]') as HTMLElement | null;

      if (!tmplEl) {
        const aboutEl = clickTarget.closest("[about]") as HTMLElement | null;
        if (aboutEl) {
          const about = aboutEl.getAttribute("about");
          if (about) {
            tmplEl = el.querySelector(
              `[about="${about}"][typeof*="mw:Transclusion"]`
            ) as HTMLElement | null;
          }
        }
      }

      if (!tmplEl) {
        const protectedEl = clickTarget.closest(
          ".wikios-ve-template, .wikios-ve-infobox"
        ) as HTMLElement | null;
        if (protectedEl) {
          const about = protectedEl.getAttribute("about");
          if (about) {
            tmplEl = el.querySelector(`[about="${about}"][data-mw]`) as HTMLElement | null;
          }
        }
      }

      if (!tmplEl) return;

      e.preventDefault();
      e.stopPropagation();
      try {
        const dataMw = JSON.parse(tmplEl.getAttribute("data-mw") ?? "{}");
        const tmpl = dataMw.parts?.[0]?.template;
        const name = tmpl?.target?.wt ?? "Template";
        const params: Record<string, string> = {};
        if (tmpl?.params) {
          for (const [k, v] of Object.entries(tmpl.params)) {
            params[k] = (v as { wt?: string }).wt ?? String(v);
          }
        }
        const visibleEl =
          (clickTarget.closest(
            '.wikios-ve-infobox, .wikios-ve-template, [typeof*="mw:Transclusion"]'
          ) as HTMLElement) ?? tmplEl;
        setEditingTemplate({ element: visibleEl, name, params });
      } catch {
        /* ignore */
      }
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, [editableRef]);

  // Selection preservation
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editableRef.current?.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  }, [editableRef]);

  const restoreSelection = useCallback(() => {
    const range = savedRangeRef.current;
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []);

  const insertNodeAtCursor = useCallback(
    (node: Node) => {
      restoreSelection();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(node);
        range.collapse(false);
      } else {
        editableRef.current?.appendChild(node);
      }
      setIsDirty(true);
    },
    [editableRef, restoreSelection, setIsDirty]
  );

  const insertHtmlAtCursor = useCallback(
    (html: string) => {
      restoreSelection();
      editableRef.current?.focus();
      document.execCommand("insertHTML", false, html);
      setIsDirty(true);
    },
    [editableRef, restoreSelection, setIsDirty]
  );

  // Formatting execution helpers
  const exec = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editableRef.current?.focus();
  }, [editableRef]);

  const setHeading = useCallback((level: number) => {
    document.execCommand("formatBlock", false, `h${level}`);
    editableRef.current?.focus();
  }, [editableRef]);

  const setParagraph = useCallback(() => {
    document.execCommand("formatBlock", false, "p");
    editableRef.current?.focus();
  }, [editableRef]);

  const insertLink = useCallback(() => {
    const sel = window.getSelection();
    const selectedText = sel?.toString() ?? "";
    const url = window.prompt(
      "Enter URL or wiki page name:",
      selectedText.startsWith("http") ? selectedText : ""
    );
    if (url) {
      document.execCommand("createLink", false, url);
      editableRef.current?.focus();
    }
  }, [editableRef]);

  const removeLink = useCallback(() => {
    document.execCommand("unlink");
    editableRef.current?.focus();
  }, [editableRef]);

  const insertHR = useCallback(() => {
    document.execCommand("insertHorizontalRule");
    editableRef.current?.focus();
    setIsDirty(true);
  }, [editableRef, setIsDirty]);

  const insertTable = useCallback(() => {
    const html =
      '<table style="border-collapse:collapse;width:100%"><tbody><tr><th style="border:1px solid rgba(255,255,255,0.1);padding:4px 8px">Header 1</th><th style="border:1px solid rgba(255,255,255,0.1);padding:4px 8px">Header 2</th></tr><tr><td style="border:1px solid rgba(255,255,255,0.1);padding:4px 8px">Cell 1</td><td style="border:1px solid rgba(255,255,255,0.1);padding:4px 8px">Cell 2</td></tr></tbody></table>';
    insertHtmlAtCursor(html);
  }, [insertHtmlAtCursor]);

  const insertRef = useCallback(() => {
    insertHtmlAtCursor("<sup><ref>Citation needed</ref></sup>");
  }, [insertHtmlAtCursor]);

  const clearFormatting = useCallback(() => {
    document.execCommand("removeFormat");
    editableRef.current?.focus();
  }, [editableRef]);

  // Insert template handler
  const handleInsertTemplate = useCallback(
    async (templateName: string, params: Record<string, string>) => {
      if (
        templateName.startsWith("MyCountry:") ||
        templateName.startsWith("CountryData:") ||
        templateName.startsWith("BusinessData:")
      ) {
        const dataMw = JSON.stringify({
          parts: [
            {
              template: {
                target: { wt: templateName },
                params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, { wt: v }])),
              },
            },
          ],
        });
        const wrapper = document.createElement("span");
        wrapper.setAttribute("typeof", "mw:Transclusion");
        wrapper.setAttribute("data-mw", dataMw);
        wrapper.contentEditable = "false";
        wrapper.className = getChipClassName(templateName);
        wrapper.innerHTML = getChipInnerHTML(templateName);
        insertNodeAtCursor(wrapper);
        setIsDirty(true);
        return;
      }

      const paramParts = Object.entries(params)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => `|${k}=${v}`);
      const wikitext = `{{${templateName}${paramParts.join("")}}}`;
      try {
        const result = await previewMutation.mutateAsync({ wikitext, title });
        const dataMw = JSON.stringify({
          parts: [
            {
              template: {
                target: { wt: templateName },
                params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, { wt: v }])),
              },
            },
          ],
        });
        const wrapper = document.createElement("div");
        wrapper.setAttribute("typeof", "mw:Transclusion");
        wrapper.setAttribute("data-mw", dataMw);
        wrapper.contentEditable = "false";
        wrapper.classList.add("wikios-ve-template");
        wrapper.innerHTML = fixEditorImageUrls(result.html);
        insertNodeAtCursor(wrapper);
      } catch (err) {
        console.error("Failed to render template:", err);
      }
    },
    [previewMutation, title, insertNodeAtCursor, setIsDirty]
  );

  // Insert image handler
  const handleInsertImage = useCallback(
    async (imageWikitext: string) => {
      try {
        const result = await previewMutation.mutateAsync({ wikitext: imageWikitext, title });
        const temp = document.createElement("div");
        temp.innerHTML = fixEditorImageUrls(result.html);
        const figure = temp.querySelector("figure, .thumb, img");
        if (figure) {
          (figure as HTMLElement).contentEditable = "false";
          figure.classList.add("wikios-ve-media");
          insertNodeAtCursor(figure);
        }
      } catch (err) {
        console.error("Failed to render image:", err);
      }
    },
    [previewMutation, title, insertNodeAtCursor]
  );

  // Update existing template in DOM
  const handleTemplateUpdate = useCallback(
    async (newParams: Record<string, string>) => {
      if (!editingTemplate) return;
      const { element, name } = editingTemplate;

      if (
        name.startsWith("MyCountry:") ||
        name.startsWith("CountryData:") ||
        name.startsWith("BusinessData:")
      ) {
        const dataMw = JSON.stringify({
          parts: [
            {
              template: {
                target: { wt: name },
                params: Object.fromEntries(
                  Object.entries(newParams).map(([k, v]) => [k, { wt: v }])
                ),
              },
            },
          ],
        });
        element.setAttribute("data-mw", dataMw);
        element.innerHTML = getChipInnerHTML(name);
        setEditingTemplate(null);
        setIsDirty(true);
        return;
      }

      const paramParts = Object.entries(newParams)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => `|${k}=${v}`);
      const wikitext = `{{${name}${paramParts.join("")}}}`;
      try {
        const result = await previewMutation.mutateAsync({ wikitext, title });
        const dataMw = JSON.stringify({
          parts: [
            {
              template: {
                target: { wt: name },
                params: Object.fromEntries(
                  Object.entries(newParams).map(([k, v]) => [k, { wt: v }])
                ),
              },
            },
          ],
        });
        element.setAttribute("data-mw", dataMw);
        element.innerHTML = fixEditorImageUrls(result.html);
        setEditingTemplate(null);
        setIsDirty(true);
      } catch (err) {
        console.error("Failed to update template:", err);
      }
    },
    [editingTemplate, previewMutation, title, setIsDirty]
  );

  return {
    savedRangeRef,
    activeFormats,
    editingTemplate,
    setEditingTemplate,
    protectTemplatesAndImages,
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
  };
}
