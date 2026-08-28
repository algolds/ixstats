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
          className="h-8 text-xs"
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={!presetNameInput.trim()}
          onClick={() => {
            onSavePreset(presetNameInput.trim());
            setPresetNameInput("");
          }}
          className="h-8 shrink-0 gap-1 text-xs"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </Button>
      </div>

      {/* Preset List */}
      {presets.length > 0 ? (
        <div className="max-h-40 space-y-1.5 overflow-y-auto pt-1">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="border-border bg-muted/20 hover:bg-muted/50 flex items-center justify-between rounded-lg border p-2 transition-colors"
            >
              <span className="text-foreground truncate text-xs font-medium">{preset.name}</span>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onLoadPreset(preset)}
                  className="text-primary h-6 px-2 text-[10px]"
                >
                  Load
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeletePreset(preset.id)}
                  className="text-muted-foreground hover:text-destructive h-6 px-1.5 text-[10px]"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground py-1 text-xs italic">
          No saved presets yet. Type a name and save your layout!
        </div>
      )}
    </div>
  );
});
