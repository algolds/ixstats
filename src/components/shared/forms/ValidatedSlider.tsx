"use client";

import React, { useState } from 'react';
import { Label } from '~/components/ui/label';
import { Slider } from '~/components/ui/slider';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';

export interface ValidatedSliderProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  description?: string;
  showInput?: boolean;
  formatValue?: (value: number) => string;
  className?: string;
  disabled?: boolean;
  marks?: Array<{ value: number; label: string }>;
  tooltip?: string;
  warning?: {
    threshold: number;
    message: string;
    compare?: 'above' | 'below';
  };
  info?: string;
}

export function ValidatedSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit,
  description,
  showInput = true,
  formatValue,
  className,
  disabled = false,
  marks,
  tooltip,
  warning,
  info
}: ValidatedSliderProps) {
  const [inputValue, setInputValue] = useState(value.toString());
  const [isFocused, setIsFocused] = useState(false);

  const displayValue = formatValue ? formatValue(value) : value.toString();
  const showWarning = warning && (
    (warning.compare === 'above' && value > warning.threshold) ||
    (warning.compare === 'below' && value < warning.threshold) ||
    (!warning.compare && value > warning.threshold)
  );

  const handleSliderChange = (newValue: number[]) => {
    onChange(newValue[0]!);
    setInputValue(newValue[0]!.toString());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(min, Math.min(max, numValue));
      onChange(clampedValue);
      setInputValue(clampedValue.toString());
    } else {
      setInputValue(value.toString());
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {(label || tooltip) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {label && <Label className="text-sm font-medium">{label}</Label>}
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm max-w-xs">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {showInput && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={isFocused ? inputValue : value}
                onChange={handleInputChange}
                onFocus={() => setIsFocused(true)}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                className="w-20 h-8 text-sm text-right"
              />
              {unit && (
                <span className="text-sm text-muted-foreground min-w-fit">{unit}</span>
              )}
            </div>
          )}
          {!showInput && (
            <Badge variant="secondary" className="text-sm">
              {displayValue}
              {unit && ` ${unit}`}
            </Badge>
          )}
        </div>
      )}

      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      <div className="space-y-2">
        <Slider
          value={[value]}
          onValueChange={handleSliderChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="w-full"
        />

        {marks && marks.length > 0 && (
          <div className="relative pt-1">
            {marks.map((mark, idx) => {
              const percentage = ((mark.value - min) / (max - min)) * 100;
              return (
                <div
                  key={idx}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${percentage}%` }}
                >
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {mark.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showWarning && warning && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <Info className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            {warning.message}
          </p>
        </div>
      )}

      {info && !showWarning && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-400">{info}</p>
        </div>
      )}
    </div>
  );
}
