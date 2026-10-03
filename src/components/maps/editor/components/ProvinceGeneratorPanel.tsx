"use client";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { useState, useCallback } from "react";
import { useNotify } from "~/hooks/useNotify";
import {
  DiceFive as Dice5,
  Check,
  Xmark as X,
  ViewGrid as Grid3X3,
  SystemRestart as Loader2,
} from "iconoir-react";
import { generateProvinces } from "~/lib/maps/province-generator";
import { api } from "~/trpc/react";
import type { Polygon, MultiPolygon } from "geojson";
import { Slider } from "~/components/ui/slider";
import { Card } from "~/components/ui/card";

interface ProvinceGeneratorPanelProps {
  countryGeometry: Polygon | MultiPolygon | null;
  countryId: string;
  onClose: () => void;
}

export const ProvinceGeneratorPanel = React.memo(function ProvinceGeneratorPanel({
  countryGeometry,
  countryId,
  onClose,
}: ProvinceGeneratorPanelProps) {
  const notify = useNotify();
  const [count, setCount] = useState(10);
  const [seed, setSeed] = useState(42);
  const [names, setNames] = useState("");
  const [cells, setCells] = useState<(Polygon | MultiPolygon)[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commitMutation = api.geoFeatures.commitGeneratedSubdivisions.useMutation({
    onSuccess: (data) => {
      setCells(null);
      setError(null);
      notify.success(
        `Created ${data.created} subdivisions (${data.skipped} skipped, ${data.totalCells} total cells).`
      );
    },
    onError: (err) => {
      setError(err.message || "Commit failed");
    },
  });

  const handleGenerate = useCallback(() => {
    if (!countryGeometry) return;
    setError(null);
    try {
      const result = generateProvinces(countryGeometry, count, { seed });
      if (result.length === 0) {
        setError("Generation produced no cells. Try a different seed or count.");
        setCells(null);
      } else {
        setCells(result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
  }, [countryGeometry, count, seed]);

  const handleCommit = useCallback(() => {
    if (!cells || cells.length === 0) return;
    const namesList = names
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean);
    commitMutation.mutate({
      countryId,
      count: cells.length,
      seed,
      names: namesList.length > 0 ? namesList : undefined,
    });
  }, [cells, countryId, seed, names, commitMutation]);

  const handleDiscard = useCallback(() => {
    setCells(null);
    setError(null);
  }, []);

  if (!countryGeometry) {
    return (
      <div className="space-y-3 p-3">
        <p className="text-label-secondary text-footnote">No country geometry loaded.</p>
        <Button variant="ghost" size="sm" className="text-label-secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-label text-caption font-semibold">Generate subdivisions</span>
        <Button
          variant="ghost"
          size="icon"
          className="text-label-secondary h-6 w-6"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-2">
        <div>
          <Eyebrow className="block">Count ({count})</Eyebrow>
          <Slider
            aria-label="Generate subdivisions"
            min={2}
            max={50}
            value={[count]}
            onValueChange={([v]) => v !== undefined && setCount(v)}
            className="w-full py-2"
          />
        </div>

        <div className="flex items-center gap-2">
          <Eyebrow className="block shrink-0">Seed</Eyebrow>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value) || 42)}
            className="border-separator bg-surface focus:border-tint focus:ring-tint text-footnote rounded-control-sm w-20 border px-2 py-1 focus:ring-1 focus:outline-none"
          />
        </div>

        <div>
          <Eyebrow className="block">Names (one per line, optional)</Eyebrow>
          <textarea
            value={names}
            onChange={(e) => setNames(e.target.value)}
            rows={3}
            placeholder="Province A&#10;Province B&#10;..."
            className="border-separator bg-surface focus:border-tint focus:ring-tint text-footnote rounded-control-sm w-full border px-2 py-1 focus:ring-1 focus:outline-none"
          />
        </div>
      </div>

      {!cells && (
        <Button
          variant="secondary"
          size="sm"
          className="w-full justify-center"
          onClick={handleGenerate}
        >
          <Dice5 className="h-3.5 w-3.5" />
          Generate
        </Button>
      )}

      {cells && (
        <>
          <Card className="space-y-1 p-2">
            <div className="flex items-center justify-between">
              <Eyebrow className="flex items-center gap-1">
                <Grid3X3 className="h-3 w-3" />
                Preview ({cells.length} cells)
              </Eyebrow>
            </div>
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {cells.map((cell, i) => (
                <div key={i} className="text-label-secondary text-footnote flex justify-between">
                  <span>
                    {names
                      .split("\n")
                      .map((n) => n.trim())
                      .filter(Boolean)[i] || `Province ${i + 1}`}
                  </span>
                  <span className="text-footnote font-mono">
                    {cell.type === "Polygon"
                      ? `${cell.coordinates[0].length} pts`
                      : `${cell.coordinates.length} polys`}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 justify-center"
              onClick={handleCommit}
              disabled={commitMutation.isPending}
            >
              {commitMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {commitMutation.isPending ? "Committing…" : "Commit"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive flex-1 justify-center"
              onClick={handleDiscard}
              disabled={commitMutation.isPending}
            >
              <X className="h-3.5 w-3.5" />
              Discard
            </Button>
          </div>
        </>
      )}

      {error && <p className="text-footnote text-red">{error}</p>}
    </div>
  );
});
