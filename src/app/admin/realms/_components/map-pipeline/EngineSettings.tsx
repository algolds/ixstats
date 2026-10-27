"use client";

import {
  layerEngineOptionsSchema,
  type LayerEngineOptions,
} from "~/lib/maps/import/png/layer-engine-options";
import { FieldError, NumberInput, invalidProps } from "./fields";
import type { DraftErrors } from "./pipeline-draft";

export type EngineOverrides = Partial<LayerEngineOptions>;
type Nested = "minRegionPixels" | "rivers";
type TopKey = Exclude<keyof LayerEngineOptions, Nested>;

const DEFAULTS = layerEngineOptionsSchema.parse({});

interface Group<K extends string> {
  title: string;
  fields: ReadonlyArray<readonly [K, string]>;
}

const TOP_GROUPS: ReadonlyArray<Group<TopKey>> = [
  {
    title: "Land, ice and lines",
    fields: [
      ["landMaxSum", "Land below R+G+B"],
      ["lineWidth", "Border line width (px)"],
      ["iceMinChannel", "Ice above darkest channel"],
    ],
  },
  {
    title: "Colour matching",
    fields: [
      ["climateTolerance", "Climate tolerance (ΔE)"],
      ["elevationTolerance", "Elevation tolerance (ΔE)"],
      ["elevationSmoothing", "Elevation mode-filter passes"],
    ],
  },
  {
    title: "Outlines",
    fields: [
      ["simplify", "Simplify (px²)"],
      ["smooth", "Smoothing rounds"],
      ["smoothMaxCut", "Largest corner cut (px)"],
      ["smoothPrune", "Prune after smoothing (px²)"],
    ],
  },
];

const REGION_FIELDS: Group<keyof LayerEngineOptions["minRegionPixels"]> = {
  title: "Smallest regions (px)",
  fields: [
    ["land", "Lakes"],
    ["climate", "Climate zones"],
    ["icecaps", "Ice caps"],
    ["elevation", "Elevation bands"],
  ],
};

const RIVER_FIELDS: Group<keyof LayerEngineOptions["rivers"]> = {
  title: "Rivers",
  fields: [
    ["tolerance", "Colour tolerance (RGB)"],
    ["coastMargin", "Coast margin (px)"],
    ["minLength", "Shortest river (px)"],
    ["spurLength", "Longest spur (px)"],
    ["simplify", "Simplify (px)"],
    ["smooth", "Smoothing rounds"],
    ["maxCut", "Largest corner cut (px)"],
  ],
};

/** A nested group with one field set; dropped when every field is back at its default. */
function withNested<T extends Record<string, number>>(
  defaults: T,
  current: T | undefined,
  key: keyof T,
  value: number | undefined
): T | undefined {
  const next = { ...defaults, ...current, [key]: value ?? defaults[key] };
  return Object.keys(defaults).every((k) => next[k] === defaults[k]) ? undefined : next;
}

/** A nested group's fields that differ from the defaults (the others show as placeholders). */
function nonDefault<T extends Record<string, number>>(
  values: T | undefined,
  defaults: T
): Partial<T> | undefined {
  if (!values) return undefined;
  return Object.fromEntries(
    Object.entries(values).filter(([k, v]) => v !== defaults[k])
  ) as Partial<T>;
}

function withoutEmpty(engine: EngineOverrides): EngineOverrides | undefined {
  const kept = Object.fromEntries(Object.entries(engine).filter(([, v]) => v !== undefined));
  return Object.keys(kept).length > 0 ? (kept as EngineOverrides) : undefined;
}

function GroupFields<K extends string>({
  group,
  values,
  defaults,
  errorPath,
  errors,
  onChange,
}: {
  group: Group<K>;
  values: Partial<Record<K, number>> | undefined;
  defaults: Record<K, number>;
  errorPath: string;
  errors: DraftErrors;
  onChange: (key: K, value: number | undefined) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-label text-subhead mb-2 font-medium">{group.title}</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {group.fields.map(([key, label]) => {
          const id = `engine-${errorPath}${key}`.replace(/\./g, "-");
          const error = errors[`physical.engine.${errorPath}${key}`];
          return (
            <div key={key} className="flex flex-col gap-1">
              <label htmlFor={id} className="text-label-secondary text-footnote">
                {label}
              </label>
              <NumberInput
                id={id}
                optional
                placeholder={String(defaults[key])}
                value={values?.[key]}
                onChange={(value) => onChange(key, value)}
                {...invalidProps(id, error)}
              />
              <FieldError id={id} error={error} />
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The layer engine's settings that differ from its defaults: an empty field keeps the default (shown as its
 * placeholder).
 */
export function EngineSettings({
  engine,
  errors,
  onChange,
}: {
  engine: EngineOverrides | undefined;
  errors: DraftErrors;
  onChange: (engine: EngineOverrides | undefined) => void;
}) {
  const current = engine ?? {};
  const setTop = (key: TopKey, value: number | undefined) =>
    onChange(withoutEmpty({ ...current, [key]: value }));
  return (
    <div className="flex flex-col gap-4">
      {TOP_GROUPS.map((group) => (
        <GroupFields
          key={group.title}
          group={group}
          values={current}
          defaults={DEFAULTS}
          errorPath=""
          errors={errors}
          onChange={setTop}
        />
      ))}
      <GroupFields
        group={REGION_FIELDS}
        values={nonDefault(current.minRegionPixels, DEFAULTS.minRegionPixels)}
        defaults={DEFAULTS.minRegionPixels}
        errorPath="minRegionPixels."
        errors={errors}
        onChange={(key, value) =>
          onChange(
            withoutEmpty({
              ...current,
              minRegionPixels: withNested(
                DEFAULTS.minRegionPixels,
                current.minRegionPixels,
                key,
                value
              ),
            })
          )
        }
      />
      <GroupFields
        group={RIVER_FIELDS}
        values={nonDefault(current.rivers, DEFAULTS.rivers)}
        defaults={DEFAULTS.rivers}
        errorPath="rivers."
        errors={errors}
        onChange={(key, value) =>
          onChange(
            withoutEmpty({
              ...current,
              rivers: withNested(DEFAULTS.rivers, current.rivers, key, value),
            })
          )
        }
      />
    </div>
  );
}
