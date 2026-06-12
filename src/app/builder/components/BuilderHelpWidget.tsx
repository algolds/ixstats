// Builder Help Widget for Atomic Builder
"use client";

import React from "react";
import { BookOpen } from "lucide-react";
import { cn } from "~/lib/utils";
import { useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { type BuilderSection } from "../lib/builder-theme";
import { contextualHelp } from "../data/contextual-help";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { useBuilderFilter } from "./builder-filter-context";

interface BuilderHelpWidgetProps {
  activeSection: BuilderSection;
}

const SECTION_TITLES: Record<BuilderSection, string> = {
  foundation: "Getting Started",
  identity: "Identity",
  government: "Government",
  economics: "Economics",
  preview: "Preview",
  import: "Import",
};

export function BuilderHelpWidget({ activeSection }: BuilderHelpWidgetProps) {
  const { selectedTemplate } = useBuilderFilter();

  let steps = contextualHelp[activeSection] || contextualHelp.foundation;
  let sectionTitle = SECTION_TITLES[activeSection] || activeSection;

  if (activeSection === "foundation" && selectedTemplate) {
    sectionTitle = "Country Archetype";
    steps = [
      {
        title: "Choose Starting Model",
        description:
          "Select an archetype (e.g. Nordic, Silicon Valley, Soviet Command) to seed your nation's initial policies, tax structures, and starting modifiers.",
      },
      {
        title: "Check Alignment Profile",
        description:
          "Review how each archetype aligns with innovation and stability metrics to see how they fit your desired gameplay strategy.",
      },
      {
        title: "Review Traits & Modifiers",
        description:
          "Analyze starting traits that determine initial sector bonuses, public trust levels, and GDP growth potentials.",
      },
      {
        title: "Confirm or Skip",
        description:
          "Seed the chosen archetype structure or choose to skip to build from a blank slate. You can customize everything later.",
      },
    ];
  }

  return (
    <CutoutCard
      className={cn(cutoutCardSurfaceClassName, "w-56 overflow-hidden rounded-xl")}
      trackPointerHover={false}
      texture="dots"
      textureOpacity={0.06}
    >
      {/* Cutout tab header */}
      <div className="relative bg-blue-500/10 px-3 pt-2.5 pb-4">
        <div className="text-card-foreground flex items-center gap-1.5 text-xs font-bold">
          <BookOpen className="h-3.5 w-3.5 text-blue-400" />
          <span>
            {sectionTitle === "Getting Started" ? "Getting Started" : `${sectionTitle} Guide`}
          </span>
        </div>
        <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
        <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={16} />
      </div>

      <CutoutCardContent className="space-y-3 p-3 pt-1">
        <div className="space-y-3.5">
          {steps.map((step, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center gap-2">
                {activeSection !== "foundation" && (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 text-[9px] font-bold text-blue-400">
                    {index + 1}
                  </span>
                )}
                <span className="text-foreground text-[10px] font-bold">{step.title}</span>
              </div>
              <p
                className={cn(
                  "text-muted-foreground text-[9px] leading-normal",
                  activeSection === "foundation" ? "pl-0" : "pl-6"
                )}
              >
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </CutoutCardContent>
    </CutoutCard>
  );
}
