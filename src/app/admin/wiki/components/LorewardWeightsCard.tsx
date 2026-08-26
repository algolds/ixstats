// src/app/admin/wiki/components/LorewardWeightsCard.tsx
// Scoring parameter weights tuning & simulation preview.

"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { ControlSlider as SlidersHorizontal, FloppyDisk as Save, SystemRestart as Loader2 } from "iconoir-react";
import { cn } from "~/lib/utils";

export function LorewardWeightsCard() {
  const notify = useNotify();
  const utils = api.useUtils();

  const { data: weights, refetch: refetchWeights } = api.admin.getLorewardWeights.useQuery();
  const [tempWeights, setTempWeights] = useState<any>(null);

  useEffect(() => {
    if (weights) {
      setTempWeights({ ...weights });
    }
  }, [weights]);

  const saveWeightsMutation = api.admin.saveLorewardWeights.useMutation({
    onSuccess: () => {
      notify.success("Weights Saved", "System scoring weights updated successfully");
      refetchWeights();
    },
    onError: (err) => notify.error("Error", err.message),
  });

  const handleWeightChange = (key: string, value: number) => {
    setTempWeights((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: value,
      };
    });
  };

  const handleSaveWeights = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempWeights) return;
    saveWeightsMutation.mutate(tempWeights);
  };

  // Weight Tuning Preview console
  const [previewDate, setPreviewDate] = useState(
    new Date(Date.now() - 86400000).toISOString().split("T")[0]
  );
  const [currentPreviewData, setCurrentPreviewData] = useState<any>(null);
  const [simulatedPreviewData, setSimulatedPreviewData] = useState<any>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const handleRunPreview = async () => {
    if (!tempWeights || !weights) return;
    setIsPreviewLoading(true);
    try {
      const current = await utils.admin.previewLorewardScoring.fetch({
        date: previewDate,
        proseWeight: weights.lorewardWeight_proseRatio,
        collaborativeBonus: weights.lorewardWeight_collaborationBonus,
        depthMaxBonus: weights.lorewardWeight_editDepth,
        noveltyBonus: weights.lorewardWeight_newArticleBonus,
        importanceMaxBonus: 0.2,
      });

      const simulated = await utils.admin.previewLorewardScoring.fetch({
        date: previewDate,
        proseWeight: tempWeights.lorewardWeight_proseRatio,
        collaborativeBonus: tempWeights.lorewardWeight_collaborationBonus,
        depthMaxBonus: tempWeights.lorewardWeight_editDepth,
        noveltyBonus: tempWeights.lorewardWeight_newArticleBonus,
        importanceMaxBonus: 0.2,
      });

      setCurrentPreviewData(current);
      setSimulatedPreviewData(simulated);
      notify.success("Preview Generated", `Fetched scoring data for ${previewDate}`);
    } catch (err: any) {
      notify.error("Preview Error", err.message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const getRankDeltas = () => {
    if (!currentPreviewData || !simulatedPreviewData) return [];

    const currentMap = new Map<string, { rank: number; score: number }>();
    currentPreviewData.candidates.forEach((cand: any, idx: number) => {
      currentMap.set(`${cand.user}|${cand.page}`, {
        rank: idx + 1,
        score: cand.finalScore,
      });
    });

    return simulatedPreviewData.candidates.map((cand: any, idx: number) => {
      const simRank = idx + 1;
      const key = `${cand.user}|${cand.page}`;
      const curr = currentMap.get(key);

      const rankDelta = curr ? curr.rank - simRank : 0;
      const scoreDelta = curr ? cand.finalScore - curr.score : 0;

      return {
        user: cand.user,
        page: cand.page,
        currentRank: curr ? curr.rank : "N/A",
        simulatedRank: simRank,
        currentScore: curr ? curr.score : 0,
        simulatedScore: cand.finalScore,
        rankDelta,
        scoreDelta,
      };
    });
  };

  const rankDeltas = getRankDeltas();

  return (
    <div className="space-y-6">
      {/* Scoring Parameter Weights */}
      <div className="rounded-2xl border border-border/30 bg-card/25 p-5 backdrop-blur-md shadow-xs space-y-4">
        <div className="border-b border-border/20 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-blue-400" />
            <h3 className="text-xs font-bold text-foreground">Scoring Parameters Tuning</h3>
          </div>
          <p className="text-muted-foreground text-[11px] mt-0.5">
            Tune the daily Loreward scoring engine weights in real-time
          </p>
        </div>
        <div>
          {tempWeights ? (
            <form onSubmit={handleSaveWeights} className="space-y-4">
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground">Bytes Added Weight</span>
                    <span className="font-mono font-bold text-blue-400">
                      {tempWeights.lorewardWeight_bytesAdded}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.1"
                    value={tempWeights.lorewardWeight_bytesAdded}
                    onChange={(e) =>
                      handleWeightChange("lorewardWeight_bytesAdded", parseFloat(e.target.value))
                    }
                    className="w-full accent-blue-500 h-1.5 rounded-lg bg-muted/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground">Prose Ratio Weight</span>
                    <span className="font-mono font-bold text-blue-400">
                      {tempWeights.lorewardWeight_proseRatio}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.1"
                    value={tempWeights.lorewardWeight_proseRatio}
                    onChange={(e) =>
                      handleWeightChange("lorewardWeight_proseRatio", parseFloat(e.target.value))
                    }
                    className="w-full accent-blue-500 h-1.5 rounded-lg bg-muted/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground">Edit Depth Weight</span>
                    <span className="font-mono font-bold text-blue-400">
                      {tempWeights.lorewardWeight_editDepth}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.1"
                    value={tempWeights.lorewardWeight_editDepth}
                    onChange={(e) =>
                      handleWeightChange("lorewardWeight_editDepth", parseFloat(e.target.value))
                    }
                    className="w-full accent-blue-500 h-1.5 rounded-lg bg-muted/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground">Collaboration Bonus Weight</span>
                    <span className="font-mono font-bold text-blue-400">
                      {tempWeights.lorewardWeight_collaborationBonus}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.1"
                    value={tempWeights.lorewardWeight_collaborationBonus}
                    onChange={(e) =>
                      handleWeightChange(
                        "lorewardWeight_collaborationBonus",
                        parseFloat(e.target.value)
                      )
                    }
                    className="w-full accent-blue-500 h-1.5 rounded-lg bg-muted/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground">New Article Bonus Weight</span>
                    <span className="font-mono font-bold text-blue-400">
                      {tempWeights.lorewardWeight_newArticleBonus}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.1"
                    value={tempWeights.lorewardWeight_newArticleBonus}
                    onChange={(e) =>
                      handleWeightChange(
                        "lorewardWeight_newArticleBonus",
                        parseFloat(e.target.value)
                      )
                    }
                    className="w-full accent-blue-500 h-1.5 rounded-lg bg-muted/40"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={saveWeightsMutation.isPending}
                className="h-8 w-full gap-2 rounded-xl text-xs font-semibold active:scale-[0.98] transition-transform"
              >
                {saveWeightsMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Save className="h-3.5 w-3.5" />
                Save Weight Configuration
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          )}
        </div>
      </div>

      {/* Weight Tuning Preview Console */}
      <div className="rounded-2xl border border-border/30 bg-card/25 p-5 backdrop-blur-md shadow-xs space-y-4">
        <div className="border-b border-border/20 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-foreground">Weight Tuning Preview</h3>
          </div>
          <p className="text-muted-foreground text-[11px] mt-0.5">Preview candidate ranks under simulated weights</p>
        </div>
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <label className="text-foreground text-xs font-medium">Scoring Date</label>
              <Input
                type="date"
                value={previewDate}
                onChange={(e) => setPreviewDate(e.target.value)}
                className="h-8 rounded-xl border-border/30 bg-background/50 text-xs"
              />
            </div>
            <Button
              onClick={handleRunPreview}
              disabled={isPreviewLoading || !tempWeights}
              className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform"
            >
              {isPreviewLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
              )}
              Preview Ranks
            </Button>
          </div>

          {isPreviewLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          ) : rankDeltas.length > 0 ? (
            <div className="border-border/30 max-h-80 overflow-y-auto rounded-xl border text-xs">
              <table className="w-full">
                <thead className="bg-muted/30 sticky top-0 font-medium backdrop-blur-md border-b border-border/30 text-muted-foreground">
                  <tr>
                    <th className="w-16 px-3 py-2 text-left">Rank</th>
                    <th className="px-3 py-2 text-left">Candidate</th>
                    <th className="px-3 py-2 text-right">Curr Score</th>
                    <th className="px-3 py-2 text-right font-semibold">Sim Score</th>
                  </tr>
                </thead>
                <tbody className="divide-border/15 divide-y">
                  {rankDeltas.map((item: any, idx: number) => {
                    const delta = item.rankDelta;
                    return (
                      <tr key={idx} className="hover:bg-foreground/[0.02]">
                        <td className="px-3 py-2 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">{item.simulatedRank}</span>
                            {delta > 0 && (
                              <span className="font-bold text-emerald-400">▲{delta}</span>
                            )}
                            {delta < 0 && (
                              <span className="font-bold text-red-400">▼{Math.abs(delta)}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-foreground font-semibold">{item.user}</span>
                          <span className="text-muted-foreground block text-[10px]">
                            {item.page}
                          </span>
                        </td>
                        <td className="text-muted-foreground px-3 py-2 text-right font-mono">
                          {item.currentScore.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          <span className="font-semibold">{item.simulatedScore.toFixed(2)}</span>
                          {item.scoreDelta !== 0 && (
                            <span
                              className={cn(
                                "block text-[10px] font-medium",
                                item.scoreDelta > 0 ? "text-emerald-400" : "text-red-400"
                              )}
                            >
                              {item.scoreDelta > 0 ? "+" : ""}
                              {item.scoreDelta.toFixed(2)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : currentPreviewData ? (
            <div className="text-muted-foreground py-8 text-center text-xs italic">
              No edits or candidates qualified on {previewDate}.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
