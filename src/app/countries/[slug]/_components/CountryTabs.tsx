"use client";

import React from "react";
import { Eye, Activity, BookOpen } from "lucide-react";
import { FacetTabs } from "~/components/facet-ui";
import { getFlagColors } from "~/lib/flag-color-extractor";

export type TabType = "overview" | "lore" | "activity";

interface CountryTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  countryName?: string;
}

export function CountryTabs({ activeTab, onTabChange, countryName }: CountryTabsProps) {
  const flagColors = getFlagColors(countryName || "");

  const tabs = [
    {
      id: "overview",
      icon: Eye,
      label: "Factbook",
      themeColor: flagColors.primary,
    },
    {
      id: "lore",
      icon: BookOpen,
      label: "Dossier",
      themeColor: flagColors.secondary,
    },
    {
      id: "activity",
      icon: Activity,
      label: "Activity",
      themeColor: flagColors.accent,
    },
  ];

  return (
    <FacetTabs
      tabs={tabs}
      activeTab={activeTab}
      onChange={(tab) => onTabChange(tab as TabType)}
      tone="neutral"
      size="md"
      springPreset="fluid"
      className="facet-surface facet-refraction w-full min-w-fit rounded-xl border border-white/5"
    />
  );
}
