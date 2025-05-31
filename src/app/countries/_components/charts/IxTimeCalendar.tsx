"use client";

import { useState, useMemo } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface IxTimeCalendarProps {
  selectedIxTime: number;
  /** Client-side callback for IxTime changes */
  onIxTimeChangeAction: (ixTime: number) => void;
  minIxTime?: number;
  maxIxTime?: number;
  gameEpoch: number;
  className?: string;
}

export function IxTimeCalendar({
  selectedIxTime,
  onIxTimeChangeAction,
  minIxTime,
  maxIxTime,
  gameEpoch,
  className,
}: IxTimeCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date(selectedIxTime));

  const timeInfo = useMemo(() => {
    const currentDate = new Date(selectedIxTime);
    const gameYear = IxTime.getCurrentGameYear(selectedIxTime);
    const yearsSinceEpoch = IxTime.getYearsSinceGameEpoch(selectedIxTime);
    const isPresent = Math.abs(selectedIxTime - IxTime.getCurrentIxTime()) < 60000; // 1 minute tolerance
    const isHistorical = selectedIxTime < IxTime.getCurrentIxTime();
    const isFuture = selectedIxTime > IxTime.getCurrentIxTime();

    return {
      currentDate,
      gameYear,
      yearsSinceEpoch,
      isPresent,
      isHistorical,
      isFuture,
      formattedDate: IxTime.formatIxTime(selectedIxTime),
      formattedShort: IxTime.formatIxTime(selectedIxTime, false),
    };
  }, [selectedIxTime]);

  const quickSelectOptions = useMemo(() => {
    const currentIxTime = IxTime.getCurrentIxTime();
    const options = [
      {
        label: "Present",
        value: currentIxTime,
        description: "Current IxTime",
      },
      {
        label: "Game Start",
        value: gameEpoch,
        description: "January 1, 2028",
      },
      {
        label: "1 Year Ago",
        value: IxTime.addYears(currentIxTime, -1),
        description: `Game Year ${IxTime.getCurrentGameYear(IxTime.addYears(currentIxTime, -1))}`,
      },
      {
        label: "5 Years Ago",
        value: IxTime.addYears(currentIxTime, -5),
        description: `Game Year ${IxTime.getCurrentGameYear(IxTime.addYears(currentIxTime, -5))}`,
      },
      {
        label: "10 Years Ago",
        value: IxTime.addYears(currentIxTime, -10),
        description: `Game Year ${IxTime.getCurrentGameYear(IxTime.addYears(currentIxTime, -10))}`,
      },
    ];

    // Filter options based on min/max constraints
    return options.filter(option => {
      if (minIxTime && option.value < minIxTime) return false;
      if (maxIxTime && option.value > maxIxTime) return false;
      return true;
    });
  }, [gameEpoch, minIxTime, maxIxTime]);

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    
    // Create IxTime from selected date while preserving time components
    const selectedDateTime = new Date(date);
    selectedDateTime.setHours(
      new Date(selectedIxTime).getHours(),
      new Date(selectedIxTime).getMinutes(),
      new Date(selectedIxTime).getSeconds()
    );
    
    const newIxTime = selectedDateTime.getTime();
    
    // Apply constraints
    let constrainedTime = newIxTime;
    if (minIxTime && constrainedTime < minIxTime) constrainedTime = minIxTime;
    if (maxIxTime && constrainedTime > maxIxTime) constrainedTime = maxIxTime;
    
    onIxTimeChangeAction(constrainedTime);
    setCalendarDate(new Date(constrainedTime));
  };

  const handleQuickSelect = (value: string) => {
    const ixTime = parseInt(value);
    onIxTimeChangeAction(ixTime);
    setCalendarDate(new Date(ixTime));
    setIsOpen(false);
  };

  const handleTimeAdjustment = (direction: 'prev' | 'next', unit: 'day' | 'month' | 'year') => {
    const multiplier = direction === 'next' ? 1 : -1;
    let newIxTime: number;

    switch (unit) {
      case 'day':
        newIxTime = selectedIxTime + (multiplier * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        newIxTime = IxTime.addMonths(selectedIxTime, multiplier);
        break;
      case 'year':
        newIxTime = IxTime.addYears(selectedIxTime, multiplier);
        break;
      default:
        return;
    }

    // Apply constraints
    if (minIxTime && newIxTime < minIxTime) newIxTime = minIxTime;
    if (maxIxTime && newIxTime > maxIxTime) newIxTime = maxIxTime;

    onIxTimeChangeAction(newIxTime);
    setCalendarDate(new Date(newIxTime));
  };

  const getBadgeVariant = () => {
    if (timeInfo.isPresent) return "default";
    if (timeInfo.isHistorical) return "secondary";
    return "outline";
  };

  const getBadgeText = () => {
    if (timeInfo.isPresent) return "Present";
    if (timeInfo.isHistorical) return "Historical";
    return "Future";
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Time Navigation Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleTimeAdjustment('prev', 'year')}
          disabled={!!(minIxTime && IxTime.addYears(selectedIxTime, -1) < minIxTime)}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleTimeAdjustment('next', 'year')}
          disabled={!!(maxIxTime && IxTime.addYears(selectedIxTime, 1) > maxIxTime)}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Main Calendar Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-auto justify-start text-left font-normal",
              !selectedIxTime && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span className="truncate">{timeInfo.formattedShort}</span>
            <Badge variant={getBadgeVariant()} className="ml-2 text-xs">
              {getBadgeText()}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="space-y-4 p-4">
            {/* Quick Select Options */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Quick Select</label>
              <Select onValueChange={handleQuickSelect}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose preset time..." />
                </SelectTrigger>
                <SelectContent>
                  {quickSelectOptions.map((option) => (
                    <SelectItem key={option.label} value={option.value.toString()}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Calendar */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Date</label>
              <Calendar
                mode="single"
                selected={calendarDate}
                onSelect={handleCalendarSelect}
                disabled={(date) => {
                  const timeMs = date.getTime();
                  if (minIxTime && timeMs < minIxTime) return true;
                  if (maxIxTime && timeMs > maxIxTime) return true;
                  return false;
                }}
                initialFocus
              />
            </div>

            {/* Current Selection Info */}
            <div className="border-t pt-4 space-y-2">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Selected:</span>
                  <span className="font-medium">{timeInfo.formattedShort}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Game Year:</span>
                  <span className="font-medium">{timeInfo.gameYear}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Years Since Epoch:</span>
                  <span className="font-medium">
                    {timeInfo.yearsSinceEpoch > 0 ? '+' : ''}{timeInfo.yearsSinceEpoch.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Game Year Display */}
      <Badge variant="outline" className="text-xs">
        Year {timeInfo.gameYear}
      </Badge>
    </div>
  );
}
