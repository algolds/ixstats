// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

/**
 * useCityImporter - State machine hook for the city import wizard.
 *
 * Manages the 3-step wizard: upload → preview → commit.
 * Integrates with tRPC endpoints geoAdmin.validateCityImport + geoAdmin.commitCityImport.
 */

import { useState, useCallback } from "react";
import { api } from "~/trpc/react";
import { parseCityImportText } from "~/lib/city-importer/parser";
import type { RawCityRow, ParsedCityImport } from "~/lib/city-importer/parser";

// ── Types ────────────────────────────────────────────────────────────────────

export type CityImportStep = "upload" | "preview" | "commit";

export interface ValidatedCityRow extends RawCityRow {
  issues: string[];
}

export interface CityImportState {
  step: CityImportStep;
  rawText: string;
  fileName: string;
  parsed: ParsedCityImport | null;
  validated: ValidatedCityRow[] | null;
  isProcessing: boolean;
  error: string | null;
  committedCount: number;
}

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

  // ── tRPC ────────────────────────────────────────────────────────────────────
  const utils = api.useUtils();
  const commitMutation = api.geoAdmin.commitCityImport.useMutation();

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsProcessing(true);
      try {
        const text = await file.text();
        const result = parseCityImportText(text, file.name);
        setRawText(text);
        setFileName(file.name);
        setParsed(result);
        setValidated(null);
        setStep("preview");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to read file");
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const validate = useCallback(async () => {
    if (!parsed || !countryId) return;

    // Collect rows that passed parse-time checks (no parse errors for required fields)
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
      // Use imperative fetch via utils
      const serverResult = await utils.geoAdmin.validateCityImport.fetch({
        countryId,
        cities: queryRows,
      });

      // Build map of server issues by name
      const serverIssuesByName: Record<string, string[]> = {};
      for (const r of serverResult.results) {
        serverIssuesByName[r.name] = r.issues;
      }

      // Merge parse errors + server issues
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

    // Use validated rows if available, else fall back to parsed rows with no blocking parse errors
    const source = validated ?? parsed.rows.map((r) => ({ ...r, issues: r._parseErrors ?? [] }));
    const toCommit = source
      .filter((row) => !row.issues.some((i) => i.includes("missing required field") || i.includes("out of range") || i.includes("invalid lat") || i.includes("invalid lng") || i.includes("outside country")))
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
    // Actions
    setStep,
    handleFile,
    validate,
    commitImport,
    reset,
  };
}
