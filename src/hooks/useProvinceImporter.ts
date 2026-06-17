// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

/**
 * useProvinceImporter - State machine hook for the province import wizard.
 *
 * Manages the 6-step wizard flow: upload → names → align → snap → validate → commit.
 * Integrates with tRPC mutations and the alignment/topology pure functions.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import type {
  ProvinceFeature,
  ImportStep,
  AlignmentMode,
  ReferencePoint,
  AffineMatrix,
  ManualTransform,
  TopologyReport,
} from "~/lib/province-importer/types";
import {
  computeAffineFromReferencePoints,
  autoAlignToCountryBorder,
  manualTransformToMatrix,
  applyAffineToProvinces,
  snapProvincesToBorderMultiRing,
} from "~/lib/province-importer/alignment";
import { applyCityAffine } from "~/lib/city-importer/align-cities";
import type { SvgLayerInfo, SvgCityPoint } from "~/lib/city-importer/svg-points";
import {
  validateTopology,
  autoFillGaps,
  resolveOverlaps,
  clipProvincesToBorder,
  simplifyProvinces,
} from "~/lib/province-importer/topology";
import type { ConformanceResult } from "~/lib/province-importer/topology";
import { sanitizeRegionShape } from "~/lib/border-editor";
import type { Polygon, MultiPolygon } from "geojson";

const STEPS: ImportStep[] = ["upload", "names", "align", "snap", "validate", "commit"];

const DEFAULT_MANUAL_TRANSFORM: ManualTransform = {
  translate: [0, 0],
  rotate: 0,
  scale: 1,
};

export function useProvinceImporter(countryId: string) {
  // ── Session State ──
  const [step, setStep] = useState<ImportStep>("upload");
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [rawProvinces, setRawProvinces] = useState<ProvinceFeature[]>([]);
  const [alignedProvinces, setAlignedProvinces] = useState<ProvinceFeature[]>([]);
  const [alignmentMode, setAlignmentMode] = useState<AlignmentMode>("auto-align");
  const [referencePoints, setReferencePoints] = useState<ReferencePoint[]>([]);
  const [transform, setTransform] = useState<AffineMatrix | null>(null);
  const [manualTransform, setManualTransform] = useState<ManualTransform>(DEFAULT_MANUAL_TRANSFORM);
  const [snapTolerance, setSnapTolerance] = useState(0.02);
  const [simplifyTolerance, setSimplifyTolerance] = useState(0.005);
  const [validationReport, setValidationReport] = useState<TopologyReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countryBorder, setCountryBorder] = useState<Polygon | MultiPolygon | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [conformanceResult, setConformanceResult] = useState<ConformanceResult | null>(null);
  const [showConformanceModal, setShowConformanceModal] = useState(false);
  const [parseLog, setParseLog] = useState<string[]>([]);
  const [detectedLayers, setDetectedLayers] = useState<string[]>([]);

  // City Importer integrated state
  const [hasCities, setHasCities] = useState(false);
  const [importCities, setImportCities] = useState(true);
  const [cityLayers, setCityLayers] = useState<SvgLayerInfo[]>([]);
  const [rawCityPoints, setRawCityPoints] = useState<SvgCityPoint[]>([]);
  const [citiesLayerId, setCitiesLayerId] = useState("");
  const [capitalLayerId, setCapitalLayerId] = useState("");
  const [rawSvgContent, setRawSvgContent] = useState<string | null>(null);

  // ── tRPC Mutations ──
  const parseMutation = api.geoAdmin.parseProvinceUpload.useMutation();
  const commitMutation = api.geoAdmin.commitProvinceImport.useMutation();
  const previewQuery = api.geoAdmin.getProvinceImportPreview.useQuery(
    { countryId },
    { enabled: step === "upload" || step === "commit" }
  );

  // ── Auto-align after parsing ──
  // When raw provinces and country border are both available, automatically
  // apply bbox+ICP alignment so provinces appear near the country on the map
  // instead of staying in SVG pixel space.
  const hasAutoAligned = useRef(false);
  useEffect(() => {
    if (hasAutoAligned.current) return;
    if (rawProvinces.length === 0 || !countryBorder) return;

    try {
      const result = autoAlignToCountryBorder(rawProvinces, countryBorder);
      setTransform(result.matrix);
      setAlignedProvinces(applyAffineToProvinces(rawProvinces, result.matrix));
      hasAutoAligned.current = true;
    } catch {
      // Silently fail — user can still align manually
    }
  }, [rawProvinces, countryBorder]);

  // ── Real-time manual transform preview ──
  // When the user changes manual sliders, immediately update the preview
  // instead of requiring an "Apply Transform" button click.
  useEffect(() => {
    if (alignmentMode !== "manual") return;
    // Skip if transform is identity (initial state)
    const mt = manualTransform;
    if (mt.translate[0] === 0 && mt.translate[1] === 0 && mt.rotate === 0 && mt.scale === 1) return;

    // Use aligned provinces as base if available (preserves auto-alignment), otherwise raw
    const base = hasAutoAligned.current
      ? applyAffineToProvinces(rawProvinces, transform ?? { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 })
      : rawProvinces;
    const included = base.filter((p) => p.included);
    if (included.length === 0) return;

    const cx = included.reduce((s, p) => s + p.centroid[0], 0) / included.length;
    const cy = included.reduce((s, p) => s + p.centroid[1], 0) / included.length;

    const manualMatrix = manualTransformToMatrix(mt, [cx, cy]);
    setAlignedProvinces(applyAffineToProvinces(base, manualMatrix));
  }, [manualTransform, alignmentMode, rawProvinces, transform]);

  // ── Step Navigation ──
  const stepIndex = useMemo(() => STEPS.indexOf(step), [step]);
  const canGoNext = useMemo(() => stepIndex < STEPS.length - 1, [stepIndex]);
  const canGoBack = useMemo(() => stepIndex > 0, [stepIndex]);

  const goToStep = useCallback((target: ImportStep) => {
    setError(null);
    setStep(target);
  }, []);

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    setError(null);

    // Enforce border conformance when leaving snap step
    if (step === "snap" && countryBorder) {
      const source = alignedProvinces.length > 0 ? alignedProvinces : rawProvinces;
      const result = clipProvincesToBorder(source, countryBorder);
      setAlignedProvinces(result.provinces);
      if (result.clippedIndices.length > 0) {
        setConformanceResult(result);
        setShowConformanceModal(true);
      }
    }

    setStep(STEPS[stepIndex + 1]!);
  }, [canGoNext, stepIndex, step, countryBorder, alignedProvinces, rawProvinces]);

  const goBack = useCallback(() => {
    if (canGoBack) {
      setError(null);
      setStep(STEPS[stepIndex - 1]!);
    }
  }, [canGoBack, stepIndex]);

  // ── Upload Step ──
  const handleUpload = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setError(null);

      try {
        // Upload file
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

        const text = await file.text();
        setRawSvgContent(text);

        // Parse the uploaded SVG
        const result = await parseMutation.mutateAsync({
          countryId,
          uploadId: uploadData.id,
        });

        setRawProvinces(result.provinces as ProvinceFeature[]);
        if (result.countryBorder) {
          setCountryBorder(result.countryBorder as Polygon | MultiPolygon);
        }
        if (result.log) setParseLog(result.log as string[]);
        if (result.layersFound) setDetectedLayers(result.layersFound as string[]);

        if (result.cityData) {
          setHasCities(result.cityData.points.length > 0);
          setRawCityPoints(result.cityData.points);
          setCityLayers(result.cityData.layers);
          setCitiesLayerId(result.cityData.detectedCitiesLayerId || "");
          setImportCities(result.cityData.points.length > 0);
        } else {
          setHasCities(false);
          setRawCityPoints([]);
          setCityLayers([]);
          setCitiesLayerId("");
          setImportCities(false);
        }

        goToStep("names");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsProcessing(false);
      }
    },
    [countryId, parseMutation, goToStep]
  );

  const handleDirectSvg = useCallback(
    async (svgContent: string) => {
      setIsProcessing(true);
      setError(null);
      setRawSvgContent(svgContent);

      try {
        const result = await parseMutation.mutateAsync({
          countryId,
          svgContent,
        });

        setRawProvinces(result.provinces as ProvinceFeature[]);
        if (result.countryBorder) {
          setCountryBorder(result.countryBorder as Polygon | MultiPolygon);
        }
        if (result.log) setParseLog(result.log as string[]);
        if (result.layersFound) setDetectedLayers(result.layersFound as string[]);

        if (result.cityData) {
          setHasCities(result.cityData.points.length > 0);
          setRawCityPoints(result.cityData.points);
          setCityLayers(result.cityData.layers);
          setCitiesLayerId(result.cityData.detectedCitiesLayerId || "");
          setImportCities(result.cityData.points.length > 0);
        } else {
          setHasCities(false);
          setRawCityPoints([]);
          setCityLayers([]);
          setCitiesLayerId("");
          setImportCities(false);
        }

        goToStep("names");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Parse failed");
      } finally {
        setIsProcessing(false);
      }
    },
    [countryId, parseMutation, goToStep]
  );

  // ── Names Step ──
  const updateProvinceName = useCallback((sourceId: string, name: string) => {
    setRawProvinces((prev) => prev.map((p) => (p.sourceId === sourceId ? { ...p, name } : p)));
    // Also update alignedProvinces if they exist
    setAlignedProvinces((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((p) => (p.sourceId === sourceId ? { ...p, name } : p));
    });
  }, []);

  const toggleProvinceIncluded = useCallback((sourceId: string) => {
    setRawProvinces((prev) =>
      prev.map((p) => (p.sourceId === sourceId ? { ...p, included: !p.included } : p))
    );
    // Also update alignedProvinces if they exist
    setAlignedProvinces((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((p) => (p.sourceId === sourceId ? { ...p, included: !p.included } : p));
    });
  }, []);

  // ── Alignment Step ──
  const addReferencePoint = useCallback((point: ReferencePoint) => {
    setReferencePoints((prev) => [...prev, point]);
  }, []);

  const removeReferencePoint = useCallback((index: number) => {
    setReferencePoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const applyReferencePointAlignment = useCallback(() => {
    if (referencePoints.length < 2) {
      setError("At least 2 reference points required");
      return;
    }

    const result = computeAffineFromReferencePoints(referencePoints);
    setTransform(result.matrix);
    setAlignedProvinces(applyAffineToProvinces(rawProvinces, result.matrix));
    setError(null);
  }, [referencePoints, rawProvinces]);

  const applyAutoAlignment = useCallback(() => {
    if (!countryBorder) {
      setError("Country border not available");
      return;
    }

    setIsProcessing(true);
    try {
      const result = autoAlignToCountryBorder(rawProvinces, countryBorder);
      setTransform(result.matrix);
      setAlignedProvinces(applyAffineToProvinces(rawProvinces, result.matrix));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-alignment failed");
    } finally {
      setIsProcessing(false);
    }
  }, [rawProvinces, countryBorder]);

  const applyManualAlignment = useCallback(() => {
    const provinces = rawProvinces.filter((p) => p.included);
    if (provinces.length === 0) return;

    // Compute center from included provinces
    const cx = provinces.reduce((s, p) => s + p.centroid[0], 0) / provinces.length;
    const cy = provinces.reduce((s, p) => s + p.centroid[1], 0) / provinces.length;

    const matrix = manualTransformToMatrix(manualTransform, [cx, cy]);
    setTransform(matrix);
    setAlignedProvinces(applyAffineToProvinces(rawProvinces, matrix));
  }, [rawProvinces, manualTransform]);

  // ── Aligned Cities Derived State & setLayer ──
  const alignedCities = useMemo(() => {
    if (!importCities || rawCityPoints.length === 0 || !transform) return [];
    return applyCityAffine(rawCityPoints, transform);
  }, [importCities, rawCityPoints, transform]);

  const parseCitySvgMutation = api.geoAdmin.parseCitySvg.useMutation();

  const setLayer = useCallback(
    async (newCitiesLayerId: string, newCapitalLayerId?: string) => {
      setCitiesLayerId(newCitiesLayerId);
      if (newCapitalLayerId !== undefined) {
        setCapitalLayerId(newCapitalLayerId);
      }

      setIsProcessing(true);
      setError(null);
      try {
        if (!rawSvgContent) return;

        const result = await parseCitySvgMutation.mutateAsync({
          countryId,
          svgContent: rawSvgContent,
          citiesLayerId: newCitiesLayerId,
          capitalLayerId: newCapitalLayerId !== undefined ? newCapitalLayerId : "",
        });

        setRawCityPoints(result.points);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update layers");
      } finally {
        setIsProcessing(false);
      }
    },
    [countryId, rawSvgContent, parseCitySvgMutation]
  );

  // ── Snap Step ──
  const applySnapping = useCallback(() => {
    if (!countryBorder) {
      setError("Country border not available for snapping");
      return;
    }

    const source = alignedProvinces.length > 0 ? alignedProvinces : rawProvinces;

    // 1. Clip to border
    const { provinces: clipped } = clipProvincesToBorder(source, countryBorder);

    // 2. Snap vertices to country border with multi-ring support
    const snapped = snapProvincesToBorderMultiRing(clipped, countryBorder, snapTolerance);

    // 3. Simplify — topology-preserving batch simplification via TopoJSON
    //    TopoJSON handles shared borders automatically, no neighbor snapping needed.
    const simplified = simplifyProvinces(snapped, simplifyTolerance, { targetVertices: 100 });

    setAlignedProvinces(simplified);
  }, [alignedProvinces, rawProvinces, countryBorder, snapTolerance, simplifyTolerance]);

  // ── Validation Step ──
  const runValidation = useCallback(() => {
    if (!countryBorder) {
      setError("Country border not available for validation");
      return;
    }

    const source = alignedProvinces.length > 0 ? alignedProvinces : rawProvinces;
    const report = validateTopology(source, countryBorder);
    setValidationReport(report);
  }, [alignedProvinces, rawProvinces, countryBorder]);

  const autoFixGaps = useCallback(() => {
    if (!countryBorder || !validationReport) return;

    const source = alignedProvinces.length > 0 ? alignedProvinces : rawProvinces;
    const fixed = autoFillGaps(source, validationReport.gaps, countryBorder);
    setAlignedProvinces(fixed);

    // Re-validate
    const newReport = validateTopology(fixed, countryBorder);
    setValidationReport(newReport);
  }, [alignedProvinces, rawProvinces, countryBorder, validationReport]);

  const autoFixOverlaps = useCallback(() => {
    if (!validationReport || !countryBorder) return;

    const source = alignedProvinces.length > 0 ? alignedProvinces : rawProvinces;
    const fixed = resolveOverlaps(source, validationReport.overlaps);
    setAlignedProvinces(fixed);

    // Re-validate
    const newReport = validateTopology(fixed, countryBorder);
    setValidationReport(newReport);
  }, [alignedProvinces, rawProvinces, countryBorder, validationReport]);

  // ── Commit Step ──
  const commitImport = useCallback(async () => {
    setIsProcessing(true);
    setError(null);

    try {
      let source = alignedProvinces.length > 0 ? alignedProvinces : rawProvinces;

      // Final conformance: sanitize shapes + simplify + clip to border
      if (countryBorder) {
        // Sanitize: remove spikes, degenerate vertices
        source = source.map((p) => {
          if (!p.included || !p.geometry) return p;
          const { geometry: sanitized } = sanitizeRegionShape(
            p.geometry as Polygon | MultiPolygon,
            countryBorder
          );
          return { ...p, geometry: sanitized };
        });

        // Final simplification pass (safety valve)
        source = simplifyProvinces(source, simplifyTolerance);

        // Clip to country border
        const clipped = clipProvincesToBorder(source, countryBorder);
        source = clipped.provinces;
      }

      const included = source.filter((p) => p.included);

      const citiesToCommit = importCities
        ? alignedCities.map((c) => ({
            name: c.name,
            coordinates: [c.lng, c.lat],
            isCapital: c.isCapital,
          }))
        : undefined;

      const result = await commitMutation.mutateAsync({
        countryId,
        provinces: included.map((p) => ({
          name: p.name,
          type: "province",
          geometry: p.geometry as unknown as Record<string, unknown>,
          level: 1,
          color: p.color,
        })),
        cities: citiesToCommit,
        replaceExisting,
      });

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit failed");
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [
    alignedProvinces,
    rawProvinces,
    countryId,
    replaceExisting,
    commitMutation,
    countryBorder,
    simplifyTolerance,
    importCities,
    alignedCities,
  ]);

  // ── Reset ──
  const reset = useCallback(() => {
    setStep("upload");
    setUploadId(null);
    setRawProvinces([]);
    setAlignedProvinces([]);
    setAlignmentMode("auto-align");
    setReferencePoints([]);
    setTransform(null);
    setManualTransform(DEFAULT_MANUAL_TRANSFORM);
    setSnapTolerance(0.02);
    setSimplifyTolerance(0.005);
    setValidationReport(null);
    setIsProcessing(false);
    setError(null);
    setCountryBorder(null);
    setReplaceExisting(false);
    setConformanceResult(null);
    setShowConformanceModal(false);
    setParseLog([]);
    setDetectedLayers([]);
    hasAutoAligned.current = false;
    setHasCities(false);
    setImportCities(true);
    setRawCityPoints([]);
    setCityLayers([]);
    setCitiesLayerId("");
    setCapitalLayerId("");
    setRawSvgContent(null);
  }, []);

  // ── Current Provinces (for display) ──
  const currentProvinces = useMemo(() => {
    return alignedProvinces.length > 0 ? alignedProvinces : rawProvinces;
  }, [alignedProvinces, rawProvinces]);

  const includedCount = useMemo(() => {
    return currentProvinces.filter((p) => p.included).length;
  }, [currentProvinces]);

  return {
    // State
    step,
    stepIndex,
    uploadId,
    rawProvinces,
    alignedProvinces,
    currentProvinces,
    includedCount,
    alignmentMode,
    referencePoints,
    transform,
    manualTransform,
    snapTolerance,
    validationReport,
    isProcessing,
    error,
    countryBorder,
    replaceExisting,
    existingSubdivisions: previewQuery.data?.existingSubdivisions ?? [],

    // Navigation
    canGoNext,
    canGoBack,
    goNext,
    goBack,
    goToStep,

    // Upload
    handleUpload,
    handleDirectSvg,

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
    parseLog,
    detectedLayers,

    // Conformance
    conformanceResult,
    showConformanceModal,
    setShowConformanceModal,

    // City Importer integrated state
    hasCities,
    importCities,
    setImportCities,
    cityLayers,
    rawCityPoints,
    citiesLayerId,
    capitalLayerId,
    alignedCities,
    setLayer,

    // Reset
    reset,
  };
}
