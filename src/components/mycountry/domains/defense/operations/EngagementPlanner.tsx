"use client";

/**
 * Plan an engagement before committing it (realm time D3): choose the share of forces to commit, read the odds and the
 * preview, then commit with a confirmation. The roll happens on the server from a seed bound to the committed orders,
 * so committing again never rerolls a result.
 */
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { DEFAULT_COMMITMENT, MIN_COMMITMENT } from "~/lib/military/combat";
import { api } from "~/trpc/react";
import { CombatOdds } from "./CombatOdds";

interface EngagementPlannerProps {
  mode: "strike" | "pvp";
  targetId: string;
  commitLabel: string;
  pendingLabel: string;
  /** What committing means, shown before the final confirmation. */
  confirmText: string;
  pending: boolean;
  onCommit: (commitment: number) => void;
}

export function EngagementPlanner(p: EngagementPlannerProps) {
  const [commitment, setCommitment] = useState(DEFAULT_COMMITMENT);
  const [queried, setQueried] = useState(DEFAULT_COMMITMENT);
  const [confirming, setConfirming] = useState(false);
  const odds = api.security.getCombatOdds.useQuery(
    { targetCountryId: p.targetId, mode: p.mode, commitment: queried },
    { enabled: !!p.targetId, retry: false, staleTime: 60_000 }
  );

  return (
    <div className="space-y-4">
      <div>
        <Label id="commitment-label">Forces committed: {Math.round(commitment * 100)}%</Label>
        <Slider
          aria-labelledby="commitment-label"
          value={[commitment]}
          onValueChange={([v]) => {
            setCommitment(v ?? DEFAULT_COMMITMENT);
            setConfirming(false);
          }}
          onValueCommit={([v]) => setQueried(v ?? DEFAULT_COMMITMENT)}
          min={MIN_COMMITMENT}
          max={1}
          step={0.1}
        />
      </div>
      {odds.isLoading && <p className="text-label-secondary text-footnote">Reading the odds…</p>}
      {odds.error && (
        <p role="alert" className="text-destructive text-body">
          {odds.error.message}
        </p>
      )}
      {odds.data && <CombatOdds data={odds.data} />}
      {confirming ? (
        <div className="space-y-2">
          <p className="text-body">{p.confirmText}</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)}>
              Back
            </Button>
            <Button className="flex-1" disabled={p.pending} onClick={() => p.onCommit(commitment)}>
              {p.pending ? p.pendingLabel : p.commitLabel}
            </Button>
          </div>
        </div>
      ) : (
        <Button className="w-full" disabled={!odds.data} onClick={() => setConfirming(true)}>
          Review and commit
        </Button>
      )}
    </div>
  );
}
