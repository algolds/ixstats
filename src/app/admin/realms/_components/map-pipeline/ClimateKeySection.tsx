"use client";

import { Cloud, Plus, Trash } from "iconoir-react";
import type { RealmLayerConfig } from "~/lib/maps/import/realm-layer-config";
import type { ClimateZone } from "~/lib/maps/realm-map-settings";
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
import { ArtSelect, ColourInput, Field, FieldError, PipelineSection, invalidProps } from "./fields";
import { patchItem, type DraftErrors } from "./pipeline-draft";

type Climate = NonNullable<RealmLayerConfig["climate"]>;
type Key = Climate["key"];
type KeyFile = Extract<Key, { art: string }>;

const MODE_OPTIONS = [
  { value: "typed", label: "Typed zones" },
  { value: "file", label: "From an art file" },
] as const;

const P = "physical.climate.key";
const MAX_ZONES = 64;

function TextField({
  id,
  label,
  value,
  error,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...invalidProps(id, error)}
      />
    </Field>
  );
}

function ZonesTable({
  zones,
  errors,
  onChange,
}: {
  zones: ClimateZone[];
  errors: DraftErrors;
  onChange: (zones: ClimateZone[]) => void;
}) {
  const err = (i: number, field: string) => errors[`${P}.zones.${i}.${field}`];
  const cellInput = (i: number, field: "code" | "name" | "link", label: string) => {
    const id = `zone-${i}-${field}`;
    return (
      <>
        <Input
          id={id}
          aria-label={`Zone ${i + 1} ${label}`}
          className={field === "code" ? "font-data w-20" : undefined}
          value={zones[i]?.[field] ?? ""}
          onChange={(e) =>
            onChange(
              patchItem(zones, i, {
                [field]: field === "link" && e.target.value === "" ? undefined : e.target.value,
              })
            )
          }
          {...invalidProps(id, err(i, field))}
        />
        <FieldError id={id} error={err(i, field)} />
      </>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      {errors[`${P}.zones`] && <FieldError id="zones" error={errors[`${P}.zones`]} />}
      {zones.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Colour</TableHead>
              <TableHead>Link</TableHead>
              <TableHead>
                <span className="sr-only">Remove</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zones.map((zone, i) => (
              <TableRow key={i}>
                <TableCell className="align-top">{cellInput(i, "code", "code")}</TableCell>
                <TableCell className="align-top">{cellInput(i, "name", "name")}</TableCell>
                <TableCell className="align-top">
                  <ColourInput
                    id={`zone-${i}-color`}
                    label={`Zone ${i + 1} colour`}
                    value={zone.color}
                    error={err(i, "color")}
                    onChange={(color) => onChange(patchItem(zones, i, { color }))}
                  />
                  <FieldError id={`zone-${i}-color`} error={err(i, "color")} />
                </TableCell>
                <TableCell className="align-top">{cellInput(i, "link", "link")}</TableCell>
                <TableCell className="align-top">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove zone ${zone.code || i + 1}`}
                    onClick={() => onChange(zones.filter((_, j) => j !== i))}
                  >
                    <Trash />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div>
        <Button
          size="sm"
          variant="outline"
          disabled={zones.length >= MAX_ZONES}
          onClick={() => onChange([...zones, { code: "", name: "", color: "#888888" }])}
        >
          <Plus /> Add zone
        </Button>
      </div>
    </div>
  );
}

function KeyFileFields({
  keyFile,
  artKeys,
  errors,
  onChange,
}: {
  keyFile: KeyFile;
  artKeys: string[];
  errors: DraftErrors;
  onChange: (key: KeyFile) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field id="climate-key-art" label="Data file" error={errors[`${P}.art`]}>
        <ArtSelect
          id="climate-key-art"
          value={keyFile.art || undefined}
          artKeys={artKeys}
          error={errors[`${P}.art`]}
          onChange={(art) => onChange({ ...keyFile, art: art ?? "" })}
        />
      </Field>
      <TextField
        id="climate-key-zones"
        label="Binding holding the zones"
        hint="The name of the array in the file; it is read as literals, never run."
        value={keyFile.zonesBinding}
        error={errors[`${P}.zonesBinding`]}
        onChange={(zonesBinding) => onChange({ ...keyFile, zonesBinding })}
      />
      <TextField
        id="climate-key-links"
        label="Binding holding the link prefix (optional)"
        value={keyFile.linkPrefixBinding ?? ""}
        error={errors[`${P}.linkPrefixBinding`]}
        onChange={(v) => onChange({ ...keyFile, linkPrefixBinding: v === "" ? undefined : v })}
      />
    </div>
  );
}

/** The classification the climate layer is traced in: zones typed here, or read from a data file of the art. */
export function ClimateKeySection({
  climate,
  artKeys,
  errors,
  onChange,
}: {
  climate: Climate | undefined;
  artKeys: string[];
  errors: DraftErrors;
  onChange: (climate: Climate) => void;
}) {
  if (!climate) {
    return (
      <PipelineSection
        icon={<Cloud />}
        title="Climate key"
        description="Switch on climate zones in Physical layers to set their key."
      />
    );
  }
  const key = climate.key;
  const setKey = (next: Key) => onChange({ ...climate, key: next });
  const setMode = (mode: "typed" | "file") =>
    setKey(
      mode === "file"
        ? { art: "", system: key.system, zonesBinding: "" }
        : { system: key.system, zones: [] }
    );
  return (
    <PipelineSection
      icon={<Cloud />}
      title="Climate key"
      description="The zones the climate map is painted in, with their colours; the map's legend shows them."
      action={
        <SegmentedControl
          aria-label="Climate key source"
          size="sm"
          value={"art" in key ? "file" : "typed"}
          options={MODE_OPTIONS}
          onValueChange={setMode}
        />
      }
    >
      <div className="max-w-sm">
        <TextField
          id="climate-key-system"
          label="Classification"
          value={key.system}
          error={errors[`${P}.system`]}
          onChange={(system) => setKey({ ...key, system })}
        />
      </div>
      {"art" in key ? (
        <KeyFileFields keyFile={key} artKeys={artKeys} errors={errors} onChange={setKey} />
      ) : (
        <ZonesTable
          zones={key.zones}
          errors={errors}
          onChange={(zones) => setKey({ ...key, zones })}
        />
      )}
    </PipelineSection>
  );
}
