"use client";

/**
 * useProvinceImporter - State machine hook for the province import wizard.
 *
 * Manages the 6-step wizard flow: upload → names → align → snap → validate → commit.
 * State lives in one reducer (`importer-state.ts`); this hook runs the tRPC calls and the
 * alignment/topology pure functions and dispatches their results.
 */

import { useReducer, useCallback, useMemo, useEffect } from "react";
import { useNotify } from "~/hooks/useNotify";
import { api, type RouterOutputs } from "~/trpc/react";
import type {
  ProvinceFeature,
  ImportStep,
  AlignmentMode,
  ReferencePoint,
  AffineMatrix,
  ManualTransform,
} from "~/lib/maps/province-importer/types";
import {
  computeAffineFromReferencePoints,
  autoAlignToCountryBorder,
  manualTransformToMatrix,
  applyAffineToProvinces,
  snapProvincesToBorderMultiRing,
} from "~/lib/maps/province-importer/alignment";
import { applyCityAffine } from "~/lib/city-importer/align-cities";
import {
  validateTopology,
  autoFillGaps,
  resolveOverlaps,
  clipProvincesToBorder,
  simplifyProvinces,
} from "~/lib/maps/province-importer/topology";
import {
  conformProvincesToBorder,
  hasValidLngLat,
  snapCitiesToBorder,
  type AlignedCity,
} from "~/lib/maps/province-importer/commit-prep";
import {
  IMPORT_STEPS,
  createSession,
  importerReducer,
  initialImporterState,
  type ImportScope,
  type ImporterSettings,
  type ParsedUpload,
} from "~/lib/maps/province-importer/importer-state";
import type { Polygon, MultiPolygon } from "geojson";

const IDENTITY_MATRIX: AffineMatrix = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

/** Read-only stand-in for "nothing parsed yet", so the returned fields keep their old defaults. */
const EMPTY_SESSION = createSession({
  uploadId: null,
  rawSvgContent: "",
  provinces: [],
  countryBorder: null,
  parseLog: [],
  detectedLayers: [],
  cityData: null,
});

type ParseOutput = RouterOutputs["geoAdmin"]["parseProvinceUpload"];

function toParsedUpload(
  result: ParseOutput,
  rawSvgContent: string,
  uploadId: string | null
): ParsedUpload {
  return {
    uploadId,
    rawSvgContent,
    provinces: result.provinces as unknown as ProvinceFeature[],
    countryBorder: (result.countryBorder as unknown as Polygon | MultiPolygon | null) ?? null,
    parseLog: result.log,
    detectedLayers: result.layersFound,
    cityData: result.cityData ?? null,
  };
}

function isIdentity(mt: ManualTransform): boolean {
  return mt.translate[0] === 0 && mt.translate[1] === 0 && mt.rotate === 0 && mt.scale === 1;
}

/** Mean of a set of points; null when there are none. */
function meanCentre(points: [number, number][]): [number, number] | null {
  if (points.length === 0) return null;
  const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const cy = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  return [cx, cy];
}

function cityName(c: AlignedCity, index: number): string {
  return c.name.trim() || `Unnamed City ${index + 1}`;
}

export function useProvinceImporter(countryId: string) {
  const notify = useNotify();
  const [state, dispatch] = useReducer(importerReducer, initialImporterState);
  const { wizard, status, settings } = state;
  const { step } = wizard;
  const session = wizard.session;
  const s = session ?? EMPTY_SESSION;
  const validationReport = "validationReport" in wizard ? wizard.validationReport : null;
  const {
    importScope,
    importCities,
    alignmentMode,
    manualTransform,
    snapTolerance,
    simplifyTolerance,
    replaceExisting,
  } = settings;

  // tRPC Mutations
  const utils = api.useUtils();
  const parseMutation = api.geoAdmin.parseProvinceUpload.useMutation();
  const parseCitySvgMutation = api.geoAdmin.parseCitySvg.useMutation();
  const commitCityMutation = api.geoAdmin.commitCityImport.useMutation({
    onSuccess: (data) => {
      void utils.geoCore.getCountryFeatures.invalidate();
      void utils.realms.map.version.invalidate();
      void utils.geoCore.getMapBundleMarkers.invalidate();
      void utils.geoCore.getMapBundleDetail.invalidate();
      void utils.geoCore.getCapitalCities.invalidate();
      void utils.geoCore.getCountryGeometry.invalidate();

      const summary = data?.created ? `${data.created} cities added/updated` : "no changes";
      notify.success(`Cities imported (${summary})`);
    },
    onError: (err) => {
      notify.error(err?.message || "City import failed");
    },
  });
  const commitMutation = api.geoAdmin.commitProvinceImport.useMutation({
    onSuccess: (data) => {
      // Invalidate every client-side cache that renders provinces/cities so the
      // map editor's feature layer AND the base "political" world-map layer
      // refetch and display the newly imported data. The server already cleared
      // its own caches in commitProvinceImport; without these client-side
      // invalidations the map never visually updates after an import.
      void utils.geoCore.getCountryFeatures.invalidate();
      void utils.realms.map.version.invalidate();
      void utils.geoCore.getMapBundleMarkers.invalidate();
      void utils.geoCore.getMapBundleDetail.invalidate();
      void utils.geoCore.getCapitalCities.invalidate();
      void utils.geoCore.getCountryGeometry.invalidate();
      void utils.geoAdmin.getProvinceImportPreview.invalidate();

      const parts: string[] = [];
      if (data?.created) parts.push(`${data.created} added`);
      if (data?.updated) parts.push(`${data.updated} updated`);
      if (data?.citiesCreated)
        parts.push(`${data.citiesCreated} cit${data.citiesCreated === 1 ? "y" : "ies"}`);
      const summary = parts.length > 0 ? parts.join(", ") : "no changes";
      notify.success(
        data?.replaced ? `Provinces replaced (${summary})` : `Provinces imported (${summary})`
      );
    },
    onError: (err) => {
      notify.error(err?.message || "Province import failed");
    },
  });
  const previewQuery = api.geoAdmin.getProvinceImportPreview.useQuery(
    { countryId },
    // The World Editor mounts the importer with no country ("__none__"); previewing that is FORBIDDEN.
    { enabled: countryId !== "__none__" && (step === "upload" || step === "commit") }
  );

  // Current Provinces (for display and as the source of every later pipeline stage)
  const currentProvinces = useMemo(
    () => (s.alignedProvinces.length > 0 ? s.alignedProvinces : s.rawProvinces),
    [s.alignedProvinces, s.rawProvinces]
  );

  const includedCount = useMemo(
    () => currentProvinces.filter((p) => p.included).length,
    [currentProvinces]
  );

  // Auto-align after parsing
  // When raw provinces and country border are both available, automatically
  // apply bbox+ICP alignment so provinces appear near the country on the map
  // instead of staying in SVG pixel space.
  useEffect(() => {
    if (s.autoAligned || s.rawProvinces.length === 0 || !s.countryBorder) return;

    try {
      const result = autoAlignToCountryBorder(s.rawProvinces, s.countryBorder);
      const provinces = applyAffineToProvinces(s.rawProvinces, result.matrix);
      dispatch({ type: "aligned", transform: result.matrix, provinces, auto: true });
    } catch {
      // Silently fail — user can still align manually
    }
  }, [s.autoAligned, s.rawProvinces, s.countryBorder]);

  // Real-time manual transform preview
  // When the user changes manual sliders, immediately update the preview
  // instead of requiring an "Apply Transform" button click.
  useEffect(() => {
    if (alignmentMode !== "manual" || isIdentity(manualTransform)) return;

    // Use aligned provinces as base if available (preserves auto-alignment), otherwise raw
    const base = s.autoAligned
      ? applyAffineToProvinces(s.rawProvinces, s.transform ?? IDENTITY_MATRIX)
      : s.rawProvinces;
    const centre = meanCentre(base.filter((p) => p.included).map((p) => p.centroid));
    if (!centre) return;

    const manualMatrix = manualTransformToMatrix(manualTransform, centre);
    dispatch({ type: "provincesReplaced", provinces: applyAffineToProvinces(base, manualMatrix) });
  }, [manualTransform, alignmentMode, s.rawProvinces, s.transform, s.autoAligned]);

  // Step Navigation
  const stepIndex = IMPORT_STEPS.indexOf(step);
  const canGoNext = stepIndex < IMPORT_STEPS.length - 1;
  const canGoBack = stepIndex > 0;

  const goToStep = useCallback((target: ImportStep) => {
    dispatch({ type: "stepChanged", step: target });
  }, []);

  const goNext = useCallback(() => {
    // Enforce border conformance when leaving snap step
    const clipped =
      step === "snap" && s.countryBorder
        ? clipProvincesToBorder(currentProvinces, s.countryBorder)
        : null;
    dispatch({ type: "advanced", clipped });
  }, [step, s.countryBorder, currentProvinces]);

  const goBack = useCallback(() => {
    dispatch({ type: "retreated" });
  }, []);

  // Upload Step
  const runParse = useCallback(async (load: () => Promise<ParsedUpload>, fallback: string) => {
    dispatch({ type: "processingStarted" });
    try {
      dispatch({ type: "parsed", upload: await load() });
    } catch (err) {
      dispatch({ type: "failed", message: err instanceof Error ? err.message : fallback });
    }
  }, []);

  const handleUpload = useCallback(
    (file: File) =>
      runParse(async () => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("countryId", countryId);

        const uploadResponse = await fetch("/api/upload-province", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || "Upload failed");
        }

        const uploadData = await uploadResponse.json();
        const text = await file.text();

        // Parse the uploaded SVG
        const result = await parseMutation.mutateAsync({ countryId, uploadId: uploadData.id });
        return toParsedUpload(result, text, uploadData.id);
      }, "Upload failed"),
    [countryId, parseMutation, runParse]
  );

  const handleDirectSvg = useCallback(
    (svgContent: string) =>
      runParse(async () => {
        const result = await parseMutation.mutateAsync({ countryId, svgContent });
        return toParsedUpload(result, svgContent, null);
      }, "Parse failed"),
    [countryId, parseMutation, runParse]
  );

  const setImportScope = useCallback((scope: ImportScope) => {
    dispatch({ type: "scopeChanged", scope });
  }, []);

  const changeSettings = useCallback((patch: Partial<Omit<ImporterSettings, "importScope">>) => {
    dispatch({ type: "settingsChanged", patch });
  }, []);

  // Names Step
  const updateProvinceName = useCallback((sourceId: string, name: string) => {
    dispatch({ type: "provinceRenamed", sourceId, name });
  }, []);

  const toggleProvinceIncluded = useCallback((sourceId: string) => {
    dispatch({ type: "provinceIncludedToggled", sourceId });
  }, []);

  // Alignment Step
  const setAlignmentMode = useCallback(
    (mode: AlignmentMode) => changeSettings({ alignmentMode: mode }),
    [changeSettings]
  );

  const setManualTransform = useCallback(
    (mt: ManualTransform) => changeSettings({ manualTransform: mt }),
    [changeSettings]
  );

  const addReferencePoint = useCallback((point: ReferencePoint) => {
    dispatch({ type: "referencePointAdded", point });
  }, []);

  const removeReferencePoint = useCallback((index: number) => {
    dispatch({ type: "referencePointRemoved", index });
  }, []);

  const applyReferencePointAlignment = useCallback(() => {
    if (s.referencePoints.length < 2) {
      dispatch({ type: "failed", message: "At least 2 reference points required" });
      return;
    }

    const result = computeAffineFromReferencePoints(s.referencePoints);
    const provinces = applyAffineToProvinces(s.rawProvinces, result.matrix);
    dispatch({ type: "aligned", transform: result.matrix, provinces });
  }, [s.referencePoints, s.rawProvinces]);

  const applyAutoAlignment = useCallback(() => {
    if (!s.countryBorder) {
      dispatch({ type: "failed", message: "Country border not available" });
      return;
    }

    try {
      const result = autoAlignToCountryBorder(s.rawProvinces, s.countryBorder);
      const provinces = applyAffineToProvinces(s.rawProvinces, result.matrix);
      dispatch({ type: "aligned", transform: result.matrix, provinces });
    } catch (err) {
      dispatch({
        type: "failed",
        message: err instanceof Error ? err.message : "Auto-alignment failed",
      });
    }
  }, [s.rawProvinces, s.countryBorder]);

  const applyManualAlignment = useCallback(() => {
    const included = s.rawProvinces.filter((p) => p.included);
    // Centre on the included provinces, or on the city points when none is included
    const centre =
      included.length > 0
        ? meanCentre(included.map((p) => p.centroid))
        : meanCentre(s.rawCityPoints.map((c): [number, number] => [c.svgX, c.svgY]));
    if (!centre) return;

    const matrix = manualTransformToMatrix(manualTransform, centre);
    // With no included provinces the centre came from the cities; only the transform changes.
    const provinces =
      included.length > 0 ? applyAffineToProvinces(s.rawProvinces, matrix) : undefined;
    dispatch({ type: "aligned", transform: matrix, provinces });
  }, [s.rawProvinces, s.rawCityPoints, manualTransform]);

  // Aligned Cities Derived State & setLayer
  const { alignedCities, snappedCitiesCount } = useMemo(() => {
    if (!importCities || s.rawCityPoints.length === 0 || !s.countryBorder) {
      return { alignedCities: [], snappedCitiesCount: 0 };
    }
    const aligned = applyCityAffine(s.rawCityPoints, s.transform ?? IDENTITY_MATRIX);
    return snapCitiesToBorder(aligned, s.countryBorder, currentProvinces);
  }, [importCities, s.rawCityPoints, s.transform, s.countryBorder, currentProvinces]);

  const setLayer = useCallback(
    async (newCitiesLayerId: string, newCapitalLayerId?: string, newCityNameLayerId?: string) => {
      if (!session) return;
      dispatch({
        type: "cityLayersSelected",
        citiesLayerId: newCitiesLayerId,
        capitalLayerId: newCapitalLayerId,
        cityNameLayerId: newCityNameLayerId,
      });
      dispatch({ type: "processingStarted" });
      try {
        const result = await parseCitySvgMutation.mutateAsync({
          countryId,
          svgContent: session.rawSvgContent,
          citiesLayerId: newCitiesLayerId,
          capitalLayerId: newCapitalLayerId ?? session.capitalLayerId,
          cityNameLayerId: newCityNameLayerId ?? session.cityNameLayerId,
        });
        dispatch({ type: "cityPointsLoaded", points: result.points });
      } catch (e) {
        dispatch({
          type: "failed",
          message: e instanceof Error ? e.message : "Failed to update layers",
        });
      }
    },
    [countryId, session, parseCitySvgMutation]
  );

  // Snap Step
  const setSnapTolerance = useCallback(
    (value: number) => changeSettings({ snapTolerance: value }),
    [changeSettings]
  );

  const setSimplifyTolerance = useCallback(
    (value: number) => changeSettings({ simplifyTolerance: value }),
    [changeSettings]
  );

  const applySnapping = useCallback(() => {
    if (!s.countryBorder) {
      dispatch({ type: "failed", message: "Country border not available for snapping" });
      return;
    }

    // 1. Clip to border
    const { provinces: clipped } = clipProvincesToBorder(currentProvinces, s.countryBorder);

    // 2. Snap vertices to country border with multi-ring support
    const snapped = snapProvincesToBorderMultiRing(clipped, s.countryBorder, snapTolerance);

    // 3. Simplify — topology-preserving batch simplification via TopoJSON
    //    TopoJSON handles shared borders automatically, no neighbor snapping needed.
    const simplified = simplifyProvinces(snapped, simplifyTolerance, { targetVertices: 100 });

    dispatch({ type: "provincesReplaced", provinces: simplified });
  }, [currentProvinces, s.countryBorder, snapTolerance, simplifyTolerance]);

  // Validation Step
  const runValidation = useCallback(() => {
    if (!s.countryBorder) {
      dispatch({ type: "failed", message: "Country border not available for validation" });
      return;
    }

    dispatch({ type: "validated", report: validateTopology(currentProvinces, s.countryBorder) });
  }, [currentProvinces, s.countryBorder]);

  const autoFixGaps = useCallback(() => {
    if (!s.countryBorder || !validationReport) return;

    const fixed = autoFillGaps(currentProvinces, validationReport.gaps, s.countryBorder);
    // Re-validate
    const report = validateTopology(fixed, s.countryBorder);
    dispatch({ type: "validated", report, provinces: fixed });
  }, [currentProvinces, s.countryBorder, validationReport]);

  const autoFixOverlaps = useCallback(() => {
    if (!validationReport || !s.countryBorder) return;

    const fixed = resolveOverlaps(currentProvinces, validationReport.overlaps);
    // Re-validate
    const report = validateTopology(fixed, s.countryBorder);
    dispatch({ type: "validated", report, provinces: fixed });
  }, [currentProvinces, s.countryBorder, validationReport]);

  // Commit Step
  const setReplaceExisting = useCallback(
    (value: boolean) => changeSettings({ replaceExisting: value }),
    [changeSettings]
  );

  const commitCities = useCallback(
    () =>
      commitCityMutation.mutateAsync({
        countryId,
        cities: alignedCities.filter(hasValidLngLat).map((c, index) => ({
          name: cityName(c, index),
          lat: c.lat,
          lng: c.lng,
          cityType: "city",
          isNationalCapital: c.isCapital,
        })),
      }),
    [commitCityMutation, countryId, alignedCities]
  );

  // provinces-only or both
  const commitProvinces = useCallback(() => {
    // Final conformance: sanitize shapes + simplify + clip to border
    const source = s.countryBorder
      ? conformProvincesToBorder(currentProvinces, s.countryBorder, simplifyTolerance)
      : currentProvinces;

    const citiesToCommit =
      importCities && importScope === "both"
        ? alignedCities.filter(hasValidLngLat).map((c, index) => ({
            name: cityName(c, index),
            coordinates: [c.lng, c.lat],
            isCapital: c.isCapital,
          }))
        : undefined;

    return commitMutation.mutateAsync({
      countryId,
      provinces: source
        .filter((p) => p.included)
        .map((p) => ({
          name: p.name,
          type: "province",
          geometry: p.geometry as unknown as Record<string, unknown>,
          level: 1,
          color: p.color,
        })),
      cities: citiesToCommit,
      replaceExisting,
    });
  }, [
    s.countryBorder,
    currentProvinces,
    simplifyTolerance,
    importCities,
    importScope,
    alignedCities,
    commitMutation,
    countryId,
    replaceExisting,
  ]);

  const commitImport = useCallback(async () => {
    const citiesOnly = importScope === "cities";
    if (citiesOnly && (!importCities || alignedCities.length === 0)) {
      dispatch({ type: "failed", message: "No cities aligned/available to import" });
      return null;
    }

    dispatch({ type: "processingStarted" });
    try {
      const result = citiesOnly ? await commitCities() : await commitProvinces();
      dispatch({ type: "processingFinished" });
      return result;
    } catch (err) {
      dispatch({ type: "failed", message: err instanceof Error ? err.message : "Commit failed" });
      return null;
    }
  }, [importScope, importCities, alignedCities, commitCities, commitProvinces]);

  // Conformance
  const setShowConformanceModal = useCallback((open: boolean) => {
    dispatch({ type: "conformanceModalSet", open });
  }, []);

  const setImportCities = useCallback(
    (value: boolean) => changeSettings({ importCities: value }),
    [changeSettings]
  );

  // Reset
  const reset = useCallback(() => {
    dispatch({ type: "reset" });
  }, []);

  return {
    step,
    stepIndex,
    uploadId: s.uploadId,
    rawProvinces: s.rawProvinces,
    alignedProvinces: s.alignedProvinces,
    currentProvinces,
    includedCount,
    alignmentMode,
    referencePoints: s.referencePoints,
    transform: s.transform,
    manualTransform,
    snapTolerance,
    validationReport,
    isProcessing: status.kind === "processing",
    error: status.kind === "error" ? status.message : null,
    countryBorder: s.countryBorder,
    replaceExisting,
    existingSubdivisions: previewQuery.data?.existingSubdivisions ?? [],
    importScope,

    // Navigation
    canGoNext,
    canGoBack,
    goNext,
    goBack,
    goToStep,

    // Upload
    handleUpload,
    handleDirectSvg,
    setImportScope,

    // Names
    updateProvinceName,
    toggleProvinceIncluded,

    // Alignment
    setAlignmentMode,
    addReferencePoint,
    removeReferencePoint,
    applyReferencePointAlignment,
    applyAutoAlignment,
    applyManualAlignment,
    setManualTransform,

    // Snap & Simplify
    setSnapTolerance,
    simplifyTolerance,
    setSimplifyTolerance,
    applySnapping,

    // Validation
    runValidation,
    autoFixGaps,
    autoFixOverlaps,

    // Commit
    setReplaceExisting,
    commitImport,

    // Parse info
    parseLog: s.parseLog,
    detectedLayers: s.detectedLayers,

    // Conformance
    conformanceResult: s.conformance?.result ?? null,
    showConformanceModal: s.conformance?.modalOpen ?? false,
    setShowConformanceModal,

    // City Importer integrated state
    hasCities: s.hasCities,
    importCities,
    setImportCities,
    cityLayers: s.cityLayers,
    rawCityPoints: s.rawCityPoints,
    citiesLayerId: s.citiesLayerId,
    capitalLayerId: s.capitalLayerId,
    cityNameLayerId: s.cityNameLayerId,
    alignedCities,
    snappedCitiesCount,
    setLayer,

    // Reset
    reset,
  };
}
