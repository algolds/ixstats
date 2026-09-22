"use client";

/**
 * BuilderHalo — Halo overlay plugin for the Nation Builder.
 *
 * Provides real-time step tracking, validation error counts,
 * manual save action trigger, and expanded builder modal views.
 */

import React, { useMemo, useRef, useEffect } from "react";
import { useDIPlugin } from "~/components/halo/plugin-context";
import { useBuilderFilter, type BuilderFilterState } from "~/app/builder/components/builder-filter-context";
import { useBuilderContext, type BuilderContextValue } from "~/app/builder/components/enhanced/context/BuilderStateContext";
import type { RealCountryData } from "~/app/builder/lib/economy-types";
import { BuilderView } from "./views";
import type { DIPlugin, DIViewProps } from "~/components/halo/types";
import { PreText } from "~/components/ui/pretext";
import { useToastQueueStore } from "~/stores/toastQueueStore";
import { notifyFromStore } from "~/hooks/useNotify";
import { WarningCircle as AlertCircle, FloppyDisk as Save } from "iconoir-react";

interface BuilderCompactLabelProps {
  step: string;
  countryName: string;
}

function BuilderCompactLabel({ step, countryName }: BuilderCompactLabelProps) {
  const stepLabel = useMemo(() => {
    switch (step) {
      case "foundation":
        return "Template";
      case "core":
      case "identity":
        return "Identity";
      case "government":
        return "Government";
      case "economics":
        return "Economics";
      case "preview":
        return "Verify";
      default:
        return "Design";
    }
  }, [step]);

  const fullLabel = countryName ? `${countryName} (${stepLabel})` : stepLabel;

  return (
    <span
      className="flex min-w-0 max-w-[130px] items-center gap-1.5 overflow-hidden select-none sm:max-w-[180px]"
      title={`Builder: ${fullLabel}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 animate-pulse" />
      <PreText
        className="text-foreground/90 shrink-0 text-xs font-semibold tracking-tight"
        whiteSpace="nowrap"
      >
        Builder
      </PreText>
      <span className="text-muted-foreground/50 shrink-0 text-[10px]">•</span>
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs font-medium [mask-image:linear-gradient(to_right,black_85%,transparent_100%)]">
        {fullLabel}
      </span>
    </span>
  );
}

interface BuilderHaloInnerProps {
  filter: BuilderFilterState;
  context: BuilderContextValue;
}

function BuilderHaloInner({ filter, context }: BuilderHaloInnerProps) {
  useEffect(() => {
    if (context.builderState.step === "foundation") {
      return;
    }

    if (context.builderState.selectedCountry) {
      if (filter.selectedTemplate?.name !== context.builderState.selectedCountry.name) {
        filter.setSelectedTemplate(context.builderState.selectedCountry);
      }
    } else if (context.builderState.economicInputs?.countryName) {
      if (filter.selectedTemplate?.name !== context.builderState.economicInputs.countryName) {
        const syntheticCountry: RealCountryData = {
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
        };
        filter.setSelectedTemplate(syntheticCountry);
      }
    } else if (filter.selectedTemplate !== null) {
      filter.setSelectedTemplate(null);
    }
  }, [
    context.builderState.step,
    context.builderState.selectedCountry,
    context.builderState.economicInputs?.countryName,
    context.builderState.economicInputs?.nationalIdentity?.isoCode,
    context.builderState.economicInputs?.coreIndicators?.nominalGDP,
    context.builderState.economicInputs?.coreIndicators?.gdpPerCapita,
    context.builderState.economicInputs?.laborEmployment?.unemploymentRate,
    context.builderState.economicInputs?.coreIndicators?.totalPopulation,
    context.builderState.economicInputs?.geography?.continent,
    context.builderState.economicInputs?.geography?.region,
    context.builderState.economicInputs?.flagUrl,
    filter.selectedTemplate,
    filter.setSelectedTemplate,
  ]);



  // Fine-grained selector subscribing only to the error count to minimize re-renders
  const errorCount = useToastQueueStore((s) => s.queue.filter((t) => t.type === "error").length);
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

  const countryName =
    context.builderState.economicInputs?.countryName ||
    filter.selectedTemplate?.name ||
    context.builderState.selectedCountry?.name ||
    "";

  const isFoundationStep = context.builderState.step === "foundation";

  const plugin = useMemo<DIPlugin<BuilderFilterState, BuilderContextValue>>(() => {
    return {
      id: "builder",
      priority: 20, // High priority to override mycountry/wiki default plugins
      center: (
        <BuilderCompactLabel
          step={context.builderState.step}
          countryName={countryName}
        />
      ),
      expandedViews: {
        builder: BuilderView as React.ComponentType<DIViewProps<BuilderFilterState, BuilderContextValue>>,
      },
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
        ...(!isFoundationStep ? [saveAction] : []),
      ],
      filter,
      context,
    };
  }, [
    context.builderState.step,
    countryName,
    hasError,
    errorCount,
    isFoundationStep,
    saveAction,
    filter,
    context,
  ]);

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
