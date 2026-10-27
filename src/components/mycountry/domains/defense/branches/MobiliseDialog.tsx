"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import type { Doctrine } from "~/lib/military/model";
import { mobilisationCost, mobilisationSchedule } from "~/lib/military/defense-console";
import { formatCount, formatPercent } from "../forces/force-fields";

export interface MobiliseTarget {
  id: string;
  name: string;
  reserves: number;
  mobilisationOrder: number;
}

interface MobiliseDialogProps {
  branch: MobiliseTarget | null;
  onOpenChange: (open: boolean) => void;
  doctrine: Doctrine;
  volunteerShare: number;
  gdpPerCapita: number;
  gdp: number;
  annualBudget: number;
  /** Pay of reservists already reported, outside the budget. */
  supplement: number;
  pending: boolean;
  onConfirm: (branchId: string, reservists: number) => void;
}

const burden = (spending: number, gdp: number) => (gdp > 0 ? (spending / gdp) * 100 : 0);

function ArrivalExplainer({ doctrine }: { doctrine: Doctrine }) {
  const [three, fourteen, sixty] = mobilisationSchedule(doctrine);
  return (
    <p className="text-label-secondary text-callout" data-testid="mobilisation-arrival">
      Reservists report gradually, not at once: about {formatPercent(three!.share)} within 3 days,{" "}
      {formatPercent(fourteen!.share)} within 14 days and {formatPercent(sixty!.share)} within 60
      days. They return at reserve-level training, so readiness dips while they retrain.
    </p>
  );
}

/** Call up part of a branch's reserve, with how fast it arrives and what the emergency supplement costs. */
export function MobiliseDialog({
  branch,
  onOpenChange,
  doctrine,
  volunteerShare,
  gdpPerCapita,
  gdp,
  annualBudget,
  supplement,
  pending,
  onConfirm,
}: MobiliseDialogProps) {
  const available = branch ? Math.max(0, Math.floor(branch.reserves - branch.mobilisationOrder)) : 0;
  const [count, setCount] = useState(0);
  const reservists = Math.min(available, Math.max(0, Math.floor(count)));
  const cost = mobilisationCost({ reservists, volunteerShare, gdpPerCapita });
  const before = burden(annualBudget + supplement, gdp);
  const after = burden(annualBudget + supplement + cost, gdp);

  return (
    <Dialog
      open={branch !== null}
      onOpenChange={(open) => {
        if (!open) setCount(0);
        onOpenChange(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mobilise {branch?.name}</DialogTitle>
          <DialogDescription>
            {formatCount(available)} reservists can be called up
            {branch && branch.mobilisationOrder > 0
              ? `, on top of the ${formatCount(branch.mobilisationOrder)} already ordered`
              : ""}
            .
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mobilise-count">Reservists to call up</Label>
            <Input
              id="mobilise-count"
              type="number"
              inputMode="numeric"
              min={0}
              max={available}
              step={1}
              value={count || ""}
              onChange={(e) => setCount(Number(e.target.value) || 0)}
            />
          </div>
          <ArrivalExplainer doctrine={doctrine} />
          <p className="text-label-secondary text-callout" data-testid="mobilisation-cost">
            Their pay, about {formatCompactCurrency(cost)} a year once all report, is an emergency
            supplement outside the defense budget. Defense spending rises from {before.toFixed(1)}%
            to {after.toFixed(1)}% of GDP while they serve.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!branch || reservists < 1 || pending}
            onClick={() => {
              if (!branch) return;
              onConfirm(branch.id, reservists);
              setCount(0);
              onOpenChange(false);
            }}
          >
            {pending ? "Ordering..." : `Mobilise ${formatCount(reservists)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
