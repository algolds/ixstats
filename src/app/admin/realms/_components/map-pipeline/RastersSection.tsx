"use client";

import { ArrowDown, ArrowUp, Map as MapIcon, Plus, Trash } from "iconoir-react";
import type { PipelineRaster } from "~/lib/maps/realm-map-pipeline";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ValueSelect } from "~/components/ui/value-select";
import { ArtSelect, FieldError, NumberInput, PipelineSection, invalidProps } from "./fields";
import { moveItem, patchItem, type DraftErrors } from "./pipeline-draft";

const KIND_OPTIONS = [
  ["base", "Base"],
  ["overlay", "Overlay"],
] as const;

const MAX_RASTERS = 12;

interface RastersSectionProps {
  rasters: PipelineRaster[];
  artKeys: string[];
  errors: DraftErrors;
  onChange: (rasters: PipelineRaster[]) => void;
}

function RasterRow({
  raster,
  index,
  count,
  artKeys,
  errors,
  set,
  move,
  remove,
}: {
  raster: PipelineRaster;
  index: number;
  count: number;
  artKeys: string[];
  errors: DraftErrors;
  set: (patch: Partial<PipelineRaster>) => void;
  move: (by: number) => void;
  remove: () => void;
}) {
  const name = raster.label || raster.id || `layer ${index + 1}`;
  const err = (field: string) => errors[`rasters.${index}.${field}`];
  const cell = (field: string) => `raster-${index}-${field}`;
  return (
    <TableRow>
      <TableCell className="align-top">
        <Input
          id={cell("id")}
          aria-label={`Raster ${index + 1} id`}
          className="font-data w-36"
          value={raster.id}
          onChange={(e) => set({ id: e.target.value.trim() })}
          {...invalidProps(cell("id"), err("id"))}
        />
        <FieldError id={cell("id")} error={err("id")} />
      </TableCell>
      <TableCell className="align-top">
        <Input
          id={cell("label")}
          aria-label={`Raster ${index + 1} label`}
          className="w-40"
          value={raster.label}
          onChange={(e) => set({ label: e.target.value })}
          {...invalidProps(cell("label"), err("label"))}
        />
        <FieldError id={cell("label")} error={err("label")} />
      </TableCell>
      <TableCell className="align-top">
        <ValueSelect
          aria-label={`Raster ${index + 1} kind`}
          value={raster.kind}
          options={KIND_OPTIONS}
          onValueChange={(kind) =>
            set(kind === "base" ? { kind, order: undefined } : { kind, order: raster.order ?? 1 })
          }
        />
      </TableCell>
      <TableCell className="align-top">
        {raster.kind === "overlay" ? (
          <NumberInput
            id={cell("order")}
            aria-label={`Raster ${index + 1} order`}
            className="w-20"
            optional
            value={raster.order}
            onChange={(order) => set({ order })}
            {...invalidProps(cell("order"), err("order"))}
          />
        ) : (
          <span className="text-label-secondary">–</span>
        )}
        <FieldError id={cell("order")} error={err("order")} />
      </TableCell>
      <TableCell className="align-top">
        <ArtSelect
          id={cell("art")}
          ariaLabel={`Raster ${index + 1} art`}
          value={raster.art || undefined}
          artKeys={artKeys}
          error={err("art")}
          onChange={(art) => set({ art: art ?? "" })}
        />
        <FieldError id={cell("art")} error={err("art")} />
      </TableCell>
      <TableCell className="align-top">
        <ArtSelect
          id={cell("legendArt")}
          ariaLabel={`Raster ${index + 1} legend art`}
          value={raster.legendArt}
          artKeys={artKeys}
          noneLabel="No legend"
          error={err("legendArt")}
          onChange={(legendArt) => set({ legendArt })}
        />
        <FieldError id={cell("legendArt")} error={err("legendArt")} />
      </TableCell>
      <TableCell className="align-top">
        <Checkbox
          aria-label={`Raster ${index + 1} grey`}
          checked={raster.grey === true}
          onCheckedChange={(v) => set({ grey: v === true ? true : undefined })}
        />
      </TableCell>
      <TableCell className="align-top">
        <div className="flex gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Move ${name} up`}
            disabled={index === 0}
            onClick={() => move(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Move ${name} down`}
            disabled={index === count - 1}
            onClick={() => move(1)}
          >
            <ArrowDown />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Remove ${name}`} onClick={remove}>
            <Trash />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

/** The raster tile layers built from the art: base maps (one shown at a time) and overlays (drawn by order). */
export function RastersSection({ rasters, artKeys, errors, onChange }: RastersSectionProps) {
  const add = () =>
    onChange([
      ...rasters,
      { id: "", label: "", kind: rasters.length === 0 ? "base" : "overlay", art: "" },
    ]);
  return (
    <PipelineSection
      icon={<MapIcon />}
      title="Raster layers"
      description="Each is a full-globe equirectangular image (2:1). Base layers are alternatives; overlays are switches drawn lowest order first. Grey builds a grey copy of the art."
      action={
        <Button size="sm" variant="outline" disabled={rasters.length >= MAX_RASTERS} onClick={add}>
          <Plus /> Add layer
        </Button>
      }
    >
      {errors.rasters && <FieldError id="rasters" error={errors.rasters} />}
      {rasters.length === 0 ? (
        <p className="text-label-secondary text-body">No raster layers.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Id</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Art</TableHead>
              <TableHead>Legend art</TableHead>
              <TableHead>Grey</TableHead>
              <TableHead>
                <span className="sr-only">Arrange</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rasters.map((raster, i) => (
              <RasterRow
                key={i}
                raster={raster}
                index={i}
                count={rasters.length}
                artKeys={artKeys}
                errors={errors}
                set={(patch) => onChange(patchItem(rasters, i, patch))}
                move={(by) => onChange(moveItem(rasters, i, by))}
                remove={() => onChange(rasters.filter((_, j) => j !== i))}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </PipelineSection>
  );
}
