// src/app/admin/_components/platform/TimeControlCard.tsx
// Refactored with premium glassmorphism styles and visual updates
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
import { cn } from "~/lib/utils";
import { Switch } from "~/components/ui/switch";

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
  {
    label: "Pause",
    value: 0,
    color:
      "border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10 hover:border-red-500/30",
    icon: Pause,
  },
  {
    label: "1x Speed",
    value: 1,
    color: "border-border/30 bg-muted/20 text-foreground hover:bg-muted/30",
    icon: Play,
  },
  {
    label: "2x Speed",
    value: 2,
    color:
      "border-blue-500/20 bg-blue-500/5 text-blue-500 hover:bg-blue-500/10 hover:border-blue-500/30",
    icon: Play,
  },
  {
    label: "4x Speed",
    value: 4,
    color:
      "border-indigo-500/20 bg-indigo-500/5 text-indigo-500 hover:bg-indigo-500/10 hover:border-indigo-500/30",
    icon: Play,
  },
  {
    label: "10x Speed",
    value: 10,
    color:
      "border-purple-500/20 bg-purple-500/5 text-purple-500 hover:bg-purple-500/10 hover:border-purple-500/30",
    icon: Play,
  },
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Poll IxTime every second for live display
  useEffect(() => {
    const update = () => {
      const ix = IxTime.getCurrentIxTime();
      setCurrentIxTime(ix);
      setFormattedIxTime(IxTime.formatIxTime(ix, true));
      setGameYear(IxTime.getCurrentGameYear(ix));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const ixDaysPerRealDay = IxTime.getIxDaysPerRealDay(timeMultiplier);
  const predictedIn24h = IxTime.predictIxTimeAfterRealHours(24, timeMultiplier);

  const handleJumpToYear = (year: number) => {
    const ixTs = IxTime.createGameTime(year, 1, 1);
    const d = new Date(ixTs);
    onCustomDateChange(d.toISOString().split("T")[0] ?? "");
    onCustomTimeChange("00:00");
  };

  return (
    <Card className="glass-surface border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-1.5 text-blue-500">
                <Clock className="h-4 w-4" />
              </div>
              Time Flow Controller
            </CardTitle>
            <CardDescription className="text-xs">
              Manage system simulation speed, time progression multipliers, and jump benchmarks
            </CardDescription>
          </div>
          <div className="border-border/20 bg-card/20 flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5">
            <Label
              htmlFor="time-advanced-mode"
              className="text-muted-foreground cursor-pointer text-[10px] font-bold tracking-wider uppercase select-none"
            >
              Advanced
            </Label>
            <Switch
              id="time-advanced-mode"
              checked={showAdvanced}
              onCheckedChange={setShowAdvanced}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Live IxTime Display */}
        <div className="space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-blue-400 uppercase">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
            </span>
            Current simulation time
          </div>
          <div className="font-mono text-sm leading-tight font-bold break-words text-blue-500">
            {formattedIxTime}
          </div>
          <div className="text-muted-foreground grid grid-cols-1 gap-2 border-t border-blue-500/10 pt-2 text-[10px] font-medium sm:grid-cols-2">
            <div>
              <span className="text-foreground font-semibold">1 real day</span> = {ixDaysPerRealDay}{" "}
              IX days
            </div>
            <div>
              <span className="text-foreground font-semibold">In 24h:</span>{" "}
              {new Date(predictedIn24h).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              IX
            </div>
          </div>
        </div>

        {/* Time Multiplier Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-foreground text-xs font-semibold">Speed Multiplier</Label>
            <Badge
              variant="outline"
              className="rounded-full border-blue-500/20 bg-blue-500/5 px-2.5 py-0.5 font-mono text-xs font-semibold text-blue-500 tabular-nums"
            >
              {timeMultiplier}x
            </Badge>
          </div>
          <Slider
            value={[timeMultiplier]}
            onValueChange={([v]) => v !== undefined && onTimeMultiplierChange(v)}
            min={0}
            max={10}
            step={0.1}
            className="cursor-grab py-1 active:cursor-grabbing"
          />
          <div className="text-muted-foreground flex justify-between text-[10px] font-semibold tracking-wider uppercase">
            <span>Paused</span>
            <span>2x (Default)</span>
            <span>4x</span>
            <span>10x</span>
          </div>
        </div>

        {/* Speed Preset Buttons */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SPEED_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = timeMultiplier === preset.value;

            return (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => onTimeMultiplierChange(preset.value)}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-200 hover:scale-102",
                  isSelected ? "bg-primary/10 border-primary/30 text-primary" : preset.color
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{preset.label.replace(" Speed", "")}</span>
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={onResetToRealTime}
            className="border-border/30 bg-muted/20 text-foreground hover:bg-muted/30 col-span-2 flex h-9 items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-200 hover:scale-102 sm:col-span-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Flow</span>
          </Button>
        </div>

        {showAdvanced && (
          <div className="animate-in fade-in slide-in-from-top-2 space-y-4 pt-1 duration-200">
            <Separator className="border-border/20 my-1" />

            {/* Year Jump Presets */}
            <div className="space-y-2">
              <Label className="text-foreground text-xs font-semibold">
                Jump to Simulation Era
              </Label>
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
                      className="border-border/30 bg-card/20 hover:bg-muted/20 flex h-9 items-center justify-center gap-1 text-xs font-semibold transition-all duration-200 hover:scale-102"
                    >
                      <Calendar className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                      <span>{year}</span>
                      {isPast && (
                        <span className="text-muted-foreground/60 ml-0.5 text-[9px] font-normal">
                          (past)
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Separator className="border-border/20 my-1" />

            {/* Custom IxTime Setting */}
            <div className="space-y-3">
              <Label className="text-foreground text-xs font-semibold">Set Custom Time Point</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label
                    htmlFor="custom-date"
                    className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase"
                  >
                    Date
                  </Label>
                  <Input
                    id="custom-date"
                    type="date"
                    value={customDate}
                    onChange={(e) => onCustomDateChange(e.target.value)}
                    className="bg-card/20 border-border/30 focus:border-primary/50 h-9 text-xs focus:ring-0"
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="custom-time"
                    className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase"
                  >
                    Time
                  </Label>
                  <Input
                    id="custom-time"
                    type="time"
                    value={customTime}
                    onChange={(e) => onCustomTimeChange(e.target.value)}
                    className="bg-card/20 border-border/30 focus:border-primary/50 h-9 text-xs focus:ring-0"
                  />
                </div>
              </div>
              <Button
                onClick={onSetCustomTime}
                disabled={!customDate || !customTime || setTimePending}
                className="h-10 w-full text-xs font-bold transition-all duration-250 hover:scale-[1.01]"
              >
                {setTimePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {setTimePending ? "Setting..." : "Apply Custom Time"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
