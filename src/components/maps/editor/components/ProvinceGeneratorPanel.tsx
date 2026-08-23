"use client";

import React, { useState, useCallback } from "react";
import { DiceFive as Dice5, Check, Xmark as X, ViewGrid as Grid3X3, SystemRestart as Loader2 } from "iconoir-react";
import { generateProvinces } from "~/lib/maps/province-generator";
import { api } from "~/trpc/react";
import type { Polygon, MultiPolygon } from "geojson";

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
  const [count, setCount] = useState(10);
  const [seed, setSeed] = useState(42);
  const [names, setNames] = useState("");
  const [cells, setCells] = useState<(Polygon | MultiPolygon)[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commitMutation = api.geoFeatures.commitGeneratedSubdivisions.useMutation({
    onSuccess: (data) => {
      setCells(null);
      setError(null);
      alert(
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
        setError("Generation produced no cells — try a different seed or count.");
        setCells(null);
      } else {
        setCells(result);
      }
    } catch (e: any) {
      setError(e?.message || "Generation failed");
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
        <p className="text-muted-foreground text-xs">No country geometry loaded.</p>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xs underline"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-foreground text-xs font-semibold">Generate Subdivisions</span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground rounded p-0.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Controls */}
      <div className="space-y-2">
        <div>
          <label className="text-muted-foreground text-[10px] font-medium uppercase">
            Count ({count})
          </label>
          <input
            type="range"
            min={2}
            max={50}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value))}
            className="h-1 w-full accent-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-muted-foreground shrink-0 text-[10px] font-medium uppercase">
            Seed
          </label>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value) || 42)}
            className="border-border bg-background w-20 rounded border px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-muted-foreground text-[10px] font-medium uppercase">
            Names (one per line, optional)
          </label>
          <textarea
            value={names}
            onChange={(e) => setNames(e.target.value)}
            rows={3}
            placeholder="Province A&#10;Province B&#10;..."
            className="border-border bg-background w-full rounded border px-2 py-1 text-[10px] focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Action buttons */}
      {!cells && (
        <button
          onClick={handleGenerate}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600/20 px-3 py-2 text-xs font-medium text-blue-500 hover:bg-blue-600/30"
        >
          <Dice5 className="h-3.5 w-3.5" />
          Generate
        </button>
      )}

      {/* Generated cells preview */}
      {cells && (
        <>
          <div className="border-border/30 bg-muted/10 space-y-1 rounded-lg border p-2">
            <div className="text-muted-foreground flex items-center justify-between text-[10px] font-semibold tracking-wider uppercase">
              <span className="flex items-center gap-1">
                <Grid3X3 className="h-3 w-3" />
                Preview ({cells.length} cells)
              </span>
            </div>
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {cells.map((cell, i) => (
                <div key={i} className="text-muted-foreground flex justify-between text-[10px]">
                  <span>
                    {names
                      .split("\n")
                      .map((n) => n.trim())
                      .filter(Boolean)[i] || `Province ${i + 1}`}
                  </span>
                  <span className="font-mono text-[9px]">
                    {cell.type === "Polygon"
                      ? `${cell.coordinates[0].length} pts`
                      : `${cell.coordinates.length} polys`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCommit}
              disabled={commitMutation.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600/20 px-3 py-2 text-xs font-medium text-green-500 hover:bg-green-600/30 disabled:opacity-50"
            >
              {commitMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {commitMutation.isPending ? "Committing…" : "Commit"}
            </button>
            <button
              onClick={handleDiscard}
              disabled={commitMutation.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600/20 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-600/30 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Discard
            </button>
          </div>
        </>
      )}

      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  );
});
