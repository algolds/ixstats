"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FeatureCollection, Point } from "geojson";
import type { DiagnosticKind, DiagnosticResult, WorldGenerator } from "~/hooks/useWorldGenerator";

/**
 * A request the world outran: a newer generate replaced the one it asked about, or the worker was replaced. The
 * answer is for a world no one is looking at, so it is dropped without a word; ask again once the new world lands.
 */
const OUTRUN = /world changed|was restarted|no world to draw/i;

const isOutrun = (error: Error): boolean => OUTRUN.test(error.message);

type Source = Pick<WorldGenerator, "state" | "result" | "diagnostic" | "nationSeeds">;

export interface StudioDiagnostics {
  /** The diagnostic shown, one at a time; null for none */
  kind: DiagnosticKind | null;
  setKind: (kind: DiagnosticKind | null) => void;
  /** The image of the shown diagnostic for the world on the map; null while it is being drawn or when none is shown */
  image: DiagnosticResult | null;
  seedsOn: boolean;
  setSeedsOn: (on: boolean) => void;
  seeds: FeatureCollection<Point> | null;
  /** The worker could not draw it (not a world that moved on) */
  error: string | null;
}

/**
 * The diagnostic image and the nation seeds of the world on the map. Choosing or hiding a diagnostic never
 * regenerates: the worker draws it from its cached graph. When the world changes the shown diagnostic is asked for
 * again (the old image stays up until the new one lands), and an answer for a world that has since changed is dropped.
 */
export function useStudioDiagnostics({
  state,
  result,
  diagnostic,
  nationSeeds,
}: Source): StudioDiagnostics {
  const [kind, setKindState] = useState<DiagnosticKind | null>(null);
  const [seedsOn, setSeedsState] = useState(false);
  const [drawn, setDrawn] = useState<DiagnosticResult | null>(null);
  const [placed, setPlaced] = useState<FeatureCollection<Point> | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const setKind = useCallback((next: DiagnosticKind | null) => {
    setFailure(null);
    setKindState(next);
  }, []);
  const setSeedsOn = useCallback((on: boolean) => {
    setFailure(null);
    setSeedsState(on);
  }, []);

  // The worker holds the graph only once a run has landed
  const settled = state === "ready" && result !== null;

  useEffect(() => {
    if (!settled || kind === null) return;
    let current = true;
    diagnostic(kind).then(
      (image) => {
        if (!current) return;
        setDrawn(image);
        setFailure(null);
      },
      (error: Error) => {
        if (current && !isOutrun(error)) setFailure(error.message);
      }
    );
    return () => {
      current = false;
    };
  }, [settled, result, kind, diagnostic]);

  useEffect(() => {
    if (!settled || !seedsOn) return;
    let current = true;
    nationSeeds().then(
      (seeds) => {
        if (current) setPlaced(seeds);
      },
      (error: Error) => {
        if (current && !isOutrun(error)) setFailure(error.message);
      }
    );
    return () => {
      current = false;
    };
  }, [settled, result, seedsOn, nationSeeds]);

  const image = kind !== null && drawn?.kind === kind ? drawn : null;
  const seeds = seedsOn ? placed : null;
  return useMemo(
    () => ({ kind, setKind, image, seedsOn, setSeedsOn, seeds, error: failure }),
    [kind, setKind, image, seedsOn, setSeedsOn, seeds, failure]
  );
}
