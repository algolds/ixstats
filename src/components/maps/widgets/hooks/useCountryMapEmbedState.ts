"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";

interface UseCountryMapEmbedStateProps {
  countryId: string;
  highlightCountryIds?: string[];
  highlightCountryNames?: string[];
}

export function useCountryMapEmbedState({
  countryId,
  highlightCountryIds,
  highlightCountryNames,
}: UseCountryMapEmbedStateProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any | null>(null);
  const neighborGeoRef = useRef<any | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const query = useCountryMapEmbed(countryId);

  const highlightCountryIdsStr = JSON.stringify(highlightCountryIds);
  const highlightIdsMemo = useMemo(
    () => new Set(highlightCountryIds || []),
    [highlightCountryIdsStr]
  );

  const highlightCountryNamesStr = JSON.stringify(highlightCountryNames);
  const highlightNamesMemo = useMemo(
    () => new Set(highlightCountryNames || []),
    [highlightCountryNamesStr]
  );

  // Resize map when container dimensions change
  useEffect(() => {
    if (!containerRef.current || !mapRef.current) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [mapReady]);

  return {
    containerRef,
    mapRef,
    neighborGeoRef,
    mapReady,
    setMapReady,
    highlightIdsMemo,
    highlightNamesMemo,
    ...query,
  };
}
