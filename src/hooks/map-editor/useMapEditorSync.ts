"use client";

import { useMemo, useCallback, useRef } from "react";
import { api } from "~/trpc/react";
import type { EditorFeature } from "./editor-types";

interface UseMapEditorSyncProps {
  countryId?: string;
  skipLinkageGate?: boolean;
}

export function useMapEditorSync({
  countryId,
  skipLinkageGate = false,
}: UseMapEditorSyncProps) {
  const utils = api.useUtils();
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Queries
  const {
    data: countryGeo,
    isLoading: geometryLoading,
    refetch: refetchCountryGeo,
  } = api.geoCore.getCountryPolygon.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId }
  );

  const {
    data: linkage,
    isLoading: linkageLoading,
  } = api.geoLinkage.getLinkageStatus.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId && !skipLinkageGate }
  );

  const {
    data: features,
    isLoading: featuresLoading,
    refetch: refetchGeoFeatures,
  } = api.geoFeatures.getFeaturesByCountry.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId && (skipLinkageGate || !!linkage?.isLinked) }
  );

  const {
    data: routes,
    isLoading: routesLoading,
    refetch: refetchRoutes,
  } = api.geoRoutes.getRoutesByCountry.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId && (skipLinkageGate || !!linkage?.isLinked) }
  );

  // Invalidation & Refetch
  const invalidateAllMapData = useCallback(() => {
    if (!countryId) return;
    utils.geoFeatures.getFeaturesByCountry.invalidate({ countryId });
    utils.geoRoutes.getRoutesByCountry.invalidate({ countryId });
    utils.geoCore.getCountryPolygon.invalidate({ countryId });
  }, [countryId, utils]);

  const refetchFeatures = useCallback(() => {
    refetchGeoFeatures();
    refetchRoutes();
    refetchCountryGeo();
  }, [refetchGeoFeatures, refetchRoutes, refetchCountryGeo]);

  const debouncedRefetch = useCallback(() => {
    if (refetchTimerRef.current) {
      clearTimeout(refetchTimerRef.current);
    }
    refetchTimerRef.current = setTimeout(() => {
      refetchFeatures();
    }, 200);
  }, [refetchFeatures]);

  // Aggregate All Features
  const allFeatures: EditorFeature[] = useMemo(() => {
    if (!features) return [];
    const list: EditorFeature[] = [];

    (features.cities || []).forEach((c) => {
      list.push({
        id: c.id,
        type: "city",
        name: c.name,
        coordinates: (c.coordinates as [number, number]) || undefined,
        properties: c,
      });
    });

    (features.subdivisions || []).forEach((s) => {
      list.push({
        id: s.id,
        type: "subdivision",
        name: s.name,
        geometry: (s.geometry as object) || undefined,
        properties: s,
      });
    });

    (features.pointsOfInterest || []).forEach((p) => {
      list.push({
        id: p.id,
        type: "poi",
        name: p.name,
        coordinates: (p.coordinates as [number, number]) || undefined,
        properties: p,
      });
    });

    (features.storyPins || []).forEach((sp) => {
      list.push({
        id: sp.id,
        type: "storyPin",
        name: sp.title,
        coordinates: (sp.coordinates as [number, number]) || undefined,
        properties: sp,
      });
    });

    (features.mapLabels || []).forEach((ml) => {
      list.push({
        id: ml.id,
        type: "mapLabel",
        name: ml.text,
        coordinates: (ml.coordinates as [number, number]) || undefined,
        properties: ml,
      });
    });

    (features.peaks || []).forEach((pk) => {
      list.push({
        id: pk.id,
        type: "peak",
        name: pk.name,
        coordinates: (pk.coordinates as [number, number]) || undefined,
        properties: pk,
      });
    });

    (features.rivers || []).forEach((r) => {
      list.push({
        id: r.id,
        type: "river",
        name: r.name,
        geometry: (r.geometry as object) || undefined,
        properties: r,
      });
    });

    (features.lakes || []).forEach((l) => {
      list.push({
        id: l.id,
        type: "lake",
        name: l.name,
        geometry: (l.geometry as object) || undefined,
        properties: l,
      });
    });

    (routes || []).forEach((rt: any) => {
      list.push({
        id: rt.id,
        type: "route",
        name: rt.name,
        geometry: rt.geometry || undefined,
        properties: rt,
      });
    });

    return list;
  }, [features, routes]);

  return {
    countryGeo,
    geometryLoading,
    linkage,
    linkageLoading,
    features,
    featuresLoading: featuresLoading || routesLoading,
    routes,
    routesLoading,
    allFeatures,
    refetchFeatures,
    debouncedRefetch,
    invalidateAllMapData,
  };
}
