"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "~/trpc/react";

const SPORT_COMMONS_CATEGORIES: Record<string, string> = {
  soccer: "Association football stadiums",
  football: "American football stadiums",
  hockey: "Ice hockey arenas",
  basketball: "Basketball venues",
  baseball: "Baseball stadiums",
  f1: "Formula One circuits",
  boxing: "Boxing matches",
};

/**
 * The league creator's cover image: a Wikimedia Commons file for the chosen sport, picked once per
 * preset from step 2 on, with shuffle and remove; `setCoverImage` takes a file picked elsewhere.
 */
export function useLeagueCoverImage({
  open,
  selectedPresetKey,
  currentStep,
}: {
  open: boolean;
  selectedPresetKey: string | null;
  currentStep: number;
}) {
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [autoSelectedForPreset, setAutoSelectedForPreset] = useState<string | null>(null);

  // Commons category query
  const activeCategory = selectedPresetKey ? SPORT_COMMONS_CATEGORIES[selectedPresetKey] : null;
  const { data: commonsData, isLoading: commonsLoading } = api.commons.getCategoryFiles.useQuery(
    {
      category: activeCategory ?? "",
      limit: 35,
    },
    {
      enabled: !!open && !!activeCategory && currentStep >= 2,
    }
  );

  useEffect(() => {
    if (selectedPresetKey !== autoSelectedForPreset) {
      setAutoSelectedForPreset(null);
    }
  }, [selectedPresetKey, autoSelectedForPreset]);

  useEffect(() => {
    if (
      commonsData?.images &&
      commonsData.images.length > 0 &&
      selectedPresetKey &&
      autoSelectedForPreset !== selectedPresetKey &&
      !coverImage
    ) {
      const randomIndex = Math.floor(Math.random() * commonsData.images.length);
      const suggestedImage = commonsData.images[randomIndex]?.url ?? null;
      if (suggestedImage) {
        setCoverImage(suggestedImage);
        setAutoSelectedForPreset(selectedPresetKey);
      }
    }
  }, [commonsData, selectedPresetKey, autoSelectedForPreset, coverImage]);

  const handleShuffleCover = useCallback(() => {
    if (!commonsData?.images || commonsData.images.length === 0) return;
    const available = commonsData.images.filter((img) => img.url !== coverImage);
    if (available.length > 0) {
      const randomIndex = Math.floor(Math.random() * available.length);
      const newUrl = available[randomIndex]?.url;
      if (newUrl) {
        setCoverImage(newUrl);
      }
    } else {
      const randomIndex = Math.floor(Math.random() * commonsData.images.length);
      const newUrl = commonsData.images[randomIndex]?.url;
      if (newUrl) {
        setCoverImage(newUrl);
      }
    }
  }, [commonsData, coverImage]);

  const handleRemoveCover = useCallback(() => {
    setCoverImage(null);
  }, []);

  const resetCover = useCallback(() => {
    setCoverImage(null);
    setAutoSelectedForPreset(null);
  }, []);

  return {
    coverImage,
    setCoverImage,
    commonsData,
    commonsLoading,
    handleShuffleCover,
    handleRemoveCover,
    resetCover,
  };
}
