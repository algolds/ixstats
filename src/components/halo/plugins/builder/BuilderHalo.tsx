"use client";

/**
 * BuilderHalo — Halo overlay plugin for the Nation Builder.
 *
 * Provides real-time step tracking, validation error counts,
 * manual save action trigger, and expanded builder modal views.
 */

import React, { useMemo } from "react";
import { useDIPlugin } from "~/components/halo/plugin-context";
import { useBuilderFilter } from "~/app/builder/components/builder-filter-context";
import { useBuilderContext } from "~/app/builder/components/enhanced/context/BuilderStateContext";
import type { RealCountryData } from "~/app/builder/lib/economy-data-service";
import { BuilderView } from "./views";
import type { DIViewProps } from "~/components/halo/types";
import { PreText } from "~/components/ui/pretext";
import { useToastQueueStore } from "~/stores/toastQueueStore";
import { notifyFromStore } from "~/hooks/useNotify";
import { AlertCircle, Save } from "lucide-react";

function BuilderCompactLabel() {
  return (
    <span className="flex items-center select-none">
      <PreText
        className="text-foreground/80 text-xs font-semibold tracking-tight"
        whiteSpace="nowrap"
      >
        MyCountry Builder
      </PreText>
    </span>
  );
}

interface BuilderHaloInnerProps {
  filter: ReturnType<typeof useBuilderFilter>;
  context: ReturnType<typeof useBuilderContext>;
}

function BuilderHaloInner({ filter, context }: BuilderHaloInnerProps) {
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
          unemploymentRate:
            context.builderState.economicInputs.laborEmployment?.unemploymentRate || 0,
          population: context.builderState.economicInputs.coreIndicators?.totalPopulation || 0,
          continent: context.builderState.economicInputs.geography?.continent || "",
          region: context.builderState.economicInputs.geography?.region || "",
          flag: context.builderState.economicInputs.flagUrl || "",
        } as unknown as RealCountryData);
      }
    } else {
      if (filter.selectedTemplate !== null) {
        filter.setSelectedTemplate(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.builderState.selectedCountry,
    context.builderState.economicInputs?.countryName,
    filter.selectedTemplate,
    filter.setSelectedTemplate,
  ]);

  const [hasTriggeredRestoreExpansion, setHasTriggeredRestoreExpansion] = React.useState(false);

  React.useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (!hasTriggeredRestoreExpansion) {
      setHasTriggeredRestoreExpansion(true);
      timer = setTimeout(() => {
        filter.triggerDIExpansion();
      }, 100);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [hasTriggeredRestoreExpansion, filter]);

  const toastQueue = useToastQueueStore((s) => s.queue);
  const errorCount = useMemo(
    () => toastQueue.filter((t) => t.type === "error").length,
    [toastQueue]
  );
  const hasError = errorCount > 0;

  const isSaving = context.isAutoSaving || context.isSyncing;
  const saveAction = useMemo(
    () => ({
      id: "builder-save",
      icon: Save,
      label: isSaving ? "Saving…" : "Save progress",
      onClick: async () => {
        try {
          await context.triggerManualSave();
          notifyFromStore({
            title: "Progress saved",
            type: "success",
            category: "system",
          });
        } catch (e) {
          notifyFromStore({
            title: "Save failed",
            message: e instanceof Error ? e.message : "Could not save your changes.",
            type: "error",
            category: "system",
          });
        }
      },
    }),
    [context, isSaving]
  );

  const plugin = useMemo(() => {
    return {
      id: "builder",
      priority: 20, // High priority to override mycountry/wiki default plugins
      center: <BuilderCompactLabel />,
      expandedViews: { builder: BuilderView as React.ComponentType<DIViewProps> },
      accentColor: hasError ? "#ef4444" : "#f59e0b",
      stickyLabel: "Builder",
      badge: hasError ? { color: "#ef4444", pulse: true } : undefined,
      actions: [
        ...(hasError
          ? [
              {
                id: "builder-errors",
                icon: AlertCircle,
                label: `${errorCount} validation error${errorCount === 1 ? "" : "s"}`,
                onClick: () => {
                  window.dispatchEvent(new CustomEvent("ix:open-validation-toast"));
                },
                badge: errorCount,
              },
            ]
          : []),
        saveAction,
      ],
      filter,
      context,
    };
  }, [filter, context, hasError, errorCount, saveAction]);

  useDIPlugin(plugin);
  return null;
}

export function BuilderHalo() {
  const filter = useBuilderFilter();
  const context = useBuilderContext();

  return <BuilderHaloInner filter={filter} context={context} />;
}

// Backwards compatibility alias
export const BuilderDIPlugin = BuilderHalo;
