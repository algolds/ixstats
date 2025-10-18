"use client";

import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';
import type { FieldLockConfig } from './enhanced/builderConfig';

interface FieldLockIndicatorProps {
  fieldLock?: FieldLockConfig;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * FieldLockIndicator - Visual indicator for locked/unlocked fields in editor mode
 *
 * Displays a lock icon with tooltip explaining why a field is locked (calculated value)
 * or unlocked (user-editable). Only shows in edit mode.
 */
export function FieldLockIndicator({ fieldLock, className, size = 'sm' }: FieldLockIndicatorProps) {
  if (!fieldLock) return null;

  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5';
  const isLocked = fieldLock.isLocked;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            'inline-flex items-center',
            isLocked ? 'text-gray-400' : 'text-amber-500',
            className
          )}>
            {isLocked ? (
              <Lock className={iconSize} />
            ) : (
              <Unlock className={iconSize} />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">
            {isLocked ? (
              <>
                <span className="font-semibold">🔒 Locked</span>
                <br />
                {fieldLock.reason}
              </>
            ) : (
              <>
                <span className="font-semibold">🔓 Editable</span>
                <br />
                You can modify this value
              </>
            )}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
