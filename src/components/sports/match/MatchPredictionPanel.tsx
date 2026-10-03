"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { soundCues } from "~/lib/sound/cuelume";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";

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
      soundCues.success();
      notify.success("Prediction placed");
      void utils.sports.getMatchPredictions.invalidate({ matchId });
    },
    onError: (err) => {
      soundCues.error();
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
    <div className="border-separator bg-surface rounded-card space-y-3 border p-4">
      <div className="flex items-center justify-between">
        <span className="text-label text-footnote font-semibold">Predict the result</span>
        {data && (
          <span className="text-label-secondary text-footnote">
            Pool: {data.totalPool.toLocaleString()} ({data.entries}{" "}
            {data.entries === 1 ? "entry" : "entries"})
          </span>
        )}
      </div>

      {data?.mine ? (
        <p className="text-label-secondary text-footnote">
          You backed{" "}
          <span className="text-label font-semibold">
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
          <RadioCardGroup
            aria-label="Predicted outcome"
            value={outcome}
            onValueChange={(v) => setOutcome(v as Outcome)}
            className="grid grid-cols-3 gap-2"
          >
            {options.map((o) => (
              <RadioCard
                key={o.id}
                value={o.id}
                indicator={false}
                className="text-footnote flex-col items-stretch gap-0 px-2 py-2 text-center font-semibold"
              >
                <span className="block truncate">{o.label}</span>
                {data && (
                  <span className="text-label-secondary block font-normal tabular-nums">
                    {data.pool[o.id].toLocaleString()}
                  </span>
                )}
              </RadioCard>
            ))}
          </RadioCardGroup>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={data?.minStake ?? 1}
              max={data?.maxStake ?? 10000}
              step={1}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="rounded-row text-footnote h-8 flex-1"
              aria-label="Stake in Sovereigns"
            />
            <Button
              size="sm"
              disabled={place.isPending || !validStake}
              onClick={() => {
                place.mutate({ matchId, outcome, stake: stakeNumber });
              }}
              className="rounded-row bg-green text-footnote text-on-green h-8 px-3 font-semibold"
            >
              Stake Sovereigns
            </Button>
          </div>
          <p className="text-label-secondary text-footnote">
            One prediction per match, closed at kickoff. If nobody picks the result, stakes are
            refunded.
          </p>
        </>
      )}
    </div>
  );
}
