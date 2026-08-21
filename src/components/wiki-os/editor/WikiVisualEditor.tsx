// src/components/wiki-os/editor/WikiVisualEditor.tsx
// Hybrid visual editor — Parsoid HTML in contenteditable with React toolbar.
// Templates render as live HTML with click-to-edit. Preserves data-mw for roundtrip.

"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { useNavigationScroll } from "~/hooks/useNavigationScroll";
import { fixEditorImageUrls } from "~/lib/wiki-os/fix-editor-images";
import { useWikiEditorState } from "./hooks/useWikiEditorState";
import { useWikiVisualFormatting } from "./hooks/useWikiVisualFormatting";
import { WikiVisualToolbar } from "./components/WikiVisualToolbar";
import { WikiEditorSavePanel } from "./components/WikiEditorSavePanel";
import { WikiEditorModalHost } from "./components/WikiEditorModalHost";

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

export function WikiVisualEditor({
  initialHtml,
  title,
  onSave,
  onCancel,
  onSwitchToSource,
}: WikiVisualEditorProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useNavigationScroll();
  const repulsionProgress = Math.min(1, Math.max(0, scrollY / 56));

  const state = useWikiEditorState({ title });
  const fmt = useWikiVisualFormatting({
    title,
    editableRef,
    setIsDirty: state.setIsDirty,
  });

  // Load initial HTML into contenteditable div on mount
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (editableRef.current) {
      const fixed = fixEditorImageUrls(initialHtml);
      editableRef.current.innerHTML = fixed;
      fmt.protectTemplatesAndImages(editableRef.current);
      state.setWordCount(editableRef.current.innerText.split(/\s+/).filter(Boolean).length);

      const draft = localStorage.getItem(`wikios-draft-html-${title}`);
      if (draft && draft !== fixed) {
        timer = setTimeout(() => {
          const restore = window.confirm(
            `An unsaved local draft from a previous session was found for "${title}". Would you like to restore it?`
          );
          if (restore && editableRef.current) {
            editableRef.current.innerHTML = draft;
            fmt.protectTemplatesAndImages(editableRef.current);
            state.setIsDirty(true);
          }
        }, 100);
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [title, initialHtml, fmt.protectTemplatesAndImages, state.setIsDirty, state.setWordCount]);

  // Dirty tracking, word count, beforeunload
  const handleInput = useCallback(() => {
    state.setIsDirty(true);
    if (editableRef.current) {
      state.setWordCount(editableRef.current.innerText.split(/\s+/).filter(Boolean).length);
    }
  }, [state.setIsDirty, state.setWordCount]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.isDirty]);

  // Save actions
  const handleSave = useCallback(async () => {
    const html = editableRef.current?.innerHTML ?? "";
    state.setSaving(true);
    const isSession = state.saveActionType === "session";
    try {
      await onSave(html, state.summary, state.minor, isSession);
      localStorage.removeItem(`wikios-draft-html-${title}`);
      state.setIsDirty(false);
      state.setShowSavePanel(false);
      state.notify.success(
        isSession ? "Session Saved" : "Article Published",
        isSession
          ? "Your progress has been saved successfully."
          : "Your changes have been published to the wiki."
      );
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      state.setSaving(false);
    }
  }, [onSave, state, title]);

  const handleSaveDraft = useCallback(() => {
    const html = editableRef.current?.innerHTML ?? "";
    try {
      localStorage.setItem(`wikios-draft-html-${title}`, html);
      state.setIsDirty(false);
      state.notify.success("Draft Saved", "Your draft has been saved locally.");
    } catch (err) {
      console.error("Failed to save draft:", err);
      state.notify.error("Save Draft Failed", "Could not write draft to local storage.");
    }
  }, [title, state]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            fmt.exec("bold");
            break;
          case "i":
            e.preventDefault();
            fmt.exec("italic");
            break;
          case "u":
            e.preventDefault();
            fmt.exec("underline");
            break;
          case "k":
            e.preventDefault();
            fmt.insertLink();
            break;
          case "s":
            e.preventDefault();
            handleSave();
            break;
          case "z":
          case "y":
            break;
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        if (e.key.toLowerCase() === "x") {
          e.preventDefault();
          fmt.exec("strikeThrough");
        }
      }
    },
    [fmt, handleSave]
  );

  // Template and Image Handlers
  const handleInsertInfobox = useCallback(
    (wikitext: string) => {
      const clean = wikitext.trim().replace(/^\{\{/, "").replace(/\}\}$/, "");
      const parts = clean.split("|");
      const name = parts[0]?.trim() || "Infobox";
      const params: Record<string, string> = {};
      for (let i = 1; i < parts.length; i++) {
        const p = parts[i]!;
        const eq = p.indexOf("=");
        if (eq !== -1) {
          params[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
        }
      }
      fmt.handleInsertTemplate(name, params);
    },
    [fmt]
  );

  const handleInsertCountryStats = useCallback(
    (wikitext: string) => {
      const clean = wikitext.trim().replace(/^\{\{/, "").replace(/\}\}$/, "");
      const parts = clean.split("|");
      const name = parts[0]?.trim() || "CountryData";
      const params: Record<string, string> = {};
      for (let i = 1; i < parts.length; i++) {
        const p = parts[i]!;
        const eq = p.indexOf("=");
        if (eq !== -1) {
          params[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
        }
      }
      fmt.handleInsertTemplate(name, params);
    },
    [fmt]
  );

  const handleInsertBusinessStats = useCallback(
    (wikitext: string) => {
      const clean = wikitext.trim().replace(/^\{\{/, "").replace(/\}\}$/, "");
      const parts = clean.split("|");
      const name = parts[0]?.trim() || "BusinessData";
      const params: Record<string, string> = {};
      for (let i = 1; i < parts.length; i++) {
        const p = parts[i]!;
        const eq = p.indexOf("=");
        if (eq !== -1) {
          params[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
        }
      }
      fmt.handleInsertTemplate(name, params);
    },
    [fmt]
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

      const anchor = document.createElement("a");
      anchor.contentEditable = "false";
      anchor.setAttribute("href", `${type}:${values}`);
      anchor.setAttribute("title", `${type}:${values}`);

      if (type.toLowerCase() === "coords") {
        anchor.className = "wikios-ve-custom-chip chip-coords";
        anchor.innerHTML = `<span class="opacity-70">📍</span> ${label || "Location"}`;
      } else {
        anchor.className = "wikios-ve-custom-chip chip-mapembed";
        anchor.innerHTML = `<span class="opacity-70">🗺️</span> Map Embed`;
      }
      fmt.insertNodeAtCursor(anchor);
    },
    [fmt]
  );

  const handleInsertStashedImage = useCallback(
    (filename: string) => {
      fmt.handleInsertImage(`[[File:${filename}|thumb|]]`);
    },
    [fmt]
  );

  const handleRemoveTemplate = useCallback(() => {
    if (fmt.editingTemplate) {
      fmt.editingTemplate.element.remove();
      fmt.setEditingTemplate(null);
      state.setIsDirty(true);
    }
  }, [fmt, state.setIsDirty]);

  return (
    <div className="wikios-ve-container">
      <WikiVisualToolbar
        title={title}
        wordCount={state.wordCount}
        isDirty={state.isDirty}
        repulsionProgress={repulsionProgress}
        onSwitchToSource={() => {
          const currentHtml = editableRef.current?.innerHTML ?? "";
          onSwitchToSource(state.isDirty, currentHtml);
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
        setShowImageSearch={state.setShowImageSearch}
        setShowInfoboxModal={state.setShowInfoboxModal}
        setShowCountryStatsModal={state.setShowCountryStatsModal}
        setShowBusinessStatsModal={state.setShowBusinessStatsModal}
        setShowMapCoordsModal={state.setShowMapCoordsModal}
        setShowTemplateInserter={state.setShowTemplateInserter}
        stashesOpen={state.stashesOpen}
        setStashesOpen={state.setStashesOpen}
        templatesOpen={state.templatesOpen}
        setTemplatesOpen={state.setTemplatesOpen}
        settingsOpen={state.settingsOpen}
        setSettingsOpen={state.setSettingsOpen}
        enableAutocomplete={state.enableAutocomplete}
        handleToggleAutocomplete={state.handleToggleAutocomplete}
        stashes={state.stashes}
        activeStashId={state.activeStashId}
        setSelectedStashId={state.setSelectedStashId}
        imageItems={state.imageItems}
        imagesMap={state.imagesMap}
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

      {/* ─── ContentEditable Editor Canvas ─── */}
      <div className="wikios-ve-editor-wrapper">
        <div
          ref={editableRef}
          className="wikios-ve-content"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          spellCheck
        />
      </div>

      <WikiEditorModalHost
        showImageSearch={state.showImageSearch}
        setShowImageSearch={state.setShowImageSearch}
        onInsertImage={fmt.handleInsertImage}
        showTemplateInserter={state.showTemplateInserter}
        setShowTemplateInserter={state.setShowTemplateInserter}
        onInsertTemplate={fmt.handleInsertTemplate}
        showInfoboxModal={state.showInfoboxModal}
        setShowInfoboxModal={state.setShowInfoboxModal}
        onInsertInfobox={handleInsertInfobox}
        showCountryStatsModal={state.showCountryStatsModal}
        setShowCountryStatsModal={state.setShowCountryStatsModal}
        onInsertCountryStats={handleInsertCountryStats}
        showBusinessStatsModal={state.showBusinessStatsModal}
        setShowBusinessStatsModal={state.setShowBusinessStatsModal}
        onInsertBusinessStats={handleInsertBusinessStats}
        showMapCoordsModal={state.showMapCoordsModal}
        setShowMapCoordsModal={state.setShowMapCoordsModal}
        onInsertMapCoords={handleInsertMapCoords}
        editingTemplate={fmt.editingTemplate}
        setEditingTemplate={fmt.setEditingTemplate}
        onUpdateTemplate={fmt.handleTemplateUpdate}
        onRemoveTemplate={handleRemoveTemplate}
      />
    </div>
  );
}
