"use client";

import { useState } from "react";
import { Coins, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

type Side = "home" | "draw" | "away";

/**
 * Parimutuel matchday prediction. Stake Sovereigns on home/draw/away; the whole
 * pool is split among correct pickers when the match resolves. The shown multiplier
 * is indicative (current pool) — the real payout settles at kickoff.
 */
export function MatchPredictionWidget({
  matchId,
  homeName,
  awayName,
  bettingOpen,
}: {
  matchId: string;
  homeName: string;
  awayName: string;
  bettingOpen: boolean;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { data } = api.sports.getMatchPool.useQuery({ matchId }, { refetchInterval: 20_000 });
  const [side, setSide] = useState<Side>("home");
  const [stake, setStake] = useState(50);

  const place = api.sports.placePrediction.useMutation({
    onSuccess: () => {
      notify.success("Prediction placed", `₷${stake.toLocaleString()} staked`);
      void utils.sports.getMatchPool.invalidate({ matchId });
      void utils.sports.getMyPredictions.invalidate();
    },
    onError: (e) => notify.error("Couldn't place prediction", e.message),
  });

  const total = data?.total ?? 0;
  const poolFor = (s: Side) => data?.pool[s] ?? 0;
  const multFor = (s: Side) => {
    const p = poolFor(s) + stake; // include your hypothetical stake
    return p > 0 ? (total + stake) / p : 0;
  };

  const labels: Record<Side, string> = { home: homeName, draw: "Draw", away: awayName };

  if (data?.myPick) {
    return (
      <div className="border-border/30 flex items-center gap-2 rounded-xl border bg-emerald-500/5 p-3 text-xs">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        <span className="text-foreground/80">
          You backed <b>{labels[data.myPick as Side]}</b>. Pool: ₷{total.toLocaleString()} across{" "}
          {data.count} picks. Payout settles at kickoff.
        </span>
      </div>
    );
  }

  return (
    <div className="border-border/30 space-y-3 rounded-xl border p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase">
        <Coins className="h-3.5 w-3.5 text-amber-400" />
        Predict the result
        <span className="text-muted-foreground ml-auto font-normal normal-case">
          Pool ₷{total.toLocaleString()}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["home", "draw", "away"] as Side[]).map((s) => {
          const pct = total > 0 ? Math.round((poolFor(s) / total) * 100) : 0;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg border p-2 text-xs transition",
                side === s
                  ? "border-amber-400 bg-amber-400/10 font-bold"
                  : "border-border/40 hover:bg-muted/40"
              )}
            >
              <span className="max-w-full truncate">{labels[s]}</span>
              <span className="text-muted-foreground text-[10px]">
                ≈{multFor(s).toFixed(2)}x · {pct}%
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={100000}
          value={stake}
          onChange={(e) => setStake(Math.max(1, Math.min(100000, Number(e.target.value) || 0)))}
          className="h-8 w-24 text-xs"
          disabled={!bettingOpen}
        />
        <Button
          size="sm"
          className="h-8 flex-1 text-xs"
          disabled={!bettingOpen || place.isPending || stake < 1}
          onClick={() => place.mutate({ matchId, outcome: side, stake })}
        >
          {place.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Coins className="mr-1.5 h-3.5 w-3.5" />
          )}
          {bettingOpen ? `Stake ₷${stake.toLocaleString()}` : "Betting closed"}
        </Button>
      </div>
    </div>
  );
}
