"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle } from "iconoir-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  BRANCH_TYPES,
  BRANCH_TYPE_LABELS,
  FORCE_LIMITS,
  type BranchTypeKey,
} from "~/lib/military/force-structure";
import { CountField, LevelField, TextField, type ForceBranch } from "./force-fields";

export interface BranchFormData {
  branchType: BranchTypeKey;
  name: string;
  motto: string;
  description: string;
  established: string;
  activeDuty: number;
  reserves: number;
  civilianStaff: number;
  annualBudget: number;
  budgetPercent: number;
  readinessLevel: number;
  technologyLevel: number;
  trainingLevel: number;
  morale: number;
  deploymentCapacity: number;
  sustainmentCapacity: number;
}

function toForm(branch: ForceBranch | null): BranchFormData {
  return {
    branchType: (branch?.branchType as BranchTypeKey | undefined) ?? "army",
    name: branch?.name ?? BRANCH_TYPE_LABELS.army,
    motto: branch?.motto ?? "",
    description: branch?.description ?? "",
    established: branch?.established ?? "",
    activeDuty: branch?.activeDuty ?? 0,
    reserves: branch?.reserves ?? 0,
    civilianStaff: branch?.civilianStaff ?? 0,
    annualBudget: branch?.annualBudget ?? 0,
    budgetPercent: branch?.budgetPercent ?? 0,
    readinessLevel: branch?.readinessLevel ?? 50,
    technologyLevel: branch?.technologyLevel ?? 50,
    trainingLevel: branch?.trainingLevel ?? 50,
    morale: branch?.morale ?? 50,
    deploymentCapacity: branch?.deploymentCapacity ?? 50,
    sustainmentCapacity: branch?.sustainmentCapacity ?? 50,
  };
}

interface BranchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: ForceBranch | null;
  pending: boolean;
  onSubmit: (data: BranchFormData) => void;
}

/** Create or edit a military branch: identity, personnel and budget, readiness and capability. */
export function BranchSheet({ open, onOpenChange, branch, pending, onSubmit }: BranchSheetProps) {
  const [form, setForm] = useState<BranchFormData>(() => toForm(branch));

  useEffect(() => {
    // oxlint-disable-next-line
    if (open) setForm(toForm(branch));
  }, [branch, open]);

  const set = <K extends keyof BranchFormData>(key: K, value: BranchFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const assigned = branch?.units.reduce((s, u) => s + u.personnel, 0) ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="wide" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{branch ? `Edit ${branch.name}` : "New military branch"}</SheetTitle>
          <SheetDescription>
            Personnel, readiness and equipment all feed your combat strength.
          </SheetDescription>
        </SheetHeader>

        <form
          id="branch-form"
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
        >
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="branch-type">Branch type</Label>
                <Select
                  value={form.branchType}
                  onValueChange={(value) => {
                    const next = value as BranchTypeKey;
                    setForm((prev) => ({
                      ...prev,
                      branchType: next,
                      // Follow the type's default name until the player names the branch.
                      name:
                        prev.name === BRANCH_TYPE_LABELS[prev.branchType]
                          ? BRANCH_TYPE_LABELS[next]
                          : prev.name,
                    }));
                  }}
                >
                  <SelectTrigger id="branch-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCH_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {BRANCH_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TextField
                id="branch-name"
                label="Name"
                value={form.name}
                maxLength={100}
                placeholder="e.g. Royal Navy"
                onChange={(v) => set("name", v)}
              />
              <TextField
                id="branch-motto"
                label="Motto (optional)"
                value={form.motto}
                maxLength={200}
                onChange={(v) => set("motto", v)}
              />
              <TextField
                id="branch-established"
                label="Established (optional)"
                value={form.established}
                maxLength={50}
                placeholder="e.g. 1802"
                onChange={(v) => set("established", v)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-description">Description (optional)</Label>
              <Textarea
                id="branch-description"
                value={form.description}
                maxLength={2000}
                rows={3}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h3 className="text-label text-headline">Personnel and budget</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <CountField
                id="branch-active"
                label="Active duty"
                value={form.activeDuty}
                max={FORCE_LIMITS.maxActiveDuty}
                onChange={(v) => set("activeDuty", v)}
                hint={assigned > 0 ? `${assigned.toLocaleString("en-US")} in units` : undefined}
              />
              <CountField
                id="branch-reserves"
                label="Reserves"
                value={form.reserves}
                max={FORCE_LIMITS.maxReserves}
                onChange={(v) => set("reserves", v)}
              />
              <CountField
                id="branch-civilians"
                label="Civilian staff"
                value={form.civilianStaff}
                max={FORCE_LIMITS.maxCivilianStaff}
                onChange={(v) => set("civilianStaff", v)}
              />
              <CountField
                id="branch-budget"
                label="Annual budget"
                value={form.annualBudget}
                max={FORCE_LIMITS.maxBudget}
                onChange={(v) => set("annualBudget", v)}
              />
              <CountField
                id="branch-budget-share"
                label="Share of defense budget (%)"
                value={form.budgetPercent}
                max={100}
                onChange={(v) => set("budgetPercent", v)}
              />
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h3 className="text-label text-headline">Readiness and capability</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <LevelField
                label="Readiness"
                value={form.readinessLevel}
                onChange={(v) => set("readinessLevel", v)}
              />
              <LevelField
                label="Technology"
                value={form.technologyLevel}
                onChange={(v) => set("technologyLevel", v)}
              />
              <LevelField
                label="Training"
                value={form.trainingLevel}
                onChange={(v) => set("trainingLevel", v)}
              />
              <LevelField label="Morale" value={form.morale} onChange={(v) => set("morale", v)} />
              <LevelField
                label="Deployment capacity"
                value={form.deploymentCapacity}
                onChange={(v) => set("deploymentCapacity", v)}
              />
              <LevelField
                label="Sustainment capacity"
                value={form.sustainmentCapacity}
                onChange={(v) => set("sustainmentCapacity", v)}
              />
            </div>
          </section>
        </form>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="branch-form" disabled={pending || !form.name.trim()}>
            <CheckCircle aria-hidden="true" className="h-4 w-4" />
            {pending ? "Saving..." : branch ? "Save branch" : "Create branch"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
