"use client";

import React, { useState } from "react";
import { Flash, Plus, Shield } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
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
import {
  useBranchLevers,
  useDefenseOverview,
  useDefenseRefresh,
  type OwnerBranch,
  type OwnerDefense,
} from "~/hooks/useDefenseConsole";
import { FORCE_LIMITS, DOMAIN_LABELS, BRANCH_DOMAINS } from "~/lib/military/force-structure";
import { normaliseEffort } from "~/lib/military/model";
import { BranchSheet, type BranchFormData } from "../forces/BranchSheet";
import { UnitSheet, type UnitFormData } from "../forces/UnitSheet";
import { StarterForceDialog } from "../forces/StarterForceDialog";
import type { ForceBranch, ForceUnit } from "../forces/force-fields";
import { BranchCard, type BranchActions } from "./BranchCard";
import { MobiliseDialog, type MobiliseTarget } from "./MobiliseDialog";

type PendingDelete = { kind: "branch" | "unit"; id: string; name: string };
type PendingConfirm = PendingDelete | { kind: "demobilise"; id: string; name: string };

/** Identity writes (branches and units) with their toasts. */
function useForceWrites(countryId: string, onBranchCreated: (id: string) => void) {
  const notify = useNotify();
  const refresh = useDefenseRefresh(countryId);
  const onError = (error: { message: string }) => notify.error(error.message);
  const done = (message: string) => () => {
    notify.success(message);
    refresh();
  };
  return {
    refresh,
    createBranch: api.security.createMilitaryBranch.useMutation({
      onSuccess: (b) => {
        onBranchCreated(b.id);
        done(`${b.name} created. It grows from the defense budget.`)();
      },
      onError,
    }),
    updateBranch: api.security.updateMilitaryBranch.useMutation({ onSuccess: done("Branch saved"), onError }),
    deleteBranch: api.security.deleteMilitaryBranch.useMutation({ onSuccess: done("Branch deleted"), onError }),
    createUnit: api.security.createMilitaryUnit.useMutation({ onSuccess: done("Unit created"), onError }),
    updateUnit: api.security.updateMilitaryUnit.useMutation({ onSuccess: done("Unit saved"), onError }),
    deleteUnit: api.security.deleteMilitaryUnit.useMutation({ onSuccess: done("Unit deleted"), onError }),
  };
}

/** Branches grouped by domain, each with its derived state, plan, equipment and units. */
export function BranchesPanel({ countryId }: { countryId: string }) {
  const { canEdit } = useCanEdit();
  const { owner } = useDefenseOverview(countryId);
  const { data: rows, isLoading } = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const levers = useBranchLevers(countryId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const writes = useForceWrites(countryId, (id) => setExpanded((prev) => new Set(prev).add(id)));
  const [branchSheet, setBranchSheet] = useState<{ open: boolean; branch: ForceBranch | null }>({
    open: false,
    branch: null,
  });
  const [unitSheet, setUnitSheet] = useState<{ open: boolean; branch: ForceBranch | null; unit: ForceUnit | null }>({
    open: false,
    branch: null,
    unit: null,
  });
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [mobilising, setMobilising] = useState<MobiliseTarget | null>(null);
  const [starterOpen, setStarterOpen] = useState(false);

  if (isLoading || !owner) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading branches">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const list = rows ?? [];
  const states = new Map(owner.branches.map((b) => [b.id, b]));
  const effort = new Map(
    owner.branches.map((b, i) => [b.id, normaliseEffort(owner.branches.map((x) => x.effortShare))[i] ?? 0])
  );
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const actionsFor = (row: ForceBranch, state: OwnerBranch): BranchActions => ({
    toggle: () => toggle(row.id),
    edit: () => setBranchSheet({ open: true, branch: row }),
    remove: () => setConfirm({ kind: "branch", id: row.id, name: row.name }),
    addUnit: () => setUnitSheet({ open: true, branch: row, unit: null }),
    editUnit: (unit) => setUnitSheet({ open: true, branch: row, unit }),
    removeUnit: (unit) => setConfirm({ kind: "unit", id: unit.id, name: unit.name }),
    mobilise: () => setMobilising(state),
    demobilise: () => setConfirm({ kind: "demobilise", id: row.id, name: row.name }),
    savePlan: levers.saveAllocation,
    assetStatus: levers.setAssetStatus,
    scrapAsset: levers.scrapAsset,
  });

  const submitBranch = (data: BranchFormData) => {
    const editing = branchSheet.branch;
    const { domain: _domain, ...identity } = data;
    if (editing) writes.updateBranch.mutate({ id: editing.id, branch: identity });
    else writes.createBranch.mutate({ countryId, branch: data });
    setBranchSheet({ open: false, branch: null });
  };
  const submitUnit = (data: UnitFormData) => {
    if (unitSheet.unit) writes.updateUnit.mutate({ id: unitSheet.unit.id, unit: data });
    else if (unitSheet.branch) writes.createUnit.mutate({ branchId: unitSheet.branch.id, unit: data });
    setUnitSheet({ open: false, branch: null, unit: null });
  };
  const confirmAction = () => {
    if (confirm?.kind === "branch") writes.deleteBranch.mutate({ id: confirm.id });
    if (confirm?.kind === "unit") writes.deleteUnit.mutate({ id: confirm.id });
    if (confirm?.kind === "demobilise") levers.demobilise(confirm.id);
    setConfirm(null);
  };

  return (
    <section className="space-y-4" aria-labelledby="branches-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="branches-title" className="text-title-3 text-label flex items-center gap-2">
          <Shield aria-hidden="true" className="text-tint h-4 w-4" />
          Branches by domain
        </h3>
        {canEdit && (
          <Button
            size="sm"
            disabled={list.length >= FORCE_LIMITS.maxBranchesPerCountry}
            onClick={() => setBranchSheet({ open: true, branch: null })}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add branch
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={<Shield />}
            title="No military branches yet"
            message="Your combat power is zero until you have a force. A new branch starts empty and grows from the defense budget."
            action={
              canEdit ? (
                <Button size="sm" onClick={() => setStarterOpen(true)}>
                  <Flash aria-hidden="true" className="h-4 w-4" />
                  Start from my nation&apos;s data
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <DomainGroups
          rows={list}
          states={states}
          effort={effort}
          expanded={expanded}
          canEdit={canEdit}
          pending={levers.pending}
          actionsFor={actionsFor}
        />
      )}

      <BranchSheet
        open={branchSheet.open}
        onOpenChange={(open) => setBranchSheet((prev) => ({ ...prev, open }))}
        branch={branchSheet.branch}
        pending={writes.createBranch.isPending || writes.updateBranch.isPending}
        onSubmit={submitBranch}
      />
      <UnitSheet
        open={unitSheet.open}
        onOpenChange={(open) => setUnitSheet((prev) => ({ ...prev, open }))}
        branch={unitSheet.branch}
        unit={unitSheet.unit}
        pending={writes.createUnit.isPending || writes.updateUnit.isPending}
        onSubmit={submitUnit}
      />
      {canEdit && (
        <StarterForceDialog
          countryId={countryId}
          open={starterOpen}
          onOpenChange={setStarterOpen}
          onCreated={writes.refresh}
        />
      )}
      <MobiliseFor overview={owner} branch={mobilising} onClose={() => setMobilising(null)} levers={levers} />
      <ConfirmDialog confirm={confirm} onCancel={() => setConfirm(null)} onConfirm={confirmAction} />
    </section>
  );
}

function DomainGroups({
  rows,
  states,
  effort,
  expanded,
  canEdit,
  pending,
  actionsFor,
}: {
  rows: ForceBranch[];
  states: Map<string, OwnerBranch>;
  effort: Map<string, number>;
  expanded: Set<string>;
  canEdit: boolean;
  pending: boolean;
  actionsFor: (row: ForceBranch, state: OwnerBranch) => BranchActions;
}) {
  return (
    <div className="space-y-5">
      {BRANCH_DOMAINS.map((domain) => {
        const inDomain = rows.filter((r) => r.domain === domain && states.has(r.id));
        if (inDomain.length === 0) return null;
        return (
          <div key={domain} className="space-y-3">
            <h4 className="text-subhead text-label-secondary font-medium">{DOMAIN_LABELS[domain]}</h4>
            {inDomain.map((row) => {
              const state = states.get(row.id)!;
              return (
                <BranchCard
                  key={row.id}
                  row={row}
                  state={state}
                  effortOfTotal={effort.get(row.id) ?? 0}
                  expanded={expanded.has(row.id)}
                  canEdit={canEdit}
                  pending={pending}
                  actions={actionsFor(row, state)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function MobiliseFor({
  overview,
  branch,
  onClose,
  levers,
}: {
  overview: OwnerDefense;
  branch: MobiliseTarget | null;
  onClose: () => void;
  levers: ReturnType<typeof useBranchLevers>;
}) {
  return (
    <MobiliseDialog
      branch={branch}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      doctrine={overview.policy.doctrine}
      volunteerShare={overview.policy.volunteerShare}
      gdpPerCapita={overview.economy.gdpPerCapita}
      gdp={overview.economy.gdp}
      annualBudget={overview.budget.annual}
      supplement={overview.mobilisationSupplement}
      pending={levers.pending}
      onConfirm={levers.mobilise}
    />
  );
}

const CONFIRM_TEXT: Record<PendingConfirm["kind"], { action: string; body: string }> = {
  branch: {
    action: "Delete",
    body: "The branch, its units, equipment and open orders are removed, and its equipment's value is lost. This cannot be undone.",
  },
  unit: {
    action: "Delete",
    body: "The unit is removed and its personnel return to the branch. This cannot be undone.",
  },
  demobilise: {
    action: "Demobilise",
    body: "Everyone called up goes home at once and the emergency supplement for them stops. Mobilising again starts the call-up over.",
  },
};

function ConfirmDialog({
  confirm,
  onCancel,
  onConfirm,
}: {
  confirm: PendingConfirm | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const text = confirm ? CONFIRM_TEXT[confirm.kind] : null;
  return (
    <AlertDialog
      open={confirm !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {text?.action} {confirm?.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>{text?.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={onConfirm}>
            {text?.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
