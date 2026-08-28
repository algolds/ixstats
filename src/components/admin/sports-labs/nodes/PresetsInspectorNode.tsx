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
        <div className="space-y-1.5">
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

        <Card className="facet-hierarchy-child border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Trophy className="h-4 w-4 text-amber-500" />
              Preset Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="border-border/40 grid grid-cols-2 gap-2 border-b pb-2">
              <div>
                <span className="text-muted-foreground">Archetype</span>
                <p className="font-semibold capitalize">{activePreset.archetype}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Roster Size</span>
                <p className="font-semibold">{activePreset.rosterSize}</p>
              </div>
            </div>
            <div className="border-border/40 grid grid-cols-2 gap-2 border-b pb-2">
              <div>
                <span className="text-muted-foreground">Team Range</span>
                <p className="font-semibold">
                  {activePreset.minTeamCount} - {activePreset.maxTeamCount}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Federation</span>
                <p className="truncate font-semibold" title={activePreset.federationName}>
                  {activePreset.federationShort}
                </p>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Rating Vectors</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {activePreset.ratingVector.map((v) => (
                  <Badge key={v} variant="secondary" className="text-[10px]">
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
      <h4 className="text-sm font-semibold">Database Presets list</h4>
      <div className="thin-scrollbar max-h-[400px] space-y-2 overflow-y-auto">
        {presetList.map((p) => (
          <div
            key={p.key}
            className="bg-muted/20 flex items-center justify-between rounded-lg border p-3 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{p.icon}</span>
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-muted-foreground text-[10px] capitalize">
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
