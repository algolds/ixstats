"use client";

import React from "react";

export interface GenParams {
  seed: number;
  continentCount: number;
  countryMin: number;
  countryMax: number;
  oceanPercentage: number;
  terrainRoughness: number;
  hasIcecaps: boolean;
  hasRivers: boolean;
  hasLakes: boolean;
  gridResolution: number;
  similarity: number;
  profileName: string;
}

interface GenerationParamsFormProps {
  params: GenParams;
  onChange: (params: GenParams) => void;
  disabled?: boolean;
}

const PRESETS: Record<string, Partial<GenParams>> = {
  IxWorld: {
    continentCount: 6,
    countryMin: 160,
    countryMax: 200,
    oceanPercentage: 0.65,
    terrainRoughness: 0.5,
    hasIcecaps: true,
    hasRivers: true,
    hasLakes: true,
    gridResolution: 384,
    similarity: 0.8,
    profileName: "IxWorld",
  },
  "Earth-like": {
    continentCount: 6,
    countryMin: 40,
    countryMax: 80,
    oceanPercentage: 0.7,
    terrainRoughness: 0.5,
    hasIcecaps: true,
    hasRivers: true,
    hasLakes: true,
    similarity: 0.5,
    profileName: "IxWorld",
  },
  Pangaea: {
    continentCount: 1,
    countryMin: 15,
    countryMax: 40,
    oceanPercentage: 0.6,
    terrainRoughness: 0.6,
    hasIcecaps: true,
    hasRivers: true,
    hasLakes: true,
    similarity: 0.3,
  },
  Archipelago: {
    continentCount: 8,
    countryMin: 30,
    countryMax: 80,
    oceanPercentage: 0.8,
    terrainRoughness: 0.3,
    hasIcecaps: false,
    hasRivers: false,
    hasLakes: true,
    similarity: 0.3,
  },
  Desert: {
    continentCount: 3,
    countryMin: 10,
    countryMax: 30,
    oceanPercentage: 0.5,
    terrainRoughness: 0.7,
    hasIcecaps: false,
    hasRivers: false,
    hasLakes: false,
    similarity: 0.2,
  },
  Waterworld: {
    continentCount: 5,
    countryMin: 20,
    countryMax: 50,
    oceanPercentage: 0.85,
    terrainRoughness: 0.3,
    hasIcecaps: true,
    hasRivers: true,
    hasLakes: true,
    similarity: 0.3,
  },
};

export const GenerationParamsForm = React.memo(function GenerationParamsForm({
  params,
  onChange,
  disabled,
}: GenerationParamsFormProps) {
  const set = <K extends keyof GenParams>(key: K, value: GenParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Presets</label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(PRESETS).map(([name, preset]) => (
            <button
              key={name}
              onClick={() => onChange({ ...params, ...preset })}
              disabled={disabled}
              className="rounded border border-border bg-muted/30 px-2.5 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-40"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Profile Similarity */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Profile Similarity
          </label>
          <span className="text-xs text-muted-foreground">
            {Math.round(params.similarity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={params.similarity}
          onChange={(e) => set("similarity", parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full"
        />
        <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground/50">
          <span>Random</span>
          <span>IxWorld-like</span>
        </div>
      </div>

      {/* Seed */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Seed
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={params.seed}
            onChange={(e) => set("seed", parseInt(e.target.value) || 0)}
            disabled={disabled}
            className="w-full rounded border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground focus:border-blue-500/50 focus:outline-none disabled:opacity-40"
          />
          <button
            onClick={() => set("seed", Math.floor(Math.random() * 999999))}
            disabled={disabled}
            className="rounded border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-40"
          >
            Random
          </button>
        </div>
      </div>

      {/* Continents */}
      <SliderField
        label="Continents"
        value={params.continentCount}
        min={1}
        max={8}
        step={1}
        onChange={(v) => set("continentCount", v)}
        disabled={disabled}
        display={`${params.continentCount}`}
      />

      {/* Country Range */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Country Count: {params.countryMin} – {params.countryMax}
        </label>
        <div className="flex gap-2">
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={params.countryMin}
            onChange={(e) => set("countryMin", parseInt(e.target.value))}
            disabled={disabled}
            className="flex-1"
          />
          <input
            type="range"
            min={10}
            max={200}
            step={5}
            value={params.countryMax}
            onChange={(e) => set("countryMax", parseInt(e.target.value))}
            disabled={disabled}
            className="flex-1"
          />
        </div>
      </div>

      {/* Ocean Percentage */}
      <SliderField
        label="Ocean Coverage"
        value={params.oceanPercentage}
        min={0.2}
        max={0.95}
        step={0.05}
        onChange={(v) => set("oceanPercentage", v)}
        disabled={disabled}
        display={`${Math.round(params.oceanPercentage * 100)}%`}
      />

      {/* Terrain Roughness */}
      <SliderField
        label="Terrain Roughness"
        value={params.terrainRoughness}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => set("terrainRoughness", v)}
        disabled={disabled}
        display={`${Math.round(params.terrainRoughness * 100)}%`}
      />

      {/* Grid Resolution */}
      <SliderField
        label="Grid Resolution"
        value={params.gridResolution}
        min={128}
        max={512}
        step={64}
        onChange={(v) => set("gridResolution", v)}
        disabled={disabled}
        display={`${params.gridResolution}px`}
      />

      {/* Toggles */}
      <div className="flex flex-wrap gap-3">
        <ToggleField
          label="Icecaps"
          checked={params.hasIcecaps}
          onChange={(v) => set("hasIcecaps", v)}
          disabled={disabled}
        />
        <ToggleField
          label="Rivers"
          checked={params.hasRivers}
          onChange={(v) => set("hasRivers", v)}
          disabled={disabled}
        />
        <ToggleField
          label="Lakes"
          checked={params.hasLakes}
          onChange={(v) => set("hasLakes", v)}
          disabled={disabled}
        />
      </div>
    </div>
  );
});

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  display: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <span className="text-xs text-muted-foreground">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-full"
      />
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="rounded border-border"
      />
      {label}
    </label>
  );
}
