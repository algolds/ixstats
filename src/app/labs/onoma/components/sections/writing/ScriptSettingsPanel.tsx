// src/app/labs/onoma/components/sections/writing/ScriptSettingsPanel.tsx
// Onoma Lab — Script Directory & Typology Settings Panel
// Philosophy: Apple Settings × Emil Design Engineering

import React from "react";
import {
  DesignPencil as Feather,
  Trash as Trash2,
  FloppyDisk as Save,
  Plus,
  Compass,
  Check,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import type { ScriptTypology, ScriptDirection, Glyph } from "./types";
import { Input } from "~/components/ui/input";
import { FacetCard } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";

interface ScriptSettingsPanelProps {
  systems: any[] | undefined;
  listLoading: boolean;
  selectedSystemId: string | null;
  onSelectSystem: (id: string | null) => void;
  systemName: string;
  onSystemNameChange: (name: string) => void;
  scriptType: ScriptTypology;
  onScriptTypeChange: (type: ScriptTypology) => void;
  direction: ScriptDirection;
  onDirectionChange: (dir: ScriptDirection) => void;
  glyphSize: number;
  onGlyphSizeChange: (size: number) => void;
  baselineOffset: number;
  onBaselineOffsetChange: (offset: number) => void;
  glyphs: Glyph[];
  onSaveSystem: () => void;
  onDeleteSystem: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}

const TYPOLOGY_OPTIONS: Array<{ value: ScriptTypology; label: string; desc: string }> = [
  { value: "alphabet", label: "Alphabet", desc: "Consonants & vowels" },
  { value: "syllabary", label: "Syllabary", desc: "Syllable units (CV)" },
  { value: "abjad", label: "Abjad", desc: "Consonant-only roots" },
  { value: "logographic", label: "Logograph", desc: "Semantic symbols" },
];

export function ScriptSettingsPanel({
  systems,
  listLoading,
  selectedSystemId,
  onSelectSystem,
  systemName,
  onSystemNameChange,
  scriptType,
  onScriptTypeChange,
  direction,
  onDirectionChange,
  onSaveSystem,
  onDeleteSystem,
  isSaving,
  isDeleting,
}: ScriptSettingsPanelProps) {
  return (
    <div className="space-y-4">
      {/* Script Directory */}
      <FacetCard variant="inset" padding="none" className="space-y-3 p-4">
        <div className="border-separator flex items-center justify-between border-b pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="bg-tint/10 text-tint rounded-row flex h-7 w-7 items-center justify-center">
              <Feather className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-label text-subhead">Script Directory</h3>
              <p className="text-label-secondary text-caption">Active & saved conlang scripts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectSystem(null)}
            className="hover:border-tint/40 hover:bg-tint/10 border-separator bg-fill-4 text-tint rounded-row text-caption flex cursor-pointer items-center gap-1.5 border px-2.5 py-1 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.97]"
          >
            <Plus className="h-3 w-3" />
            <span>New Script</span>
          </button>
        </div>

        {listLoading ? (
          <div className="text-label-secondary text-footnote py-2">Loading scripts...</div>
        ) : !systems || systems.length === 0 ? (
          <div className="text-label-secondary text-footnote py-2 italic">
            No writing systems saved yet. Create your first script below!
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {systems.map((s: any) => {
              const isSelected = selectedSystemId === s.id;
              const glyphCount = Array.isArray(s.glyphs) ? s.glyphs.length : 0;

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectSystem(s.id)}
                  className={cn(
                    "rounded-row text-footnote flex cursor-pointer items-center justify-between border px-3 py-2 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]",
                    isSelected
                      ? "border-tint/50 bg-tint/10 text-tint shadow-card font-semibold"
                      : "border-separator bg-surface hover:bg-fill-4 text-label"
                  )}
                >
                  <span className="truncate font-medium">{s.name}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-label-secondary bg-fill-3 rounded-control-sm text-caption px-1.5 py-0.5 font-mono capitalize">
                      {s.scriptType}
                    </span>
                    <span className="text-label-secondary bg-fill-3 rounded-control-sm text-caption px-1.5 py-0.5 font-mono">
                      {glyphCount} glyphs
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </FacetCard>

      {/* Script Typology & Configuration Form */}
      <FacetCard variant="inset" padding="none" className="space-y-4 p-4">
        <div className="border-separator flex items-center justify-between border-b pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="bg-fill-3 text-label rounded-row flex h-7 w-7 items-center justify-center">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-label text-subhead">Script Settings</h4>
              <p className="text-label-secondary text-caption">
                Typological model & reading direction
              </p>
            </div>
          </div>

          {selectedSystemId && (
            <button
              type="button"
              onClick={onDeleteSystem}
              disabled={isDeleting}
              className="text-label-secondary rounded-control text-caption hover:bg-red/10 hover:text-red flex cursor-pointer items-center gap-1 px-2 py-1 font-semibold transition-colors active:scale-[0.97]"
            >
              <Trash2 className="h-3 w-3" />
              <span>Delete</span>
            </button>
          )}
        </div>

        <div className="space-y-3.5">
          {/* Script Name */}
          <div>
            <label className="text-label-secondary text-subhead mb-1 block">Script Name</label>
            <Input
              type="text"
              required
              value={systemName}
              onChange={(e) => onSystemNameChange(e.target.value)}
              placeholder="e.g. High Elvish Tengwar, Eldritch Runes"
              className="text-footnote w-full font-medium"
            />
          </div>

          {/* Typology Segmented Cards */}
          <div>
            <label className="text-label-secondary text-subhead mb-1.5 block">
              Typological Model
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {TYPOLOGY_OPTIONS.map((opt) => {
                const isSelected = scriptType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onScriptTypeChange(opt.value)}
                    className={cn(
                      "rounded-row flex cursor-pointer flex-col border p-2.5 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.97]",
                      isSelected
                        ? "border-tint/60 bg-tint/10 text-label shadow-card font-semibold"
                        : "border-separator bg-surface hover:bg-fill-4 text-label-secondary"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-label text-footnote font-semibold">{opt.label}</span>
                      {isSelected && <Check className="text-tint h-3 w-3" />}
                    </div>
                    <span className="text-caption mt-0.5 opacity-75">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Direction Segmented Control */}
          <div>
            <label className="text-label-secondary text-subhead mb-1.5 block">
              Writing Direction
            </label>
            <div className="border-separator bg-fill-4 rounded-row grid grid-cols-3 gap-1 border p-1">
              <button
                type="button"
                onClick={() => onDirectionChange("ltr")}
                className={cn(
                  "rounded-control text-caption cursor-pointer py-1.5 text-center font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.97]",
                  direction === "ltr"
                    ? "bg-background text-label shadow-card font-semibold"
                    : "text-label-secondary hover:text-label"
                )}
              >
                Left → Right
              </button>
              <button
                type="button"
                onClick={() => onDirectionChange("rtl")}
                className={cn(
                  "rounded-control text-caption cursor-pointer py-1.5 text-center font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.97]",
                  direction === "rtl"
                    ? "bg-background text-label shadow-card font-semibold"
                    : "text-label-secondary hover:text-label"
                )}
              >
                Right → Left
              </button>
              <button
                type="button"
                onClick={() => onDirectionChange("ttb")}
                className={cn(
                  "rounded-control text-caption cursor-pointer py-1.5 text-center font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.97]",
                  direction === "ttb"
                    ? "bg-background text-label shadow-card font-semibold"
                    : "text-label-secondary hover:text-label"
                )}
              >
                Top → Bottom
              </button>
            </div>
          </div>

          {/* Save Script System Action */}
          <Button
            size="sm"
            type="button"
            onClick={onSaveSystem}
            disabled={isSaving || !systemName.trim()}
            className="w-full justify-center"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Saving System..." : "Save Writing System"}</span>
          </Button>
        </div>
      </FacetCard>
    </div>
  );
}
