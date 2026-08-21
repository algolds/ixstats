// src/components/wiki-os/editor/hooks/useWikiEditorState.ts
// Shared state management for WikiOS Visual and Source editors.

"use client";

import { useState, useCallback, useMemo } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

export interface UseWikiEditorStateProps {
  title: string;
}

export function useWikiEditorState({ title }: UseWikiEditorStateProps) {
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
  const [saveActionType, setSaveActionType] = useState<"publish" | "session">("publish");

  // Modals and popovers
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [showTemplateInserter, setShowTemplateInserter] = useState(false);
  const [showInfoboxModal, setShowInfoboxModal] = useState(false);
  const [showCountryStatsModal, setShowCountryStatsModal] = useState(false);
  const [showBusinessStatsModal, setShowBusinessStatsModal] = useState(false);
  const [showMapCoordsModal, setShowMapCoordsModal] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [stashesOpen, setStashesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Editor settings
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

  const [showLineNumbers, setShowLineNumbers] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("wikios-editor-line-numbers") !== "false";
    }
    return true;
  });

  const handleToggleLineNumbers = useCallback((val: boolean) => {
    setShowLineNumbers(val);
    localStorage.setItem("wikios-editor-line-numbers", String(val));
  }, []);

  const [enableWordWrap, setEnableWordWrap] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("wikios-editor-word-wrap") !== "false";
    }
    return true;
  });

  const handleToggleWordWrap = useCallback((val: boolean) => {
    setEnableWordWrap(val);
    localStorage.setItem("wikios-editor-word-wrap", String(val));
  }, []);

  // Stash queries and image resolution
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

  return {
    notify,
    title,
    isDirty,
    setIsDirty,
    wordCount,
    setWordCount,
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
    showImageSearch,
    setShowImageSearch,
    showTemplateInserter,
    setShowTemplateInserter,
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
