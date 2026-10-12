"use client";

import { NavArrowDown, NavArrowRight, Undo } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import {
  STUDIO_FIELDS,
  sameValue,
  type StudioGroup,
  type StudioKey,
  type StudioParams,
} from "~/lib/worldgen/studio-fields";
import { StudioField } from "./StudioFields";

interface StudioRailGroupProps {
  group: StudioGroup;
  params: StudioParams;
  base: StudioParams;
  fitting: boolean;
  onCommit: (patch: Partial<StudioParams>) => void;
  onReset: (keys: readonly StudioKey[]) => void;
}

/** One stage's parameters, folded away or open, with a reset for the whole group. */
export function StudioRailGroup({
  group,
  params,
  base,
  fitting,
  onCommit,
  onReset,
}: StudioRailGroupProps) {
  const changed = group.fields.some((key) => !sameValue(params[key], base[key]));
  return (
    <Collapsible defaultOpen={group.open} className="border-separator border-t pt-2">
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="group -ml-2 gap-1 px-2">
            <NavArrowRight aria-hidden className="size-3.5 group-data-[state=open]:hidden" />
            <NavArrowDown aria-hidden className="size-3.5 group-data-[state=closed]:hidden" />
            {group.label}
          </Button>
        </CollapsibleTrigger>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={!changed}
          onClick={() => onReset(group.fields)}
          aria-label={`Reset group ${group.label}`}
        >
          <Undo aria-hidden className="size-3" />
          Reset group
        </Button>
      </div>
      <CollapsibleContent className="space-y-3 pt-2">
        {group.fields.map((key) => (
          <StudioField
            key={key}
            spec={STUDIO_FIELDS[key]}
            params={params}
            base={base}
            fitting={fitting}
            onCommit={onCommit}
            onReset={onReset}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
