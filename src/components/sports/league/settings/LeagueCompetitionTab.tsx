import React from "react";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface LeagueCompetitionTabProps {
  status: string;
  setStatus: (v: string) => void;
  tier: number;
  setTier: (v: number) => void;
  promotionCount: number;
  setPromotionCount: (v: number) => void;
  relegationCount: number;
  setRelegationCount: (v: number) => void;
  isDivisionConference: boolean;
  divisions: number;
  setDivisions: (v: number) => void;
  isCircuit: boolean;
  raceCount: number;
  setRaceCount: (v: number) => void;
  isBoxing: boolean;
  weightClassesRaw: string;
  setWeightClassesRaw: (v: string) => void;
}

export const LeagueCompetitionTab = React.memo(function LeagueCompetitionTab({
  status,
  setStatus,
  tier,
  setTier,
  promotionCount,
  setPromotionCount,
  relegationCount,
  setRelegationCount,
  isDivisionConference,
  divisions,
  setDivisions,
  isCircuit,
  raceCount,
  setRaceCount,
  isBoxing,
  weightClassesRaw,
  setWeightClassesRaw,
}: LeagueCompetitionTabProps) {
  return (
    <div className="space-y-4 py-3">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="league-status">League Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="league-status" className="text-footnote h-9">
              <SelectValue placeholder="Select status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="league-tier">League Tier</Label>
          <Input
            id="league-tier"
            type="number"
            min={1}
            value={tier}
            onChange={(e) => setTier(Math.max(1, Number(e.target.value) || 1))}
            className="text-footnote h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="promotion-count">Promotion Count</Label>
          <Input
            id="promotion-count"
            type="number"
            min={0}
            value={promotionCount}
            onChange={(e) => setPromotionCount(Math.max(0, Number(e.target.value) || 0))}
            className="text-footnote h-9"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="relegation-count">Relegation Count</Label>
          <Input
            id="relegation-count"
            type="number"
            min={0}
            value={relegationCount}
            onChange={(e) => setRelegationCount(Math.max(0, Number(e.target.value) || 0))}
            className="text-footnote h-9"
          />
        </div>
      </div>

      {/* Archetype Specific Settings */}
      {isDivisionConference && (
        <div className="border-separator space-y-2 border-t pt-3">
          <Label htmlFor="divisions-count">Divisions Count</Label>
          <Input
            id="divisions-count"
            type="number"
            min={1}
            value={divisions}
            onChange={(e) => setDivisions(Math.max(1, Number(e.target.value) || 1))}
            className="text-footnote h-9"
          />
          <p className="text-label-secondary text-footnote">
            Configures the number of divisions within the league's conference.
          </p>
        </div>
      )}

      {isCircuit && (
        <div className="border-separator space-y-2 border-t pt-3">
          <Label htmlFor="race-count">Race Count</Label>
          <Input
            id="race-count"
            type="number"
            min={1}
            value={raceCount}
            onChange={(e) => setRaceCount(Math.max(1, Number(e.target.value) || 1))}
            className="text-footnote h-9"
          />
          <p className="text-label-secondary text-footnote">
            Configures the number of races run in a season.
          </p>
        </div>
      )}

      {isBoxing && (
        <div className="border-separator space-y-2 border-t pt-3">
          <Label htmlFor="weight-classes">Weight Classes (Comma Separated)</Label>
          <Input
            id="weight-classes"
            value={weightClassesRaw}
            onChange={(e) => setWeightClassesRaw(e.target.value)}
            placeholder="Heavyweight, Middleweight, Welterweight..."
            className="text-footnote h-9"
          />
          <p className="text-label-secondary text-footnote">
            Comma-separated list of weight divisions.
          </p>
        </div>
      )}
    </div>
  );
});
