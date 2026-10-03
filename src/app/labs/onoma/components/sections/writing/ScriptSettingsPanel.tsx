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
} from "iconoir-react";
import type { ScriptTypology, ScriptDirection, Glyph } from "./types";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Card } from "~/components/ui/card";

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
      <Card variant="inset" padding="none" className="space-y-3 p-4">
        <div className="border-separator flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <div className="bg-tint/10 text-tint rounded-row flex h-7 w-7 items-center justify-center">
              <Feather className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-label text-subhead">Script directory</h3>
              <p className="text-label-secondary text-caption">Active & saved conlang scripts</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onSelectSystem(null)}>
            <Plus className="h-3 w-3" />
            <span>New script</span>
          </Button>
        </div>

        {listLoading ? (
          <div className="text-label-secondary text-footnote py-2">Loading scripts...</div>
        ) : !systems || systems.length === 0 ? (
          <div className="text-label-secondary text-footnote py-2 italic">
            No writing systems saved yet. Create your first script below!
          </div>
        ) : (
          <FacetListSection variant="plain" aria-label="Script systems">
            {systems.map((s: any) => {
              const glyphCount = Array.isArray(s.glyphs) ? s.glyphs.length : 0;
              return (
                <FacetRow
                  key={s.id}
                  onClick={() => onSelectSystem(s.id)}
                  selected={selectedSystemId === s.id}
                  selectionStyle="tint"
                  title={<span className="text-footnote truncate">{s.name}</span>}
                  trailing={
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant="default" className="font-mono capitalize">
                        {s.scriptType}
                      </Badge>
                      <Badge variant="default" className="font-mono">
                        {glyphCount} glyphs
                      </Badge>
                    </span>
                  }
                />
              );
            })}
          </FacetListSection>
        )}
      </Card>

      {/* Script Typology & Configuration Form */}
      <Card variant="inset" padding="none" className="space-y-4 p-4">
        <div className="border-separator flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <div className="bg-fill-3 text-label rounded-row flex h-7 w-7 items-center justify-center">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-label text-subhead">Script settings</h4>
              <p className="text-label-secondary text-caption">
                Typological model & reading direction
              </p>
            </div>
          </div>

          {selectedSystemId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeleteSystem}
              disabled={isDeleting}
              className="text-label-secondary hover:text-red text-label-secondary hover:text-red hover:bg-red/10"
            >
              <Trash2 className="h-3 w-3" />
              <span>Delete</span>
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {/* Script Name */}
          <div>
            <label className="text-label-secondary text-subhead mb-1 block">Script name</label>
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
            <label
              id="script-typology-label"
              className="text-label-secondary text-subhead mb-2 block"
            >
              Typological model
            </label>
            <RadioCardGroup
              aria-labelledby="script-typology-label"
              columns={2}
              value={scriptType}
              onValueChange={(v) => onScriptTypeChange(v as ScriptTypology)}
              className="gap-2"
            >
              {TYPOLOGY_OPTIONS.map((opt) => (
                <RadioCard
                  key={opt.value}
                  value={opt.value}
                  title={opt.label}
                  description={opt.desc}
                />
              ))}
            </RadioCardGroup>
          </div>

          {/* Direction Segmented Control */}
          <div>
            <label
              id="script-direction-label"
              className="text-label-secondary text-subhead mb-2 block"
            >
              Writing direction
            </label>
            <SegmentedControl
              size="sm"
              fullWidth
              aria-labelledby="script-direction-label"
              value={direction}
              onValueChange={onDirectionChange}
              options={[
                { value: "ltr", label: "Left → Right" },
                { value: "rtl", label: "Right → Left" },
                { value: "ttb", label: "Top → Bottom" },
              ]}
            />
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
      </Card>
    </div>
  );
}
