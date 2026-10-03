"use client";
// src/app/admin/_components/platform/TimeControlCard.tsx
// Refactored with premium glassmorphism styles and visual updates

import { useState, useEffect } from "react";
import {
  Clock,
  Pause,
  Play,
  Undo as RotateCcw,
  SystemRestart as Loader2,
  Calendar,
} from "iconoir-react";
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
    color: "border-red/20 bg-red/5 text-red hover:bg-red/10 hover:border-red/30",
    icon: Pause,
  },
  {
    label: "1x Speed",
    value: 1,
    color: "border-separator bg-fill-4 text-label hover:bg-fill-4",
    icon: Play,
  },
  {
    label: "2x Speed",
    value: 2,
    color: "border-blue/20 bg-blue/5 text-blue hover:bg-blue/10 hover:border-blue/30",
    icon: Play,
  },
  {
    label: "4x Speed",
    value: 4,
    color: "border-indigo/20 bg-indigo/5 text-indigo hover:bg-indigo/10 hover:border-indigo/30",
    icon: Play,
  },
  {
    label: "10x Speed",
    value: 10,
    color: "border-purple/20 bg-purple/5 text-purple hover:bg-purple/10 hover:border-purple/30",
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
    <Card className="flex flex-col gap-6 py-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-headline flex items-center gap-2">
              <div className="rounded-control border-blue/20 bg-blue/10 text-blue border p-2">
                <Clock className="h-4 w-4" />
              </div>
              Time Flow Controller
            </CardTitle>
            <CardDescription className="text-footnote">
              Manage system simulation speed, time progression multipliers, and jump benchmarks
            </CardDescription>
          </div>
          <div className="border-separator bg-surface rounded-control flex shrink-0 items-center gap-2 border px-3 py-2">
            <Label
              htmlFor="time-advanced-mode"
              className="text-label-secondary text-subhead cursor-pointer select-none"
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
        <div className="rounded-control border-blue/20 bg-blue/5 space-y-2 border p-4">
          <div className="text-eyebrow text-blue flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="bg-blue absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
              <span className="bg-blue relative inline-flex h-2 w-2 rounded-full"></span>
            </span>
            Current simulation time
          </div>
          <div className="text-headline text-blue leading-tight break-words tabular-nums">
            {formattedIxTime}
          </div>
          <div className="text-label-secondary border-blue/10 text-caption grid grid-cols-1 gap-2 border-t pt-2 sm:grid-cols-2">
            <div>
              <span className="text-label font-semibold">1 real day</span> = {ixDaysPerRealDay} IX
              days
            </div>
            <div>
              <span className="text-label font-semibold">In 24h:</span>{" "}
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
            <Label className="text-label text-caption">Speed Multiplier</Label>
            <Badge variant="info" className="rounded-full px-3 py-0.5 tabular-nums">
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
          <div className="text-label-secondary text-eyebrow flex justify-between">
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
                aria-pressed={isSelected}
                className={cn(
                  "text-caption duration-fast flex h-9 items-center justify-center gap-2 transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                  isSelected ? "bg-tint-fill border-tint/30 text-tint" : preset.color
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
            className="col-span-2 flex items-center justify-center gap-2 sm:col-span-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Flow</span>
          </Button>
        </div>

        {showAdvanced && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-fast space-y-4 pt-1">
            <Separator className="border-separator my-1" />

            {/* Year Jump Presets */}
            <div className="space-y-2">
              <Label className="text-label text-caption">Jump to Simulation Era</Label>
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
                      className="flex items-center justify-center gap-1"
                    >
                      <Calendar className="text-label-secondary h-3.5 w-3.5 shrink-0" />
                      <span>{year}</span>
                      {isPast && (
                        <span className="text-label-secondary text-footnote ml-0.5 font-normal">
                          (past)
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Separator className="border-separator my-1" />

            {/* Custom IxTime Setting */}
            <div className="space-y-3">
              <Label className="text-label text-caption">Set Custom Time Point</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="custom-date" className="text-label-secondary text-subhead">
                    Date
                  </Label>
                  <Input
                    id="custom-date"
                    type="date"
                    value={customDate}
                    onChange={(e) => onCustomDateChange(e.target.value)}
                    className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="custom-time" className="text-label-secondary text-subhead">
                    Time
                  </Label>
                  <Input
                    id="custom-time"
                    type="time"
                    value={customTime}
                    onChange={(e) => onCustomTimeChange(e.target.value)}
                    className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                  />
                </div>
              </div>
              <Button
                onClick={onSetCustomTime}
                disabled={!customDate || !customTime || setTimePending}
                className="h-10 w-full"
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
