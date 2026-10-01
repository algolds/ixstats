"use client";
// src/components/wiki-os/editor/WikiVisualEditor.tsx
// Visual editor on Plate (Slate).
// Operates on native WikiAST blocks and lossless wikitext serialization.

import "~/styles/wiki-os/editors.css";
import React, { useEffect, useRef, useCallback } from "react";
import { useNavigationScroll } from "~/hooks/useNavigationScroll";
import { getDraft, saveDraft } from "~/lib/wiki-os/editor/draft-store";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { parseTemplateWikitext } from "~/lib/wiki-os/editor/parse-template-wikitext";
import { Editor, Transforms, type Descendant } from "slate";
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
  /**
   * Hands the host a function that reads the editor's content as wikitext right now (null when some
   * content has no wikitext yet), and null when the editor goes away.
   */
  registerContentReader?: (read: (() => string | null) | null) => void;
  /**
   * Whether to start from a local draft of this page when one exists. A host that settles the draft
   * question itself (the edit bridge) passes false and hands the text to start from as `initialWikitext`.
   */
  restoreLocalDraft?: boolean;
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
  registerContentReader,
  restoreLocalDraft = true,
}: WikiVisualEditorProps) {
  const editorRef = useRef<PlateEditorLike | null>(null);
  const wtRef = useRef<WikitextSerializeResult>({
    wikitext: initialWikitext || "",
    complete: true,
    notices: [],
  });
  const { repulsionProgress } = useNavigationScroll();
  const { user } = useWikiAuth();
  const userId = user?.id ?? null;

  const state = useWikiEditorState({ title, onSave });
  const fmt = useWikiVisualFormatting({
    title,
    editorRef: editorRef as unknown as React.MutableRefObject<PlateEditorLike | null>,
    setIsDirty: state.setIsDirty,
  });

  // Draft restore prompt
  const initialContent = React.useMemo(() => {
    const existingDraft = restoreLocalDraft ? getDraft(userId, title, "ixwiki") : null;
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
  }, [userId, title, initialHtml, initialWikitext, restoreLocalDraft]);

  const { setIsDirty, setWordCount } = state;
  const onSerializedWikitextRef = useRef(onSerializedWikitext);
  onSerializedWikitextRef.current = onSerializedWikitext;
  const refreshActiveFormats = fmt.refreshActiveFormats;

  const handleValueChange = useCallback(
    (nodes: Descendant[], _html: string, plainText: string) => {
      wtRef.current = serializePlateToWikitext(nodes);
      onSerializedWikitextRef.current?.(wtRef.current);
      setIsDirty(true);
      setWordCount(plainText.split(/\s+/).filter(Boolean).length);
      refreshActiveFormats();
    },
    [setIsDirty, setWordCount, refreshActiveFormats]
  );

  // What a save writes is the serialized wikitext, even when it is empty: an emptied document is an
  // empty page, never the HTML of the editor.
  const handleSave = useCallback(async () => {
    // Never save leftover HTML: blocks without canonical wikitext must be fixed in source mode.
    if (!wtRef.current.complete) {
      state.notify.error(
        "Save Blocked",
        "Some content could not be converted to wikitext; switch to source mode to fix it."
      );
      return;
    }
    const wikitextToSave = wtRef.current.wikitext;
    // Edits that could not be applied as typed, or a block that had to move: the author is told.
    for (const notice of wtRef.current.notices) state.notify.warning("Check the saved page", notice);
    const saved = await state.executeSave(() => wikitextToSave);
    // A published page needs no draft (executeSave cleared it); a failed save keeps the work as one.
    if (!saved) saveDraft(userId, { title, source: "ixwiki", mode: "visual", wikitext: wikitextToSave });
  }, [state, title, userId]);

  const handleSaveDraft = useCallback(() => {
    state.executeSaveDraft(() => wtRef.current.wikitext, "visual");
  }, [state]);

  const handleSwitchToSource = useCallback(() => {
    onSwitchToSource(state.isDirty, wtRef.current.wikitext);
  }, [onSwitchToSource, state.isDirty]);

  useEffect(() => {
    registerContentReader?.(() => (wtRef.current.complete ? wtRef.current.wikitext : null));
    return () => registerContentReader?.(null);
  }, [registerContentReader]);

  const handleOpenTemplateEditor = useCallback(
    (id: string) => {
      const editor = editorRef.current;
      if (!editor || !fmt.setEditingTemplate) return;
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
      setIsDirty(true);
    },
    [editorRef, fmt, setIsDirty]
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
          ? {
              type: "chip-coord",
              href,
              title: titleAttr,
              label: label || "Location",
              wikitext: `[[${href}${label ? "|" + label : ""}]]`,
              children: [{ text: "" }],
            }
          : {
              type: "chip-mapembed",
              href,
              title: titleAttr,
              wikitext: `[[${href}]]`,
              children: [{ text: "" }],
            };
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

  const handleDeleteNode = useCallback(() => {
    fmt.removeEditingNode();
  }, [fmt]);

  const handleEditorReady = useCallback(
    (editor: unknown) => {
      editorRef.current = editor as PlateEditorLike;
      refreshActiveFormats();
    },
    [refreshActiveFormats]
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
            onEditorReady={handleEditorReady}
            onValueChange={handleValueChange}
            onSelectionChange={refreshActiveFormats}
            openTemplateEditor={handleOpenTemplateEditor}
            deleteNode={handleDeleteNode}
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
