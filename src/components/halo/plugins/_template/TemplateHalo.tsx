"use client";

/**
 * TemplateHalo — Starter boilerplate template for creating new Halo plugins.
 *
 * Developers can copy this folder to `src/components/halo/plugins/<feature>/`
 * to quickly mount custom Dynamic Island capsule indicators and expanded views.
 */

import React, { useMemo } from "react";
import { Sparkle } from "lucide-react";
import { useDIPlugin } from "~/components/halo/plugin-context";
import { PreText } from "~/components/ui/pretext";
import { TemplateView } from "./views";

function TemplateLabel() {
  return (
    <span className="flex items-center gap-1.5">
      <Sparkle className="h-3 w-3 shrink-0 text-blue-400 opacity-80" />
      <PreText className="text-foreground/80 text-xs font-medium" whiteSpace="nowrap">
        Template
      </PreText>
    </span>
  );
}

export function TemplateHalo() {
  const plugin = useMemo(
    () => ({
      id: "template",
      priority: 1,
      center: <TemplateLabel />,
      expandedViews: { template: TemplateView },
      accentColor: "#3b82f6",
      stickyLabel: "Template",
    }),
    []
  );

  useDIPlugin(plugin);
  return null;
}
