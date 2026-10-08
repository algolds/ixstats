"use client";

import type { ReactNode } from "react";
import { Globe } from "iconoir-react";
import type { RealmLayerConfig } from "~/lib/maps/import/realm-layer-config";
import { ArtSelect, Field, PipelineSection, SwitchRow } from "./fields";
import { ElevationBands, RiverColours } from "./ElevationBands";
import { EngineSettings } from "./EngineSettings";
import type { DraftErrors } from "./pipeline-draft";

type Physical = RealmLayerConfig;
type Optional = "climate" | "ice" | "elevation" | "rivers";

interface PhysicalSectionProps {
  physical: Physical | undefined;
  artKeys: string[];
  errors: DraftErrors;
  onChange: (physical: Physical | undefined) => void;
}

/** What a layer starts with when it is switched on: its art is the land's until another is chosen. */
function initialLayer<K extends Optional>(key: K, art: string): NonNullable<Physical[K]> {
  const initial: { [P in Optional]: NonNullable<Physical[P]> } = {
    climate: { art, key: { system: "", zones: [] } },
    ice: { art },
    elevation: { art, bands: [{ color: "#a5bb8c", min: 0, max: null }] },
    rivers: { art, colours: ["#5184c8"] },
  };
  return initial[key];
}

function LayerGroup({
  id,
  label,
  on,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="border-separator flex flex-col gap-3 border-t pt-4">
      <SwitchRow id={id} label={label} checked={on} onChange={onToggle} />
      {on && <div className="flex flex-col gap-3 pl-1">{children}</div>}
    </div>
  );
}

/**
 * The physical layers traced from the art (the `physical` step): the land, then climate zones, ice, elevation bands
 * and rivers, each when switched on, and the engine settings that differ from the defaults.
 */
export function PhysicalSection({ physical, artKeys, errors, onChange }: PhysicalSectionProps) {
  const enable = (on: boolean) => onChange(on ? { land: artKeys[0] ?? "" } : undefined);
  const toggle =
    (key: Optional) =>
    (on: boolean): void => {
      if (!physical) return;
      onChange({ ...physical, [key]: on ? initialLayer(key, physical.land) : undefined });
    };
  const artField = (key: Optional, path: string, label: string) => {
    const layer = physical?.[key];
    if (!physical || !layer) return null;
    const id = `physical-${key}-art`;
    return (
      <Field id={id} label={label} error={errors[path]}>
        <ArtSelect
          id={id}
          value={layer.art || undefined}
          artKeys={artKeys}
          error={errors[path]}
          onChange={(art) => onChange({ ...physical, [key]: { ...layer, art: art ?? "" } })}
        />
      </Field>
    );
  };

  return (
    <PipelineSection
      icon={<Globe />}
      title="Physical layers"
      description="Altitudes, lakes, climate, ice and rivers traced from the art and stored as the realm's map layers."
      action={
        <SwitchRow
          id="physical-on"
          label="Trace physical layers"
          checked={!!physical}
          onChange={enable}
        />
      }
    >
      {physical && (
        <>
          <Field
            id="physical-land"
            label="Land (blank map)"
            hint="Land darker than a white sea; lakes are the water it encloses."
            error={errors["physical.land"]}
          >
            <ArtSelect
              id="physical-land"
              value={physical.land || undefined}
              artKeys={artKeys}
              error={errors["physical.land"]}
              onChange={(land) => onChange({ ...physical, land: land ?? "" })}
            />
          </Field>
          <LayerGroup
            id="physical-climate-on"
            label="Climate zones"
            on={!!physical.climate}
            onToggle={toggle("climate")}
          >
            {artField("climate", "physical.climate.art", "Climate map")}
            <p className="text-label-secondary text-footnote">
              The zones and their colours are set in Climate key below.
            </p>
          </LayerGroup>
          <LayerGroup id="physical-ice-on" label="Ice" on={!!physical.ice} onToggle={toggle("ice")}>
            {artField("ice", "physical.ice.art", "Map whose ice is white")}
          </LayerGroup>
          <LayerGroup
            id="physical-elevation-on"
            label="Elevation bands"
            on={!!physical.elevation}
            onToggle={toggle("elevation")}
          >
            {artField("elevation", "physical.elevation.art", "Geography map")}
            {physical.elevation && (
              <ElevationBands
                bands={physical.elevation.bands}
                errors={errors}
                onChange={(bands) =>
                  physical.elevation &&
                  onChange({ ...physical, elevation: { ...physical.elevation, bands } })
                }
              />
            )}
          </LayerGroup>
          <LayerGroup
            id="physical-rivers-on"
            label="Rivers"
            on={!!physical.rivers}
            onToggle={toggle("rivers")}
          >
            {artField("rivers", "physical.rivers.art", "Map the rivers are drawn on")}
            {physical.rivers && (
              <RiverColours
                colours={physical.rivers.colours}
                errors={errors}
                onChange={(colours) =>
                  physical.rivers &&
                  onChange({ ...physical, rivers: { ...physical.rivers, colours } })
                }
              />
            )}
          </LayerGroup>
          <div className="border-separator flex flex-col gap-3 border-t pt-4">
            <h4 className="text-label text-body font-medium">Engine settings</h4>
            <p className="text-label-secondary text-footnote">
              Leave a field empty to keep the default shown in it.
            </p>
            <EngineSettings
              engine={physical.engine}
              errors={errors}
              onChange={(engine) => onChange({ ...physical, engine })}
            />
          </div>
        </>
      )}
    </PipelineSection>
  );
}
