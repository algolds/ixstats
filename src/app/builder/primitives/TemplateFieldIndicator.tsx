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
        "border-tint/20 bg-tint-fill text-caption text-tint inline-flex items-center gap-1 rounded-full border px-2 py-0.5 select-none",
        className
      )}
      title="Value pre-filled from selected archetype template"
    >
      <Sparkles className="h-2.5 w-2.5" />
      <span>{label}</span>
    </span>
  );
}
