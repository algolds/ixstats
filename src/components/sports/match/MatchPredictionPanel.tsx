"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { soundEffects } from "~/lib/sound/cuelume";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

type Outcome = "home" | "away" | "draw";

interface MatchPredictionPanelProps {
  matchId: string;
  homeName: string;
  awayName: string;
}

/** Stake Sovereigns on a scheduled match's outcome (parimutuel pool, settled when it's played). */
export function MatchPredictionPanel({ matchId, homeName, awayName }: MatchPredictionPanelProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [outcome, setOutcome] = useState<Outcome>("home");
  const [stake, setStake] = useState("100");

  const { data } = api.sports.getMatchPredictions.useQuery({ matchId }, { staleTime: 10000 });

  const place = api.sports.placePrediction.useMutation({
    onSuccess: () => {
      soundEffects.success();
      notify.success("Prediction placed!");
      void utils.sports.getMatchPredictions.invalidate({ matchId });
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to place prediction");
    },
  });

  const options: Array<{ id: Outcome; label: string }> = [
    { id: "home", label: homeName },
    { id: "draw", label: "Draw" },
    { id: "away", label: awayName },
  ];

  const stakeNumber = Number(stake);
  const validStake =
    Number.isInteger(stakeNumber) &&
    stakeNumber >= (data?.minStake ?? 1) &&
    stakeNumber <= (data?.maxStake ?? 10000);

  return (
    <div className="border-border/40 bg-card/50 space-y-3 rounded-2xl border p-4">
      <div className="flex items-center justify-between">
        <span className="text-foreground text-xs font-bold">Predict the result</span>
        {data && (
          <span className="text-muted-foreground text-xs">
            Pool: {data.totalPool.toLocaleString()} ({data.entries}{" "}
            {data.entries === 1 ? "entry" : "entries"})
          </span>
        )}
      </div>

      {data?.mine ? (
        <p className="text-muted-foreground text-xs">
          You backed{" "}
          <span className="text-foreground font-semibold">
            {data.mine.outcome === "home"
              ? homeName
              : data.mine.outcome === "away"
                ? awayName
                : "a draw"}
          </span>{" "}
          with {data.mine.stake.toLocaleString()} Sovereigns. Winners split the pool when the match
          is played.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  soundEffects.press();
                  setOutcome(o.id);
                }}
                className={cn(
                  "rounded-xl border px-2 py-2 text-xs font-semibold transition",
                  outcome === o.id
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "border-border/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="block truncate">{o.label}</span>
                {data && (
                  <span className="text-muted-foreground block font-normal">
                    {data.pool[o.id].toLocaleString()}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={data?.minStake ?? 1}
              max={data?.maxStake ?? 10000}
              step={1}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="h-8 flex-1 rounded-xl text-xs"
              aria-label="Stake in Sovereigns"
            />
            <Button
              size="sm"
              disabled={place.isPending || !validStake}
              onClick={() => {
                soundEffects.press();
                place.mutate({ matchId, outcome, stake: stakeNumber });
              }}
              className="h-8 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500"
            >
              Stake Sovereigns
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            One prediction per match, closed at kickoff. If nobody picks the result, stakes are
            refunded.
          </p>
        </>
      )}
    </div>
  );
}
