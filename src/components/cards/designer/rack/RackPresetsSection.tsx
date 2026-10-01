import React, { useState } from "react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { FloppyDisk as Save, Trash as Trash2 } from "iconoir-react";
import type { CardDesignPreset } from "../types";

interface RackPresetsSectionProps {
  presets: CardDesignPreset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (preset: CardDesignPreset) => void;
  onDeletePreset: (id: string) => void;
}

export const RackPresetsSection = React.memo(function RackPresetsSection({
  presets,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
}: RackPresetsSectionProps) {
  const [presetNameInput, setPresetNameInput] = useState("");

  return (
    <div className="space-y-3">
      {/* Save New Preset */}
      <div className="flex gap-2">
        <Input
          value={presetNameInput}
          onChange={(e) => setPresetNameInput(e.target.value)}
          placeholder="Preset Name..."
          className="text-footnote h-8"
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={!presetNameInput.trim()}
          onClick={() => {
            onSavePreset(presetNameInput.trim());
            setPresetNameInput("");
          }}
          className="text-footnote h-8 shrink-0 gap-1"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </Button>
      </div>

      {/* Preset List */}
      {presets.length > 0 ? (
        <div className="max-h-40 space-y-2 overflow-y-auto pt-1">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="border-separator bg-fill-4 hover:bg-fill-3 rounded-control flex items-center justify-between border p-2 transition-colors"
            >
              <span className="text-label text-footnote truncate font-medium">{preset.name}</span>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onLoadPreset(preset)}
                  className="text-tint text-footnote h-6 px-2"
                >
                  Load
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeletePreset(preset.id)}
                  className="text-label-secondary hover:text-destructive text-footnote h-6 px-2"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-label-secondary text-footnote py-1 italic">
          No saved presets yet. Type a name and save your layout!
        </div>
      )}
    </div>
  );
});
