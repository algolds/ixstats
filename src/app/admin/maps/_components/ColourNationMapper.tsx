"use client";

/**
 * ColourNationMapper — the Full Pipeline's colour → nation step for flat-colour PNG maps (decisions 10–11).
 * Lists the colours the pipeline detected, largest first, and lets the admin name each one after a nation
 * of the target realm or ignore it (ocean, background). Only named colours are vectorised; the rest are
 * dropped, with the count shown before the run.
 */

import { memo, useCallback, useMemo, useState } from "react";
import { Autocomplete } from "~/components/ui/autocomplete";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Globe, SystemRestart as Loader2, WarningTriangle } from "iconoir-react";
import {
  planColourMapping,
  type ColourMappingPlan,
  type RankedColour,
} from "~/lib/maps/png-realm-map";

interface ColourNationMapperProps {
  colours: RankedColour[];
  /** The target realm's countries and claimable nation pages. */
  nationNames: string[];
  namesLoading: boolean;
  busy: boolean;
  onVectorise: (colorMapping: Record<string, string>, unmapped: number) => void;
}

export function ColourNationMapper({
  colours,
  nationNames,
  namesLoading,
  busy,
  onVectorise,
}: ColourNationMapperProps) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [ignored, setIgnored] = useState<ReadonlySet<string>>(() => new Set());
  const plan = useMemo(
    () => planColourMapping(colours, assignments, ignored),
    [colours, assignments, ignored]
  );

  const assign = useCallback(
    (hex: string, nation: string) => setAssignments((prev) => ({ ...prev, [hex]: nation })),
    []
  );
  const setIgnoredFor = useCallback(
    (hex: string, ignore: boolean) =>
      setIgnored((prev) => {
        const next = new Set(prev);
        if (ignore) next.add(hex);
        else next.delete(hex);
        return next;
      }),
    []
  );

  return (
    <div className="space-y-4">
      <p className="text-label-secondary text-body">
        Name each colour after a nation of the target realm. Its region is imported with that
        nation&apos;s name, and becomes the nation&apos;s when it is claimed. Mark the ocean and
        other background colours as ignored.
      </p>
      <ul className="divide-separator border-separator rounded-control divide-y border">
        {colours.map((colour) => (
          <ColourRow
            key={colour.hex}
            colour={colour}
            nation={assignments[colour.hex] ?? ""}
            isIgnored={ignored.has(colour.hex)}
            nationNames={nationNames}
            namesLoading={namesLoading}
            onAssign={assign}
            onIgnore={setIgnoredFor}
          />
        ))}
      </ul>
      <MappingSummary plan={plan} />
      <Button
        onClick={() => onVectorise(plan.colorMapping, plan.unmapped)}
        disabled={busy || plan.mapped === 0 || plan.duplicates.length > 0}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
        {busy ? "Vectorising…" : `Vectorise ${plan.mapped} mapped colours`}
      </Button>
    </div>
  );
}

interface ColourRowProps {
  colour: RankedColour;
  nation: string;
  isIgnored: boolean;
  nationNames: string[];
  namesLoading: boolean;
  onAssign: (hex: string, nation: string) => void;
  onIgnore: (hex: string, ignore: boolean) => void;
}

const ColourRow = memo(function ColourRow({
  colour,
  nation,
  isIgnored,
  nationNames,
  namesLoading,
  onAssign,
  onIgnore,
}: ColourRowProps) {
  const ignoreId = `ignore-${colour.hex.slice(1)}`;
  return (
    <li
      data-testid={`colour-${colour.hex.slice(1)}`}
      className="flex flex-wrap items-center gap-3 px-3 py-2"
    >
      <span
        className="border-separator rounded-control-sm size-6 shrink-0 border"
        style={{ backgroundColor: colour.hex }}
        aria-hidden
      />
      <span className="text-label-secondary text-footnote w-20 tabular-nums">{colour.hex}</span>
      <span className="text-label text-footnote w-14 text-right tabular-nums">
        {(colour.share * 100).toFixed(1)}%
      </span>
      <div className="min-w-48 flex-1">
        <Autocomplete
          value={nation}
          onChange={(value) => onAssign(colour.hex, value)}
          defaultSuggestions={nationNames}
          isLoading={namesLoading}
          disabled={isIgnored}
          placeholder="Nation…"
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={ignoreId}
          aria-label={`Ignore ${colour.hex}`}
          checked={isIgnored}
          onCheckedChange={(checked) => onIgnore(colour.hex, checked === true)}
        />
        <Label htmlFor={ignoreId} className="text-label-secondary text-footnote">
          Ignore
        </Label>
      </div>
    </li>
  );
});

function MappingSummary({ plan }: { plan: ColourMappingPlan }) {
  return (
    <div className="text-footnote space-y-1">
      <p className="text-label-secondary">
        {plan.mapped} mapped · {plan.ignored} ignored · {plan.unmapped} unmapped
      </p>
      {plan.unmapped > 0 && (
        <p className="text-yellow">
          {plan.unmapped} unmapped colour{plan.unmapped === 1 ? "" : "s"} will be dropped from the
          map.
        </p>
      )}
      {plan.duplicates.map((nation) => (
        <p key={nation} className="text-red flex items-center gap-1">
          <WarningTriangle className="h-3.5 w-3.5" />
          {nation} has more than one colour. A nation holds one region; merge the colours or rename
          one.
        </p>
      ))}
    </div>
  );
}
