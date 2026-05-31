"use client";

/**
 * BuilderDIPlugin — registers a DI plugin for the nation builder page.
 *
 * Implements Option A (Morphing Dynamic Island) UX:
 * - Auto-expands to a large search/naming view on load.
 * - Collapses/docks once a country template is confirmed or when scrolled down.
 */

import React, { useMemo } from "react";
import { Crown } from "lucide-react";
import { useDIPlugin } from "~/components/DynamicIsland/plugin-context";
import { useBuilderFilter } from "~/app/builder/components/builder-filter-context";
import { useBuilderContext } from "~/app/builder/components/enhanced/context/BuilderStateContext";
import { BuilderDIView } from "~/components/DynamicIsland/BuilderDIView";

function BuilderCompactLabel({ filter }: { filter: any }) {
  const template = filter.selectedTemplate;
  if (template) {
    const flagUrl = template.flag || template.flagUrl;
    return (
      <span className="flex items-center gap-2 overflow-hidden select-none">
        {flagUrl && (
          <span className="h-3 w-4.5 shrink-0 overflow-hidden rounded-[1.5px] border border-white/20 shadow-xs">
            <img src={flagUrl} alt="" className="h-full w-full object-cover" />
          </span>
        )}
        <span className="text-foreground/85 truncate text-[11px] font-bold tracking-tight">
          {template.name}
        </span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 select-none">
      <Crown className="h-3 w-3 shrink-0 text-amber-400 opacity-70" />
      <span className="text-foreground/80 text-xs font-semibold tracking-tight">
        Builder
      </span>
    </span>
  );
}

export function BuilderDIPlugin() {
  const filter = useBuilderFilter();
  const context = useBuilderContext();

  const plugin = useMemo(() => {
    // Define the view component that captures context values via JavaScript closure
    const BoundView = (props: { onClose: () => void }) => (
      <BuilderDIView {...props} filter={filter} context={context} />
    );

    const hasTemplate = !!filter.selectedTemplate;

    return {
      id: hasTemplate ? "builder-collapsed" : "builder",
      priority: 20, // High priority to override mycountry/wiki default plugins
      center: <BuilderCompactLabel filter={filter} />,
      expandedViews: hasTemplate ? undefined : { builder: BoundView },
      accentColor: "#f59e0b",
      stickyLabel: "Builder",
    };
  }, [filter, context]);

  useDIPlugin(plugin);
  return null;
}
