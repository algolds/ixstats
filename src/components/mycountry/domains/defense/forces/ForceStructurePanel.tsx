"use client";

import React, { useMemo, useState } from "react";
import { Plus, Shield, Flash } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
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
import { useNotify } from "~/hooks/useNotify";
import { useCanEdit } from "~/context/MyCountryEditModeContext";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import { FORCE_LIMITS, forceTotals } from "~/lib/military/force-structure";
import { BranchCard } from "./BranchCard";
import { BranchSheet, type BranchFormData } from "./BranchSheet";
import { UnitSheet, type UnitFormData } from "./UnitSheet";
import { StarterForceDialog } from "./StarterForceDialog";
import { formatCount, type ForceBranch, type ForceUnit } from "./force-fields";

type PendingDelete =
  { kind: "branch"; id: string; name: string } | { kind: "unit"; id: string; name: string };

/** Branches and units: totals, combat strength, and owner authoring (MC-3). */
export function ForceStructurePanel({ countryId }: { countryId: string }) {
  const notify = useNotify();
  const { canEdit } = useCanEdit();
  const utils = api.useUtils();

  const { data: branches, isLoading } = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [branchSheet, setBranchSheet] = useState<{ open: boolean; branch: ForceBranch | null }>({
    open: false,
    branch: null,
  });
  const [unitSheet, setUnitSheet] = useState<{
    open: boolean;
    branch: ForceBranch | null;
    unit: ForceUnit | null;
  }>({ open: false, branch: null, unit: null });
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [starterOpen, setStarterOpen] = useState(false);

  const refresh = () => {
    void utils.security.getMilitaryBranches.invalidate({ countryId });
    void utils.security.getSecurityAssessment.invalidate({ countryId });
  };
  const onError = (error: { message: string }) => notify.error(error.message);

  const createBranch = api.security.createMilitaryBranch.useMutation({
    onSuccess: (b) => {
      notify.success(`${b.name} created`);
      setBranchSheet({ open: false, branch: null });
      setExpanded((prev) => new Set(prev).add(b.id));
      refresh();
    },
    onError,
  });
  const updateBranch = api.security.updateMilitaryBranch.useMutation({
    onSuccess: (b) => {
      notify.success(`${b.name} saved`);
      setBranchSheet({ open: false, branch: null });
      refresh();
    },
    onError,
  });
  const deleteBranch = api.security.deleteMilitaryBranch.useMutation({
    onSuccess: () => {
      notify.success("Branch deleted");
      refresh();
    },
    onError,
  });
  const createUnit = api.security.createMilitaryUnit.useMutation({
    onSuccess: (u) => {
      notify.success(`${u.name} created`);
      setUnitSheet({ open: false, branch: null, unit: null });
      refresh();
    },
    onError,
  });
  const updateUnit = api.security.updateMilitaryUnit.useMutation({
    onSuccess: (u) => {
      notify.success(`${u.name} saved`);
      setUnitSheet({ open: false, branch: null, unit: null });
      refresh();
    },
    onError,
  });
  const deleteUnit = api.security.deleteMilitaryUnit.useMutation({
    onSuccess: () => {
      notify.success("Unit deleted");
      refresh();
    },
    onError,
  });

  const totals = useMemo(() => forceTotals(branches ?? []), [branches]);
  const atBranchLimit = (branches?.length ?? 0) >= FORCE_LIMITS.maxBranchesPerCountry;

  const submitBranch = (data: BranchFormData) => {
    const editing = branchSheet.branch;
    if (editing) updateBranch.mutate({ id: editing.id, branch: data });
    else createBranch.mutate({ countryId, branch: data });
  };
  const submitUnit = (data: UnitFormData) => {
    if (unitSheet.unit) updateUnit.mutate({ id: unitSheet.unit.id, unit: data });
    else if (unitSheet.branch) createUnit.mutate({ branchId: unitSheet.branch.id, unit: data });
  };
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading force structure">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="force-structure-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield aria-hidden="true" className="text-red h-4 w-4" />
          <h3 id="force-structure-title" className="text-label text-title-3">
            Force structure
          </h3>
        </div>
        {canEdit && (
          <Button
            size="sm"
            disabled={atBranchLimit}
            onClick={() => setBranchSheet({ open: true, branch: null })}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add branch
          </Button>
        )}
      </div>

      <Card className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat size="sm" label="Combat strength" value={formatCount(totals.strength)} />
        <Stat size="sm" label="Branches" value={totals.branches} />
        <Stat size="sm" label="Active duty" value={formatCount(totals.activeDuty)} />
        <Stat size="sm" label="Reserves" value={formatCount(totals.reserves)} />
        <Stat
          size="sm"
          label="Units"
          value={totals.units}
          hint={`${formatCount(totals.assignedPersonnel)} assigned`}
        />
        <Stat
          size="sm"
          label="Branch budgets"
          value={
            totals.annualBudget === null && totals.branches > 0
              ? "Private"
              : formatCompactCurrency(totals.annualBudget ?? 0)
          }
        />
      </Card>

      {!branches || branches.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={<Shield />}
            title="No military branches yet"
            message="Your combat strength is zero until you build a force. PvNPC strikes and PvP battles use it."
            action={
              canEdit ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" onClick={() => setStarterOpen(true)}>
                    <Flash aria-hidden="true" className="h-4 w-4" />
                    Start from my nation&apos;s data
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBranchSheet({ open: true, branch: null })}
                  >
                    Create a branch
                  </Button>
                </div>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {branches.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              expanded={expanded.has(branch.id)}
              canEdit={canEdit}
              onToggle={() => toggle(branch.id)}
              onEdit={() => setBranchSheet({ open: true, branch })}
              onDelete={() =>
                setPendingDelete({ kind: "branch", id: branch.id, name: branch.name })
              }
              onAddUnit={() => setUnitSheet({ open: true, branch, unit: null })}
              onEditUnit={(unit) => setUnitSheet({ open: true, branch, unit })}
              onDeleteUnit={(unit) =>
                setPendingDelete({ kind: "unit", id: unit.id, name: unit.name })
              }
            />
          ))}
        </div>
      )}

      <BranchSheet
        open={branchSheet.open}
        onOpenChange={(open) => setBranchSheet((prev) => ({ ...prev, open }))}
        branch={branchSheet.branch}
        pending={createBranch.isPending || updateBranch.isPending}
        onSubmit={submitBranch}
      />
      <UnitSheet
        open={unitSheet.open}
        onOpenChange={(open) => setUnitSheet((prev) => ({ ...prev, open }))}
        branch={unitSheet.branch}
        unit={unitSheet.unit}
        pending={createUnit.isPending || updateUnit.isPending}
        onSubmit={submitUnit}
      />
      {canEdit && (
        <StarterForceDialog
          countryId={countryId}
          open={starterOpen}
          onOpenChange={setStarterOpen}
          onCreated={refresh}
        />
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === "branch"
                ? "The branch, its units and its assets are removed. This cannot be undone."
                : "The unit is removed and its personnel return to the branch. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (pendingDelete?.kind === "branch") deleteBranch.mutate({ id: pendingDelete.id });
                if (pendingDelete?.kind === "unit") deleteUnit.mutate({ id: pendingDelete.id });
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
