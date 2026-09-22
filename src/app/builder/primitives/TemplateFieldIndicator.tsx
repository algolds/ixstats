"use client";

import React from "react";
import { Sparks as Sparkles } from "iconoir-react";
import { cn } from "~/lib/utils";

interface TemplateFieldIndicatorProps {
  className?: string;
  label?: string;
}

export function TemplateFieldIndicator({
  className,
  label = "from template",
}: TemplateFieldIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500/90 select-none dark:text-amber-400/90",
        className
      )}
      title="Value pre-filled from selected archetype template"
    >
      <Sparkles className="h-2.5 w-2.5" />
      <span>{label}</span>
    </span>
  );
}
