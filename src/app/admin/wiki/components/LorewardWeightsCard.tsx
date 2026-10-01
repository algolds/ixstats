"use client";
// src/app/admin/wiki/components/LorewardWeightsCard.tsx
// Scoring parameter weights tuning & simulation preview.

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Slider } from "~/components/ui/slider";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  ControlSlider as SlidersHorizontal,
  FloppyDisk as Save,
  SystemRestart as Loader2,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";

const WEIGHT_SLIDERS = [
  { key: "lorewardWeight_bytesAdded", label: "Bytes Added Weight" },
  { key: "lorewardWeight_proseRatio", label: "Prose Ratio Weight" },
  { key: "lorewardWeight_editDepth", label: "Edit Depth Weight" },
  { key: "lorewardWeight_collaborationBonus", label: "Collaboration Bonus Weight" },
  { key: "lorewardWeight_newArticleBonus", label: "New Article Bonus Weight" },
] as const;

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
      <FacetCard className="space-y-4 p-5">
        <div className="border-separator border-b pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="text-blue h-4 w-4" />
            <h3 className="text-label text-caption">Scoring Parameters Tuning</h3>
          </div>
          <p className="text-label-secondary text-footnote mt-0.5">
            Tune the daily Loreward scoring engine weights in real-time
          </p>
        </div>
        <div>
          {tempWeights ? (
            <form onSubmit={handleSaveWeights} className="space-y-4">
              <div className="space-y-4">
                {WEIGHT_SLIDERS.map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <div className="text-caption flex justify-between">
                      <span id={`loreward-${key}`} className="text-label">
                        {label}
                      </span>
                      <span className="text-blue font-semibold tabular-nums">
                        {tempWeights[key]}
                      </span>
                    </div>
                    <Slider
                      aria-labelledby={`loreward-${key}`}
                      min={0}
                      max={3}
                      step={0.1}
                      value={[Number(tempWeights[key] ?? 0)]}
                      onValueChange={([v]) => {
                        if (v !== undefined) handleWeightChange(key, v);
                      }}
                    />
                  </div>
                ))}
              </div>

              <Button
                type="submit"
                disabled={saveWeightsMutation.isPending}
                className="w-full gap-2"
              >
                {saveWeightsMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Save className="h-3.5 w-3.5" />
                Save Weight Configuration
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <Skeleton className="rounded-control h-8 w-full" />
              <Skeleton className="rounded-control h-8 w-full" />
              <Skeleton className="rounded-control h-8 w-full" />
            </div>
          )}
        </div>
      </FacetCard>

      {/* Weight Tuning Preview Console */}
      <FacetCard className="space-y-4 p-5">
        <div className="border-separator border-b pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="text-indigo h-4 w-4" />
            <h3 className="text-label text-caption">Weight Tuning Preview</h3>
          </div>
          <p className="text-label-secondary text-footnote mt-0.5">
            Preview candidate ranks under simulated weights
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <label className="text-label text-caption">Scoring Date</label>
              <Input
                type="date"
                value={previewDate}
                onChange={(e) => setPreviewDate(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
            </div>
            <Button onClick={handleRunPreview} disabled={isPreviewLoading || !tempWeights}>
              {isPreviewLoading ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <SlidersHorizontal className="mr-2 h-3.5 w-3.5" />
              )}
              Preview Ranks
            </Button>
          </div>

          {isPreviewLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="rounded-control h-8 w-full" />
              <Skeleton className="rounded-control h-8 w-full" />
              <Skeleton className="rounded-control h-8 w-full" />
            </div>
          ) : rankDeltas.length > 0 ? (
            <Table containerClassName="max-h-80">
              <TableHeader sticky>
                <TableRow>
                  <TableHead className="w-16 px-3">Rank</TableHead>
                  <TableHead className="px-3">Candidate</TableHead>
                  <TableHead className="px-3 text-right">Curr Score</TableHead>
                  <TableHead className="px-3 text-right">Sim Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankDeltas.map((item: any, idx: number) => {
                  const delta = item.rankDelta;
                  return (
                    <TableRow key={idx}>
                      <TableCell className="px-3 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{item.simulatedRank}</span>
                          {delta > 0 && <span className="text-green font-semibold">▲{delta}</span>}
                          {delta < 0 && (
                            <span className="text-red font-semibold">▼{Math.abs(delta)}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-3">
                        <span className="text-label font-semibold">{item.user}</span>
                        <span className="text-label-secondary text-footnote block">
                          {item.page}
                        </span>
                      </TableCell>
                      <TableCell className="text-label-secondary px-3 text-right">
                        {item.currentScore.toFixed(2)}
                      </TableCell>
                      <TableCell className="px-3 text-right font-mono">
                        <span className="font-semibold">{item.simulatedScore.toFixed(2)}</span>
                        {item.scoreDelta !== 0 && (
                          <span
                            className={cn(
                              "text-caption block",
                              item.scoreDelta > 0 ? "text-green" : "text-red"
                            )}
                          >
                            {item.scoreDelta > 0 ? "+" : ""}
                            {item.scoreDelta.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : currentPreviewData ? (
            <div className="text-label-secondary text-footnote py-8 text-center italic">
              No edits or candidates qualified on {previewDate}.
            </div>
          ) : null}
        </div>
      </FacetCard>
    </div>
  );
}
