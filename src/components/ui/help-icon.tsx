"use client";

import React from "react";
import { HelpCircle, InfoCircle as Info } from "iconoir-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { cn } from "~/lib/utils/cn";

interface HelpIconProps {
  content: React.ReactNode;
  title?: string;
  className?: string;
  iconClassName?: string;
  side?: "top" | "bottom" | "left" | "right";
  variant?: "help" | "info";
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
  side = "top",
  variant = "help",
}: HelpIconProps) {
  const Icon = variant === "info" ? Info : HelpCircle;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-full",
            "duration-fast ease-out-facet transition-colors",
            "focus-visible:outline-tint outline-none focus-visible:outline-2 focus-visible:outline-offset-2",
            className
          )}
          aria-label={title ?? "Help information"}
        >
          <Icon
            className={cn(
              "size-4",
              "text-label-tertiary hover:text-tint",
              "duration-fast transition-colors",
              "cursor-help",
              iconClassName
            )}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={8} className="max-w-sm">
        {title && (
          <div className="text-subhead text-tint mb-2 flex items-center gap-2 font-semibold">
            <Icon aria-hidden="true" className="size-3.5" />
            {title}
          </div>
        )}
        <div className="text-footnote">{content}</div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * SectionHelpIcon - Help icon variant for section headers
 */
export function SectionHelpIcon(props: Omit<HelpIconProps, "className" | "iconClassName">) {
  return <HelpIcon {...props} className="ml-2" iconClassName="size-4" />;
}

/**
 * InlineHelpIcon - Smaller help icon for inline usage
 */
export function InlineHelpIcon(props: Omit<HelpIconProps, "className" | "iconClassName">) {
  return <HelpIcon {...props} className="ml-2" iconClassName="size-3.5" />;
}
