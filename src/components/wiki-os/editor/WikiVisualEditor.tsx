// src/components/wiki-os/editor/WikiVisualEditor.tsx
// Visual editor on Plate (Slate).
// Operates on native WikiAST blocks and lossless wikitext serialization.

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
import { PlateWikiEditor } from "./plate/PlateWikiEditor";
import type { WikitextSerializeResult } from "./plate/wiki-wikitext";
import { serializePlateToWikitext } from "./plate/wiki-wikitext";
import { fixEditorImageUrls } from "~/lib/wiki-os/transformers/fix-editor-images";
import type { TSlateEditor } from "platejs";

export interface WikiVisualEditorProps {
  initialHtml?: string;
  initialWikitext?: string;
  title: string;
  onSave: (
    wikitextOrHtml: string,
    summary: string,
    minor: boolean,
    keepEditing?: boolean
  ) => Promise<void> | void;
  onCancel: () => void;
  onSwitchToSource: (dirty: boolean, currentContent: string) => void;
  /** Reports the client-side wikitext serialization after every change. */
  onSerializedWikitext?: (result: WikitextSerializeResult) => void;
}

type PlateEditorLike = TSlateEditor;

export function WikiVisualEditor({
  initialHtml,
  initialWikitext,
  title,
  onSave,
  onCancel,
  onSwitchToSource,
  onSerializedWikitext,
}: WikiVisualEditorProps) {
  const editorRef = useRef<PlateEditorLike | null>(null);
  const htmlRef = useRef<string>(initialHtml || "");
  const wtRef = useRef<WikitextSerializeResult>({ wikitext: initialWikitext || "", complete: true });
  const { repulsionProgress } = useNavigationScroll();

  const state = useWikiEditorState({ title, onSave });
  const fmt = useWikiVisualFormatting({
    title,
    editorRef: editorRef as unknown as React.MutableRefObject<PlateEditorLike | null>,
    setIsDirty: state.setIsDirty,
  });

  // Draft restore prompt
  const initialContent = React.useMemo(() => {
    const existingDraft = getDraft(title, "ixwiki");
    if (existingDraft?.wikitext) {
      return { wikitext: existingDraft.wikitext };
    }
    if (existingDraft?.html) {
      return { html: fixEditorImageUrls(existingDraft.html) };
    }
    if (initialWikitext !== undefined) {
      return { wikitext: initialWikitext };
    }
    return { html: fixEditorImageUrls(initialHtml || "") };
  }, [title, initialHtml, initialWikitext]);

  const handleValueChange = useCallback(
    (nodes: Descendant[], html: string, plainText: string) => {
      htmlRef.current = html;
      wtRef.current = serializePlateToWikitext(nodes);
      onSerializedWikitext?.(wtRef.current);
      state.setIsDirty(true);
      state.setWordCount(plainText.split(/\s+/).filter(Boolean).length);
      fmt.refreshActiveFormats();
    },
    [state, onSerializedWikitext, fmt]
  );

  const handleSave = useCallback(async () => {
    const wikitextToSave = wtRef.current.wikitext || htmlRef.current;
    await state.executeSave(() => wikitextToSave);
    saveDraft({ title, source: "ixwiki", mode: "visual", wikitext: wikitextToSave });
  }, [state, title]);

  const handleSaveDraft = useCallback(() => {
    const wikitextToSave = wtRef.current.wikitext || htmlRef.current;
    state.executeSaveDraft(() => wikitextToSave, "visual");
  }, [state]);

  const handleSwitchToSource = useCallback(() => {
    onSwitchToSource(state.isDirty, wtRef.current.wikitext || htmlRef.current);
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

  const handleUpdateTemplateRaw = useCallback(
    (wikitext: string) => {
      const editor = editorRef.current;
      if (!editor || !fmt.editingTemplate) return;
      const { id } = fmt.editingTemplate;
      const { Editor, Transforms } = require("slate") as typeof import("slate");
      const entries = Array.from(
        Editor.nodes(editor as unknown as import("slate").BaseEditor, {
          at: [],
          match: (n) => (n as unknown as { id?: string }).id === id,
        })
      );
      if (entries.length === 0) return;
      const [, path] = entries[0]!;
      Transforms.setNodes(
        editor as unknown as import("slate").BaseEditor,
        { rawWikitext: wikitext, wikitext } as unknown as Partial<import("slate").Descendant>,
        { at: path }
      );
      fmt.setEditingTemplate(null);
      state.setIsDirty(true);
    },
    [editorRef, fmt, state]
  );

  const handleUpdateInfoboxFields = useCallback(
    (id: string, fields: Array<{ label: string; value: string }>) => {
      const editor = editorRef.current;
      if (!editor) return;
      const { Editor, Transforms } = require("slate") as typeof import("slate");
      const entries = Array.from(
        Editor.nodes(editor as unknown as import("slate").BaseEditor, {
          at: [],
          match: (n) => (n as unknown as { id?: string }).id === id,
        })
      );
      if (entries.length === 0) return;
      const [, path] = entries[0]!;
      Transforms.setNodes(
        editor as unknown as import("slate").BaseEditor,
        { fields, edited: true } as unknown as Partial<import("slate").Descendant>,
        { at: path }
      );
      state.setIsDirty(true);
    },
    [editorRef, state]
  );

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
          ? { type: "chip-coord", href, title: titleAttr, label: label || "Location", wikitext: `[[${href}${label ? "|" + label : ""}]]`, children: [{ text: "" }] }
          : { type: "chip-mapembed", href, title: titleAttr, wikitext: `[[${href}]]`, children: [{ text: "" }] };
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
            initialHtml={initialContent.html}
            initialWikitext={initialContent.wikitext}
            onValueChange={handleValueChange}
            openTemplateEditor={handleOpenTemplateEditor}
            deleteNode={() => fmt.removeEditingNode()}
            updateInfoboxFields={handleUpdateInfoboxFields}
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
          onUpdateTemplateRaw={handleUpdateTemplateRaw}
          onRemoveTemplate={handleRemoveTemplate}
        />
      </div>
    </EditorModalProvider>
  );
}
