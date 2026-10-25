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
import type { DefenseBudgetSource } from "~/lib/military/model/budget";
import { formatCount } from "./force-fields";

const SOURCE_TEXT: Record<DefenseBudgetSource, string> = {
  defenseDepartment: "Your Defense department's lines in the national budget fund it",
  builder: "The Defense spending set when your nation was founded funds it",
  governmentForm: "Your government form's usual Defense share of spending funds it",
  estimate: "No Defense spending is recorded, so it assumes 2% of GDP",
  none: "No GDP or Defense spending is recorded, so it has no budget",
};

interface StarterForceDialogProps {
  countryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

/** Confirm new army, navy and air force branches, previewing the force the defense budget sustains. */
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
            Creates an army, a navy and an air force. They start empty and grow on your realm&apos;s
            clock toward the force your defense budget sustains, shown below.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoading || !plan ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-3">
            <ul className="border-separator rounded-control divide-separator divide-y border">
              {plan.branches.map((b) => (
                <li key={b.domain} className="flex items-center justify-between gap-3 p-3">
                  <span className="text-label text-body font-medium">{b.name}</span>
                  <span className="text-label-secondary text-footnote tabular-nums">
                    {formatCount(b.activeDuty)} active · {formatCount(b.reserves)} reserve ·{" "}
                    {b.cLevel}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-label-secondary text-footnote">
              {formatCompactCurrency(plan.budget)} a year. {SOURCE_TEXT[plan.budgetSource]}.
            </p>
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
