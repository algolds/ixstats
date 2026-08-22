// src/components/wiki-os/editor/WikiSourceEditor.tsx
// Wikitext source editor — CodeMirror 6 with wikitext toolbar, syntax decorations, and live preview.

"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigationScroll } from "~/hooks/useNavigationScroll";
import { api } from "~/trpc/react";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  rectangularSelection,
} from "@codemirror/view";
import { EditorState, Compartment, Prec } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  undo,
  redo,
} from "@codemirror/commands";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";

import {
  wikitextHighlightPlugin,
  wrapSelectionCM,
} from "./utils/codemirror-wikitext";
import { useWikiEditorState } from "./hooks/useWikiEditorState";
import { getDraft, clearDraft } from "~/lib/wiki-os/editor/draft-store";
import { WikiSourceToolbar } from "./components/WikiSourceToolbar";
import { WikiEditorSavePanel } from "./components/WikiEditorSavePanel";
import { WikiEditorModalHost } from "./components/WikiEditorModalHost";
import { WikiEditorStatusBar } from "./components/WikiEditorStatusBar";

export interface WikiSourceEditorProps {
  initialWikitext: string;
  title: string;
  onSave: (
    wikitext: string,
    summary: string,
    minor: boolean,
    keepEditing?: boolean
  ) => Promise<void> | void;
  onCancel: () => void;
  onSwitchToVisual?: (dirty: boolean, currentWikitext: string) => void;
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
  const [showPreview, setShowPreview] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [lineCount, setLineCount] = useState(1);

  const previewMutation = api.wikios.previewWikitext.useMutation();
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshPreviewRef = useRef<() => void>(() => {});

  const { repulsionProgress } = useNavigationScroll();

  const state = useWikiEditorState({ title, onSave });

  // CodeMirror 6 Compartments for dynamic configuration
  const lineNumbersComp = useRef(new Compartment());
  const wordWrapComp = useRef(new Compartment());
  const autocompleteComp = useRef(new Compartment());

  // Dynamic reconfiguration
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: lineNumbersComp.current.reconfigure(
          state.showLineNumbers
            ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()]
            : []
        ),
      });
    }
  }, [state.showLineNumbers]);

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: wordWrapComp.current.reconfigure(
          state.enableWordWrap ? EditorView.lineWrapping : []
        ),
      });
    }
  }, [state.enableWordWrap]);

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: autocompleteComp.current.reconfigure(
          state.enableAutocomplete ? [autocompletion(), closeBrackets()] : []
        ),
      });
    }
  }, [state.enableAutocomplete]);

  // CodeMirror Initialization
  useEffect(() => {
    if (!containerRef.current) return;

    const updateStats = EditorView.updateListener.of((update) => {
      if (update.docChanged || update.selectionSet) {
        const doc = update.state.doc;
        const sel = update.state.selection.main;
        const line = doc.lineAt(sel.head);
        setCursorPos({ line: line.number, col: sel.head - line.from + 1 });

        if (update.docChanged) {
          const text = doc.toString();
          state.setWordCount(text.split(/\s+/).filter(Boolean).length);
          setLineCount(doc.lines);
          state.setIsDirty(true);
          refreshPreviewRef.current();
        }
      }
    });

    const editorState = EditorState.create({
      doc: initialWikitext,
      extensions: [
        lineNumbersComp.current.of(
          state.showLineNumbers
            ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()]
            : []
        ),
        wordWrapComp.current.of(state.enableWordWrap ? EditorView.lineWrapping : []),
        autocompleteComp.current.of(
          state.enableAutocomplete ? [autocompletion(), closeBrackets()] : []
        ),
        history(),
        drawSelection(),
        rectangularSelection(),
        bracketMatching(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle),
        wikitextHighlightPlugin,
        Prec.highest(
          keymap.of([
            {
              key: "Mod-b",
              run: (view) => wrapSelectionCM(view, "'''", "'''"),
            },
            {
              key: "Mod-i",
              run: (view) => wrapSelectionCM(view, "''", "''"),
            },
            {
              key: "Mod-k",
              run: (view) => wrapSelectionCM(view, "[[", "]]"),
            },
            {
              key: "Mod-s",
              run: () => {
                void state.executeSave(() => viewRef.current?.state.doc.toString() ?? initialWikitext);
                return true;
              },
            },
          ])
        ),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        updateStats,
        EditorView.theme({
          "&": {
            height: "100%",
            width: "100%",
            fontSize: "13.5px",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
            backgroundColor: "var(--wikios-bg) !important",
            color: "var(--wikios-text) !important",
          },
          "&.cm-focused": {
            outline: "none",
          },
          ".cm-scroller": {
            height: "100%",
            overflow: "auto !important",
            fontFamily: "inherit",
          },
          ".cm-content": {
            padding: "16px 0",
            caretColor: "var(--wikios-accent)",
            minHeight: "100%",
          },
          ".cm-cursor": {
            borderLeftColor: "var(--wikios-accent)",
            borderLeftWidth: "2px",
          },
          ".cm-gutters": {
            backgroundColor: "var(--wikios-surface) !important",
            borderRight: "1px solid var(--wikios-border) !important",
            color: "var(--wikios-text-dim) !important",
            minWidth: "48px",
          },
          ".cm-activeLineGutter": {
            backgroundColor: "var(--wikios-border) !important",
            color: "var(--wikios-text) !important",
          },
          ".cm-activeLine": {
            backgroundColor: "rgba(120, 120, 120, 0.04) !important",
          },
          ".cm-selectionBackground": {
            backgroundColor: "var(--wikios-border) !important",
          },
          ".cm-matchingBracket": {
            backgroundColor: "rgba(59, 130, 246, 0.15)",
            outline: "1px solid rgba(59, 130, 246, 0.4)",
          },
          ".cm-foldGutter": {
            width: "12px",
          },
          ".cm-searchMatch": {
            backgroundColor: "rgba(234, 179, 8, 0.25)",
            outline: "1px solid rgba(234, 179, 8, 0.5)",
          },
          ".cm-wikitext-heading": {
            color: "var(--wikios-accent)",
            fontWeight: "bold",
          },
          ".cm-wikitext-list": {
            color: "var(--wikios-accent)",
            fontWeight: "bold",
          },
          ".cm-wikitext-bold": {
            fontWeight: "bold",
          },
          ".cm-wikitext-italic": {
            fontStyle: "italic",
          },
          ".cm-wikitext-link": {
            color: "var(--wikios-link)",
            textDecoration: "underline",
          },
          ".cm-wikitext-extlink": {
            color: "var(--wikios-link)",
            textDecoration: "underline",
            fontStyle: "italic",
          },
          ".cm-wikitext-template": {
            color: "var(--wikios-text-muted)",
          },
          ".cm-wikitext-ref": {
            color: "var(--wikios-text-dim)",
          },
        }),
      ],
    });

    const view = new EditorView({
      state: editorState,
      parent: containerRef.current,
    });

    viewRef.current = view;

    const text = initialWikitext;
    state.setWordCount(text.split(/\s+/).filter(Boolean).length);
    setLineCount(text.split("\n").length);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWikitext]);

  // Warn on unload
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.isDirty]);

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

  refreshPreviewRef.current = refreshPreview;

  useEffect(() => {
    if (showPreview) {
      const wikitext = viewRef.current?.state.doc.toString() ?? "";
      if (wikitext.trim()) previewMutation.mutate({ wikitext, title });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview]);

  // Save actions
  const handleSave = useCallback(async () => {
    await state.executeSave(() => viewRef.current?.state.doc.toString() ?? initialWikitext);
  }, [state, initialWikitext]);

  const handleSaveDraft = useCallback(() => {
    state.executeSaveDraft(() => viewRef.current?.state.doc.toString() ?? "", "source");
  }, [state]);

  // Local draft restore on mount
  useEffect(() => {
    const existingDraft = getDraft(title, "ixwiki");
    const draftContent = existingDraft?.wikitext;
    if (draftContent && draftContent !== initialWikitext) {
      const timer = setTimeout(() => {
        const restore = window.confirm(
          `An unsaved local draft from a previous session was found for "${title}". Would you like to restore it?`
        );
        if (restore && viewRef.current) {
          const docLength = viewRef.current.state.doc.length;
          viewRef.current.dispatch({
            changes: { from: 0, to: docLength, insert: draftContent },
          });
          state.setIsDirty(true);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [title, initialWikitext, state.setIsDirty]);

  // Formatting helpers
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
      <WikiSourceToolbar
        title={title}
        isDirty={state.isDirty}
        repulsionProgress={repulsionProgress}
        showPreview={showPreview}
        setShowPreview={setShowPreview}
        onSwitchToVisual={() => {
          const currentWikitext = viewRef.current?.state.doc.toString() ?? "";
          onSwitchToVisual?.(state.isDirty, currentWikitext);
        }}
        onCancel={onCancel}
        onSave={handleSave}
        handleSaveDraft={handleSaveDraft}
        saving={state.saving}
        saveDropdownOpen={state.saveDropdownOpen}
        setSaveDropdownOpen={state.setSaveDropdownOpen}
        saveActionType={state.saveActionType}
        setSaveActionType={state.setSaveActionType}
        setShowSavePanel={state.setShowSavePanel}
        summary={state.summary}
        setSummary={state.setSummary}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        wrapSelection={wrapSelection}
        insertAtCursor={insertAtCursor}
        insertAtLine={insertAtLine}
        setShowImageSearch={state.setShowImageSearch}
        setShowInfoboxModal={state.setShowInfoboxModal}
        setShowCountryStatsModal={state.setShowCountryStatsModal}
        setShowBusinessStatsModal={state.setShowBusinessStatsModal}
        setShowMapCoordsModal={state.setShowMapCoordsModal}
        stashesOpen={state.stashesOpen}
        setStashesOpen={state.setStashesOpen}
        templatesOpen={state.templatesOpen}
        setTemplatesOpen={state.setTemplatesOpen}
        settingsOpen={state.settingsOpen}
        setSettingsOpen={state.setSettingsOpen}
        showLineNumbers={state.showLineNumbers}
        handleToggleLineNumbers={state.handleToggleLineNumbers}
        enableWordWrap={state.enableWordWrap}
        handleToggleWordWrap={state.handleToggleWordWrap}
        enableAutocomplete={state.enableAutocomplete}
        handleToggleAutocomplete={state.handleToggleAutocomplete}
        stashes={state.stashes}
        activeStashId={state.activeStashId}
        setSelectedStashId={state.setSelectedStashId}
        imageItems={state.imageItems}
        imagesMap={state.imagesMap}
        handleInsertStashedImage={(filename) =>
          insertAtCursor(`[[File:${filename}|thumb|]]`)
        }
      />

      <WikiEditorSavePanel
        showSavePanel={state.showSavePanel}
        summary={state.summary}
        setSummary={state.setSummary}
        minor={state.minor}
        setMinor={state.setMinor}
        saving={state.saving}
        saveActionType={state.saveActionType}
        onSave={handleSave}
      />

      {/* Editor + Preview container */}
      <div className={`wikios-editor-body ${showPreview ? "wikios-editor-split" : ""}`}>
        <div ref={containerRef} className="wikios-editor-cm-container wikios-editor-cm" />
        {showPreview && (
          <div className="wikios-editor-preview">
            <div className="wikios-editor-preview-header">
              <span>Preview</span>
              {previewMutation.isPending && (
                <span className="wikios-editor-preview-loading">Rendering...</span>
              )}
            </div>
            <div
              className="wikios-editor-preview-content wikios-article-body"
              dangerouslySetInnerHTML={{
                __html: previewMutation.data?.html || "<em>Loading preview...</em>",
              }}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <WikiEditorStatusBar
        cursorPos={cursorPos}
        wordCount={state.wordCount}
        lineCount={lineCount}
        formatName="Wikitext"
        encoding="UTF-8"
      />

      <WikiEditorModalHost
        showImageSearch={state.showImageSearch}
        setShowImageSearch={state.setShowImageSearch}
        onInsertImage={insertAtCursor}
        showInfoboxModal={state.showInfoboxModal}
        setShowInfoboxModal={state.setShowInfoboxModal}
        onInsertInfobox={insertAtCursor}
        showCountryStatsModal={state.showCountryStatsModal}
        setShowCountryStatsModal={state.setShowCountryStatsModal}
        onInsertCountryStats={insertAtCursor}
        showBusinessStatsModal={state.showBusinessStatsModal}
        setShowBusinessStatsModal={state.setShowBusinessStatsModal}
        onInsertBusinessStats={insertAtCursor}
        showMapCoordsModal={state.showMapCoordsModal}
        setShowMapCoordsModal={state.setShowMapCoordsModal}
        onInsertMapCoords={insertAtCursor}
      />
    </div>
  );
}
