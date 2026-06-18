// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

/**
 * useCityImporter - State machine hook for the city import wizard.
 *
 * Manages the 4-step wizard: upload → align → preview → commit.
 * Integrates with tRPC endpoints geoAdmin.validateCityImport + geoAdmin.commitCityImport.
 */

import { useState, useCallback, useEffect } from "react";
import { api } from "~/trpc/react";
import { parseCityImportText } from "~/lib/city-importer/parser";
import type { RawCityRow, ParsedCityImport } from "~/lib/city-importer/parser";
import type {
  AlignmentMode,
  ReferencePoint,
  AffineMatrix,
  ManualTransform,
} from "~/lib/province-importer/types";
import {
  computeAffineFromReferencePoints,
  manualTransformToMatrix,
} from "~/lib/province-importer/alignment";
import { calculateCentroid } from "~/lib/border-editor";
import { applyCityAffine } from "~/lib/city-importer/align-cities";
import type { SvgLayerInfo, SvgCityPoint, SvgProvinceRef } from "~/lib/city-importer/svg-points";

// ── Types ────────────────────────────────────────────────────────────────────

export type CityImportStep = "upload" | "align" | "preview" | "commit";

export interface ValidatedCityRow extends RawCityRow {
  issues: string[];
}

const DEFAULT_MANUAL_TRANSFORM: ManualTransform = {
  translate: [0, 0],
  rotate: 0,
  scale: 1,
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCityImporter(countryId: string) {
  const [step, setStep] = useState<CityImportStep>("upload");
  const [rawText, setRawText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedCityImport | null>(null);
  const [validated, setValidated] = useState<ValidatedCityRow[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [committedCount, setCommittedCount] = useState(0);

  // ── SVG Align States ──
  const [inputMode, setInputMode] = useState<"tabular" | "svg">("tabular");
  const [layers, setLayers] = useState<SvgLayerInfo[]>([]);
  const [svgPoints, setSvgPoints] = useState<SvgCityPoint[]>([]);
  const [svgProvinces, setSvgProvinces] = useState<SvgProvinceRef[]>([]);
  const [alignmentMode, setAlignmentMode] = useState<AlignmentMode>("auto-align");
  const [referencePoints, setReferencePoints] = useState<ReferencePoint[]>([]);
  const [transform, setTransform] = useState<AffineMatrix | null>(null);
  const [manualTransform, setManualTransform] = useState<ManualTransform>(DEFAULT_MANUAL_TRANSFORM);
  const [citiesLayerId, setCitiesLayerId] = useState<string>("");
  const [capitalLayerId, setCapitalLayerId] = useState<string>("");
  const [cityNameLayerId, setCityNameLayerId] = useState<string>("");
  const [alignedRows, setAlignedRows] = useState<
    Array<{ name: string; lat: number; lng: number; isCapital: boolean }>
  >([]);

  // ── tRPC ────────────────────────────────────────────────────────────────────
  const utils = api.useUtils();
  const commitMutation = api.geoAdmin.commitCityImport.useMutation();
  const parseSvgMutation = api.geoAdmin.parseCitySvg.useMutation();

  // ── Real-time manual transform preview ──
  useEffect(() => {
    if (inputMode !== "svg" || alignmentMode !== "manual") return;
    if (svgPoints.length === 0) return;

    const mt = manualTransform;
    const cx = svgPoints.reduce((s, p) => s + p.svgX, 0) / svgPoints.length;
    const cy = svgPoints.reduce((s, p) => s + p.svgY, 0) / svgPoints.length;

    const manualMatrix = manualTransformToMatrix(mt, [cx, cy]);
    setTransform(manualMatrix);
    setAlignedRows(applyCityAffine(svgPoints, manualMatrix));
  }, [manualTransform, alignmentMode, svgPoints, inputMode]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsProcessing(true);
      try {
        const text = await file.text();
        setRawText(text);
        setFileName(file.name);
        setValidated(null);

        if (file.name.toLowerCase().endsWith(".svg") || file.type === "image/svg+xml") {
          setInputMode("svg");
          const result = await parseSvgMutation.mutateAsync({
            countryId,
            svgContent: text,
          });

          setLayers(result.layers);
          setSvgPoints(result.points);
          setSvgProvinces(result.svgProvinces);
          setCitiesLayerId(result.detectedCitiesLayerId);
          setCapitalLayerId("");
          setCityNameLayerId(result.detectedCityNameLayerId || "");
          setTransform(null);
          setAlignedRows([]);
          setReferencePoints([]);
          setManualTransform(DEFAULT_MANUAL_TRANSFORM);
          setStep("align");
        } else {
          setInputMode("tabular");
          const result = parseCityImportText(text, file.name);
          setParsed(result);
          setStep("preview");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to read file");
      } finally {
        setIsProcessing(false);
      }
    },
    [countryId, parseSvgMutation]
  );

  const setLayer = useCallback(
    async (newCitiesLayerId: string, newCapitalLayerId?: string, newCityNameLayerId?: string) => {
      setCitiesLayerId(newCitiesLayerId);
      if (newCapitalLayerId !== undefined) {
        setCapitalLayerId(newCapitalLayerId);
      }
      if (newCityNameLayerId !== undefined) {
        setCityNameLayerId(newCityNameLayerId);
      }

      setIsProcessing(true);
      setError(null);
      try {
        const result = await parseSvgMutation.mutateAsync({
          countryId,
          svgContent: rawText,
          citiesLayerId: newCitiesLayerId,
          capitalLayerId: newCapitalLayerId !== undefined ? newCapitalLayerId : capitalLayerId,
          cityNameLayerId: newCityNameLayerId !== undefined ? newCityNameLayerId : cityNameLayerId,
        });

        setSvgPoints(result.points);
        setSvgProvinces(result.svgProvinces);

        if (transform) {
          setAlignedRows(applyCityAffine(result.points, transform));
        } else {
          setAlignedRows([]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update layers");
      } finally {
        setIsProcessing(false);
      }
    },
    [countryId, rawText, transform, parseSvgMutation, capitalLayerId, cityNameLayerId]
  );

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
    setAlignedRows(applyCityAffine(svgPoints, result.matrix));
    setError(null);
  }, [referencePoints, svgPoints]);

  const autoAdjust = useCallback(async () => {
    if (svgProvinces.length === 0) {
      setError("No provinces found in SVG for auto-alignment");
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const data = await utils.geoAdmin.getProvinceImportPreview.fetch({ countryId });
      const dbSubs = data.existingSubdivisions.map((sub: any) => {
        const centroid = calculateCentroid(sub.geometry);
        return {
          name: sub.name,
          centroid: centroid as [number, number],
        };
      });

      const { deriveCityAffine } = await import("~/lib/city-importer/align-cities");
      const result = deriveCityAffine(svgProvinces, dbSubs);

      if (!result.matrix) {
        setError(
          `Auto-adjust failed: only matched ${result.matchCount} provinces by name. At least 3 matches are required. You can align manually or place reference points.`
        );
        return;
      }

      setTransform(result.matrix);
      setAlignedRows(applyCityAffine(svgPoints, result.matrix));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-adjust failed");
    } finally {
      setIsProcessing(false);
    }
  }, [svgProvinces, svgPoints, countryId, utils]);

  const proceedFromAlignToPreview = useCallback(() => {
    if (alignedRows.length === 0) return;

    const rows: RawCityRow[] = alignedRows.map((row) => ({
      name: row.name,
      lat: row.lat,
      lng: row.lng,
      cityType: row.isCapital ? "capital" : "city",
      isNationalCapital: row.isCapital,
      isSubdivisionCapital: false,
      _parseErrors: [],
    }));

    setParsed({
      rows,
      errors: [],
      warnings: [],
    });
    setValidated(null);
    setStep("preview");
  }, [alignedRows]);

  const validate = useCallback(async () => {
    if (!parsed || !countryId) return;

    const queryRows = parsed.rows
      .filter((row) => {
        const hasErrors =
          row._parseErrors &&
          row._parseErrors.some(
            (e) =>
              e.includes("missing required field") ||
              e.includes("invalid lat") ||
              e.includes("invalid lng") ||
              e.includes("out of range")
          );
        return !hasErrors;
      })
      .map((row) => ({
        name: row.name,
        lat: row.lat,
        lng: row.lng,
        cityType: row.cityType ?? "city",
        population: row.population,
        foundedYear: row.foundedYear,
        elevation: row.elevation,
        isNationalCapital: row.isNationalCapital ?? false,
        isSubdivisionCapital: row.isSubdivisionCapital ?? false,
        subdivisionId: row.subdivisionId,
        wikiPageTitle: row.wikiPageTitle,
      }));

    setIsProcessing(true);
    setError(null);
    try {
      const serverResult = await utils.geoAdmin.validateCityImport.fetch({
        countryId,
        cities: queryRows,
      });

      const serverIssuesByName: Record<string, string[]> = {};
      for (const r of serverResult.results) {
        serverIssuesByName[r.name] = r.issues;
      }

      const merged: ValidatedCityRow[] = parsed.rows.map((row) => {
        const parseIssues = row._parseErrors ?? [];
        const serverIssues = serverIssuesByName[row.name] ?? [];
        return {
          ...row,
          issues: [...parseIssues, ...serverIssues],
        };
      });
      setValidated(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setIsProcessing(false);
    }
  }, [parsed, countryId, utils]);

  const commitImport = useCallback(async () => {
    if (!parsed || !countryId) return;

    const source = validated ?? parsed.rows.map((r) => ({ ...r, issues: r._parseErrors ?? [] }));
    const toCommit = source
      .filter(
        (row) =>
          !row.issues.some(
            (i) =>
              i.includes("missing required field") ||
              i.includes("out of range") ||
              i.includes("invalid lat") ||
              i.includes("invalid lng") ||
              i.includes("outside country")
          )
      )
      .map((row) => ({
        name: row.name,
        lat: row.lat,
        lng: row.lng,
        cityType: row.cityType ?? "city",
        population: row.population,
        foundedYear: row.foundedYear,
        elevation: row.elevation,
        isNationalCapital: row.isNationalCapital ?? false,
        isSubdivisionCapital: row.isSubdivisionCapital ?? false,
        subdivisionId: row.subdivisionId,
        wikiPageTitle: row.wikiPageTitle,
      }));

    if (toCommit.length === 0) {
      setError("No valid cities to import");
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const result = await commitMutation.mutateAsync({
        countryId,
        cities: toCommit,
      });
      setCommittedCount(result.created);
      setStep("commit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commit failed");
    } finally {
      setIsProcessing(false);
    }
  }, [parsed, validated, countryId, commitMutation]);

  const canCommit = (() => {
    if (!parsed || parsed.rows.length === 0) return false;
    const source = validated ?? parsed.rows.map((r) => ({ ...r, issues: r._parseErrors ?? [] }));
    return source.some(
      (r) =>
        !r.issues.some(
          (i) =>
            i.includes("missing required field") ||
            i.includes("out of range") ||
            i.includes("invalid lat") ||
            i.includes("invalid lng") ||
            i.includes("outside country")
        )
    );
  })();

  const reset = useCallback(() => {
    setStep("upload");
    setRawText("");
    setFileName("");
    setParsed(null);
    setValidated(null);
    setError(null);
    setCommittedCount(0);
    setIsProcessing(false);
    setInputMode("tabular");
    setLayers([]);
    setSvgPoints([]);
    setSvgProvinces([]);
    setAlignmentMode("auto-align");
    setReferencePoints([]);
    setTransform(null);
    setManualTransform(DEFAULT_MANUAL_TRANSFORM);
    setCitiesLayerId("");
    setCapitalLayerId("");
    setCityNameLayerId("");
    setAlignedRows([]);
  }, []);

  return {
    // State
    step,
    rawText,
    fileName,
    parsed,
    validated,
    isProcessing,
    error,
    committedCount,
    canCommit,

    // SVG Align State
    inputMode,
    layers,
    svgPoints,
    svgProvinces,
    alignmentMode,
    referencePoints,
    transform,
    manualTransform,
    citiesLayerId,
    capitalLayerId,
    cityNameLayerId,
    alignedRows,

    // Actions
    setStep,
    handleFile,
    setLayer,
    addReferencePoint,
    removeReferencePoint,
    applyReferencePointAlignment,
    autoAdjust,
    proceedFromAlignToPreview,
    validate,
    commitImport,
    reset,
    setAlignmentMode,
    setManualTransform,
  };
}
