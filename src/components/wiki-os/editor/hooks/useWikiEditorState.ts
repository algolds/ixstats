// src/components/wiki-os/editor/hooks/useWikiEditorState.ts
// Shared state management for WikiOS Visual and Source editors.

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { clearDraft, saveDraft } from "~/lib/wiki-os/editor/draft-store";
import type {
  StashEntity,
  StashItemEntity,
  WikimediaImageMeta,
  SaveActionType,
} from "../types";
import type { EditorModalState } from "../context/EditorModalContext";

export interface UseWikiEditorStateProps {
  title: string;
  onSave?: (
    content: string,
    summary: string,
    minor: boolean,
    keepEditing?: boolean
  ) => Promise<void> | void;
}

export function useWikiEditorState({ title, onSave }: UseWikiEditorStateProps) {
  const notify = useNotify();

  // Dirty and word count state
  const [isDirty, setIsDirty] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  // Save workflow state
  const [summary, setSummary] = useState("");
  const [minor, setMinor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [saveDropdownOpen, setSaveDropdownOpen] = useState(false);
  const [saveActionType, setSaveActionType] = useState<SaveActionType>("publish");

  // Modals and popovers
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [showInfoboxModal, setShowInfoboxModal] = useState(false);
  const [showCountryStatsModal, setShowCountryStatsModal] = useState(false);
  const [showBusinessStatsModal, setShowBusinessStatsModal] = useState(false);
  const [showMapCoordsModal, setShowMapCoordsModal] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [stashesOpen, setStashesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Warn on unload when dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Editor settings with localStorage sync
  const [enableAutocomplete, setEnableAutocomplete] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("wikios-editor-autocomplete") !== "false";
    }
    return true;
  });

  const handleToggleAutocomplete = useCallback((val: boolean) => {
    setEnableAutocomplete(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("wikios-editor-autocomplete", String(val));
    }
  }, []);

  const [showLineNumbers, setShowLineNumbers] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("wikios-editor-line-numbers") !== "false";
    }
    return true;
  });

  const handleToggleLineNumbers = useCallback((val: boolean) => {
    setShowLineNumbers(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("wikios-editor-line-numbers", String(val));
    }
  }, []);

  const [enableWordWrap, setEnableWordWrap] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("wikios-editor-word-wrap") !== "false";
    }
    return true;
  });

  const handleToggleWordWrap = useCallback((val: boolean) => {
    setEnableWordWrap(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("wikios-editor-word-wrap", String(val));
    }
  }, []);

  // Lazy Stash queries (Only executed when stashesOpen is active)
  const stashesQuery = api.wikios.getStashes.useQuery(undefined, {
    enabled: stashesOpen,
    staleTime: 60_000,
  });
  const stashes = (stashesQuery.data as StashEntity[]) || [];
  const defaultStash = stashes.find((s) => s.isDefault) || stashes[0];
  const [selectedStashId, setSelectedStashId] = useState<string | null>(null);
  const activeStashId = selectedStashId || defaultStash?.id || "";

  const stashItemsQuery = api.wikios.getStashItems.useQuery(
    { stashId: activeStashId, limit: 50 },
    { enabled: stashesOpen && !!activeStashId, staleTime: 30_000 }
  );
  const stashItems = (stashItemsQuery.data?.items as StashItemEntity[]) || [];

  const imageItems = useMemo(() => {
    return stashItems.filter((item) => item.pageTitle.startsWith("commons:"));
  }, [stashItems]);

  const imageTitles = useMemo(() => {
    return imageItems.map((item) => item.pageTitle.replace(/^commons:/, ""));
  }, [imageItems]);

  const { data: resolvedImages } = api.commons.getImageInfoByTitles.useQuery(
    { titles: imageTitles },
    { enabled: stashesOpen && imageTitles.length > 0, staleTime: 5 * 60 * 1000 }
  );

  const imagesMap = useMemo(() => {
    const map = new Map<string, WikimediaImageMeta>();
    if (resolvedImages) {
      for (const img of resolvedImages) {
        map.set(`commons:${img.title}`, img as WikimediaImageMeta);
      }
    }
    return map;
  }, [resolvedImages]);

  // Consolidated Save Workflow
  const executeSave = useCallback(
    async (getContent: () => string) => {
      if (!onSave) return;
      const content = getContent();
      setSaving(true);
      const isSession = saveActionType === "session";
      try {
        await onSave(content, summary, minor, isSession);
        clearDraft(title, "ixwiki");
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
        notify.error("Save Failed", "Could not save article changes.");
      } finally {
        setSaving(false);
      }
    },
    [onSave, saveActionType, summary, minor, title, notify]
  );

  const executeSaveDraft = useCallback(
    (getContent: () => string, mode: "visual" | "source") => {
      const content = getContent();
      try {
        if (mode === "visual") {
          saveDraft({ title, source: "ixwiki", html: content, mode: "visual" });
        } else {
          saveDraft({ title, source: "ixwiki", wikitext: content, mode: "source" });
        }
        setIsDirty(false);
        notify.success("Draft Saved", "Your draft has been saved locally.");
      } catch (err) {
        console.error("Failed to save draft:", err);
        notify.error("Save Draft Failed", "Could not write draft to local storage.");
      }
    },
    [title, notify]
  );

  const modalContextValue: EditorModalState = useMemo(
    () => ({
      showImageSearch,
      setShowImageSearch,
      showInfoboxModal,
      setShowInfoboxModal,
      showCountryStatsModal,
      setShowCountryStatsModal,
      showBusinessStatsModal,
      setShowBusinessStatsModal,
      showMapCoordsModal,
      setShowMapCoordsModal,
      templatesOpen,
      setTemplatesOpen,
      stashesOpen,
      setStashesOpen,
      settingsOpen,
      setSettingsOpen,
      enableAutocomplete,
      handleToggleAutocomplete,
      showLineNumbers,
      handleToggleLineNumbers,
      enableWordWrap,
      handleToggleWordWrap,
      summary,
      setSummary,
      minor,
      setMinor,
      saving,
      showSavePanel,
      setShowSavePanel,
      saveDropdownOpen,
      setSaveDropdownOpen,
      saveActionType,
      setSaveActionType,
      stashes,
      activeStashId,
      setSelectedStashId,
      imageItems,
      imagesMap,
    }),
    [
      showImageSearch, showInfoboxModal, showCountryStatsModal,
      showBusinessStatsModal, showMapCoordsModal,
      templatesOpen, stashesOpen, settingsOpen,
      enableAutocomplete, showLineNumbers, enableWordWrap,
      summary, minor, saving, showSavePanel,
      saveDropdownOpen, saveActionType,
      stashes, activeStashId, imageItems, imagesMap,
    ]
  );

  return {
    notify,
    title,
    isDirty,
    setIsDirty,
    wordCount,
    setWordCount,
    modalContextValue,
    summary,
    setSummary,
    minor,
    setMinor,
    saving,
    setSaving,
    showSavePanel,
    setShowSavePanel,
    saveDropdownOpen,
    setSaveDropdownOpen,
    saveActionType,
    setSaveActionType,
    executeSave,
    executeSaveDraft,
    showImageSearch,
    setShowImageSearch,
    showInfoboxModal,
    setShowInfoboxModal,
    showCountryStatsModal,
    setShowCountryStatsModal,
    showBusinessStatsModal,
    setShowBusinessStatsModal,
    showMapCoordsModal,
    setShowMapCoordsModal,
    templatesOpen,
    setTemplatesOpen,
    stashesOpen,
    setStashesOpen,
    settingsOpen,
    setSettingsOpen,
    enableAutocomplete,
    handleToggleAutocomplete,
    showLineNumbers,
    handleToggleLineNumbers,
    enableWordWrap,
    handleToggleWordWrap,
    stashes,
    selectedStashId,
    setSelectedStashId,
    activeStashId,
    imageItems,
    resolvedImages,
    imagesMap,
  };
}
