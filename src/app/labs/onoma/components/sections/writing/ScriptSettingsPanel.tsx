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
import { FacetMaterial } from "~/components/ui/facet";
import { cn } from "~/lib/utils";
import type { ScriptTypology, ScriptDirection, Glyph } from "./types";

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
      <FacetMaterial
        material="satin"
        className="border-border/30 space-y-3 rounded-2xl border p-4 shadow-sm"
      >
        <div className="border-border/40 flex items-center justify-between border-b pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="bg-onoma-primary/10 text-onoma-primary dark:bg-onoma-primary/15 flex h-7 w-7 items-center justify-center rounded-xl">
              <Feather className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-foreground text-xs font-bold tracking-wider uppercase">
                Script Directory
              </h3>
              <p className="text-muted-foreground text-[10px]">Active & saved conlang scripts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectSystem(null)}
            className="hover:border-onoma-primary/40 hover:bg-onoma-primary/10 border-border/40 bg-secondary/20 text-onoma-primary flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[10px] font-bold transition-all active:scale-[0.97]"
          >
            <Plus className="h-3 w-3" />
            <span>New Script</span>
          </button>
        </div>

        {listLoading ? (
          <div className="text-muted-foreground py-2 text-xs">Loading scripts...</div>
        ) : !systems || systems.length === 0 ? (
          <div className="text-muted-foreground py-2 text-xs italic">
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
                    "flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition-all active:scale-[0.98]",
                    isSelected
                      ? "border-onoma-primary/50 bg-onoma-primary/10 text-onoma-primary font-semibold shadow-xs"
                      : "border-border/30 bg-background/50 hover:bg-secondary/20 text-foreground"
                  )}
                >
                  <span className="truncate font-medium">{s.name}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-muted-foreground bg-secondary/40 rounded px-1.5 py-0.5 font-mono text-[9px] capitalize">
                      {s.scriptType}
                    </span>
                    <span className="text-muted-foreground bg-secondary/40 rounded px-1.5 py-0.5 font-mono text-[9px]">
                      {glyphCount} glyphs
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </FacetMaterial>

      {/* Script Typology & Configuration Form */}
      <FacetMaterial
        material="satin"
        className="border-border/30 space-y-4 rounded-2xl border p-4 shadow-sm"
      >
        <div className="border-border/40 flex items-center justify-between border-b pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="bg-secondary/40 text-foreground flex h-7 w-7 items-center justify-center rounded-xl">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
                Script Settings
              </h4>
              <p className="text-muted-foreground text-[10px]">
                Typological model & reading direction
              </p>
            </div>
          </div>

          {selectedSystemId && (
            <button
              type="button"
              onClick={onDeleteSystem}
              disabled={isDeleting}
              className="text-muted-foreground flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-red-500/10 hover:text-red-400 active:scale-[0.97]"
            >
              <Trash2 className="h-3 w-3" />
              <span>Delete</span>
            </button>
          )}
        </div>

        <div className="space-y-3.5">
          {/* Script Name */}
          <div>
            <label className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-wider uppercase">
              Script Name
            </label>
            <input
              type="text"
              required
              value={systemName}
              onChange={(e) => onSystemNameChange(e.target.value)}
              placeholder="e.g. High Elvish Tengwar, Eldritch Runes"
              className="bg-background/80 border-border/40 text-foreground placeholder:text-muted-foreground/60 focus:border-onoma-primary/60 focus:ring-onoma-primary/20 w-full rounded-xl border px-3.5 py-2 text-xs font-medium transition-all outline-none focus:ring-2"
            />
          </div>

          {/* Typology Segmented Cards */}
          <div>
            <label className="text-muted-foreground mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
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
                      "flex cursor-pointer flex-col rounded-xl border p-2.5 text-left transition-all active:scale-[0.97]",
                      isSelected
                        ? "border-onoma-primary/60 bg-onoma-primary/10 text-foreground font-semibold shadow-xs"
                        : "border-border/30 bg-background/50 hover:bg-secondary/20 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-foreground text-xs font-bold">{opt.label}</span>
                      {isSelected && <Check className="text-onoma-primary h-3 w-3" />}
                    </div>
                    <span className="mt-0.5 text-[9px] opacity-75">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Direction Segmented Control */}
          <div>
            <label className="text-muted-foreground mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
              Writing Direction
            </label>
            <div className="border-border/40 bg-secondary/20 grid grid-cols-3 gap-1 rounded-xl border p-1">
              <button
                type="button"
                onClick={() => onDirectionChange("ltr")}
                className={cn(
                  "cursor-pointer rounded-lg py-1.5 text-center text-[10px] font-semibold transition-all active:scale-[0.97]",
                  direction === "ltr"
                    ? "bg-background text-foreground font-bold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Left → Right
              </button>
              <button
                type="button"
                onClick={() => onDirectionChange("rtl")}
                className={cn(
                  "cursor-pointer rounded-lg py-1.5 text-center text-[10px] font-semibold transition-all active:scale-[0.97]",
                  direction === "rtl"
                    ? "bg-background text-foreground font-bold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Right → Left
              </button>
              <button
                type="button"
                onClick={() => onDirectionChange("ttb")}
                className={cn(
                  "cursor-pointer rounded-lg py-1.5 text-center text-[10px] font-semibold transition-all active:scale-[0.97]",
                  direction === "ttb"
                    ? "bg-background text-foreground font-bold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Top → Bottom
              </button>
            </div>
          </div>

          {/* Save Script System Action */}
          <button
            type="button"
            onClick={onSaveSystem}
            disabled={isSaving || !systemName.trim()}
            className="bg-onoma-primary hover:bg-onoma-primary-hover flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-white shadow-xs transition-all active:scale-[0.97] disabled:opacity-40"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Saving System..." : "Save Writing System"}</span>
          </button>
        </div>
      </FacetMaterial>
    </div>
  );
}
