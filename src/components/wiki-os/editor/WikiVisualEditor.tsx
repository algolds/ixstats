// src/components/wiki-os/editor/WikiVisualEditor.tsx
// Visual editor on Plate (Slate). Parsoid HTML is deserialized into a block
// model; atomic nodes (templates/chips/media) preserve their original HTML
// verbatim for lossless save roundtrips.

"use client";

import React, { useRef, useCallback } from "react";
import { useNavigationScroll } from "~/hooks/useNavigationScroll";
import { getDraft, saveDraft } from "~/lib/wiki-os/editor/draft-store";
import { parseTemplateWikitext } from "~/lib/wiki-os/editor/parse-template-wikitext";
import type { Descendant } from "slate";
import { useWikiEditorState } from "./hooks/useWikiEditorState";
import { useWikiVisualFormatting } from "./hooks/useWikiVisualFormatting";
import { WikiVisualToolbar } from "./components/WikiVisualToolbar";
import { WikiEditorSavePanel } from "./components/WikiEditorSavePanel";
import { WikiEditorModalHost } from "./components/WikiEditorModalHost";
import { WikiEditorStatusBar } from "./components/WikiEditorStatusBar";
import { EditorModalProvider } from "./context/EditorModalContext";
import {
  PlateWikiEditor,
} from "./plate/PlateWikiEditor";
import { fixEditorImageUrls } from "~/lib/wiki-os/transformers/fix-editor-images";
import type { TSlateEditor } from "platejs";

export interface WikiVisualEditorProps {
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

type PlateEditorLike = TSlateEditor;

export function WikiVisualEditor({
  initialHtml,
  title,
  onSave,
  onCancel,
  onSwitchToSource,
}: WikiVisualEditorProps) {
  const editorRef = useRef<PlateEditorLike | null>(null);
  const htmlRef = useRef<string>(initialHtml);
  const valueRef = useRef<Descendant[] | null>(null);
  const { repulsionProgress } = useNavigationScroll();

  const state = useWikiEditorState({ title, onSave });
  const fmt = useWikiVisualFormatting({
    title,
    editorRef: editorRef as unknown as React.MutableRefObject<PlateEditorLike | null>,
    setIsDirty: state.setIsDirty,
  });

  // Draft restore prompt (drafts store serialized HTML)
  const initialForPlate = React.useMemo(() => {
    const existingDraft = getDraft(title, "ixwiki");
    const draftContent = existingDraft?.html;
    if (draftContent && draftContent !== fixEditorImageUrls(initialHtml)) {
      setTimeout(() => {
        const restore = window.confirm(
          `An unsaved local draft from a previous session was found for "${title}". Would you like to restore it? Reopen the editor to apply.`
        );
        if (restore) {
          state.setIsDirty(true);
        }
      }, 100);
      return draftContent;
    }
    return fixEditorImageUrls(initialHtml);
  }, [title, initialHtml, state.setIsDirty]);

  const handleValueChange = useCallback(
    (_nodes: Descendant[], html: string, plainText: string) => {
      htmlRef.current = html;
      state.setIsDirty(true);
      state.setWordCount(plainText.split(/\s+/).filter(Boolean).length);
      if (editorRef.current) {
        valueRef.current = editorRef.current.children;
      }
    },
    [state]
  );

  const handleSave = useCallback(async () => {
    await state.executeSave(() => htmlRef.current);
    saveDraft({ title, source: "ixwiki", mode: "visual", html: htmlRef.current });
  }, [state, title]);

  const handleSaveDraft = useCallback(() => {
    state.executeSaveDraft(() => htmlRef.current, "visual");
  }, [state]);

  const handleSwitchToSource = useCallback(() => {
    onSwitchToSource(state.isDirty, htmlRef.current);
  }, [onSwitchToSource, state.isDirty]);

  const handleOpenTemplateEditor = useCallback(
    (id: string) => {
      const editor = editorRef.current;
      if (!editor || !fmt.setEditingTemplate) return;
      const { Editor } = require("slate") as typeof import("slate");
      const entries = Array.from(
        Editor.nodes(editor as unknown as import("slate").BaseEditor, {
          at: [],
          match: (n) => (n as unknown as { id?: string }).id === id,
        })
      );
      if (entries.length === 0) return;
      const node = entries[0]![0] as {
        name?: string;
        params?: Record<string, string>;
      };
      fmt.setEditingTemplate({
        id,
        name: node.name ?? "Template",
        params: node.params ?? {},
      });
    },
    [fmt]
  );

  const handleRemoveTemplate = useCallback(() => {
    fmt.removeEditingNode();
  }, [fmt]);

  // Template and Image Handlers
  const handleInsertTemplateFromWikitext = useCallback(
    (wikitext: string, defaultName = "Template") => {
      const { name, params } = parseTemplateWikitext(wikitext, defaultName);
      fmt.handleInsertTemplate(name, params);
    },
    [fmt]
  );

  const handleInsertInfobox = useCallback(
    (wikitext: string) => handleInsertTemplateFromWikitext(wikitext, "Infobox"),
    [handleInsertTemplateFromWikitext]
  );

  const handleInsertCountryStats = useCallback(
    (wikitext: string) => handleInsertTemplateFromWikitext(wikitext, "CountryData"),
    [handleInsertTemplateFromWikitext]
  );

  const handleInsertBusinessStats = useCallback(
    (wikitext: string) => handleInsertTemplateFromWikitext(wikitext, "BusinessData"),
    [handleInsertTemplateFromWikitext]
  );

  const handleInsertMapCoords = useCallback(
    (wikitext: string) => {
      const clean = wikitext.trim().replace(/^\[\[/, "").replace(/\]\]$/, "");
      const parts = clean.split("|");
      const head = parts[0] || "";
      const label = parts[1] || "";
      const colonIdx = head.indexOf(":");
      const type = colonIdx !== -1 ? head.slice(0, colonIdx) : head;
      const values = colonIdx !== -1 ? head.slice(colonIdx + 1) : "";
      const href = `${type}:${values}`;
      const titleAttr = `${type}:${values}`;

      const chipNode =
        type.toLowerCase() === "coords"
          ? { type: "chip-coord", href, title: titleAttr, label: label || "Location", children: [{ text: "" }] }
          : { type: "chip-mapembed", href, title: titleAttr, children: [{ text: "" }] };
      fmt.insertChip(chipNode);
    },
    [fmt]
  );

  const handleInsertStashedImage = useCallback(
    (filename: string) => {
      fmt.handleInsertImage(`[[File:${filename}|thumb|]]`);
    },
    [fmt]
  );

  return (
    <EditorModalProvider value={state.modalContextValue}>
    <div className="wikios-ve-container">
      <WikiVisualToolbar
        title={title}
        wordCount={state.wordCount}
        isDirty={state.isDirty}
        repulsionProgress={repulsionProgress}
        onSwitchToSource={handleSwitchToSource}
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
        activeFormats={fmt.activeFormats}
        exec={fmt.exec}
        setHeading={fmt.setHeading}
        setParagraph={fmt.setParagraph}
        insertLink={fmt.insertLink}
        removeLink={fmt.removeLink}
        insertHR={fmt.insertHR}
        insertTable={fmt.insertTable}
        insertRef={fmt.insertRef}
        clearFormatting={fmt.clearFormatting}
        insertHtmlAtCursor={fmt.insertHtmlAtCursor}
        saveSelection={fmt.saveSelection}
        restoreSelection={fmt.restoreSelection}
        handleInsertStashedImage={handleInsertStashedImage}
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

      {/* ─── Plate Editor Canvas ─── */}
      <div className="wikios-ve-editor-wrapper">
        <PlateWikiEditor
          initialHtml={initialForPlate}
          onValueChange={handleValueChange}
          openTemplateEditor={handleOpenTemplateEditor}
          deleteNode={() => fmt.removeEditingNode()}
        />
      </div>

      <WikiEditorStatusBar
        cursorPos={{ line: 1, col: 1 }}
        wordCount={state.wordCount}
        lineCount={1}
        formatName="Canvas Block AST"
        encoding="UTF-8"
      />

      <WikiEditorModalHost
        onInsertImage={fmt.handleInsertImage}
        onInsertInfobox={handleInsertInfobox}
        onInsertCountryStats={handleInsertCountryStats}
        onInsertBusinessStats={handleInsertBusinessStats}
        onInsertMapCoords={handleInsertMapCoords}
        editingTemplate={fmt.editingTemplate}
        setEditingTemplate={fmt.setEditingTemplate}
        onUpdateTemplate={fmt.handleTemplateUpdate}
        onRemoveTemplate={handleRemoveTemplate}
      />
    </div>
    </EditorModalProvider>
  );
}
