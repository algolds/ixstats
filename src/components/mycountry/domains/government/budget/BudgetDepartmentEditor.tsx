"use client";

import React, { useState } from "react";
import { Plus, Trash } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { allocationAmount, ALLOCATION_PERCENT_MAX } from "~/lib/government/budget-math";
import { DepartmentCategorySchema, type DepartmentCategory } from "~/types/government";
import type { BudgetEditing } from "~/hooks/useBudgetEditing";

const parsePercent = (text: string): number | null => {
  const value = Number(text);
  return text.trim() !== "" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= ALLOCATION_PERCENT_MAX
    ? value
    : null;
};

/** A department's share of the budget, with the amount it is worth. */
export function AllocationEditor({
  departmentId,
  departmentName,
  percent,
  editing,
  formatNumber,
}: {
  departmentId: string;
  departmentName: string;
  percent: number;
  editing: BudgetEditing;
  formatNumber: (num: number) => string;
}) {
  const [text, setText] = useState(String(percent));
  const value = parsePercent(text);
  const changed = value !== null && value !== percent;

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (changed) editing.onUpdateBudget(departmentId, { allocatedPercent: value });
      }}
    >
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        max={ALLOCATION_PERCENT_MAX}
        step={0.1}
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-label={`${departmentName} share of the budget, in percent`}
        aria-invalid={value === null}
        className="w-24 tabular-nums"
      />
      <span className="text-label-secondary text-footnote tabular-nums">
        % of budget, {formatNumber(allocationAmount(editing.totalBudget, value ?? 0))}
      </span>
      <Button type="submit" size="sm" variant="secondary" disabled={!changed || editing.pending}>
        Save
      </Button>
    </form>
  );
}

export function RemoveDepartmentButton({
  departmentId,
  departmentName,
  editing,
}: {
  departmentId: string;
  departmentName: string;
  editing: BudgetEditing;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${departmentName}`}
          disabled={editing.pending}
        >
          <Trash aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {departmentName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its allocations for every year and its appointed officials are removed too.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </AlertDialogClose>
          <AlertDialogClose asChild>
            <Button variant="destructive" onClick={() => editing.onRemoveDepartment(departmentId)}>
              Remove
            </Button>
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const CATEGORIES = DepartmentCategorySchema.options;

export function AddDepartmentForm({ editing }: { editing: BudgetEditing }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DepartmentCategory>("Other");
  const trimmed = name.trim();

  return (
    <form
      className="border-separator rounded-row flex flex-wrap items-end gap-2 border border-dashed p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmed) return;
        editing.onAddDepartment({ name: trimmed, category });
        setName("");
      }}
    >
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="e.g. Ministry of Fisheries"
        aria-label="New department name"
        maxLength={120}
        className="min-w-48 flex-1"
      />
      <Select value={category} onValueChange={(v) => setCategory(v as DepartmentCategory)}>
        <SelectTrigger className="w-48" aria-label="New department category">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" disabled={!trimmed || editing.pending}>
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        Add department
      </Button>
    </form>
  );
}
