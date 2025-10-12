"use client";

import React from 'react';
import { HelpCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { cn } from '~/lib/utils';

interface HelpIconProps {
  content: React.ReactNode;
  title?: string;
  className?: string;
  iconClassName?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  variant?: 'help' | 'info';
}

/**
 * HelpIcon - A reusable help icon with tooltip for providing contextual information
 *
 * @example
 * <HelpIcon
 *   title="Economic Tier"
 *   content="Your country's economic tier determines growth rates and capabilities."
 * />
 */
export function HelpIcon({
  content,
  title,
  className,
  iconClassName,
  side = 'top',
  variant = 'help'
}: HelpIconProps) {
  const Icon = variant === 'info' ? Info : HelpCircle;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center",
            "transition-all duration-200",
            "hover:scale-110 active:scale-95",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 rounded-full",
            className
          )}
          aria-label={title ?? "Help information"}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              "text-white/40 hover:text-amber-400",
              "transition-colors duration-200",
              "cursor-help",
              iconClassName
            )}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={8}
        className="max-w-sm"
      >
        {title && (
          <div className="font-semibold text-sm mb-2 flex items-center gap-2 text-amber-400">
            <Icon className="h-3.5 w-3.5" />
            {title}
          </div>
        )}
        <div className="text-sm leading-relaxed">
          {content}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * SectionHelpIcon - Help icon variant for section headers
 */
export function SectionHelpIcon(props: Omit<HelpIconProps, 'className' | 'iconClassName'>) {
  return (
    <HelpIcon
      {...props}
      className="ml-2"
      iconClassName="h-4 w-4 text-white/50 hover:text-amber-300"
    />
  );
}

/**
 * InlineHelpIcon - Smaller help icon for inline usage
 */
export function InlineHelpIcon(props: Omit<HelpIconProps, 'className' | 'iconClassName'>) {
  return (
    <HelpIcon
      {...props}
      className="ml-1.5"
      iconClassName="h-3.5 w-3.5 text-white/40 hover:text-amber-400"
    />
  );
}
