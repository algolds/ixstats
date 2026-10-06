"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { useNotify } from "~/hooks/useNotify";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import type { StarterBudgetSource } from "~/lib/military/force-structure";
import { formatCount } from "./force-fields";

const SOURCE_TEXT: Record<StarterBudgetSource, string> = {
  builder: "Budgets come from the Defense spending you set in the builder.",
  defenseBudget: "Budgets come from your stored defense budget.",
  estimate: "No Defense spending was recorded, so budgets assume 2% of GDP.",
  none: "No GDP or Defense spending is recorded, so budgets start at zero.",
};

interface StarterForceDialogProps {
  countryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

/** Preview and confirm the army, navy and air force planned from the nation's builder data. */
export function StarterForceDialog({
  countryId,
  open,
  onOpenChange,
  onCreated,
}: StarterForceDialogProps) {
  const notify = useNotify();
  const { data: plan, isLoading } = api.security.previewStarterForceStructure.useQuery(
    { countryId },
    { enabled: open && !!countryId }
  );
  const seed = api.security.seedStarterForceStructure.useMutation({
    onSuccess: (result) => {
      notify.success(`${result.created} branches created`);
      onOpenChange(false);
      onCreated();
    },
    onError: (error) => notify.error(error.message),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start from your nation&apos;s data</AlertDialogTitle>
          <AlertDialogDescription>
            Creates three branches sized from your population (0.5% on active duty). You can edit or
            delete them afterwards and add units to each.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoading || !plan ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-3">
            <ul className="border-separator rounded-control divide-separator divide-y border">
              {plan.branches.map((b) => (
                <li key={b.branchType} className="flex items-center justify-between gap-3 p-3">
                  <span className="text-label text-body font-medium">{b.name}</span>
                  <span className="text-label-secondary text-footnote tabular-nums">
                    {formatCount(b.activeDuty)} active · {formatCount(b.reserves)} reserve ·{" "}
                    {formatCompactCurrency(b.annualBudget)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-label-secondary text-footnote">{SOURCE_TEXT[plan.budgetSource]}</p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button disabled={!plan || seed.isPending} onClick={() => seed.mutate({ countryId })}>
            {seed.isPending ? "Creating..." : "Create branches"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
