"use client";
// src/components/mycountry/domains/defense/command/BudgetManagementCard.tsx

import React, { useState } from "react";
import {
  Dollar as DollarSign,
  EditPencil as Edit,
  FloppyDisk as Save,
  HelpCircle,
  InfoCircle as Info,
  Plus,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { useCanEdit } from "~/context/MyCountryEditModeContext";
import { useNationClock } from "~/hooks/useNationClock";
import { formatBudgetYear } from "~/lib/realms/realm-year";
import { CreateGovernmentStructureButton } from "~/components/mycountry/domains/government/CreateGovernmentStructureButton";
import { ALLOCATION_PERCENT_MAX } from "~/lib/government/budget-math";
import type { DefenseLine } from "~/lib/military/defense-budget";

type LineData = Extract<DefenseLine, { kind: "line" }>;

interface BudgetManagementCardProps {
  countryId: string;
  line: DefenseLine;
  isLoading: boolean;
  isSaving: boolean;
  editingBudget: boolean;
  setEditingBudget: (editing: boolean) => void;
  /** Saves the Defense department's share of the national budget, in percent. */
  onSaveShare: (allocatedPercent: number) => void;
  onAddDefenseDepartment: () => void;
}

function BudgetGuide() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="About the defense budget"
        >
          <HelpCircle className="text-label-secondary h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent size="wide" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Info aria-hidden="true" className="text-label-secondary h-5 w-5" />
            Defense budget guide
          </SheetTitle>
        </SheetHeader>
        <div className="text-body space-y-4">
          <div>
            <h4 className="mb-2 font-semibold">Where it comes from</h4>
            <p className="text-label-secondary">
              Your defense budget is every Defense department line in the National budget, added
              together. Here you edit the largest of them; a change in the National budget shows
              here too.
            </p>
          </div>
          <div>
            <h4 className="mb-2 font-semibold">How it is spent</h4>
            <p className="text-label-secondary">
              The budget split under Budget and posture divides it between personnel, operations and
              maintenance, procurement, research and infrastructure. Each line buys only its own
              thing: pay keeps people, upkeep keeps them trained and their equipment working,
              procurement buys equipment.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The share field while editing; it starts from the saved share each time it opens. */
function ShareEditor({
  line,
  isSaving,
  onCancel,
  onSave,
}: {
  line: LineData;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (allocatedPercent: number) => void;
}) {
  const [draft, setDraft] = useState(String(line.allocatedPercent));
  const percent = Number(draft);
  const valid = draft.trim() !== "" && percent >= 0 && percent <= ALLOCATION_PERCENT_MAX;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          max={ALLOCATION_PERCENT_MAX}
          step={0.1}
          aria-label="Defense share of the national budget"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-28 tabular-nums"
        />
        <span className="text-label-secondary text-body tabular-nums">
          % of ${Math.round(line.totalBudget).toLocaleString("en-US")}
          {valid && ` = $${Math.round((line.totalBudget * percent) / 100).toLocaleString("en-US")}`}
        </span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => onSave(percent)} disabled={!valid || isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Saving…" : "Save share"}
        </Button>
      </div>
    </div>
  );
}

function LineFigures({ line }: { line: LineData }) {
  const severalLines = line.totalDefenseAmount > line.allocatedAmount + 0.5;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-caption text-label-secondary block">Defense budget</span>
          <div className="text-title-1 mt-1 tabular-nums">
            $<NumberFlowDisplay value={line.totalDefenseAmount} format="compact" />
          </div>
        </div>
        <div>
          <span className="text-caption text-label-secondary block">National budget</span>
          <div className="text-title-1 mt-1 tabular-nums">
            $<NumberFlowDisplay value={line.totalBudget} format="compact" />
          </div>
        </div>
      </div>
      {severalLines && (
        <p className="text-label-secondary text-footnote">
          All Defense lines together. The {line.departmentName} line is $
          {Math.round(line.allocatedAmount).toLocaleString("en-US")} of it and is the one you edit
          here.
        </p>
      )}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-body">Share of the national budget</span>
          <span className="text-body font-medium tabular-nums">
            <NumberFlowDisplay
              value={line.allocatedPercent}
              format="percentage"
              decimalPlaces={1}
            />
          </span>
        </div>
        <Progress value={Math.min(line.allocatedPercent, 100)} className="h-2" />
      </div>
    </div>
  );
}

function EmptyState({
  line,
  countryId,
  canEdit,
  isSaving,
  onAddDefenseDepartment,
}: {
  line: Exclude<DefenseLine, LineData>;
  countryId: string;
  canEdit: boolean;
  isSaving: boolean;
  onAddDefenseDepartment: () => void;
}) {
  const noStructure = line.kind === "no-structure";
  return (
    <div
      role="status"
      className="rounded-control border-separator flex flex-wrap items-center justify-between gap-3 border px-4 py-3"
    >
      <p className="text-label text-body">
        {noStructure
          ? "Your government has no departments yet. Create its structure to set a defense budget."
          : "Your government has no Defense department. Add one to set a defense budget."}
      </p>
      {canEdit &&
        (noStructure ? (
          <CreateGovernmentStructureButton countryId={countryId} />
        ) : (
          <Button size="sm" onClick={onAddDefenseDepartment} disabled={isSaving}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add a Defense department
          </Button>
        ))}
    </div>
  );
}

export const BudgetManagementCard = React.memo(function BudgetManagementCard({
  countryId,
  line,
  isLoading,
  isSaving,
  editingBudget,
  setEditingBudget,
  onSaveShare,
  onAddDefenseDepartment,
}: BudgetManagementCardProps) {
  // The free Defense preview shows the budget read-only.
  const { canEdit } = useCanEdit();
  const hasLine = line.kind === "line";
  const clock = useNationClock();
  const yearLabel = (year: number) => (clock ? formatBudgetYear(year, clock) : String(year));
  return (
    <Card content="data">
      <CardHeader className="p-5 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <DollarSign aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />
              <h3 className="text-label text-title-3">Defense budget</h3>
              <BudgetGuide />
            </div>
            <p className="text-label-secondary text-body mt-1">
              {hasLine
                ? `The ${line.departmentName} line of the national budget${
                    line.budgetYear !== null ? ` for ${yearLabel(line.budgetYear)}` : ""
                  }`
                : "The Defense department's line of the national budget"}
            </p>
          </div>
          {canEdit && hasLine && !editingBudget && (
            <Button size="sm" variant="outline" onClick={() => setEditingBudget(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit share
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-5 pb-5">
        {isLoading ? null : hasLine ? (
          <>
            <LineFigures line={line} />
            {canEdit && editingBudget && (
              <ShareEditor
                line={line}
                isSaving={isSaving}
                onCancel={() => setEditingBudget(false)}
                onSave={onSaveShare}
              />
            )}
          </>
        ) : (
          <EmptyState
            line={line}
            countryId={countryId}
            canEdit={canEdit}
            isSaving={isSaving}
            onAddDefenseDepartment={onAddDefenseDepartment}
          />
        )}
      </CardContent>
    </Card>
  );
});
