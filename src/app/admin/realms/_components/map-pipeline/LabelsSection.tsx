"use client";

import { realmLabelsEditorHref } from "~/lib/maps/realm-labels";
import { useState } from "react";
import Link from "next/link";
import { Plus, Text, Trash } from "iconoir-react";
import type { RealmMapPipeline } from "~/lib/maps/realm-map-pipeline";
import {
  REALM_LABEL_RANK_NAMES,
  REALM_LABEL_RANKS,
  REALM_LABEL_TYPE_NAMES,
  REALM_LABEL_TYPES,
  type RealmLabelRank,
  type RealmLabelSeedEntry,
} from "~/lib/maps/realm-labels";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ValueSelect } from "~/components/ui/value-select";
import { ArtSelect, Field, FieldError, NumberInput, PipelineSection, invalidProps } from "./fields";
import { patchItem, type DraftErrors } from "./pipeline-draft";

type Labels = RealmMapPipeline["labels"];
type LabelFile = Exclude<NonNullable<Labels>, { art: string }>;
type Mode = "none" | "file" | "list";

const MODE_OPTIONS = [
  { value: "none", label: "Map editor only" },
  { value: "file", label: "Label file" },
  { value: "list", label: "Typed list" },
] as const;

type RankChoice = RealmLabelRank | "default";

const KIND_OPTIONS = REALM_LABEL_TYPES.map((kind) => [kind, REALM_LABEL_TYPE_NAMES[kind]] as const);
const RANK_OPTIONS: ReadonlyArray<readonly [RankChoice, string]> = [
  ["default", "Kind's default"],
  ...REALM_LABEL_RANKS.map((rank) => [rank, REALM_LABEL_RANK_NAMES[rank]] as const),
];

const modeOf = (labels: Labels): Mode => (!labels ? "none" : "art" in labels ? "file" : "list");

function LabelRow({
  label,
  index,
  errors,
  set,
  remove,
}: {
  label: RealmLabelSeedEntry;
  index: number;
  errors: DraftErrors;
  set: (patch: Partial<RealmLabelSeedEntry>) => void;
  remove: () => void;
}) {
  const err = (field: string) => errors[`labels.labels.${index}.${field}`];
  const id = (field: string) => `label-${index}-${field}`;
  const [lng, lat] = label.coordinates;
  return (
    <TableRow>
      <TableCell className="align-top">
        <Input
          id={id("text")}
          aria-label={`Label ${index + 1} text`}
          value={label.text}
          onChange={(e) => set({ text: e.target.value })}
          {...invalidProps(id("text"), err("text"))}
        />
        <FieldError id={id("text")} error={err("text")} />
      </TableCell>
      <TableCell className="align-top">
        <ValueSelect
          aria-label={`Label ${index + 1} kind`}
          value={label.kind}
          options={KIND_OPTIONS}
          onValueChange={(kind) => set({ kind })}
        />
      </TableCell>
      <TableCell className="align-top">
        <ValueSelect
          aria-label={`Label ${index + 1} rank`}
          value={label.rank ?? "default"}
          options={RANK_OPTIONS}
          onValueChange={(rank) => set({ rank: rank === "default" ? undefined : rank })}
        />
      </TableCell>
      <TableCell numeric className="align-top">
        <NumberInput
          aria-label={`Label ${index + 1} longitude`}
          className="ml-auto w-24 text-right"
          value={lng}
          onChange={(v) => set({ coordinates: [v ?? Number.NaN, lat] })}
          {...invalidProps(id("lng"), err("coordinates.0") ?? err("coordinates"))}
        />
        <FieldError id={id("lng")} error={err("coordinates.0") ?? err("coordinates")} />
      </TableCell>
      <TableCell numeric className="align-top">
        <NumberInput
          aria-label={`Label ${index + 1} latitude`}
          className="ml-auto w-24 text-right"
          value={lat}
          onChange={(v) => set({ coordinates: [lng, v ?? Number.NaN] })}
          {...invalidProps(id("lat"), err("coordinates.1"))}
        />
        <FieldError id={id("lat")} error={err("coordinates.1")} />
      </TableCell>
      <TableCell className="align-top">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Remove label ${label.text || index + 1}`}
          onClick={remove}
        >
          <Trash />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function LabelList({
  labels,
  errors,
  onChange,
}: {
  labels: LabelFile;
  errors: DraftErrors;
  onChange: (labels: LabelFile) => void;
}) {
  const [open, setOpen] = useState(labels.labels.length <= 10);
  const list = labels.labels;
  const setList = (next: RealmLabelSeedEntry[]) => onChange({ ...labels, labels: next });
  return (
    <div className="flex flex-col gap-3">
      <div className="max-w-md">
        <Field
          id="labels-source"
          label="Where the labels come from"
          error={errors["labels.source"]}
        >
          <Input
            id="labels-source"
            value={labels.source}
            onChange={(e) => onChange({ ...labels, source: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
          {open ? "Hide the list" : `Edit the ${list.length} labels`}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setOpen(true);
            setList([...list, { text: "", kind: "sea", coordinates: [0, 0] }]);
          }}
        >
          <Plus /> Add label
        </Button>
      </div>
      {open && list.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Text</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Rank</TableHead>
              <TableHead numeric>Longitude (°)</TableHead>
              <TableHead numeric>Latitude (°)</TableHead>
              <TableHead>
                <span className="sr-only">Remove</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((label, i) => (
              <LabelRow
                key={i}
                label={label}
                index={i}
                errors={errors}
                set={(patch) => setList(patchItem(list, i, patch))}
                remove={() => setList(list.filter((_, j) => j !== i))}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/** The realm's ocean, sea, region and continent labels: a label file of the art, a typed list, or none. */
export function LabelsSection({
  labels,
  artKeys,
  errors,
  slug,
  onChange,
}: {
  labels: Labels;
  artKeys: string[];
  errors: DraftErrors;
  slug: string;
  onChange: (labels: Labels) => void;
}) {
  const mode = modeOf(labels);
  const setMode = (next: Mode) =>
    onChange(
      next === "none" ? undefined : next === "file" ? { art: "" } : { source: "", labels: [] }
    );
  return (
    <PipelineSection
      icon={<Text />}
      title="Labels"
      description={
        <>
          Labels are matched by key (or text): a run adds and updates them, never removes. For fine
          edits,{" "}
          <Link className="text-tint underline" href={realmLabelsEditorHref(slug)}>
            edit them on the realm&apos;s map
          </Link>
          .
        </>
      }
      action={
        <SegmentedControl
          aria-label="Labels source"
          size="sm"
          value={mode}
          options={MODE_OPTIONS}
          onValueChange={setMode}
        />
      }
    >
      {labels && "art" in labels && (
        <div className="max-w-sm">
          <Field id="labels-art" label="Label file (JSON)" error={errors["labels.art"]}>
            <ArtSelect
              id="labels-art"
              value={labels.art || undefined}
              artKeys={artKeys}
              error={errors["labels.art"]}
              onChange={(art) => onChange({ art: art ?? "" })}
            />
          </Field>
        </div>
      )}
      {labels && "labels" in labels && (
        <LabelList labels={labels} errors={errors} onChange={onChange} />
      )}
    </PipelineSection>
  );
}
