// src/components/wiki-os/editor/WikiVisualEditor.tsx
// Hybrid visual editor — Parsoid HTML in contenteditable with React toolbar.
// Templates render as live HTML with click-to-edit. Preserves data-mw for roundtrip.

"use client";
import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { useNavigationScroll } from "~/hooks/useNavigationScroll";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Superscript,
  Subscript,
  List,
  ListOrdered,
  Quote,
  Link2,
  Unlink,
  Image as ImageIcon,
  Puzzle,
  Save,
  X,
  FileText,
  Loader2,
  Code,
  Minus,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  RemoveFormatting,
  Table,
  Indent,
  Outdent,
  Bookmark,
  ChevronDown,
  // eslint-disable-next-line unused-imports/no-unused-imports
  ChevronRight,
  Copy,
  Check,
  Sparkles,
  Map as MapIcon,
  FileCode,
  Globe,
  Crown,
  Settings,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { CANVAS_VERSION } from "~/lib/buildVersion";
import {
  DynamicIslandEffects,
  DYNAMIC_ISLAND_STYLE,
  DYNAMIC_ISLAND_BORDER_CLASS,
} from "~/app/builder/components/glass";

import { TemplateInserter } from "~/components/wiki-os/editor/TemplateInserter";
import { ImageSearchModal } from "~/components/wiki-os/editor/ImageSearchModal";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import {
  InfoboxCountryModal,
  CountryStatsModal,
  BusinessStatsModal,
  MapCoordsModal,
} from "~/components/wiki-os/editor/WikiTemplateModals";
import { AppleSwitch } from "~/components/ui/apple-switch";
import { useNotify } from "~/hooks/useNotify";
import { fixEditorImageUrls } from "~/lib/wiki-os/fix-editor-images";

interface WikiVisualEditorProps {
  initialHtml: string;
  title: string;
  onSave: (
    html: string,
    summary: string,
    minor: boolean,
    keepEditing?: boolean
  ) => Promise<void> | void;
  onCancel: () => void;
  onSwitchToSource: (dirty: boolean, currentHtml: string) => void;
}

export function WikiVisualEditor({
  initialHtml,
  title,
  onSave,
  onCancel,
  onSwitchToSource,
}: WikiVisualEditorProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [summary, setSummary] = useState("");
  const [minor, setMinor] = useState(false);
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [showTemplateInserter, setShowTemplateInserter] = useState(false);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [showInfoboxModal, setShowInfoboxModal] = useState(false);
  const [showCountryStatsModal, setShowCountryStatsModal] = useState(false);
  const [showBusinessStatsModal, setShowBusinessStatsModal] = useState(false);
  const [showMapCoordsModal, setShowMapCoordsModal] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [editingTemplate, setEditingTemplate] = useState<{
    element: HTMLElement;
    name: string;
    params: Record<string, string>;
  } | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const [saveDropdownOpen, setSaveDropdownOpen] = useState(false);
  const [saveActionType, setSaveActionType] = useState<"publish" | "session">("publish");
  const { scrollY } = useNavigationScroll();
  const repulsionProgress = Math.min(1, Math.max(0, scrollY / 56));
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [enableAutocomplete, setEnableAutocomplete] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("wikios-editor-autocomplete") !== "false";
    }
    return true;
  });

  const handleToggleAutocomplete = useCallback((val: boolean) => {
    setEnableAutocomplete(val);
    localStorage.setItem("wikios-editor-autocomplete", String(val));
  }, []);

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [stashesOpen, setStashesOpen] = useState(false);

  const previewMutation = api.wikios.previewWikitext.useMutation();

  // --- Stashed Images Setup ---
  const stashesQuery = api.wikios.getStashes.useQuery(undefined, {
    staleTime: 30_000,
  });
  const stashes = stashesQuery.data || [];
  const defaultStash = stashes.find((s) => s.isDefault) || stashes[0];
  const [selectedStashId, setSelectedStashId] = useState<string | null>(null);
  const activeStashId = selectedStashId || defaultStash?.id || "";

  const stashItemsQuery = api.wikios.getStashItems.useQuery(
    { stashId: activeStashId, limit: 50 },
    { enabled: !!activeStashId, staleTime: 10_000 }
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stashItems = stashItemsQuery.data?.items || [];

  const imageItems = useMemo(() => {
    return stashItems.filter((item) => item.pageTitle.startsWith("commons:"));
  }, [stashItems]);

  const imageTitles = useMemo(() => {
    return imageItems.map((item) => item.pageTitle.replace(/^commons:/, ""));
  }, [imageItems]);

  const { data: resolvedImages } = api.commons.getImageInfoByTitles.useQuery(
    { titles: imageTitles },
    { enabled: imageTitles.length > 0, staleTime: 5 * 60 * 1000 }
  );

  const imagesMap = useMemo(() => {
    const map = new Map<string, any>();
    if (resolvedImages) {
      for (const img of resolvedImages) {
        map.set(`commons:${img.title}`, img);
      }
    }
    return map;
  }, [resolvedImages]);

  const protectTemplatesAndImages = useCallback((el: HTMLElement) => {
    // Protect template transclusions.
    // Parsoid uses `about` attributes to group elements belonging to the same transclusion.
    // The `typeof="mw:Transclusion"` may be on a <style> tag while the visible <table> shares the same `about`.
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
      } catch (err) {
        // ignore
      }

      const about = htmlEl.getAttribute("about");
      if (about) protectedAbouts.add(about);
    });

    // Protect all elements in the same transclusion group
    protectedAbouts.forEach((about) => {
      el.querySelectorAll(`[about="${about}"]`).forEach((member) => {
        const htmlEl = member as HTMLElement;
        htmlEl.contentEditable = "false";

        // Infobox tables — keep their natural float positioning, use subtle overlay
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

    // Protect standalone templates not using about groups
    el.querySelectorAll('[typeof*="mw:Transclusion"]:not([about])').forEach((tmpl) => {
      const htmlEl = tmpl as HTMLElement;
      if (htmlEl.classList.contains("wikios-ve-custom-chip")) return;
      htmlEl.contentEditable = "false";
      htmlEl.classList.add("wikios-ve-template");
    });

    // Protect and format Coordinates and MapEmbed links
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

    // Protect images/files
    el.querySelectorAll('[typeof*="mw:File"]').forEach((fig) => {
      (fig as HTMLElement).contentEditable = "false";
      fig.classList.add("wikios-ve-media");
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Mount Parsoid HTML + protect templates/images
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    el.innerHTML = fixEditorImageUrls(initialHtml);
    protectTemplatesAndImages(el);
    setWordCount(el.innerText.split(/\s+/).filter(Boolean).length);
  }, [initialHtml, protectTemplatesAndImages]);

  // Check for local HTML draft on mount
  useEffect(() => {
    const draft = localStorage.getItem(`wikios-draft-html-${title}`);
    if (draft && draft !== initialHtml) {
      const timer = setTimeout(() => {
        const restore = window.confirm(
          `An unsaved local draft from a previous session was found for "${title}". Would you like to restore it?`
        );
        if (restore && editableRef.current) {
          editableRef.current.innerHTML = fixEditorImageUrls(draft);
          protectTemplatesAndImages(editableRef.current);
          setIsDirty(true);
          setWordCount(editableRef.current.innerText.split(/\s+/).filter(Boolean).length);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    return;
  }, [title, initialHtml, protectTemplatesAndImages]);

  // ---------------------------------------------------------------------------
  // Selection state tracking — powers toolbar active indicators
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handler = () => {
      // Only inspect formatting state when the selection is inside this editor —
      // otherwise every selection anywhere on the page runs 8 queryCommandState calls.
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
  }, []);

  // ---------------------------------------------------------------------------
  // Template click handler (event delegation)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const clickTarget = e.target as HTMLElement;

      // Direct match: element has typeof="mw:Transclusion"
      let tmplEl = clickTarget.closest('[typeof*="mw:Transclusion"]') as HTMLElement | null;

      // Indirect match: element is inside a protected template/infobox (shares `about` attribute)
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

      // Also match clicks on .wikios-ve-infobox or .wikios-ve-template
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
        // Store the visible element (table/div) as the target for DOM updates
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
  }, []);

  // ---------------------------------------------------------------------------
  // Dirty tracking, word count, beforeunload
  // ---------------------------------------------------------------------------
  const handleInput = useCallback(() => {
    setIsDirty(true);
    if (editableRef.current) {
      setWordCount(editableRef.current.innerText.split(/\s+/).filter(Boolean).length);
    }
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ---------------------------------------------------------------------------
  // Selection save/restore for modal interactions
  // ---------------------------------------------------------------------------
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editableRef.current?.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  }, []);

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
    [restoreSelection]
  );

  const insertHtmlAtCursor = useCallback(
    (html: string) => {
      restoreSelection();
      editableRef.current?.focus();
      document.execCommand("insertHTML", false, html);
      setIsDirty(true);
    },
    [restoreSelection]
  );

  // ---------------------------------------------------------------------------
  // Format commands
  // ---------------------------------------------------------------------------
  const exec = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editableRef.current?.focus();
  }, []);

  const setHeading = useCallback((level: number) => {
    document.execCommand("formatBlock", false, `h${level}`);
    editableRef.current?.focus();
  }, []);

  const setParagraph = useCallback(() => {
    document.execCommand("formatBlock", false, "p");
    editableRef.current?.focus();
  }, []);

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
  }, []);

  const removeLink = useCallback(() => {
    document.execCommand("unlink");
    editableRef.current?.focus();
  }, []);

  const insertHR = useCallback(() => {
    document.execCommand("insertHorizontalRule");
    editableRef.current?.focus();
    setIsDirty(true);
  }, []);

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
  }, []);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------
  const handleSave = useCallback(async () => {
    const html = editableRef.current?.innerHTML ?? "";
    setSaving(true);
    const isSession = saveActionType === "session";
    try {
      await onSave(html, summary, minor, isSession);
      localStorage.removeItem(`wikios-draft-html-${title}`); // Clear draft
      setIsDirty(false);
      setShowSavePanel(false);
      notify.success(
        isSession ? "Session Saved" : "Article Published",
        isSession
          ? "Your progress has been saved successfully."
          : "Your changes have been published to the wiki."
      );
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [onSave, summary, minor, title, saveActionType, notify]);

  const handleSaveDraft = useCallback(() => {
    const html = editableRef.current?.innerHTML ?? "";
    try {
      localStorage.setItem(`wikios-draft-html-${title}`, html);
      setIsDirty(false);
      notify.success("Draft Saved", "Your draft has been saved locally.");
    } catch (err) {
      console.error("Failed to save draft:", err);
      notify.error("Save Draft Failed", "Could not write draft to local storage.");
    }
  }, [title, notify]);

  // ---------------------------------------------------------------------------
  // Template insertion
  // ---------------------------------------------------------------------------
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
    [previewMutation, title, insertNodeAtCursor]
  );

  // ---------------------------------------------------------------------------
  // Image insertion
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Template update (after editing params)
  // ---------------------------------------------------------------------------
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
    [editingTemplate, previewMutation, title]
  );

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            exec("bold");
            break;
          case "i":
            e.preventDefault();
            exec("italic");
            break;
          case "u":
            e.preventDefault();
            exec("underline");
            break;
          case "k":
            e.preventDefault();
            insertLink();
            break;
          case "s":
            e.preventDefault();
            handleSave();
            break;
          case "z":
            /* browser native undo */ break;
          case "y":
            /* browser native redo */ break;
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case "x":
            e.preventDefault();
            exec("strikeThrough");
            break;
          case "z":
            /* browser native redo */ break;
        }
      }
    },
    [exec, insertLink, handleSave]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="wikios-ve-container">
      {/* Title bar */}
      <div className="wikios-ve-titlebar">
        <div className="wikios-ve-titlebar-left">
          <span className="wikios-ve-titlebar-name">
            <span className="mr-1 font-medium opacity-50">Editing</span>
            <span className="mr-1.5 opacity-30">:</span>
            {title}
          </span>
          {isDirty && (
            <span className="wikios-ve-dirty ml-1.5 text-[10px] font-semibold text-[var(--wikios-accent)] uppercase opacity-80">
              Unsaved
            </span>
          )}
        </div>

        {/* Center: Apple-style switch toggle */}
        <div className="wikios-ve-titlebar-center">
          <motion.div
            className={cn(
              "relative z-10 flex cursor-pointer items-center overflow-hidden rounded-full px-5 py-1.5 text-xs font-semibold select-none",
              DYNAMIC_ISLAND_BORDER_CLASS
            )}
            animate={{
              y: -repulsionProgress * 40,
              scale: 1 - repulsionProgress * 0.1,
              gap: 10 - repulsionProgress * 2,
              opacity: 1 - repulsionProgress,
              pointerEvents: repulsionProgress > 0.5 ? "none" : "auto",
              boxShadow:
                repulsionProgress > 0 && repulsionProgress < 0.8
                  ? `0 0 ${(1 - repulsionProgress) * 12}px rgba(59, 130, 246, ${(1 - repulsionProgress) * 0.4})`
                  : "none",
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
              mass: 1,
            }}
            style={DYNAMIC_ISLAND_STYLE}
            title="Toggle Editing Mode (Source / Canvas)"
          >
            <DynamicIslandEffects glowOpacity={0.5} showGlow={true} showShimmer={true} />
            <span
              style={{
                color: "var(--wikios-text-dim)",
                opacity: 1 - repulsionProgress * 0.25,
              }}
              className="relative z-10 transition-colors duration-150"
            >
              Source
            </span>
            <div className="relative z-10">
              <AppleSwitch
                checked={true}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    const currentHtml = editableRef.current?.innerHTML ?? "";
                    onSwitchToSource(isDirty, currentHtml);
                  }
                }}
                size="sm"
                tone="accent"
              />
            </div>
            <span
              style={{
                color: "var(--wikios-text)",
                opacity: 1 - repulsionProgress * 0.25,
              }}
              className="relative z-10 transition-colors duration-150"
            >
              Canvas
            </span>
          </motion.div>
        </div>

        <div className="wikios-ve-titlebar-actions">
          <button
            className="wikios-editor-btn-cancel"
            onClick={onCancel}
            type="button"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>

          <Popover open={saveDropdownOpen} onOpenChange={setSaveDropdownOpen}>
            <PopoverTrigger
              className="wikios-editor-btn-save"
              disabled={saving}
              title="Save options"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="glass-none z-[10001] w-52 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-1 text-[var(--wikios-text)] shadow-2xl"
            >
              <div className="flex flex-col gap-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSaveDropdownOpen(false);
                    setSaveActionType("publish");
                    setShowSavePanel(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <Save className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Save and Publish</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSaveDropdownOpen(false);
                    handleSaveDraft();
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-400" />
                  <span>Save as Draft</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSaveDropdownOpen(false);
                    setSaveActionType("session");
                    if (!summary) setSummary("Session save");
                    setShowSavePanel(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <Bookmark className="h-3.5 w-3.5 text-amber-400" />
                  <span>Save Session</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Save panel */}
      {showSavePanel && (
        <div className="wikios-ve-save-bar">
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Describe your changes..."
            className="wikios-ve-save-input"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          <label className="wikios-ve-save-minor">
            <input type="checkbox" checked={minor} onChange={(e) => setMinor(e.target.checked)} />
            Minor
          </label>
          <button
            className="flex h-8 items-center justify-center rounded-lg bg-[var(--wikios-accent)] px-3 text-xs font-semibold text-white transition-all hover:bg-[var(--wikios-accent-hover)] active:scale-95 disabled:scale-100 disabled:opacity-50"
            onClick={handleSave}
            type="button"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : saveActionType === "publish" ? (
              "Save & Publish"
            ) : (
              "Save Session"
            )}
          </button>
        </div>
      )}

      {/* ─── Full Formatting Toolbar ─── */}
      <div className="wikios-ve-toolbar">
        {/* Undo / Redo */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn icon={<Undo2 size={14} />} title="Undo (Ctrl+Z)" onClick={() => exec("undo")} />
          <VEBtn icon={<Redo2 size={14} />} title="Redo (Ctrl+Y)" onClick={() => exec("redo")} />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Text formatting */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<Bold size={14} />}
            title="Bold (Ctrl+B)"
            active={activeFormats.has("bold")}
            onClick={() => exec("bold")}
          />
          <VEBtn
            icon={<Italic size={14} />}
            title="Italic (Ctrl+I)"
            active={activeFormats.has("italic")}
            onClick={() => exec("italic")}
          />
          <VEBtn
            icon={<Underline size={14} />}
            title="Underline (Ctrl+U)"
            active={activeFormats.has("underline")}
            onClick={() => exec("underline")}
          />
          <VEBtn
            icon={<Strikethrough size={14} />}
            title="Strikethrough (Ctrl+Shift+X)"
            active={activeFormats.has("strikethrough")}
            onClick={() => exec("strikeThrough")}
          />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Script / code */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<Superscript size={14} />}
            title="Superscript"
            active={activeFormats.has("superscript")}
            onClick={() => exec("superscript")}
          />
          <VEBtn
            icon={<Subscript size={14} />}
            title="Subscript"
            active={activeFormats.has("subscript")}
            onClick={() => exec("subscript")}
          />
          <VEBtn
            icon={<Code size={14} />}
            title="Inline code"
            onClick={() => insertHtmlAtCursor("<code>code</code>")}
          />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Block formatting */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn icon={<Type size={14} />} title="Normal paragraph" onClick={setParagraph} />
          <VEBtn
            icon={<span className="wikios-ve-heading-label">H2</span>}
            title="Section heading"
            onClick={() => setHeading(2)}
          />
          <VEBtn
            icon={<span className="wikios-ve-heading-label">H3</span>}
            title="Subsection"
            onClick={() => setHeading(3)}
          />
          <VEBtn
            icon={<span className="wikios-ve-heading-label">H4</span>}
            title="Sub-subsection"
            onClick={() => setHeading(4)}
          />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Lists & structure */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<List size={14} />}
            title="Bullet list"
            active={activeFormats.has("ul")}
            onClick={() => exec("insertUnorderedList")}
          />
          <VEBtn
            icon={<ListOrdered size={14} />}
            title="Numbered list"
            active={activeFormats.has("ol")}
            onClick={() => exec("insertOrderedList")}
          />
          <VEBtn
            icon={<Quote size={14} />}
            title="Blockquote"
            onClick={() => exec("formatBlock", "blockquote")}
          />
          <VEBtn icon={<Indent size={14} />} title="Indent" onClick={() => exec("indent")} />
          <VEBtn icon={<Outdent size={14} />} title="Outdent" onClick={() => exec("outdent")} />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Alignment */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<AlignLeft size={14} />}
            title="Align left"
            onClick={() => exec("justifyLeft")}
          />
          <VEBtn
            icon={<AlignCenter size={14} />}
            title="Align center"
            onClick={() => exec("justifyCenter")}
          />
          <VEBtn
            icon={<AlignRight size={14} />}
            title="Align right"
            onClick={() => exec("justifyRight")}
          />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Links */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn icon={<Link2 size={14} />} title="Insert link (Ctrl+K)" onClick={insertLink} />
          <VEBtn icon={<Unlink size={14} />} title="Remove link" onClick={removeLink} />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Insert objects */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<ImageIcon size={14} />}
            title="Insert image"
            onClick={() => {
              saveSelection();
              setShowImageSearch(true);
            }}
          />

          <Popover open={stashesOpen} onOpenChange={setStashesOpen}>
            <PopoverTrigger
              className="wikios-editor-format-btn"
              title="Stashed Images"
              onClick={saveSelection}
            >
              <Bookmark className="h-3.5 w-3.5" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="glass-none z-[10001] flex w-80 flex-col gap-2 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-3 text-[var(--wikios-text)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--wikios-border)] pb-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--wikios-text-muted)]">
                  <Bookmark className="h-3.5 w-3.5 text-rose-500" />
                  <span>Stashed Images</span>
                </span>

                {stashes.length > 1 && (
                  <select
                    value={activeStashId}
                    onChange={(e) => setSelectedStashId(e.target.value)}
                    className="cursor-pointer rounded border border-[var(--wikios-border)] bg-[var(--wikios-surface)] px-1.5 py-0.5 text-[10px] text-[var(--wikios-text)] focus:outline-none"
                  >
                    {stashes.map((s) => (
                      <option
                        key={s.id}
                        value={s.id}
                        className="bg-[var(--wikios-surface)] text-[var(--wikios-text)]"
                      >
                        {s.name} ({s.itemCount})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {stashesQuery.isLoading || (activeStashId && stashItemsQuery.isLoading) ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                </div>
              ) : imageItems.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-[11px] text-zinc-400">No stashed images found.</p>
                  <p className="mt-1 text-[9px] text-zinc-500">
                    Stash images from the Category Browser to insert them here.
                  </p>
                </div>
              ) : (
                <div className="wikios-custom-scrollbar grid max-h-60 grid-cols-3 gap-2 overflow-y-auto pr-1">
                  {imageItems.map((item) => {
                    const imgInfo = imagesMap.get(item.pageTitle);
                    const filename = item.pageTitle.replace(/^commons:File:/, "");
                    const cleanTitle = filename.replace(/_/g, " ");

                    return (
                      <StashImageCard
                        key={item.id}
                        imgInfo={imgInfo}
                        cleanTitle={cleanTitle}
                        filename={filename}
                        onInsert={() => {
                          setStashesOpen(false);
                          restoreSelection();
                          handleInsertImage(`[[File:${filename}|thumb|]]`);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </PopoverContent>
          </Popover>

          <VEBtn icon={<Table size={14} />} title="Insert table" onClick={insertTable} />

          <Popover open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <PopoverTrigger
              className="wikios-editor-format-btn flex !w-auto items-center gap-1.5 rounded px-2.5 text-zinc-300 hover:text-white"
              title="Insert Templates & Widgets"
              onClick={saveSelection}
            >
              <FileCode className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Templates</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="glass-none z-[10001] w-56 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-1 text-[var(--wikios-text)] shadow-2xl"
            >
              <div className="flex flex-col gap-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setTemplatesOpen(false);
                    restoreSelection();
                    setShowInfoboxModal(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <FileText className="h-3.5 w-3.5 text-amber-400" />
                  <span>Infobox Country</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTemplatesOpen(false);
                    restoreSelection();
                    setShowCountryStatsModal(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <MyCountryTinyIcon />
                  <span>Country Stats</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTemplatesOpen(false);
                    restoreSelection();
                    setShowBusinessStatsModal(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-teal-400" />
                  <span>Business Stats</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTemplatesOpen(false);
                    restoreSelection();
                    setShowMapCoordsModal(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--wikios-border)]"
                >
                  <MapIcon className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Map Coords &amp; Embeds</span>
                </button>
                <div className="my-0.5 border-t border-[var(--wikios-border)]" />
                <button
                  type="button"
                  onClick={() => {
                    setTemplatesOpen(false);
                    restoreSelection();
                    setShowTemplateInserter(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[var(--wikios-text-muted)] transition-colors hover:bg-[var(--wikios-border)] hover:text-[var(--wikios-text)]"
                >
                  <Puzzle className="h-3.5 w-3.5" />
                  <span>Generic Template...</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <VEBtn icon={<Minus size={14} />} title="Horizontal rule" onClick={insertHR} />
          <VEBtn
            icon={
              <span className="wikios-ve-heading-label" style={{ fontSize: 9 }}>
                ref
              </span>
            }
            title="Insert reference"
            onClick={insertRef}
          />
        </div>
        <span className="wikios-ve-toolbar-sep" />

        {/* Clear */}
        <div className="wikios-ve-toolbar-group">
          <VEBtn
            icon={<RemoveFormatting size={14} />}
            title="Clear formatting"
            onClick={clearFormatting}
          />
        </div>

        {/* Far right: Editor Settings */}
        <div className="ml-auto flex items-center">
          <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
            <PopoverTrigger className="wikios-editor-format-btn" title="Editor Settings">
              <Settings className="h-3.5 w-3.5" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="glass-none z-[10001] w-56 rounded-xl border border-[var(--wikios-border)] bg-[var(--wikios-surface)] p-2 text-[var(--wikios-text)] shadow-2xl"
            >
              <div className="flex flex-col gap-2.5 p-1 text-xs">
                <div className="mb-1 border-b border-[var(--wikios-border)] pb-1.5 font-semibold text-[var(--wikios-text-dim)]">
                  Editor Settings
                </div>

                {/* Autocomplete */}
                <div className="flex items-center justify-between select-none">
                  <span className="font-medium">Autocomplete</span>
                  <AppleSwitch
                    checked={enableAutocomplete}
                    onCheckedChange={handleToggleAutocomplete}
                    size="sm"
                    tone="neutral"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Template inserter dropdown */}
      {showTemplateInserter && (
        <TemplateInserter
          onInsert={handleInsertTemplate}
          onClose={() => setShowTemplateInserter(false)}
        />
      )}

      {/* ─── Contenteditable Surface ─── */}
      <div className="wikios-ve-surface">
        <div
          ref={editableRef}
          className="wikios-ve-editable wikios-article-content"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          data-editor-active="true"
        />
      </div>

      {/* Status bar */}
      <div className="wikios-ve-statusbar">
        <span>{wordCount.toLocaleString()} words</span>
        <span>Canvas Editor v{CANVAS_VERSION}</span>
        {isDirty && <span className="wikios-ve-dirty-indicator">Modified</span>}
      </div>

      {/* Modals */}
      <ImageSearchModal
        isOpen={showImageSearch}
        onClose={() => setShowImageSearch(false)}
        onInsert={handleInsertImage}
      />

      {/* Custom Template Modals */}
      <InfoboxCountryModal
        isOpen={showInfoboxModal}
        onClose={() => setShowInfoboxModal(false)}
        onInsert={(wikitext) => {
          restoreSelection();
          const { templateName, params } = parseWikitextTemplate(wikitext);
          handleInsertTemplate(templateName, params);
        }}
      />

      <CountryStatsModal
        isOpen={showCountryStatsModal}
        onClose={() => setShowCountryStatsModal(false)}
        onInsert={(wikitext) => {
          restoreSelection();
          const { templateName, params } = parseWikitextTemplate(wikitext);
          handleInsertTemplate(templateName, params);
        }}
      />

      <BusinessStatsModal
        isOpen={showBusinessStatsModal}
        onClose={() => setShowBusinessStatsModal(false)}
        onInsert={(wikitext) => {
          restoreSelection();
          const { templateName, params } = parseWikitextTemplate(wikitext);
          handleInsertTemplate(templateName, params);
        }}
      />

      <MapCoordsModal
        isOpen={showMapCoordsModal}
        onClose={() => setShowMapCoordsModal(false)}
        onInsert={(wikitext) => {
          restoreSelection();
          try {
            const { type, values, optionOrLabel } = parseCoordsOrMapEmbed(wikitext);
            const anchor = document.createElement("a");
            anchor.setAttribute("href", `${type}:${values}`);
            anchor.setAttribute("title", `${type}:${values}`);
            anchor.contentEditable = "false";
            if (type === "Coords") {
              anchor.className = "wikios-ve-custom-chip chip-coords";
              const cleanLabel = optionOrLabel || "Location";
              anchor.innerHTML = `<span class="opacity-70">📍</span> ${cleanLabel}`;
            } else {
              anchor.className = "wikios-ve-custom-chip chip-mapembed";
              anchor.innerHTML = `<span class="opacity-70">🗺️</span> Map Embed`;
            }
            insertNodeAtCursor(anchor);
            setIsDirty(true);
          } catch (err) {
            console.error("Failed to parse and insert coords/map embed:", err);
          }
        }}
      />

      {editingTemplate && (
        <TemplateEditorDialog
          templateName={editingTemplate.name}
          params={editingTemplate.params}
          onSave={handleTemplateUpdate}
          onClose={() => setEditingTemplate(null)}
          onRemove={() => {
            editingTemplate.element.remove();
            setEditingTemplate(null);
            setIsDirty(true);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function VEBtn({
  icon,
  title,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn("wikios-ve-toolbar-btn", active && "wikios-ve-toolbar-btn-active")}
      title={title}
    >
      {icon}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Template Editor Dialog
// ---------------------------------------------------------------------------
function TemplateEditorDialog({
  templateName,
  params,
  onSave,
  onClose,
  onRemove,
}: {
  templateName: string;
  params: Record<string, string>;
  onSave: (p: Record<string, string>) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({ ...params });
  const [showPreview, setShowPreview] = useState(false);

  const tdQuery = api.wikios.getTemplateData.useQuery(
    { title: templateName },
    { staleTime: 300000 }
  );
  const previewQuery = api.wikios.getTemplatePreview.useQuery(
    { template: templateName, params: values },
    { enabled: showPreview, staleTime: 0 }
  );

  const tdParams =
    (
      tdQuery.data?.templateData as {
        params?: Record<string, { label?: string; description?: string; required?: boolean }>;
      }
    )?.params ?? {};
  const allKeys = [...new Set([...Object.keys(params), ...Object.keys(tdParams)])];

  return (
    <div className="wikios-modal-backdrop" onClick={onClose}>
      <div
        className="wikios-quick-modal wikios-ve-template-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wikios-quick-modal-header">
          <div className="wikios-quick-modal-title">
            <Puzzle size={16} />
            <span>Edit: {templateName}</span>
          </div>
          <button onClick={onClose} className="wikios-quick-modal-close">
            <X size={16} />
          </button>
        </div>
        <div className="wikios-quick-modal-body">
          {allKeys.map((key) => {
            const schema = tdParams[key];
            return (
              <div key={key} className="wikios-ve-template-field">
                <label className="wikios-ve-template-field-label">
                  {schema?.label ?? key}
                  {schema?.required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
                </label>
                {schema?.description && (
                  <div className="wikios-ti-param-desc">{schema.description}</div>
                )}
                <input
                  type="text"
                  value={values[key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  className="wikios-ti-param-input"
                  placeholder={`Enter ${schema?.label ?? key}...`}
                />
              </div>
            );
          })}
          {showPreview && previewQuery.data && (
            <div
              className="wikios-ti-preview"
              dangerouslySetInnerHTML={{ __html: previewQuery.data }}
            />
          )}
        </div>
        <div className="wikios-ve-template-dialog-footer">
          <button onClick={onRemove} className="wikios-ve-template-remove">
            Remove template
          </button>
          <div className="wikios-ve-template-dialog-actions">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="wikios-ve-btn wikios-ve-btn-ghost"
              type="button"
            >
              {showPreview ? "Hide Preview" : "Preview"}
            </button>
            <button
              onClick={() => onSave(values)}
              className="wikios-ve-btn wikios-ve-btn-primary"
              type="button"
            >
              Update Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stash Image Card Component for Visual Editor
// ---------------------------------------------------------------------------
function StashImageCard({
  imgInfo,
  cleanTitle,
  filename,
  onInsert,
}: {
  imgInfo: any;
  cleanTitle: string;
  filename: string;
  onInsert: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`[[File:${filename}|thumb|]]`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={onInsert}
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-white/5 bg-white/5 text-white transition-all hover:border-white/10 hover:bg-white/10"
      title={`Click to insert [[File:${filename}]]`}
    >
      {imgInfo?.thumbUrl ? (
        <img
          src={imgInfo.thumbUrl}
          alt={cleanTitle}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-3 w-3 animate-spin rounded-full border border-zinc-700 border-t-zinc-400" />
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md border border-white/10 bg-zinc-950/80 p-1 text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white"
          title="Copy Wikitext Link"
        >
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent p-1 text-[8px] text-zinc-300 group-hover:text-white">
        {cleanTitle}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wikitext template parser utility
// ---------------------------------------------------------------------------
function parseWikitextTemplate(wikitext: string) {
  const clean = wikitext.trim().replace(/^\{\{/, "").replace(/\}\}$/, "");
  const parts = clean.split("|");
  const templateName = parts[0]?.trim() || "";
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]!;
    const eqIdx = part.indexOf("=");
    if (eqIdx !== -1) {
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();
      params[key] = val;
    }
  }
  return { templateName, params };
}

function getChipClassName(name: string): string {
  let type = "mycountry";
  if (name.startsWith("CountryData:")) {
    type = "countrydata";
  } else if (name.startsWith("BusinessData:")) {
    type = "businessdata";
  }
  return `wikios-ve-custom-chip chip-${type} wikios-ve-template`;
}

function getChipInnerHTML(name: string): string {
  let icon = "📊";
  if (name.startsWith("CountryData:")) {
    icon = "📈";
  } else if (name.startsWith("BusinessData:")) {
    icon = "💼";
  }
  return `<span class="opacity-70">${icon}</span> ${name}`;
}

function parseCoordsOrMapEmbed(wikitext: string) {
  const clean = wikitext.trim().replace(/^\[\[/, "").replace(/\]\]$/, "");
  const parts = clean.split("|");
  const head = parts[0] || "";
  const optionOrLabel = parts[1] || "";
  const colonIdx = head.indexOf(":");
  const type = colonIdx !== -1 ? head.slice(0, colonIdx) : head;
  const values = colonIdx !== -1 ? head.slice(colonIdx + 1) : "";
  return { type, values, optionOrLabel };
}

// Tiny MyCountry Logo representation for Popovers
function MyCountryTinyIcon() {
  return (
    <div className="relative flex h-4 w-4 shrink-0 items-center justify-center">
      <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-amber-300/50 bg-gradient-to-br from-amber-200 to-amber-400 shadow-sm">
        <Globe className="h-2 w-2 text-amber-950" />
      </div>
      <div className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full border border-amber-300 bg-amber-400 p-[0.5px] shadow-sm">
        <Crown className="h-1.5 w-1.5 text-amber-950" />
      </div>
    </div>
  );
}
