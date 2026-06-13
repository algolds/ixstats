"use client";

import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { SPORTS_ABBREVIATIONS } from "~/lib/sports/presets";

interface PositionTooltipProps {
  position: string;
  children: React.ReactNode;
}

export function PositionTooltip({ position, children }: PositionTooltipProps) {
  const fullName = SPORTS_ABBREVIATIONS[position] || position;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {fullName}
      </TooltipContent>
    </Tooltip>
  );
}
