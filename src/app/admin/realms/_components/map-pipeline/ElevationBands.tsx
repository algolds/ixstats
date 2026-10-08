"use client";

import { Plus, Trash } from "iconoir-react";
import type { RealmLayerConfig } from "~/lib/maps/import/realm-layer-config";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ColourInput, FieldError, NumberInput, invalidProps } from "./fields";
import { patchItem, type DraftErrors } from "./pipeline-draft";

type Band = NonNullable<RealmLayerConfig["elevation"]>["bands"][number];

const MAX_BANDS = 16;
const MAX_RIVER_COLOURS = 8;

/** The geography map's hypsometric tints, each with the elevations it stands for (metres). */
export function ElevationBands({
  bands,
  errors,
  onChange,
}: {
  bands: Band[];
  errors: DraftErrors;
  onChange: (bands: Band[]) => void;
}) {
  const err = (i: number, field: string) => errors[`physical.elevation.bands.${i}.${field}`];
  const add = () => {
    const top = bands.at(-1);
    onChange([...bands, { color: "#ffffff", min: top?.max ?? 0, max: null }]);
  };
  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tint</TableHead>
            <TableHead numeric>From (m)</TableHead>
            <TableHead numeric>To (m)</TableHead>
            <TableHead>
              <span className="sr-only">Remove</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bands.map((band, i) => (
            <TableRow key={i}>
              <TableCell className="align-top">
                <ColourInput
                  id={`band-${i}-color`}
                  label={`Band ${i + 1} tint`}
                  value={band.color}
                  error={err(i, "color")}
                  onChange={(color) => onChange(patchItem(bands, i, { color }))}
                />
                <FieldError id={`band-${i}-color`} error={err(i, "color")} />
              </TableCell>
              <TableCell numeric className="align-top">
                <NumberInput
                  aria-label={`Band ${i + 1} from (m)`}
                  className="ml-auto w-28 text-right"
                  value={band.min}
                  onChange={(min) => onChange(patchItem(bands, i, { min: min ?? Number.NaN }))}
                  {...invalidProps(`band-${i}-min`, err(i, "min"))}
                />
                <FieldError id={`band-${i}-min`} error={err(i, "min")} />
              </TableCell>
              <TableCell numeric className="align-top">
                <NumberInput
                  aria-label={`Band ${i + 1} to (m)`}
                  className="ml-auto w-28 text-right"
                  placeholder="Open top"
                  optional
                  value={band.max}
                  onChange={(max) => onChange(patchItem(bands, i, { max: max ?? null }))}
                  {...invalidProps(`band-${i}-max`, err(i, "max"))}
                />
                <FieldError id={`band-${i}-max`} error={err(i, "max")} />
              </TableCell>
              <TableCell className="align-top">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove band ${i + 1}`}
                  disabled={bands.length === 1}
                  onClick={() => onChange(bands.filter((_, j) => j !== i))}
                >
                  <Trash />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div>
        <Button size="sm" variant="outline" disabled={bands.length >= MAX_BANDS} onClick={add}>
          <Plus /> Add band
        </Button>
      </div>
    </div>
  );
}

/** The colours the geography map draws rivers in. */
export function RiverColours({
  colours,
  errors,
  onChange,
}: {
  colours: string[];
  errors: DraftErrors;
  onChange: (colours: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      {colours.map((colour, i) => {
        const id = `river-colour-${i}`;
        const error = errors[`physical.rivers.colours.${i}`];
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <ColourInput
                id={id}
                label={`River colour ${i + 1}`}
                value={colour}
                error={error}
                onChange={(next) => onChange(colours.map((c, j) => (j === i ? next : c)))}
              />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove river colour ${i + 1}`}
                disabled={colours.length === 1}
                onClick={() => onChange(colours.filter((_, j) => j !== i))}
              >
                <Trash />
              </Button>
            </div>
            <FieldError id={id} error={error} />
          </div>
        );
      })}
      <Button
        size="sm"
        variant="outline"
        disabled={colours.length >= MAX_RIVER_COLOURS}
        onClick={() => onChange([...colours, "#5184c8"])}
      >
        <Plus /> Add colour
      </Button>
    </div>
  );
}
