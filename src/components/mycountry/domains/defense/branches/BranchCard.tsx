"use client";

import React from "react";
import {
  EditPencil as Edit,
  NavArrowDown,
  NavArrowRight,
  Plus,
  Trash,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { DOMAIN_LABELS } from "~/lib/military/model";
import { SUB_SCORE_KEYS, worstSubScore } from "~/lib/military/defense-console";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import { cn } from "~/lib/utils";
import type { OwnerBranch } from "~/hooks/useDefenseConsole";
import { C_LEVEL_COPY, SUB_SCORE_COPY } from "../defense-copy";
import { formatCount, formatPercent, type ForceBranch, type ForceUnit } from "../forces/force-fields";
import { BranchAssets, type AssetStatus } from "./BranchAssets";
import { BranchPlanEditor } from "./BranchPlanEditor";

export interface BranchActions {
  toggle: () => void;
  edit: () => void;
  remove: () => void;
  addUnit: () => void;
  editUnit: (unit: ForceUnit) => void;
  removeUnit: (unit: ForceUnit) => void;
  mobilise: () => void;
  demobilise: () => void;
  savePlan: (input: { id: string; effortShare: number; targetActive: number | null }) => void;
  assetStatus: (id: string, status: AssetStatus) => void;
  scrapAsset: (id: string) => void;
}

interface BranchCardProps {
  row: ForceBranch;
  state: OwnerBranch;
  effortOfTotal: number;
  expanded: boolean;
  canEdit: boolean;
  pending: boolean;
  actions: BranchActions;
}

function Figure({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-callout text-label font-medium tabular-nums">{value}</div>
      <div className="text-label-secondary text-footnote truncate">{label}</div>
      {hint && <div className="text-label-tertiary text-footnote truncate">{hint}</div>}
    </div>
  );
}

function SubScoreGrid({ state }: { state: OwnerBranch }) {
  const worst = worstSubScore(state.subScores);
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={`${state.name} readiness areas`}>
      {SUB_SCORE_KEYS.map((key) => (
        <div key={key} data-worst={key === worst || undefined} className="bg-fill-4 rounded-row px-3 py-2">
          <dt className="text-label-secondary text-footnote truncate">{SUB_SCORE_COPY[key].label}</dt>
          <dd
            className={cn(
              "text-callout tabular-nums",
              key === worst ? "text-warning-ink font-medium" : "text-label"
            )}
          >
            {formatPercent(state.subScores[key])}
            {key === worst && <span className="text-footnote ml-1">weakest</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function IconAction({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="icon"
      variant="ghost"
      className={cn("h-8 w-8", destructive && "text-label-secondary hover:text-destructive")}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/** One branch: rating and readiness areas, people and equipment, its plan, and its equipment and units. */
export function BranchCard({ row, state, effortOfTotal, expanded, canEdit, pending, actions }: BranchCardProps) {
  const Chevron = expanded ? NavArrowDown : NavArrowRight;
  const mobilising = state.mobilisationOrder > 0;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <IconAction label={expanded ? `Collapse ${row.name}` : `Expand ${row.name}`} onClick={actions.toggle}>
          <Chevron className="h-4 w-4" />
        </IconAction>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-headline text-label truncate">{row.name}</h4>
              <Badge variant="outline">{DOMAIN_LABELS[row.domain]}</Badge>
              <Badge variant="secondary" title={C_LEVEL_COPY[state.cLevel].detail}>
                {state.cLevel} · {C_LEVEL_COPY[state.cLevel].label}
              </Badge>
            </div>
            {row.motto && <p className="text-label-secondary text-footnote truncate italic">{row.motto}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure label="Active" value={formatCount(state.active)} hint={`Funded for ${formatCount(state.fundedStrength)}`} />
            <Figure label="Reserves" value={formatCount(state.reserves)} />
            <Figure
              label="Mobilised"
              value={formatCount(state.mobilised)}
              hint={mobilising ? `of ${formatCount(state.mobilisationOrder)} ordered` : undefined}
            />
            <Figure label="Combat power" value={formatCount(state.combatPower)} hint={`${formatPercent(state.readiness)} ready`} />
          </div>
          <SubScoreGrid state={state} />
          <p className="text-label-secondary text-footnote tabular-nums">
            Equipment worth {formatCompactCurrency(state.nominalCapital)} · quality{" "}
            {formatPercent(state.quality)} of the newest designs · support and enablers{" "}
            {formatPercent(state.enabler)}
          </p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            <IconAction label={`Edit ${row.name}`} onClick={actions.edit}>
              <Edit className="h-4 w-4" />
            </IconAction>
            <IconAction label={`Delete ${row.name}`} onClick={actions.remove} destructive>
              <Trash className="h-4 w-4" />
            </IconAction>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-separator mt-4 space-y-5 border-t pt-4 sm:pl-11">
          <section className="space-y-2" aria-label={`${row.name} plan`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-subhead text-label font-medium">Plan</h5>
              {canEdit && (
                <div className="flex gap-2">
                  {mobilising && (
                    <Button size="sm" variant="outline" onClick={actions.demobilise}>
                      Demobilise
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={state.reserves - state.mobilisationOrder < 1}
                    onClick={actions.mobilise}
                  >
                    Mobilise reserves
                  </Button>
                </div>
              )}
            </div>
            <BranchPlanEditor
              branchId={row.id}
              effortShare={state.effortShare}
              effortOfTotal={effortOfTotal}
              targetActive={state.targetActive}
              fundedStrength={state.fundedStrength}
              canEdit={canEdit}
              pending={pending}
              onSave={actions.savePlan}
            />
          </section>
          <section className="space-y-2" aria-label={`${row.name} equipment`}>
            <h5 className="text-subhead text-label font-medium">Equipment</h5>
            <BranchAssets
              assets={row.assets}
              canEdit={canEdit}
              onStatus={actions.assetStatus}
              onScrap={actions.scrapAsset}
            />
          </section>
          <UnitList row={row} canEdit={canEdit} actions={actions} />
        </div>
      )}
    </Card>
  );
}

function UnitList({ row, canEdit, actions }: { row: ForceBranch; canEdit: boolean; actions: BranchActions }) {
  return (
    <section className="space-y-2" aria-label={`${row.name} units`}>
      <div className="flex items-center justify-between gap-2">
        <h5 className="text-subhead text-label font-medium">Units</h5>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={actions.addUnit}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add unit
          </Button>
        )}
      </div>
      {row.units.length === 0 ? (
        <p className="text-label-secondary text-footnote">
          No units yet. Units organise the branch&apos;s people into formations you can deploy.
        </p>
      ) : (
        <ul className="divide-separator divide-y">
          {row.units.map((unit) => (
            <li key={unit.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <span className="text-callout text-label font-medium">{unit.name}</span>
                <span className="text-label-secondary text-footnote ml-2 capitalize">{unit.unitType}</span>
                <div className="text-label-secondary text-footnote truncate">
                  {formatCount(unit.personnel)} personnel
                  {[unit.commanderRank, unit.commanderName].filter(Boolean).length > 0 &&
                    ` · ${[unit.commanderRank, unit.commanderName].filter(Boolean).join(" ")}`}
                  {unit.headquarters ? ` · ${unit.headquarters}` : ""}
                </div>
              </div>
              {canEdit && (
                <div className="flex shrink-0 items-center gap-1">
                  <IconAction label={`Edit ${unit.name}`} onClick={() => actions.editUnit(unit)}>
                    <Edit className="h-4 w-4" />
                  </IconAction>
                  <IconAction label={`Delete ${unit.name}`} onClick={() => actions.removeUnit(unit)} destructive>
                    <Trash className="h-4 w-4" />
                  </IconAction>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
