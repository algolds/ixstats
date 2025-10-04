// src/components/ui/ixtime-picker.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { IxTime } from '~/lib/ixtime';
import { Label } from './label';
import { Input } from './input';
import { Button } from './button';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface IxTimePickerProps {
  value: number; // IxTime timestamp
  onChange: (ixTime: number) => void;
  label?: string;
  id?: string;
  required?: boolean;
  className?: string;
  showRealWorldTime?: boolean;
}

/**
 * IxTime Date/Time Picker
 *
 * This component allows users to pick dates in the IxTime system.
 * The input displays and accepts IxTime dates, not real-world dates.
 */
export function IxTimePicker({
  value,
  onChange,
  label,
  id,
  required = false,
  className = '',
  showRealWorldTime = true,
}: IxTimePickerProps) {
  // Convert IxTime timestamp to Date for input
  const ixDate = new Date(value);

  // Convert IxTime to real-world time for reference
  const convertIxTimeToRealWorld = (ixTime: number): Date => {
    const currentIxTime = IxTime.getCurrentIxTime();
    const ixTimeDiff = ixTime - currentIxTime; // Difference in IxTime milliseconds
    const multiplier = IxTime.getTimeMultiplier(); // Get current time multiplier

    if (multiplier === 0) return new Date(Date.now()); // If paused, return current real time

    const realTimeDiff = ixTimeDiff / multiplier; // Convert to real-world milliseconds
    return new Date(Date.now() + realTimeDiff);
  };

  // Format for datetime-local input (YYYY-MM-DDTHH:mm)
  const formatForInput = (ixTime: number) => {
    const date = new Date(ixTime);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = e.target.value;
    if (!dateString) return;

    // Parse the input as an IxTime date
    const date = new Date(dateString);
    onChange(date.getTime());
  };

  // Quick preset buttons
  const setPreset = (hours: number) => {
    const currentIxTime = IxTime.getCurrentIxTime();
    const newIxTime = currentIxTime + (hours * 60 * 60 * 1000);
    onChange(newIxTime);
  };

  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}

      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <Input
            id={id}
            type="datetime-local"
            value={formatForInput(value)}
            onChange={handleChange}
            required={required}
            className="w-full"
          />

          {/* IxTime Display */}
          <p className="text-xs text-blue-600 font-medium mt-1">
            <CalendarIcon className="h-3 w-3 inline mr-1" />
            {IxTime.formatIxTime(value, true)}
          </p>

          {/* Real-world time reference (optional) */}
          {showRealWorldTime && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3 inline mr-1" />
              Real-world: {format(convertIxTimeToRealWorld(value), 'MMM d, yyyy HH:mm')}
            </p>
          )}
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap gap-1 mt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(IxTime.getCurrentIxTime())}
          className="text-xs h-7"
        >
          Now (IxTime)
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPreset(24)}
          className="text-xs h-7"
        >
          +1 Day
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPreset(24 * 7)}
          className="text-xs h-7"
        >
          +1 Week
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPreset(24 * 30)}
          className="text-xs h-7"
        >
          +1 Month
        </Button>
      </div>
    </div>
  );
}
