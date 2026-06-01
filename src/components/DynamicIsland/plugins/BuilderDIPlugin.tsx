"use client";

/**
 * BuilderDIPlugin — registers a DI plugin for the nation builder page.
 *
 * Implements Option A (Morphing Dynamic Island) UX:
 * - Auto-expands to a large search/naming view on load.
 * - Collapses/docks once a country template is confirmed or when scrolled down.
 */

import React, { useMemo } from "react";
import { useDIPlugin } from "~/components/DynamicIsland/plugin-context";
import { useBuilderFilter } from "~/app/builder/components/builder-filter-context";
import { useBuilderContext } from "~/app/builder/components/enhanced/context/BuilderStateContext";
import { BuilderDIView } from "~/components/DynamicIsland/BuilderDIView";
import { MyCountryDIPlugin } from "./MyCountryDIPlugin";
import { PreText } from "~/components/ui/pretext";

function BuilderCompactLabel() {
  return (
    <span className="flex items-center select-none">
      <PreText className="text-foreground/80 text-xs font-semibold tracking-tight" whiteSpace="nowrap">
        MyCountry Builder
      </PreText>
    </span>
  );
}

interface BuilderDIPluginInnerProps {
  filter: ReturnType<typeof useBuilderFilter>;
  context: ReturnType<typeof useBuilderContext>;
}

function BuilderDIPluginInner({ filter, context }: BuilderDIPluginInnerProps) {
  React.useEffect(() => {
    if (context.builderState.step === "foundation") {
      return;
    }

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

  const [hasTriggeredRestoreExpansion, setHasTriggeredRestoreExpansion] = React.useState(false);

  React.useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    const isLargeScreen = typeof window !== "undefined" && window.innerWidth >= 1024;
    if (isLargeScreen && !hasTriggeredRestoreExpansion) {
      setHasTriggeredRestoreExpansion(true);
      timer = setTimeout(() => {
        filter.triggerDIExpansion();
      }, 100);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [hasTriggeredRestoreExpansion, filter]);

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
