"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "~/trpc/react";

interface UseStoryPinModalStateProps {
  pinId: string;
  onClose: () => void;
  onFlyTo?: (lng: number, lat: number) => void;
  onNavigateToPin?: (pinId: string) => void;
}

export function useStoryPinModalState({
  pinId,
  onClose,
  onFlyTo,
  onNavigateToPin,
}: UseStoryPinModalStateProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Fetch full pin data with wiki enrichment
  const { data, isLoading } = api.geoFeatures.getStoryPinFull.useQuery(
    { pinId },
    { staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleFlyTo = useCallback(() => {
    if (!data?.pin?.coordinates) return;
    const coords = data.pin.coordinates as [number, number];
    onFlyTo?.(coords[0], coords[1]);
    onClose();
  }, [data, onFlyTo, onClose]);

  const handleNavigatePin = useCallback(
    (targetPinId: string) => {
      onNavigateToPin?.(targetPinId);
    },
    [onNavigateToPin]
  );

  return {
    lightboxSrc,
    setLightboxSrc,
    data,
    isLoading,
    handleFlyTo,
    handleNavigatePin,
  };
}
