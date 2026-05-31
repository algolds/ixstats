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
import { MyCountryDIPlugin } from "./MyCountryDIPlugin";

function BuilderCompactLabel() {
  return (
    <span className="flex items-center gap-1.5 select-none">
      <Crown className="h-3 w-3 shrink-0 text-amber-400 opacity-70" />
      <span className="text-foreground/80 text-xs font-semibold tracking-tight">Builder</span>
    </span>
  );
}

interface BuilderDIPluginInnerProps {
  filter: ReturnType<typeof useBuilderFilter>;
  context: ReturnType<typeof useBuilderContext>;
}

function BuilderDIPluginInner({ filter, context }: BuilderDIPluginInnerProps) {
  React.useEffect(() => {
    if (context.builderState.selectedCountry) {
      if (filter.selectedTemplate?.name !== context.builderState.selectedCountry.name) {
        filter.setSelectedTemplate(context.builderState.selectedCountry);
      }
    } else if (context.builderState.economicInputs?.countryName) {
      if (filter.selectedTemplate?.name !== context.builderState.economicInputs.countryName) {
        filter.setSelectedTemplate({
          name: context.builderState.economicInputs.countryName,
          countryCode: context.builderState.economicInputs.nationalIdentity?.isoCode || "custom",
          gdp: context.builderState.economicInputs.coreIndicators?.nominalGDP || 0,
          gdpPerCapita: context.builderState.economicInputs.coreIndicators?.gdpPerCapita || 0,
          unemploymentRate: context.builderState.economicInputs.laborEmployment?.unemploymentRate || 0,
          population: context.builderState.economicInputs.coreIndicators?.totalPopulation || 0,
          continent: context.builderState.economicInputs.geography?.continent || "",
          region: context.builderState.economicInputs.geography?.region || "",
          flag: context.builderState.economicInputs.flagUrl || "",
        } as any);
      }
    } else {
      if (filter.selectedTemplate !== null) {
        filter.setSelectedTemplate(null);
      }
    }
  }, [
    context.builderState.selectedCountry,
    context.builderState.economicInputs?.countryName,
    filter.selectedTemplate,
    filter.setSelectedTemplate,
  ]);

  const plugin = useMemo(() => {
    return {
      id: "builder",
      priority: 20, // High priority to override mycountry/wiki default plugins
      center: <BuilderCompactLabel />,
      expandedViews: { builder: BuilderDIView as React.ComponentType<any> },
      accentColor: "#f59e0b",
      stickyLabel: "Builder",
      filter,
      context,
    };
  }, [filter, context]);

  useDIPlugin(plugin);
  return null;
}

export function BuilderDIPlugin() {
  const filter = useBuilderFilter();
  const context = useBuilderContext();

  return <BuilderDIPluginInner filter={filter} context={context} />;
}
