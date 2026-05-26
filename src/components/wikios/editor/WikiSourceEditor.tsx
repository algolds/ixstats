// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/components/wikios/editor/WikiSourceEditor.tsx
// Wikitext source editor — VS Code + Google Docs hybrid.
// CodeMirror 6 with wikitext toolbar, word count, save panel.

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Eye, EyeOff } from "lucide-react";
import { api } from "~/trpc/react";
import { ImageSearchModal } from "~/components/wikios/editor/ImageSearchModal";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  rectangularSelection,
  Decoration,
  ViewPlugin,
} from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  undo,
  redo,
} from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import {
  Bold,
  Italic,
  Link2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Save,
  X,
  FileText,
  Image,
  Table,
  Code,
  Strikethrough,
  Subscript,
  Superscript,
  Quote,
  Minus,
  ExternalLink,
  Hash,
  FileCode,
  Type,
} from "lucide-react";

const headingDeco = Decoration.mark({ class: "cm-wikitext-heading" });
const listDeco = Decoration.mark({ class: "cm-wikitext-list" });
const boldDeco = Decoration.mark({ class: "cm-wikitext-bold" });
const italicDeco = Decoration.mark({ class: "cm-wikitext-italic" });
const linkDeco = Decoration.mark({ class: "cm-wikitext-link" });
const extlinkDeco = Decoration.mark({ class: "cm-wikitext-extlink" });
const templateDeco = Decoration.mark({ class: "cm-wikitext-template" });
const refDeco = Decoration.mark({ class: "cm-wikitext-ref" });

const wikitextHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();

      for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos < to) {
          const line = view.state.doc.lineAt(pos);
          const lineText = line.text;
          const lineFrom = line.from;
          const lineTo = line.to;

          const matches: { from: number; to: number; deco: Decoration }[] = [];

          // 1. Headings
          const headingMatch = /^(={1,6})\s*(.+?)\s*\1\s*$/.exec(lineText);
          if (headingMatch) {
            matches.push({ from: lineFrom, to: lineTo, deco: headingDeco });
          } else {
            // 2. Lists
            const listMatch = /^([\*#\:\;]+)/.exec(lineText);
            if (listMatch) {
              matches.push({
                from: lineFrom,
                to: lineFrom + listMatch[1]!.length,
                deco: listDeco,
              });
            }
          }

          // 3. Bold: '''text'''
          const boldRegex = /'''([^'\n]+?)'''/g;
          let m;
          while ((m = boldRegex.exec(lineText)) !== null) {
            matches.push({
              from: lineFrom + m.index,
              to: lineFrom + m.index + m[0].length,
              deco: boldDeco,
            });
          }

          // 4. Italic: ''text''
          const italicRegex = /''([^'\n]+?)''/g;
          while ((m = italicRegex.exec(lineText)) !== null) {
            const start = m.index;
            const end = m.index + m[0].length;
            const isBoldStart = start > 0 && lineText[start - 1] === "'";
            const isBoldEnd = end < lineText.length && lineText[end] === "'";
            if (!isBoldStart && !isBoldEnd) {
              matches.push({
                from: lineFrom + start,
                to: lineFrom + end,
                deco: italicDeco,
              });
            }
          }

          // 5. Wiki Links: [[Page]] or [[Page|Title]]
          const wikiLinkRegex = /\[\[([^\]\n]+?)\]\]/g;
          while ((m = wikiLinkRegex.exec(lineText)) !== null) {
            matches.push({
              from: lineFrom + m.index,
              to: lineFrom + m.index + m[0].length,
              deco: linkDeco,
            });
          }

          // 6. External Links: [URL Title] or [URL]
          const extLinkRegex = /\[([^\[\]\n]+?)\]/g;
          while ((m = extLinkRegex.exec(lineText)) !== null) {
            const start = m.index;
            const end = m.index + m[0].length;
            const isWikiStart = start > 0 && lineText[start - 1] === "[";
            const isWikiEnd = end < lineText.length && lineText[end] === "]";
            if (!isWikiStart && !isWikiEnd) {
              matches.push({
                from: lineFrom + start,
                to: lineFrom + end,
                deco: extlinkDeco,
              });
            }
          }

          // 7. Templates: {{template}}
          const templateRegex = /\{\{([^\}\n]+?)\}\}/g;
          while ((m = templateRegex.exec(lineText)) !== null) {
            matches.push({
              from: lineFrom + m.index,
              to: lineFrom + m.index + m[0].length,
              deco: templateDeco,
            });
          }

          // 8. References: <ref>...</ref>
          const refRegex = /<ref[^>]*>|<\/ref>/gi;
          while ((m = refRegex.exec(lineText)) !== null) {
            matches.push({
              from: lineFrom + m.index,
              to: lineFrom + m.index + m[0].length,
              deco: refDeco,
            });
          }

          // Sort matches
          matches.sort((a, b) => {
            if (a.from !== b.from) return a.from - b.from;
            return b.to - a.to;
          });

          // Resolve overlaps/nesting
          const activeRanges: typeof matches = [];
          const validMatches: typeof matches = [];

          for (const match of matches) {
            while (
              activeRanges.length > 0 &&
              activeRanges[activeRanges.length - 1]!.to <= match.from
            ) {
              activeRanges.pop();
            }
            if (activeRanges.length > 0) {
              const parent = activeRanges[activeRanges.length - 1]!;
              if (match.to > parent.to) {
                match.to = parent.to;
              }
            }
            if (match.from < match.to) {
              validMatches.push(match);
              activeRanges.push(match);
            }
          }

          // Add to builder
          for (const match of validMatches) {
            builder.add(match.from, match.to, match.deco);
          }

          pos = line.to + 1;
        }
      }

      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

interface WikiSourceEditorProps {
  initialWikitext: string;
  title: string;
  onSave: (wikitext: string, summary: string, minor: boolean) => void;
  onCancel: () => void;
  onSwitchToVisual?: () => void;
}

export function WikiSourceEditor({
  initialWikitext,
  title,
  onSave,
  onCancel,
  onSwitchToVisual,
}: WikiSourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [summary, setSummary] = useState("");
  const [minor, setMinor] = useState(false);
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [lineCount, setLineCount] = useState(0);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshPreviewRef = useRef<() => void>(() => {});
  const previewMutation = api.wikios.previewWikitext.useMutation({
    onSuccess: (data) => setPreviewHtml(data.html),
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const updateStats = EditorView.updateListener.of((update) => {
      if (update.docChanged || update.selectionSet) {
        const doc = update.state.doc;
        const text = doc.toString();
        setWordCount(text.split(/\s+/).filter(Boolean).length);
        setLineCount(doc.lines);

        const sel = update.state.selection.main;
        const line = doc.lineAt(sel.head);
        setCursorPos({ line: line.number, col: sel.head - line.from + 1 });

        if (update.docChanged) {
          setIsDirty(true);
          refreshPreviewRef.current();
        }
      }
    });

    const state = EditorState.create({
      doc: initialWikitext,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        foldGutter(),
        drawSelection(),
        rectangularSelection(),
        bracketMatching(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle),
        wikitextHighlightPlugin,
        oneDark,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        EditorView.lineWrapping,
        updateStats,
        EditorView.theme({
          "&": {
            fontSize: "14px",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
          },
          "&.cm-focused": {
            outline: "none",
          },
          ".cm-content": {
            padding: "12px 0",
            caretColor: "var(--wikios-accent)",
          },
          ".cm-cursor": {
            borderLeftColor: "var(--wikios-accent)",
            borderLeftWidth: "2px",
          },
          ".cm-gutters": {
            background: "rgba(255, 255, 255, 0.02)",
            borderRight: "1px solid rgba(255, 255, 255, 0.06)",
            color: "rgba(255, 255, 255, 0.2)",
            minWidth: "48px",
          },
          ".cm-activeLineGutter": {
            background: "rgba(59, 130, 246, 0.08)",
            color: "rgba(255, 255, 255, 0.5)",
          },
          ".cm-activeLine": {
            background: "rgba(255, 255, 255, 0.02)",
          },
          ".cm-selectionBackground": {
            background: "rgba(59, 130, 246, 0.2) !important",
          },
          ".cm-matchingBracket": {
            background: "rgba(59, 130, 246, 0.15)",
            outline: "1px solid rgba(59, 130, 246, 0.4)",
          },
          ".cm-foldGutter": {
            width: "12px",
          },
          ".cm-searchMatch": {
            background: "rgba(234, 179, 8, 0.25)",
            outline: "1px solid rgba(234, 179, 8, 0.5)",
          },
          ".cm-wikitext-heading": {
            color: "#9ece6a",
            fontWeight: "bold",
          },
          ".cm-wikitext-list": {
            color: "#ff007f",
            fontWeight: "bold",
          },
          ".cm-wikitext-bold": {
            color: "#e0af68",
            fontWeight: "bold",
          },
          ".cm-wikitext-italic": {
            color: "#a9b1d6",
            fontStyle: "italic",
          },
          ".cm-wikitext-link": {
            color: "#7aa2f7",
            textDecoration: "underline",
          },
          ".cm-wikitext-extlink": {
            color: "#0db9d7",
            textDecoration: "underline",
            fontStyle: "italic",
          },
          ".cm-wikitext-template": {
            color: "#bb9af7",
          },
          ".cm-wikitext-ref": {
            color: "#f7768e",
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Set initial stats
    const text = initialWikitext;
    setWordCount(text.split(/\s+/).filter(Boolean).length);
    setLineCount(text.split("\n").length);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [initialWikitext]);

  // Warn on unload with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Debounced preview refresh
  const refreshPreview = useCallback(() => {
    if (!showPreview) return;
    const wikitext = viewRef.current?.state.doc.toString() ?? "";
    if (!wikitext.trim()) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      previewMutation.mutate({ wikitext, title });
    }, 600);
  }, [showPreview, title, previewMutation]);

  // Keep ref current so the CodeMirror listener always calls the latest version
  refreshPreviewRef.current = refreshPreview;

  // Trigger preview on toggle
  useEffect(() => {
    if (showPreview) {
      const wikitext = viewRef.current?.state.doc.toString() ?? "";
      if (wikitext.trim()) previewMutation.mutate({ wikitext, title });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview]);

  const handleSave = useCallback(() => {
    const wikitext = viewRef.current?.state.doc.toString() ?? initialWikitext;
    onSave(wikitext, summary, minor);
  }, [onSave, summary, minor, initialWikitext]);

  // Wikitext formatting helpers
  const wrapSelection = useCallback((before: string, after: string) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: `${before}${selected}${after}` },
      selection: { anchor: from + before.length, head: to + before.length },
    });
    view.focus();
  }, []);

  const insertAtCursor = useCallback((text: string) => {
    const view = viewRef.current;
    if (!view) return;
    const pos = view.state.selection.main.head;
    view.dispatch({
      changes: { from: pos, insert: text },
      selection: { anchor: pos + text.length },
    });
    view.focus();
  }, []);

  const handleUndo = useCallback(() => {
    const view = viewRef.current;
    if (view) {
      undo(view);
      view.focus();
    }
  }, []);

  const handleRedo = useCallback(() => {
    const view = viewRef.current;
    if (view) {
      redo(view);
      view.focus();
    }
  }, []);

  // Insert text at the start/end of the current line (for headings)
  const insertAtLine = useCallback((before: string, after: string) => {
    const view = viewRef.current;
    if (!view) return;
    const pos = view.state.selection.main.head;
    const line = view.state.doc.lineAt(pos);
    const lineText = line.text;
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: `${before}${lineText}${after}` },
    });
    view.focus();
  }, []);

  return (
    <div className="wikios-editor-modern">
      {/* Title bar */}
      <div className="wikios-editor-titlebar">
        <div className="wikios-editor-titlebar-left">
          <FileText className="h-4 w-4 text-blue-400" />
          <span className="wikios-editor-titlebar-name">{title}</span>
        </div>
        <div className="wikios-editor-titlebar-actions">
          <button
            className={`wikios-editor-btn-secondary ${showPreview ? "wikios-editor-btn-active" : ""}`}
            onClick={() => setShowPreview(!showPreview)}
            type="button"
            title={showPreview ? "Hide preview" : "Show preview"}
          >
            {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            Preview
          </button>
          {onSwitchToVisual && (
            <button
              className="wikios-editor-btn-secondary"
              onClick={onSwitchToVisual}
              type="button"
            >
              Visual
            </button>
          )}
          <button className="wikios-editor-btn-secondary" onClick={onCancel} type="button">
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
          <button
            className="wikios-editor-btn-primary"
            onClick={() => setShowSavePanel(!showSavePanel)}
            type="button"
          >
            <Save className="h-3.5 w-3.5" />
            Publish
          </button>
        </div>
      </div>

      {/* Save panel (slides down) */}
      {showSavePanel && (
        <div className="wikios-editor-save-bar">
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Describe your changes..."
            className="wikios-editor-save-input"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          <label className="wikios-editor-save-minor">
            <input type="checkbox" checked={minor} onChange={(e) => setMinor(e.target.checked)} />
            Minor
          </label>
          <button className="wikios-editor-btn-primary" onClick={handleSave} type="button">
            Publish
          </button>
        </div>
      )}

      {/* Formatting toolbar */}
      <div className="wikios-editor-format-bar">
        {/* Undo/Redo */}
        <div className="wikios-editor-format-group">
          <FmtBtn icon={Undo2} title="Undo (Ctrl+Z)" onClick={handleUndo} />
          <FmtBtn icon={Redo2} title="Redo (Ctrl+Y)" onClick={handleRedo} />
        </div>
        <div className="wikios-editor-format-sep" />

        {/* Text formatting */}
        <div className="wikios-editor-format-group">
          <FmtBtn
            icon={Bold}
            title="Bold ('''text''')"
            onClick={() => wrapSelection("'''", "'''")}
          />
          <FmtBtn
            icon={Italic}
            title="Italic (''text'')"
            onClick={() => wrapSelection("''", "''")}
          />
          <FmtBtn
            icon={Strikethrough}
            title="Strikethrough"
            onClick={() => wrapSelection("<s>", "</s>")}
          />
          <FmtBtn
            icon={Superscript}
            title="Superscript"
            onClick={() => wrapSelection("<sup>", "</sup>")}
          />
          <FmtBtn
            icon={Subscript}
            title="Subscript"
            onClick={() => wrapSelection("<sub>", "</sub>")}
          />
          <FmtBtn icon={Code} title="Code" onClick={() => wrapSelection("<code>", "</code>")} />
        </div>
        <div className="wikios-editor-format-sep" />

        {/* Links */}
        <div className="wikios-editor-format-group">
          <FmtBtn
            icon={Link2}
            title="Wiki link ([[Page]])"
            onClick={() => wrapSelection("[[", "]]")}
          />
          <FmtBtn
            icon={ExternalLink}
            title="External link"
            onClick={() => wrapSelection("[", "]")}
          />
        </div>
        <div className="wikios-editor-format-sep" />

        {/* Headings */}
        <div className="wikios-editor-format-group">
          <FmtBtn icon={Heading1} title="Heading 1 (=)" onClick={() => insertAtLine("= ", " =")} />
          <FmtBtn
            icon={Heading2}
            title="Heading 2 (==)"
            onClick={() => insertAtLine("== ", " ==")}
          />
          <FmtBtn
            icon={Heading3}
            title="Heading 3 (===)"
            onClick={() => insertAtLine("=== ", " ===")}
          />
        </div>
        <div className="wikios-editor-format-sep" />

        {/* Structure */}
        <div className="wikios-editor-format-group">
          <FmtBtn icon={List} title="Bullet list" onClick={() => insertAtCursor("\n* ")} />
          <FmtBtn icon={ListOrdered} title="Numbered list" onClick={() => insertAtCursor("\n# ")} />
          <FmtBtn
            icon={Quote}
            title="Blockquote"
            onClick={() => wrapSelection("<blockquote>", "</blockquote>")}
          />
          <FmtBtn icon={Minus} title="Horizontal rule" onClick={() => insertAtCursor("\n----\n")} />
        </div>
        <div className="wikios-editor-format-sep" />

        {/* Media & Templates */}
        <div className="wikios-editor-format-group">
          <FmtBtn icon={Image} title="Insert image" onClick={() => setShowImageSearch(true)} />
          <FmtBtn
            icon={Table}
            title="Table"
            onClick={() =>
              insertAtCursor(
                '\n{| class="wikitable"\n|-\n! Header 1 !! Header 2\n|-\n| Cell 1 || Cell 2\n|}\n'
              )
            }
          />
          <FmtBtn icon={FileCode} title="Template" onClick={() => wrapSelection("{{", "}}")} />
          <FmtBtn icon={Hash} title="Category" onClick={() => insertAtCursor("[[Category:]]")} />
          <FmtBtn icon={Type} title="Reference" onClick={() => wrapSelection("<ref>", "</ref>")} />
        </div>
      </div>

      {/* Editor + optional preview split */}
      <div className={`wikios-editor-body ${showPreview ? "wikios-editor-split" : ""}`}>
        <div ref={containerRef} className="wikios-editor-cm-container" />
        {showPreview && (
          <div className="wikios-editor-preview">
            <div className="wikios-editor-preview-header">
              <Eye size={12} /> Preview
              {previewMutation.isPending && (
                <span className="wikios-editor-preview-loading">Rendering...</span>
              )}
            </div>
            <div
              className="wikios-article-content wikios-editor-preview-content"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="wikios-editor-statusbar">
        <span>
          Ln {cursorPos.line}, Col {cursorPos.col}
        </span>
        <span>{lineCount} lines</span>
        <span>{wordCount.toLocaleString()} words</span>
        <span>Wikitext</span>
        {isDirty && <span className="wikios-ve-dirty-indicator">Modified</span>}
      </div>

      {/* Image search modal */}
      <ImageSearchModal
        isOpen={showImageSearch}
        onClose={() => setShowImageSearch(false)}
        onInsert={(wikitext) => insertAtCursor(wikitext)}
      />
    </div>
  );
}

// Formatting button helper
function FmtBtn({ icon: Icon, title, onClick }: { icon: any; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title} type="button" className="wikios-editor-format-btn">
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
