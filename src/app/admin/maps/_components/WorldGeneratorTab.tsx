"use client";

import React, { useState, useCallback } from "react";
import { api } from "~/trpc/react";
import {
  Sparkles,
  Loader2,
  Check,
  History,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { GenerationParamsForm, type GenParams } from "./GenerationParamsForm";
import { WorldGeneratorPreview } from "./WorldGeneratorPreview";

const DEFAULT_PARAMS: GenParams = {
  seed: 42,
  continentCount: 6,
  countryMin: 60,
  countryMax: 200,
  oceanPercentage: 0.65,
  terrainRoughness: 0.5,
  hasIcecaps: true,
  hasRivers: true,
  hasLakes: true,
  gridResolution: 512,
  similarity: 0.8,
  profileName: "IxWorld",
};

export function WorldGeneratorTab() {
  const [params, setParams] = useState<GenParams>(DEFAULT_PARAMS);
  const [currentWorldId, setCurrentWorldId] = useState<string | null>(null);
  const [commitName, setCommitName] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const utils = api.useUtils();

  const generateMutation = api.geo.generateProceduralWorld.useMutation({
    onSuccess: (data) => {
      setCurrentWorldId(data.worldId);
      void utils.geo.listProceduralWorlds.invalidate();
    },
  });

  const commitMutation = api.geo.commitProceduralWorld.useMutation({
    onSuccess: () => {
      void utils.geo.getMapStats.invalidate();
    },
  });

  const { data: history } = api.geo.listProceduralWorlds.useQuery(undefined, {
    enabled: showHistory,
    refetchOnWindowFocus: false,
  });

  const doGenerate = useCallback(
    (genParams: GenParams) => {
      generateMutation.mutate({
        seed: genParams.seed,
        continentCount: genParams.continentCount,
        countryCountRange: [genParams.countryMin, genParams.countryMax],
        oceanPercentage: genParams.oceanPercentage,
        terrainRoughness: genParams.terrainRoughness,
        hasIcecaps: genParams.hasIcecaps,
        hasRivers: genParams.hasRivers,
        hasLakes: genParams.hasLakes,
        gridResolution: genParams.gridResolution,
        similarity: genParams.similarity,
        profileName: genParams.profileName,
      });
    },
    [generateMutation]
  );

  const handleGenerate = useCallback(() => {
    doGenerate(params);
  }, [params, doGenerate]);

  const handleQuickGenerate = useCallback(() => {
    const quickParams: GenParams = {
      ...DEFAULT_PARAMS,
      seed: Math.floor(Math.random() * 999999),
      continentCount: 6,
      countryMin: 160,
      countryMax: 200,
      oceanPercentage: 0.65,
      terrainRoughness: 0.5,
      hasIcecaps: true,
      hasRivers: true,
      hasLakes: true,
      gridResolution: 512,
      similarity: 0.8,
      profileName: "IxWorld",
    };
    setParams(quickParams);
    doGenerate(quickParams);
  }, [doGenerate]);

  const handleCommit = useCallback(() => {
    if (!currentWorldId) return;
    commitMutation.mutate({
      worldId: currentWorldId,
      saveAsTemplate: !!commitName.trim(),
      templateName: commitName.trim() || undefined,
    });
  }, [currentWorldId, commitName, commitMutation]);

  const stats = generateMutation.data?.stats;

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 280px)" }}>
      {/* Left Panel: Controls */}
      <div className="flex w-80 flex-col gap-4 overflow-y-auto">
        {/* Quick Generate */}
        <Button
          onClick={handleQuickGenerate}
          disabled={generateMutation.isPending}
          className="w-full bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-medium"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Quick Generate (IxWorld-like)
            </>
          )}
        </Button>

        {/* Parameters */}
        <div className="rounded-xl border border-border bg-muted/50 p-4 ">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-foreground">World Parameters</h3>
          </div>

          <GenerationParamsForm
            params={params}
            onChange={setParams}
            disabled={generateMutation.isPending}
          />

          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="mt-4 w-full bg-amber-600 hover:bg-amber-500 text-white"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate World
              </>
            )}
          </Button>

          {generateMutation.isError && (
            <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-500">
              {generateMutation.error.message}
            </div>
          )}
        </div>

        {/* Generation Stats */}
        {stats && (
          <div className="rounded-xl border border-border bg-muted/50 p-4 ">
            <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Generation Results
            </h4>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Land coverage</span>
                <span>{Math.round(stats.landPercentage * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Countries</span>
                <span>{stats.countryCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Rivers</span>
                <span>{stats.riverCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Lakes</span>
                <span>{stats.lakeCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Altitude zones</span>
                <span>{stats.altitudeZoneCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Climate zones</span>
                <span>{stats.climateZoneCount}</span>
              </div>
              {stats.icecapCount > 0 && (
                <div className="flex justify-between">
                  <span>Icecaps</span>
                  <span>{stats.icecapCount}</span>
                </div>
              )}

              {/* Profile-guided stats */}
              {stats.areaGini !== undefined && (
                <>
                  <div className="mt-2 border-t border-border pt-2" />
                  <div className="flex justify-between">
                    <span>Area inequality (Gini)</span>
                    <span>{stats.areaGini.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Landlocked ratio</span>
                    <span>{Math.round(stats.landlockedRatio * 100)}%</span>
                  </div>
                  {stats.profileSimilarity !== null &&
                    stats.profileSimilarity !== undefined && (
                      <div className="flex justify-between">
                        <span>Profile match</span>
                        <span
                          className={
                            stats.profileSimilarity > 0.7
                              ? "text-green-500"
                              : stats.profileSimilarity > 0.4
                                ? "text-amber-500"
                                : "text-red-500"
                          }
                        >
                          {Math.round(stats.profileSimilarity * 100)}%
                        </span>
                      </div>
                    )}
                </>
              )}

              <div className="flex justify-between border-t border-border pt-1 text-muted-foreground">
                <span>Generation time</span>
                <span>{Math.round(stats.generationTimeMs)}ms</span>
              </div>
            </div>

            {/* Validation warnings */}
            {stats.warnings && stats.warnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2">
                <div className="flex items-center gap-1 text-xs font-medium text-amber-500 mb-1">
                  <AlertTriangle className="h-3 w-3" />
                  Warnings
                </div>
                {stats.warnings.map((w: string, i: number) => (
                  <p key={i} className="text-[10px] text-amber-500/80">
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Commit to Map */}
        {currentWorldId && (
          <div className="rounded-xl border border-border bg-muted/50 p-4 ">
            <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Apply to World Map
            </h4>
            <p className="mb-3 text-xs text-muted-foreground">
              This will replace all current map layers with the generated world.
            </p>
            <input
              type="text"
              value={commitName}
              onChange={(e) => setCommitName(e.target.value)}
              placeholder="Template name (optional, to save)"
              className="mb-2 w-full rounded border border-border bg-muted/50 px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:border-green-500/50 focus:outline-none"
            />
            <Button
              onClick={handleCommit}
              disabled={commitMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-500 text-white"
            >
              {commitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Apply to World
                </>
              )}
            </Button>
            {commitMutation.isSuccess && (
              <div className="mt-2 rounded border border-green-500/20 bg-green-500/10 p-2 text-xs text-green-500">
                Applied {commitMutation.data.totalImported} features!
                {commitMutation.data.templateId && " Template saved."}
              </div>
            )}
          </div>
        )}

        {/* History Toggle */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <History className="h-3.5 w-3.5" />
          {showHistory ? "Hide" : "Show"} generation history
        </button>

        {/* History */}
        {showHistory && history && (
          <div className="space-y-2">
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground/50">No generated worlds yet.</p>
            ) : (
              history.map((w) => {
                const meta = w.metadata as Record<string, unknown> | null;
                return (
                  <div
                    key={w.id}
                    className="rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">
                        Seed: {w.seed}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">
                        {new Date(w.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {meta && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {meta.countryCount && `${meta.countryCount} countries`}
                        {meta.generationTimeMs && ` · ${Math.round(meta.generationTimeMs as number)}ms`}
                        {typeof meta.profileSimilarity === "number" &&
                          ` · ${Math.round(meta.profileSimilarity * 100)}% match`}
                      </div>
                    )}
                    <div className="mt-2 flex gap-1">
                      <button
                        onClick={() => setCurrentWorldId(w.id)}
                        className="rounded bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/80"
                      >
                        Preview
                      </button>
                      {w.templateId && (
                        <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[10px] text-purple-500">
                          Saved as template
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Right: Map Preview */}
      <div className="flex-1 overflow-hidden rounded-xl border border-border">
        <WorldGeneratorPreview worldId={currentWorldId} />
      </div>
    </div>
  );
}
