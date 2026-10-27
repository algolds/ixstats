"use client";

import React, { useState } from "react";
import { UserPlus } from "iconoir-react";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import type { OwnerBranch, OwnerDefense } from "~/hooks/useDefenseConsole";
import { MobiliseDialog, type MobiliseTarget } from "../branches/MobiliseDialog";
import { formatCount } from "../forces/force-fields";

interface ReservesCardProps {
  overview: OwnerDefense;
  canEdit: boolean;
  pending: boolean;
  onMobilise: (branchId: string, reservists: number) => void;
  onDemobilise: (branchId: string) => void;
}

/** The reserve stock by branch, mobilisation under way, and calling up or standing down. */
export function ReservesCard({ overview, canEdit, pending, onMobilise, onDemobilise }: ReservesCardProps) {
  const [mobilising, setMobilising] = useState<MobiliseTarget | null>(null);
  const [standingDown, setStandingDown] = useState<OwnerBranch | null>(null);
  const { branches, policy } = overview;
  const reserves = branches.reduce((sum, b) => sum + b.reserves, 0);
  const mobilised = branches.reduce((sum, b) => sum + b.mobilised, 0);

  return (
    <Card content="data">
      <CardHeader className="p-5 pb-3">
        <CardTitle icon={<UserPlus />}>Reserves and mobilisation</CardTitle>
        <CardDescription>
          {formatCount(reserves)} reservists.{" "}
          {mobilised > 0
            ? `${formatCount(mobilised)} have reported, costing ${formatCompactCurrency(overview.mobilisationSupplement)} a year outside the budget.`
            : "None are mobilised."}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <ul className="divide-separator divide-y">
          {branches.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-callout text-label font-medium">{b.name}</div>
                <div className="text-label-secondary text-footnote tabular-nums">
                  {formatCount(b.reserves)} in reserve
                  {b.mobilisationOrder > 0 &&
                    ` · ${formatCount(b.mobilised)} of ${formatCount(b.mobilisationOrder)} reported`}
                </div>
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-2">
                  {b.mobilisationOrder > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setStandingDown(b)}>
                      Demobilise
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={b.reserves - b.mobilisationOrder < 1}
                    onClick={() => setMobilising(b)}
                  >
                    Mobilise
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>

      <MobiliseDialog
        branch={mobilising}
        onOpenChange={(open) => {
          if (!open) setMobilising(null);
        }}
        doctrine={policy.doctrine}
        volunteerShare={policy.volunteerShare}
        gdpPerCapita={overview.economy.gdpPerCapita}
        gdp={overview.economy.gdp}
        annualBudget={overview.budget.annual}
        supplement={overview.mobilisationSupplement}
        pending={pending}
        onConfirm={onMobilise}
      />
      <AlertDialog
        open={standingDown !== null}
        onOpenChange={(open) => {
          if (!open) setStandingDown(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Demobilise {standingDown?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Everyone called up goes home at once and the emergency supplement for them stops.
              Mobilising again starts the call-up over.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (standingDown) onDemobilise(standingDown.id);
                setStandingDown(null);
              }}
            >
              Demobilise
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
