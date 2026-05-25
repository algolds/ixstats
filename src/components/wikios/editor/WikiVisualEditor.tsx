// src/components/wikios/editor/WikiVisualEditor.tsx
// Hybrid visual editor — Parsoid HTML in contenteditable with React toolbar.
// Templates render as live HTML with click-to-edit. Preserves data-mw for roundtrip.

"use client";

import { useRef, useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { TemplateInserter } from "~/components/wikios/editor/TemplateInserter";
import { ImageSearchModal } from "~/components/wikios/editor/ImageSearchModal";

interface WikiVisualEditorProps {
  initialHtml: string;
  title: string;
  onSave: (html: string, summary: string, minor: boolean) => void;
  onCancel: () => void;
  onSwitchToSource: () => void;
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
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [editingTemplate, setEditingTemplate] = useState<{
    element: HTMLElement;
    name: string;
    params: Record<string, string>;
  } | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const previewMutation = api.wikios.previewWikitext.useMutation();

  // ---------------------------------------------------------------------------
  // Mount Parsoid HTML + protect templates/images
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    el.innerHTML = initialHtml;

    // Protect template transclusions.
    // Parsoid uses `about` attributes to group elements belonging to the same transclusion.
    // The `typeof="mw:Transclusion"` may be on a <style> tag while the visible <table> shares the same `about`.
    const protectedAbouts = new Set<string>();
    el.querySelectorAll('[typeof*="mw:Transclusion"]').forEach((tmpl) => {
      const about = tmpl.getAttribute("about");
      if (about) protectedAbouts.add(about);
      (tmpl as HTMLElement).contentEditable = "false";
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
      (tmpl as HTMLElement).contentEditable = "false";
      tmpl.classList.add("wikios-ve-template");
    });

    // Protect images/files
    el.querySelectorAll('[typeof*="mw:File"]').forEach((fig) => {
      (fig as HTMLElement).contentEditable = "false";
      fig.classList.add("wikios-ve-media");
    });

    setWordCount(el.innerText.split(/\s+/).filter(Boolean).length);
  }, [initialHtml]);

  // ---------------------------------------------------------------------------
  // Selection state tracking — powers toolbar active indicators
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handler = () => {
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
    try {
      await onSave(html, summary, minor);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [onSave, summary, minor]);

  // ---------------------------------------------------------------------------
  // Template insertion
  // ---------------------------------------------------------------------------
  const handleInsertTemplate = useCallback(
    async (templateName: string, params: Record<string, string>) => {
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
        wrapper.innerHTML = result.html;
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
        temp.innerHTML = result.html;
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
        element.innerHTML = result.html;
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
          <span className="wikios-ve-titlebar-badge">Visual Editor</span>
          <span className="wikios-ve-titlebar-name">{title}</span>
          {isDirty && <span className="wikios-ve-dirty">Unsaved</span>}
        </div>
        <div className="wikios-ve-titlebar-actions">
          <button
            className="wikios-ve-btn wikios-ve-btn-ghost"
            onClick={onSwitchToSource}
            type="button"
          >
            <FileText size={14} /> Source
          </button>
          <button className="wikios-ve-btn wikios-ve-btn-ghost" onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="wikios-ve-btn wikios-ve-btn-primary"
            onClick={() => setShowSavePanel(!showSavePanel)}
            type="button"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Publish
          </button>
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
            <input type="checkbox" checked={minor} onChange={(e) => setMinor(e.target.checked)} />{" "}
            Minor
          </label>
          <button
            className="wikios-ve-btn wikios-ve-btn-primary"
            onClick={handleSave}
            type="button"
          >
            {saving ? "Publishing..." : "Publish"}
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
          <VEBtn icon={<Table size={14} />} title="Insert table" onClick={insertTable} />
          <VEBtn
            icon={<Puzzle size={14} />}
            title="Insert template"
            onClick={() => {
              saveSelection();
              setShowTemplateInserter(!showTemplateInserter);
            }}
          />
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
        <span>Visual Editor</span>
        {isDirty && <span className="wikios-ve-dirty-indicator">Modified</span>}
      </div>

      {/* Modals */}
      <ImageSearchModal
        isOpen={showImageSearch}
        onClose={() => setShowImageSearch(false)}
        onInsert={handleInsertImage}
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
    { name: templateName },
    { staleTime: 300000 }
  );
  const previewQuery = api.wikios.getTemplatePreview.useQuery(
    { name: templateName, params: values },
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
              dangerouslySetInnerHTML={{ __html: previewQuery.data.html }}
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
