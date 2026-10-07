"use client";

/**
 * RegionNationMapper: the import's region → nation step. Lists what the analysis found (a PNG's colours, an SVG's
 * shapes, a GeoJSON's property values), largest first, each pre-filled from the colour key or the source's own
 * name; the admin names each after one of the realm's nations or ignores it (sea, background). Several regions may
 * name one nation: they are merged into one border. A colour-key file (CSV or JSON) fills the colours by nearest
 * colour. Names that are not one of the realm's nations are flagged, with close spellings to pick from.
 */
import { memo, useCallback, useMemo, useState } from "react";
import { Autocomplete } from "~/components/ui/autocomplete";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { WarningTriangle } from "iconoir-react";
import { matchColourKey, parseColourKey } from "~/lib/maps/import/colour-key";
import {
  initialMapping,
  planRegionMapping,
  type RegionMappingPlan,
} from "~/lib/maps/import/mapping";
import { checkNationName, type NationCandidate } from "~/lib/maps/import/nation-names";
import type { ImportRegion } from "~/lib/maps/import/options";

/** A nation's locator map thumbnail from the realm's wiki (optional helper). */
export type LocatorThumbs = Readonly<Record<string, string>>;

interface RegionNationMapperProps {
  regions: ImportRegion[];
  suggested: Readonly<Record<string, string | null>>;
  nations: NationCandidate[];
  thumbs?: LocatorThumbs;
  busy: boolean;
  onContinue: (plan: RegionMappingPlan) => void;
}

export function RegionNationMapper({
  regions,
  suggested,
  nations,
  thumbs = {},
  busy,
  onContinue,
}: RegionNationMapperProps) {
  const [start] = useState(() => initialMapping(regions, suggested));
  const [assignments, setAssignments] = useState<Record<string, string>>(start.assignments);
  const [ignored, setIgnored] = useState<ReadonlySet<string>>(start.ignored);
  const [keyNote, setKeyNote] = useState<string | null>(null);
  const plan = useMemo(
    () => planRegionMapping(regions, assignments, ignored),
    [regions, assignments, ignored]
  );
  const nationNames = useMemo(
    () => nations.map((n) => n.name).sort((a, b) => a.localeCompare(b)),
    [nations]
  );
  const total = regions.reduce((sum, r) => sum + (r.pixels ?? 0), 0);

  const assign = useCallback(
    (key: string, nation: string) => setAssignments((prev) => ({ ...prev, [key]: nation })),
    []
  );
  const setIgnoredFor = useCallback(
    (key: string, ignore: boolean) =>
      setIgnored((prev) => {
        const next = new Set(prev);
        if (ignore) next.add(key);
        else next.delete(key);
        return next;
      }),
    []
  );

  const applyColourKey = async (file: File) => {
    const key = parseColourKey(await file.text());
    const palette = regions.flatMap((r) => (r.colour ? [r.colour] : []));
    const { assignments: filled, unusedKeyColours } = matchColourKey(palette, key.entries);
    setAssignments((prev) => ({ ...prev, ...filled }));
    setKeyNote(
      [
        `${Object.keys(filled).length} colours filled from ${key.entries.length} key entries.`,
        unusedKeyColours.length ? `${unusedKeyColours.length} key colours are not on the map.` : "",
        key.problems.length
          ? `${key.problems.length} rows could not be read: ${key.problems.slice(0, 3).join("; ")}`
          : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  };

  const hasColours = regions.some((r) => r.colour);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-label-secondary text-body">
        Name each region after a nation of the realm, or ignore it (sea, background). Regions named
        after the same nation are merged into one border. A region named after a nation the realm
        has no country for yet is imported under that name, and becomes the nation&apos;s when it is
        claimed.
      </p>
      {hasColours && (
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="sm" variant="outline">
            <label className="cursor-pointer">
              Load a colour key (CSV or JSON)
              <input
                type="file"
                accept=".csv,.json,.txt,text/csv,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void applyColourKey(file);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          {keyNote && <span className="text-label-secondary text-footnote">{keyNote}</span>}
        </div>
      )}
      <ul className="divide-separator border-separator rounded-control max-h-[32rem] divide-y overflow-y-auto border">
        {regions.map((region) => (
          <RegionRow
            key={region.key}
            region={region}
            share={total > 0 && region.pixels !== undefined ? region.pixels / total : null}
            nation={assignments[region.key] ?? ""}
            isIgnored={ignored.has(region.key)}
            nationNames={nationNames}
            nations={nations}
            thumb={thumbs[assignments[region.key] ?? ""]}
            onAssign={assign}
            onIgnore={setIgnoredFor}
          />
        ))}
      </ul>
      <div className="text-footnote flex flex-col gap-1">
        <p className="text-label-secondary">
          {plan.mapped} named ({plan.nations} nations) · {plan.ignored} ignored · {plan.unmapped}{" "}
          left out
        </p>
        {plan.unmapped > 0 && (
          <p className="text-warning-ink">
            {plan.unmapped} region{plan.unmapped === 1 ? "" : "s"} neither named nor ignored will
            not be imported.
          </p>
        )}
        {plan.merged.length > 0 && (
          <p className="text-label-secondary">
            Merged from several regions: {plan.merged.join(", ")}
          </p>
        )}
      </div>
      <div>
        <Button onClick={() => onContinue(plan)} disabled={busy || plan.mapped === 0}>
          Review the changes
        </Button>
      </div>
    </div>
  );
}

interface RegionRowProps {
  region: ImportRegion;
  share: number | null;
  nation: string;
  isIgnored: boolean;
  nationNames: string[];
  nations: NationCandidate[];
  thumb: string | undefined;
  onAssign: (key: string, nation: string) => void;
  onIgnore: (key: string, ignore: boolean) => void;
}

const RegionRow = memo(function RegionRow({
  region,
  share,
  nation,
  isIgnored,
  nationNames,
  nations,
  thumb,
  onAssign,
  onIgnore,
}: RegionRowProps) {
  const id = `region-${region.key.replace(/[^a-z0-9]/gi, "")}`;
  const check = useMemo(
    () => (isIgnored ? null : checkNationName(nation, nations)),
    [isIgnored, nation, nations]
  );
  return (
    <li data-testid={id} className="flex flex-wrap items-center gap-3 px-3 py-2">
      {region.colour ? (
        <span
          className="border-separator rounded-control-sm size-6 shrink-0 border"
          style={{ backgroundColor: region.colour }}
          aria-hidden
        />
      ) : (
        <span className="size-6 shrink-0" aria-hidden />
      )}
      <span
        className="text-label-secondary text-footnote w-40 truncate"
        title={region.name ?? region.key}
      >
        {region.name ?? region.colour ?? region.key}
      </span>
      <span className="text-label text-footnote w-14 text-right tabular-nums">
        {share !== null ? `${(share * 100).toFixed(1)}%` : `${region.parts ?? 1}×`}
      </span>
      <div className="min-w-48 flex-1">
        <Autocomplete
          value={nation}
          onChange={(value) => onAssign(region.key, value)}
          defaultSuggestions={nationNames}
          disabled={isIgnored}
          placeholder="Nation…"
        />
        {check?.status === "new" && (
          <p className="text-warning-ink text-footnote mt-1 flex flex-wrap items-center gap-1">
            <WarningTriangle className="h-3.5 w-3.5" />
            Not a nation of the realm yet.
            {check.suggestions.map((s) => (
              <button
                key={s.name}
                type="button"
                className="text-tint-ink underline"
                onClick={() => onAssign(region.key, s.name)}
              >
                {s.name}?
              </button>
            ))}
          </p>
        )}
      </div>
      {thumb && (
        <img
          src={thumb}
          alt={`Locator map of ${nation}`}
          className="rounded-control-sm h-10 w-14 object-cover"
        />
      )}
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${id}-ignore`}
          aria-label={`Ignore ${region.name ?? region.key}`}
          checked={isIgnored}
          onCheckedChange={(checked) => onIgnore(region.key, checked === true)}
        />
        <Label htmlFor={`${id}-ignore`} className="text-label-secondary text-footnote">
          Ignore
        </Label>
      </div>
    </li>
  );
});
