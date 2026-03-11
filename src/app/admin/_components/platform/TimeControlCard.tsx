// src/app/admin/_components/platform/TimeControlCard.tsx
"use client";

import { useState, useEffect } from "react";
import { Clock, Pause, Play, RotateCcw, Loader2, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Separator } from "~/components/ui/separator";
import { IxTime } from "~/lib/ixtime";

interface TimeControlCardProps {
  timeMultiplier: number;
  customDate: string;
  customTime: string;
  onTimeMultiplierChange: (value: number) => void;
  onCustomDateChange: (value: string) => void;
  onCustomTimeChange: (value: string) => void;
  onSetCustomTime: () => void;
  onResetToRealTime: () => void;
  setTimePending: boolean;
}

const SPEED_PRESETS = [
  { label: "Pause", value: 0, variant: "destructive" as const, icon: Pause },
  { label: "1x", value: 1, variant: "outline" as const, icon: Play },
  { label: "2x", value: 2, variant: "default" as const, icon: Play },
  { label: "4x", value: 4, variant: "outline" as const, icon: Play },
  { label: "10x", value: 10, variant: "secondary" as const, icon: Play },
];

const YEAR_JUMP_TARGETS = [2045, 2050, 2055, 2060, 2070, 2080];

export function TimeControlCard({
  timeMultiplier,
  customDate,
  customTime,
  onTimeMultiplierChange,
  onCustomDateChange,
  onCustomTimeChange,
  onSetCustomTime,
  onResetToRealTime,
  setTimePending,
}: TimeControlCardProps) {
  const [_currentIxTime, setCurrentIxTime] = useState<number>(0);
  const [formattedIxTime, setFormattedIxTime] = useState("");
  const [gameYear, setGameYear] = useState(2040);

  // Poll IxTime every second for live display
  useEffect(() => {
    const update = () => {
      const ix = IxTime.getCurrentIxTime();
      setCurrentIxTime(ix);
      setFormattedIxTime(IxTime.formatIxTime(ix));
      setGameYear(IxTime.getCurrentGameYear(ix));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const ixDaysPerRealDay = IxTime.getIxDaysPerRealDay(timeMultiplier);
  const predictedIn24h = IxTime.predictIxTimeAfterRealHours(24, timeMultiplier);
  // predictedFormatted used inline below

  const handleJumpToYear = (year: number) => {
    const ixTs = IxTime.createGameTime(year, 1, 1);
    const d = new Date(ixTs);
    onCustomDateChange(d.toISOString().split("T")[0] ?? "");
    onCustomTimeChange("00:00");
    // Auto-trigger after setting values by calling the set custom time handler
    // (user still needs to click Set IxTime to confirm)
  };

  return (
    <Card className="glass-card-parent border-blue-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-500" />
          Time Flow Control
        </CardTitle>
        <CardDescription>IxTime multiplier, time math, and custom time settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Live IxTime Display */}
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <div className="mb-1 text-xs font-medium text-blue-400">Current IxTime</div>
          <div className="font-mono text-sm font-bold text-blue-500">{formattedIxTime}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">1 real day</span> = {ixDaysPerRealDay} IX days
            </div>
            <div>
              <span className="font-medium text-foreground">In 24h:</span>{" "}
              {new Date(predictedIn24h).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} IX
            </div>
          </div>
        </div>

        {/* Time Multiplier Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Time Multiplier</Label>
            <Badge variant="outline" className="tabular-nums">{timeMultiplier}x</Badge>
          </div>
          <Slider
            value={[timeMultiplier]}
            onValueChange={([v]) => v !== undefined && onTimeMultiplierChange(v)}
            min={0}
            max={10}
            step={0.1}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Paused</span>
            <span>2x (Default)</span>
            <span>4x</span>
            <span>10x</span>
          </div>
        </div>

        {/* Speed Preset Buttons */}
        <div className="grid grid-cols-3 gap-2">
          {SPEED_PRESETS.map((preset) => {
            const Icon = preset.icon;
            return (
              <Button
                key={preset.label}
                variant={timeMultiplier === preset.value ? "default" : preset.variant}
                size="sm"
                onClick={() => onTimeMultiplierChange(preset.value)}
              >
                <Icon className="mr-1 h-3.5 w-3.5" />
                {preset.label}
              </Button>
            );
          })}
          <Button variant="outline" size="sm" onClick={onResetToRealTime}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Reset
          </Button>
        </div>

        <Separator />

        {/* Year Jump Presets */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Jump to Year</Label>
          <div className="grid grid-cols-3 gap-2">
            {YEAR_JUMP_TARGETS.map((year) => {
              const isPast = year <= gameYear;
              return (
                <Button
                  key={year}
                  variant="outline"
                  size="sm"
                  disabled={isPast}
                  onClick={() => handleJumpToYear(year)}
                  className="text-xs"
                >
                  <Calendar className="mr-1 h-3 w-3" />
                  {year}
                  {isPast && <span className="ml-1 text-muted-foreground">(past)</span>}
                </Button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Fills the date fields below with Jan 1 of the target year. Click &ldquo;Set IxTime&rdquo; to confirm.
          </p>
        </div>

        <Separator />

        {/* Custom IxTime Setting */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Set Custom IxTime</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="custom-date" className="text-xs text-muted-foreground">Date</Label>
              <Input
                id="custom-date"
                type="date"
                value={customDate}
                onChange={(e) => onCustomDateChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom-time" className="text-xs text-muted-foreground">Time</Label>
              <Input
                id="custom-time"
                type="time"
                value={customTime}
                onChange={(e) => onCustomTimeChange(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={onSetCustomTime}
            disabled={!customDate || !customTime || setTimePending}
            className="w-full"
          >
            {setTimePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {setTimePending ? "Setting..." : "Set IxTime"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
