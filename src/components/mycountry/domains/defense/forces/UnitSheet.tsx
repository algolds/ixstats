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
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { FORCE_LIMITS, UNIT_TYPES, type BranchTypeKey } from "~/lib/military/force-structure";
import {
  CountField,
  LevelField,
  TextField,
  formatCount,
  type ForceBranch,
  type ForceUnit,
} from "./force-fields";

export interface UnitFormData {
  name: string;
  unitType: string;
  designation: string;
  description: string;
  personnel: number;
  commanderName: string;
  commanderRank: string;
  headquarters: string;
  readiness: number;
}

function toForm(unit: ForceUnit | null, branchType: BranchTypeKey): UnitFormData {
  return {
    name: unit?.name ?? "",
    unitType: unit?.unitType ?? UNIT_TYPES[branchType]?.[0] ?? "unit",
    designation: unit?.designation ?? "",
    description: unit?.description ?? "",
    personnel: unit?.personnel ?? 0,
    commanderName: unit?.commanderName ?? "",
    commanderRank: unit?.commanderRank ?? "",
    headquarters: unit?.headquarters ?? "",
    readiness: unit?.readiness ?? 50,
  };
}

interface UnitSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: ForceBranch | null;
  unit: ForceUnit | null;
  pending: boolean;
  onSubmit: (data: UnitFormData) => void;
}

/** Create or edit a formation inside a branch. Its personnel is drawn from the branch's pool. */
export function UnitSheet({ open, onOpenChange, branch, unit, pending, onSubmit }: UnitSheetProps) {
  const branchType = (branch?.branchType as BranchTypeKey | undefined) ?? "army";
  const [form, setForm] = useState<UnitFormData>(() => toForm(unit, branchType));

  useEffect(() => {
    // oxlint-disable-next-line
    if (open) setForm(toForm(unit, branchType));
  }, [unit, open, branchType]);

  const set = <K extends keyof UnitFormData>(key: K, value: UnitFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const pool = (branch?.activeDuty ?? 0) + (branch?.reserves ?? 0);
  const assignedElsewhere =
    branch?.units.filter((u) => u.id !== unit?.id).reduce((s, u) => s + u.personnel, 0) ?? 0;
  const available = Math.max(0, pool - assignedElsewhere);
  const unitTypes = UNIT_TYPES[branchType] ?? [];
  const typeOptions = unitTypes.includes(form.unitType) ? unitTypes : [form.unitType, ...unitTypes];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="wide" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {unit ? `Edit ${unit.name}` : `New unit in ${branch?.name ?? ""}`}
          </SheetTitle>
          <SheetDescription>
            {formatCount(available)} of {formatCount(pool)} branch personnel are free for this unit.
          </SheetDescription>
        </SheetHeader>

        <form
          id="unit-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="unit-name"
              label="Name"
              value={form.name}
              maxLength={100}
              placeholder="e.g. 1st Armoured Division"
              onChange={(v) => set("name", v)}
            />
            <div className="space-y-2">
              <Label htmlFor="unit-type">Formation</Label>
              <Select value={form.unitType} onValueChange={(v) => set("unitType", v)}>
                <SelectTrigger id="unit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((type) => (
                    <SelectItem key={type} value={type} className="capitalize">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CountField
              id="unit-personnel"
              label="Personnel"
              value={form.personnel}
              max={Math.min(FORCE_LIMITS.maxUnitPersonnel, available)}
              onChange={(v) => set("personnel", v)}
              hint={
                available === 0
                  ? "Raise the branch's active duty or reserves to staff this unit."
                  : undefined
              }
            />
            <TextField
              id="unit-designation"
              label="Designation (optional)"
              value={form.designation}
              maxLength={50}
              placeholder="e.g. 1AD"
              onChange={(v) => set("designation", v)}
            />
            <TextField
              id="unit-commander-rank"
              label="Commander rank (optional)"
              value={form.commanderRank}
              maxLength={100}
              onChange={(v) => set("commanderRank", v)}
            />
            <TextField
              id="unit-commander"
              label="Commander (optional)"
              value={form.commanderName}
              maxLength={100}
              onChange={(v) => set("commanderName", v)}
            />
            <TextField
              id="unit-hq"
              label="Headquarters (optional)"
              value={form.headquarters}
              maxLength={100}
              onChange={(v) => set("headquarters", v)}
            />
          </div>
          <LevelField
            label="Readiness"
            value={form.readiness}
            onChange={(v) => set("readiness", v)}
          />
          <div className="space-y-2">
            <Label htmlFor="unit-description">Description (optional)</Label>
            <Textarea
              id="unit-description"
              value={form.description}
              maxLength={2000}
              rows={3}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </form>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="unit-form" disabled={pending || !form.name.trim()}>
            <CheckCircle aria-hidden="true" className="h-4 w-4" />
            {pending ? "Saving..." : unit ? "Save unit" : "Create unit"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
