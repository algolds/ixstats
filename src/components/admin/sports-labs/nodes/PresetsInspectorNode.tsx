import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { Trophy } from "iconoir-react";
import { getAllPresets, getPreset, type SportPresetKey } from "~/lib/sports";

interface PresetsInspectorNodeProps {
  isSandbox: boolean;
  selectedSport: SportPresetKey;
  setSelectedSport: (sport: SportPresetKey) => void;
}

export const PresetsInspectorNode = React.memo(function PresetsInspectorNode({
  isSandbox,
  selectedSport,
  setSelectedSport,
}: PresetsInspectorNodeProps) {
  const presetList = getAllPresets();
  const activePreset = getPreset(selectedSport);

  if (isSandbox) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Select Sport Preset</Label>
          <Select
            value={selectedSport}
            onValueChange={(v) => setSelectedSport(v as SportPresetKey)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select sport" />
            </SelectTrigger>
            <SelectContent>
              {presetList.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.icon} {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="flex flex-col gap-6 py-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-headline flex items-center gap-2">
              <Trophy className="text-yellow h-4 w-4" />
              Preset Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="text-footnote space-y-3">
            <div className="border-separator grid grid-cols-2 gap-2 border-b pb-2">
              <div>
                <span className="text-label-secondary">Archetype</span>
                <p className="font-semibold capitalize">{activePreset.archetype}</p>
              </div>
              <div>
                <span className="text-label-secondary">Roster Size</span>
                <p className="font-semibold">{activePreset.rosterSize}</p>
              </div>
            </div>
            <div className="border-separator grid grid-cols-2 gap-2 border-b pb-2">
              <div>
                <span className="text-label-secondary">Team Range</span>
                <p className="font-semibold">
                  {activePreset.minTeamCount} - {activePreset.maxTeamCount}
                </p>
              </div>
              <div>
                <span className="text-label-secondary">Federation</span>
                <p className="truncate font-semibold" title={activePreset.federationName}>
                  {activePreset.federationShort}
                </p>
              </div>
            </div>
            <div>
              <span className="text-label-secondary">Rating Vectors</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {activePreset.ratingVector.map((v) => (
                  <Badge key={v} variant="secondary">
                    {v}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // DB Mode
  return (
    <div className="space-y-4">
      <h4 className="text-headline">Database Presets list</h4>
      <div className="thin-scrollbar max-h-[400px] space-y-2 overflow-y-auto">
        {presetList.map((p) => (
          <div
            key={p.key}
            className="bg-fill-4 rounded-control text-footnote flex items-center justify-between border p-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-title-1">{p.icon}</span>
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-label-secondary text-footnote capitalize">
                  {p.archetype} &middot; {p.federationShort}
                </p>
              </div>
            </div>
            <Badge variant="outline">{p.rosterSize} slots</Badge>
          </div>
        ))}
      </div>
    </div>
  );
});
