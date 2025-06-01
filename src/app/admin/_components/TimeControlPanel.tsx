// src/app/admin/_components/TimeControlPanel.tsx
"use client";

import { Clock, CalendarDays, Settings, Zap, Loader2, RotateCcw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { AdminPageBotStatusView } from "~/types/ixstats";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";


interface TimeControlPanelProps {
  timeMultiplier: number;
  customDate: string;
  customTime: string;
  botSyncEnabled: boolean; // Assuming this might influence time display or warnings
  botStatus: AdminPageBotStatusView | null | undefined;
  onTimeMultiplierChange: (value: number) => void;
  onCustomDateChange: (value: string) => void;
  onCustomTimeChange: (value: string) => void;
  onSetCustomTime: () => void;
  onResetToRealTime: () => void;
  setTimePending: boolean;
}

export function TimeControlPanel({
  timeMultiplier,
  customDate,
  customTime,
  botSyncEnabled,
  botStatus,
  onTimeMultiplierChange,
  onCustomDateChange,
  onCustomTimeChange,
  onSetCustomTime,
  onResetToRealTime,
  setTimePending,
}: TimeControlPanelProps) {
  
  const isBotTimeOverridden = botStatus?.isTimeOverridden ?? false;

  return (
    <Card className="dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center">
          <Clock className="h-5 w-5 mr-2" />
          Time Control
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          Manage the in-game time progression. 
          {isBotTimeOverridden && <span className="text-yellow-500 dark:text-yellow-400"> Bot time is currently overridden.</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="timeMultiplier" className="text-gray-700 dark:text-gray-300 flex items-center">
            <Settings className="h-4 w-4 mr-1.5 text-gray-500" /> Time Multiplier (e.g., 4.0 for 1 day = 6 hours RL)
          </Label>
          <Input
            id="timeMultiplier"
            type="number"
            value={timeMultiplier}
            onChange={(e) => onTimeMultiplierChange(parseFloat(e.target.value) || 1.0)}
            step="0.1"
            min="0.1"
            className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={setTimePending || isBotTimeOverridden}
          />
           {isBotTimeOverridden && <p className="text-xs text-yellow-500 dark:text-yellow-400">Clear bot time override to change multiplier.</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="customDate" className="text-gray-700 dark:text-gray-300 flex items-center">
              <CalendarDays className="h-4 w-4 mr-1.5 text-gray-500" /> Set Custom Date
            </Label>
            <Input
              id="customDate"
              type="date"
              value={customDate}
              onChange={(e) => onCustomDateChange(e.target.value)}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={setTimePending || isBotTimeOverridden}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customTime" className="text-gray-700 dark:text-gray-300 flex items-center">
              <Clock className="h-4 w-4 mr-1.5 text-gray-500" /> Set Custom Time (UTC)
            </Label>
            <Input
              id="customTime"
              type="time"
              value={customTime}
              onChange={(e) => onCustomTimeChange(e.target.value)}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={setTimePending || isBotTimeOverridden}
            />
          </div>
        </div>
         {isBotTimeOverridden && <p className="text-xs text-yellow-500 dark:text-yellow-400">Clear bot time override to set custom date/time.</p>}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={onSetCustomTime}
            disabled={setTimePending || !customDate || !customTime || isBotTimeOverridden}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            {setTimePending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Set IxTime
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                 <Button
                    variant="outline"
                    onClick={onResetToRealTime}
                    disabled={setTimePending || isBotTimeOverridden}
                    className="w-full sm:w-auto dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Real-Time
                  </Button>
              </TooltipTrigger>
              <TooltipContent className="dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700">
                <p>Resets IxTime to current real-world UTC and multiplier to 4.0.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
